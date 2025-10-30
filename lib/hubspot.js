import 'server-only';

const BASE = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_TOKEN;
const PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '';
const MAX_WORKFLOWS = parseInt(process.env.MAX_WORKFLOWS || '0', 10); // 0 = no cap
const BETWEEN_CALLS_MS = parseInt(process.env.API_DELAY_MS || '250', 10);

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

// Public helpers
export async function listWorkflows() {
  return paginate('/automation/v3/workflows', 'workflows');
}

export async function getWorkflowDetail(id) {
  const data = await hsGet(`/automation/v3/workflows/${id}`);
  await sleep(BETWEEN_CALLS_MS);
  return data;
}

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

// Very forgiving email id finder
function extractEmailRefs(node) {
  const refs = new Set();
  const t = String(node?.type || node?.actionType || '').toLowerCase();
  const shallow = node?.properties || node?.input || {};

  const addIfId = (val) => {
    if (val == null) return;
    const s = String(val).trim();
    if (/^\d+$/.test(s)) refs.add(s);
  };

  // Known keys
  for (const k of ['emailId','marketingEmailId','marketing-email-id','email-id','contentId','email_id','marketing_email_id']) {
    if (node && k in node) addIfId(node[k]);
    if (shallow && k in shallow) addIfId(shallow[k]);
  }

  // Deep scan any "*email*id*" numeric
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    for (const [k, v] of Object.entries(cur)) {
      if (v && typeof v === 'object') stack.push(v);
      const key = String(k).toLowerCase();
      if (key.includes('email') && key.includes('id')) addIfId(v);
    }
  }

  // If the action looks like sending an email and has a generic content id/name pair
  if ((t.includes('send') && t.includes('email')) && shallow?.contentId) addIfId(shallow.contentId);

  return [...refs];
}

async function getEmail(eid) {
  const data = await hsGet(`/marketing/v3/emails/${eid}`);
  await sleep(BETWEEN_CALLS_MS);
  return data;
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

  // Only workflows with at least one email action
  const workflowsRows = wfActionRows.map(r => ({ ...r, email_action_count: workflowActionCount[String(r.workflow_id)] || 0 }));

  // Build Email-level rows WITHOUT calling stats
  const emailIds = Object.keys(emailToWorkflows).filter(x => /^\d+$/.test(x));

  const emailsRows = [];
  for (const eid of emailIds) {
    let meta = {};
    try { meta = await getEmail(eid); } catch (e) { console.warn('Email meta error', eid, e); }
    const preview_url = PORTAL_ID ? `https://app.hubspot.com/email/${PORTAL_ID}/manage/${eid}` : '';
    const edit_url = PORTAL_ID ? `https://app.hubspot.com/email/${PORTAL_ID}/edit/${eid}/content` : '';

    emailsRows.push({
      email_id: eid,
      email_name: meta.name ?? '',
      subject: meta.subject ?? '',
      used_in_workflows: (emailToWorkflows[eid]?.size ?? 0),
      used_in_workflow_names: Array.from(emailToWorkflowNames[eid] ?? []),
      preview_url,
      edit_url,
      html_endpoint: `/api/email/${eid}`
    });
  }

  return { workflowsRows, emailsRows };
}
