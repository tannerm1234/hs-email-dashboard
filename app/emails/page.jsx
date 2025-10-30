import { fetchInventory } from '../../lib/hubspot';
import Table from '../table';

export const revalidate = 0;

export default async function EmailsPage() {
  const { emailsRows } = await fetchInventory();
  const cols = [
    ['email_name','Email'],
    ['subject','Subject'],
    ['used_in_workflow_names','Workflows (names)'],
    ['used_in_workflows','Used In'],
    ['preview_url','Preview'],
    ['edit_url','Edit'],
    ['html_endpoint','Body (HTML)'],
  ];
  return (
    <main>
      <h1 style={{fontSize:'22px', marginBottom:'8px'}}>Emails</h1>
      <div style={{display:'flex', gap:'12px', marginBottom:'12px'}}>
        <a href="/" style={{textDecoration:'underline'}}>View by Workflow</a>
        <a href="/api/refresh" style={{textDecoration:'underline'}}>Refresh now</a>
      </div>
      <Table rows={emailsRows} columns={cols} searchKeys={['email_name','subject','used_in_workflow_names']} />
    </main>
  );
}
