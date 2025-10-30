import { fetchInventory } from '../../../lib/hubspot';
export async function GET() {
  try {
    const { workflowsRows, emailsRows } = await fetchInventory();
    const wfIds = new Set(workflowsRows.map(r=>String(r.workflow_id)));
    return new Response(JSON.stringify({
      ok: true,
      workflows_with_email_actions: wfIds.size,
      workflow_action_rows: workflowsRows.length,
      unique_emails: new Set(emailsRows.map(r=>r.email_id)).size,
      sample_workflow_rows: workflowsRows.slice(0,5),
      sample_emails: emailsRows.slice(0,5)
    }, null, 2), { headers: { 'Content-Type': 'application/json' }});
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e) }, null, 2), { status:500, headers: { 'Content-Type': 'application/json' }});
  }
}
