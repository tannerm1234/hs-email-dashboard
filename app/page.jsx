import { fetchInventory } from '../lib/hubspot';
import Table from './table';

export const revalidate = 1800; // 30 min

export default async function Page() {
  const { workflowsRows } = await fetchInventory();
  const cols = [
    ['workflow_name','Workflow'],
    ['workflow_status','Status'],
    ['active','Active'],
    ['last_updated','Updated'],
    ['action_type','Action Type'],
    ['branch_hint','Branch'],
    ['email_id','Email ID'],
      ['email_action_count','Email actions in this WF'],
  ];
  return (
    <main>
      <h1 style={{fontSize:'22px', marginBottom:'8px'}}>Workflows → Email Actions</h1>
      <div style={{display:'flex', gap:'12px', marginBottom:'12px'}}>
        <a href="/api/export/workflows" style={{textDecoration:'underline'}}>Download CSV</a>
        <a href="/emails" style={{textDecoration:'underline'}}>View by Email</a>
        <a href="/api/refresh" style={{textDecoration:'underline'}}>Refresh now</a>
      </div>
      <Table rows={workflowsRows} columns={cols} searchKeys={['workflow_name','action_type','email_id']} showActiveToggle />
    </main>
  );
}
