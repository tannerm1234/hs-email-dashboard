import { fetchInventory } from '../lib/hubspot';
import Table from './table';

export const revalidate = 0;

export default async function Page() {
  const { workflowsRows } = await fetchInventory();
  const cols = [
    ['workflow_name','Workflow'],
    ['workflow_status','Status'],
    ['active','Active'],
    ['last_updated','Updated'],
    ['email_action_count','Email actions in WF'],
    ['email_id','Example Email ID'],
  ];
  return (
    <main>
      <h1 style={{fontSize:'22px', marginBottom:'8px'}}>Workflows</h1>
      <div style={{display:'flex', gap:'12px', marginBottom:'12px'}}>
        <a href="/emails" style={{textDecoration:'underline'}}>View by Email</a>
        <a href="/api/refresh" style={{textDecoration:'underline'}}>Refresh now</a>
      </div>
      <Table
        rows={workflowsRows}
        columns={cols}
        searchKeys={['workflow_name','workflow_status']}
        showActiveToggle
      />
    </main>
  );
}
