import { fetchInventory } from '../../lib/hubspot';
import Table from '../table';

export const revalidate = 1800;

export default async function EmailsPage() {
  const { emailsRows } = await fetchInventory();
  const cols = [
      ['used_in_workflow_names','Workflows (names)'],
      ['preview_url','Preview'],
      ['edit_url','Edit'],
    ['email_name','Email'],
    ['subject','Subject'],
    ['status','Status'],
    ['used_in_workflows','Used In'],
    ['last_30d_sends','Sends'],
    ['last_30d_opens','Opens'],
    ['last_30d_clicks','Clicks'],
    ['last_30d_bounces','Bounces'],
    ['last_send_at','Last Send'],
  ];
  return (
    <main>
      <h1 style={{fontSize:'22px', marginBottom:'8px'}}>Emails → Usage & 30d Metrics</h1>
      <div style={{display:'flex', gap:'12px', marginBottom:'12px'}}>
        <a href="/" style={{textDecoration:'underline'}}>View by Workflow</a>
        <a href="/api/export/emails" style={{textDecoration:'underline'}}>Download CSV</a>
        <a href="/api/refresh" style={{textDecoration:'underline'}}>Refresh now</a>
      </div>
      <Table rows={emailsRows} columns={cols} searchKeys={['email_name','subject']} />
    </main>
  );
}
