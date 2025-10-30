import 'server-only';

const BASE = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_TOKEN;

if (!TOKEN) {
  throw new Error('Missing HUBSPOT_TOKEN. Set it in your environment or Vercel Project Settings > Environment Variables.');
}

async function hsGet(url, params) {
  const qp = params ? `?${new URLSearchParams(params)}` : '';
  const r = await fetch(`${BASE}${url}${qp}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`HubSpot GET ${url} ${r.status} ${text.slice(0,400)}`);
  }
  return r.json();
}

async function paginate(url, rootKey) {
  let after = undefined;
  const out = [];
  while (true) {
    const data = await hsGet(url, after ? { after } : undefined);
    const chunk = (data[rootKey ?? 'results'] ?? data.results ?? []);
    out.push(...chunk);
    after = data?.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

export async function listWorkflows() {
  return paginate('/automation/v3/workflows', 'workflows');
}

export async function getWorkflowDetail(id) {
  return hsGet(`/automation/v3/workflows/${id}`);
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

function extractEmailRefs(node) {
  const refs = new Set();
  const t = String(node?.type || node?.actionType || '').toLowerCase();
  const props = node?.properties || node?.input || {};
  for (const k of ['emailId','marketingEmailId','marketing-email-id','email-id']) {
    if (node?.[k]) refs.add(String(node[k]));
    if (props?.[k]) refs.add(String(props[k]));
  }
  if (t.includes('send') && t.includes('email')) {
    const pairs = Object.entries(props).concat(Object.entries(node));
    for (const [k,v] of pairs) {
      if (String(k).toLowerCase().includes('email')) {
        const s = String(v ?? '').trim();
        if (/^\d+$/.test(s)) refs.add(s);
      }
    }
  }
  return [...refs];
}

async function getEmail(eid) {
  return hsGet(`/marketing/v3/emails/${eid}`);
}

async function get30dStats() {
  const end = new Date();
  const start = new Date(end.getTime() - 30*24*3600*1000);
  const data = await hsGet('/marketing/v3/emails/statistics/list', { start: start.toISOString(), end: end.toISOString() });
  const map = {};
  for (const row of (data?.results ?? [])) map[String(row.emailId)] = row.stats ?? {};
  return map;
}

export async function fetchInventory() {
  const workflows = await listWorkflows();
  const wfRows = [];
  const emailToWorkflows = {};

  for (const wf of workflows) {
    const id = wf.id || wf.workflowId;
    if (!id) continue;
    const detail = await getWorkflowDetail(id);
    const name = detail.name ?? wf.name ?? '';
    const status = detail.status ?? wf.status ?? '';
    const active = detail.enabled ?? detail.active ?? false;
    const folder_id = detail.folderId ?? detail.parentFolderId ?? '';
    const last_updated = detail.updatedAt ?? detail.updated ?? detail.lastUpdatedAt ?? '';

    for (const node of flattenActions(detail)) {
      const action_id = node.id || node.actionId || '';
      const action_type = node.type || node.actionType || '';
      const branch_hint = node.label || node.name || '';
      const refs = extractEmailRefs(node);

      if (!refs.length) {
        wfRows.push({ workflow_id: id, workflow_name: name, workflow_status: status, active, folder_id, last_updated, action_id, action_type, branch_hint, email_id: '' });
        continue;
      }
      for (const eid of refs) {
        wfRows.push({ workflow_id: id, workflow_name: name, workflow_status: status, active, folder_id, last_updated, action_id, action_type, branch_hint, email_id: eid });
        (emailToWorkflows[eid] ??= new Set()).add(String(id));
      }
    }
  }

  const emailIds = Object.keys(emailToWorkflows).filter(x => /^\d+$/.test(x));
  const stats30d = await get30dStats();

  const emailsRows = [];
  for (const eid of emailIds) {
    let meta = {};
    try { meta = await getEmail(eid); } catch {}
    const st = stats30d[eid] ?? {};
    emailsRows.push({
      email_id: eid,
      email_name: meta.name ?? '',
      subject: meta.subject ?? '',
      status: meta.status ?? meta.archivedStatus ?? '',
      ab_variant_key: meta.abTestId ?? meta.abVariantKey ?? '',
      folder_id: meta.folderId ?? '',
      last_updated: meta.updatedAt ?? meta.updated ?? meta.lastUpdatedAt ?? '',
      used_in_workflows: (emailToWorkflows[eid]?.size ?? 0),
      last_30d_sends: st.sent ?? st.sends ?? 0,
      last_30d_delivered: st.delivered ?? 0,
      last_30d_opens: st.opens ?? st.uniqueOpens ?? 0,
      last_30d_clicks: st.clicks ?? st.uniqueClicks ?? 0,
      last_30d_bounces: st.bounces ?? 0,
      last_30d_unsubscribes: st.unsubscribes ?? 0,
      last_30d_spamReports: st.spamReports ?? 0,
      last_send_at: st.lastSendTs ?? st.lastProcessedAt ?? '',
    });
  }

  return { workflowsRows: wfRows, emailsRows };
}
