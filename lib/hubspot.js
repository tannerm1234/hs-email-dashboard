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

async function paginate(url, rootKey, baseParams = {}) {
  let after = undefined;
  const out = [];
  while (true) {
    const params = { ...baseParams };
    if (after) params.after = after;
    const data = await hsGet(url, Object.keys(params).length ? params : undefined);
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
  return paginate('/automation/v4/flows', undefined, { limit: '100' });
}

export async function getWorkflowDetail(id) {
  const data = await hsGet(`/automation/v4/flows/${id}`);
  await sleep(BETWEEN_CALLS_MS);
  return data;
}

async function listMarketingEmailsAll() {
  return paginate('/marketing/v3/emails'); // rootKey defaults to results
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

// Forgiving email id finder
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

  // Deep scan any "*email*id*" numeric, OR nested {id: N} inside an object whose key includes "email"
  const stack = [{ key:'root', val: node }];
  while (stack.length) {
    const { key: parentKey, val } = stack.pop();
    if (!val || typeof val !== 'object') continue;
    for (const [k, v] of Object.entries(val)) {
      if (v && typeof v === 'object') stack.push({ key: k, val: v });
      const keyLower = String(k).toLowerCase();
      if (keyLower.includes('email') && keyLower.includes('id')) addIfId(v);
      // pattern: selectedMarketingEmail: { id: 123 }
      if (String(parentKey).toLowerCase().includes('email') && k === 'id') addIfId(v);
    }
  }

  // If the action looks like sending an email and has a generic content id
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
  const workflowRowsAll = [];
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

    workflowActionCount[String(id)] = emailActionsFound;
    // Always include a workflow row so the table shows the workflow even if 0 email actions
    workflowRowsAll.push({
      workflow_id: id,
      workflow_name: name,
      workflow_status: status,
      active,
      folder_id,
      last_updated,
      action_id: '', action_type: '', branch_hint: '',
      email_id: '',
      email_action_count: emailActionsFound
    });
  }

  // Use detailed rows if you want per-action; for primary table show all workflows with counts
  const workflowsRows = workflowRowsAll;

  // Build Email-level rows WITHOUT stats; list all marketing emails so the table always has content
  let allEmails = [];
  try { allEmails = await listMarketingEmailsAll(); } catch (e) { console.warn('List marketing emails error', e); }

  const emailsRows = [];
  for (const em of allEmails) {
    const eid = String(em.id ?? em.emailId ?? '').trim();
    if (!/^\d+$/.test(eid)) continue;
    const name = em.name ?? '';
    const subject = em.subject ?? '';

    const preview_url = PORTAL_ID ? `https://app.hubspot.com/email/${PORTAL_ID}/manage/${eid}` : '';
    const edit_url = PORTAL_ID ? `https://app.hubspot.com/email/${PORTAL_ID}/edit/${eid}/content` : '';

    emailsRows.push({
      email_id: eid,
      email_name: name,
      subject,
      used_in_workflows: (emailToWorkflows[eid]?.size ?? 0),
      used_in_workflow_names: Array.from(emailToWorkflowNames[eid] ?? []),
      preview_url,
      edit_url,
      html_endpoint: `/api/email/${eid}`
    });
  }

  return { workflowsRows, emailsRows };
}
