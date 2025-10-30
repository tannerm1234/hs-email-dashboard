import { fetchInventory } from '../../../../lib/hubspot';

export async function GET() {
  const { workflowsRows } = await fetchInventory();
  const header = ["workflow_id","workflow_name","workflow_status","active","folder_id","last_updated","action_id","action_type","branch_hint","email_id"];
  const csv = [header.join(",")].concat(
    workflowsRows.map(r => header.map(h => String(r[h] ?? '').replaceAll('"','""')).map(v => `"${v}"`).join(","))
  ).join("\n");
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="workflows_inventory.csv"'
    }
  });
}
