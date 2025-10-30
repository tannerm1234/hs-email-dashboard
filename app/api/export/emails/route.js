import { fetchInventory } from '../../../../lib/hubspot';

export async function GET() {
  const { emailsRows } = await fetchInventory();
  const header = ["email_id","email_name","subject","status","ab_variant_key","folder_id","last_updated","used_in_workflows","last_30d_sends","last_30d_delivered","last_30d_opens","last_30d_clicks","last_30d_bounces","last_30d_unsubscribes","last_30d_spamReports","last_send_at"];
  const csv = [header.join(",")].concat(
    emailsRows.map(r => header.map(h => String(r[h] ?? '').replaceAll('"','""')).map(v => `"${v}"`).join(","))
  ).join("\n");
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="emails_by_usage_and_metrics.csv"'
    }
  });
}
