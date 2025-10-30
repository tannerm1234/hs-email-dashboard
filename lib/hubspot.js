import 'server-only';

const BASE = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_TOKEN;
const PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '';
const MAX_WORKFLOWS = parseInt(process.env.MAX_WORKFLOWS || '0', 10); // 0 = no cap
const BETWEEN_CALLS_MS = parseInt(process.env.API_DELAY_MS || '400', 10); // gentle default

if (!TOKEN) {
  throw new Error('Missing HUBSPOT_TOKEN.');
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function hsGet(url, params, retries = 6) {
  const qp = params ? `?${new URLSearchParams(params)}` : '';
  const r = await fetch(`${BASE}${url}${qp}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (r.status === 429 && retries > 0) {
    const retryAfter = parseInt(r.headers.get('Retry-After') || '2', 10);
    await sleep((retryAfter + 1) * 1000);
    return hsGet(url, params, retries - 1);
  }

  const text = await r.text();
  if (!r.ok) {
    // Soft-fail stats endpoint if scopes/plan missing
    if (url.startsWith('/marketing/v3/emails/statistics/list')) {
      console.warn('Stats endpoint unavailable or invalid params. Proceeding without metrics. Details:', r.status, text.slice(0,300));
      return { results: [] };
    }
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 400) }; }
    throw new Error(`HubSpot GET ${url} ${r.status} ${r.statusText} :: ${JSON.stringify(body)}`);
  }
  try { return JSON.parse(text); } catch (e) {
    throw new Error(`JSON parse error from ${url}: ${String(e)} :: ${text.slice(0, 200)}`);
  }
}

async function paginate(url, rootKey) {
  let after = undefined;
  const out = [];
  while (true) {
    const data = await hsGet(url, after ? { after } : undefined);
    const chunk = (data[rootKey ?? 'results'] ?? data.results ?? []);
    if (!Array.isArray(chunk)) break;
    out.push(...chunk);
    after = data?.paging?.next?.after;
    if (!after) break;
    await sleep(BETWEEN_CALLS_MS);
    if (MAX_WORKFLOWS && out.length >= MAX_WORKFLOWS) break;
  }
  return out.slice(0, MAX_WORKFLOWS || out.length);
}

// Public helpers used by pages
export async function listWorkflows() {
  return paginate('/automation/v3/workflows', 'workflows');
}

export async function getWorkflowDetail(id) {
  const data = await hsGet(`/automation/v3/workflows/${id}`);
  await sleep(BETWEEN_CALLS_MS);
  return data;
}

// Internal helpers
function flattenActions(detail) {
  const q = Array.isArray(detail.actions) ? [...detail.actions] : [];
  const out = [];
  while (q.length) {
    const node = q.shift();
    out.push(node);
    for (const k of ['children','branchActions','actions','branches','ifElseBranches']) {
      const val = node?.[k];
      if (Array.isArray(val)) q.push(...val);
      else if (val && typeof val === 'object' && Array.isArray(val.actions)) q.push(...val.actions);
    }
  }
  return out;
}

function extractEmailRefs(node) {
  const refs = new Set();
  const t = String(node?.type || node?.actionType || '').toLowerCase();
  const shallow = node?.properties || node?.input || {};

  // Common direct keys
  for (const k of ['emailId','marketingEmailId','marketing-email-id','email-id','contentId']) {
    if (node?.[k]) refs.add(String(node[k]));
    if (shallow?.[k]) refs.add(String(shallow[k]));
  }

  // Deep scan: any key containing "email" and "id" with a numeric value
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    for (const [k, v] of Object.entries(cur)) {
      if (v && typeof v === 'object') stack.push(v);
      const key = String(k).toLowerCase();
      if (key.includes('email') && key.includes('id')) {
        const s = String(v ?? '').trim();
        if (/^\d+$/.test(s)) refs.add(s);
      }
    }
  }

  // Some actions mark contentId generically when type implies email
  if (t.includes('email') && shallow?.contentId && /^\d+$/.test(String(shallow.contentId))) {
    refs.add(String(shallow.contentId));
  }

  return [...refs];
}

async function getEmail(eid) {
  const data = await hsGet(`/marketing/v3/emails/${eid}`);
  await sleep(BETWEEN_CALLS_MS);
  return data;
}

async function get30dStats() {
  // Use ISO8601; if unsupported, we soft-fail above and return {}
  const end = new Date();
  const start = new Date(end.getTime() - 30*24*3600*1000);
  const params = { start: start.toISOString(), end: end.toISOString() };
  try {
    const data = await hsGet('/marketing/v3/emails/statistics/list', params);
    const map = {};
    for (const row of (data?.results ?? [])) map[String(row.emailId)] = row.stats ?? {};
    return map;
  } catch (e) {
    console.warn('30d stats error (soft-fail):', e);
    return {};
  }
}

export async function fetchInventory() {
  const workflows = await listWorkflows();

  const wfActionRows = [];
  const emailToWorkflows = {};
  const emailToWorkflowNames = {};
  const workflowActionCount = {};

  for (const wf of workflows) {
    const id = wf.id || wf.workflowId;
    if (!id) continue;
    let detail;
    try {
      detail = await getWorkflowDetail(id);
    } catch (e) {
      console.warn('Workflow detail error', id, e);
      continue;
    }
    const name = detail.name ?? wf.name ?? '';
    const status = detail.status ?? wf.status ?? '';
    const active = detail.enabled ?? detail.active ?? false;
    const folder_id = detail.folderId ?? detail.parentFolderId ?? '';
    const last_updated = detail.updatedAt ?? detail.updated ?? detail.lastUpdatedAt ?? '';

    let emailActionsFound = 0;
    for (const node of flattenActions(detail)) {
      const action_id = node.id || node.actionId || '';
      const action_type = node.type || node.actionType || '';
      const branch_hint = node.label || node.name || '';
      const refs = extractEmailRefs(node);

      if (refs.length) {
        for (const eid of refs) {
          wfActionRows.push({ workflow_id: id, workflow_name: name, workflow_status: status, active, folder_id, last_updated, action_id, action_type, branch_hint, email_id: eid });
          (emailToWorkflows[eid] ??= new Set()).add(String(id));
          (emailToWorkflowNames[eid] ??= new Set()).add(String(name));
          emailActionsFound++;
        }
      }
    }
    if (emailActionsFound > 0) {
      workflowActionCount[String(id)] = (workflowActionCount[String(id)] || 0) + emailActionsFound;
    }
  }

  // Final workflow rows with per-workflow action count
  const workflowsRows = wfActionRows.map(r => ({ ...r, email_action_count: workflowActionCount[String(r.workflow_id)] || 0 }));

  // Email-level summary rows
  const emailIds = Object.keys(emailToWorkflows).filter(x => /^\d+$/.test(x));
  const stats30d = await get30dStats();

  const emailsRows = [];
  for (const eid of emailIds) {
    let meta = {};
    try { meta = await getEmail(eid); } catch (e) { console.warn('Email meta error', eid, e); }
    const st = stats30d[eid] ?? {};

    const preview_url = PORTAL_ID ? `https://app.hubspot.com/email/${PORTAL_ID}/manage/${eid}` : '';
    const edit_url = PORTAL_ID ? `https://app.hubspot.com/email/${PORTAL_ID}/edit/${eid}/content` : '';

    emailsRows.push({
      email_id: eid,
      email_name: meta.name ?? '',
      subject: meta.subject ?? '',
      status: meta.status ?? meta.archivedStatus ?? '',
      ab_variant_key: meta.abTestId ?? meta.abVariantKey ?? '',
      folder_id: meta.folderId ?? '',
      last_updated: meta.updatedAt ?? meta.updated ?? meta.lastUpdatedAt ?? '',
      used_in_workflows: (emailToWorkflows[eid]?.size ?? 0),
      used_in_workflow_names: Array.from(emailToWorkflowNames[eid] ?? []),
      last_30d_sends: st.sent ?? st.sends ?? 0,
      last_30d_delivered: st.delivered ?? 0,
      last_30d_opens: st.opens ?? st.uniqueOpens ?? 0,
      last_30d_clicks: st.clicks ?? st.uniqueClicks ?? 0,
      last_30d_bounces: st.bounces ?? 0,
      last_30d_unsubscribes: st.unsubscribes ?? 0,
      last_30d_spamReports: st.spamReports ?? 0,
      last_send_at: st.lastSendTs ?? st.lastProcessedAt ?? '',
      preview_url,
      edit_url,
    });
  }

  return { workflowsRows, emailsRows };
}
