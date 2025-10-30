import { listWorkflows } from '../../../lib/hubspot';
export async function GET() {
  try {
    const wfs = await listWorkflows();
    return new Response(JSON.stringify({ ok:true, count:wfs.length, sample:wfs.slice(0,3) }, null, 2), { headers: { 'Content-Type': 'application/json' }});
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e) }, null, 2), { status:500, headers: { 'Content-Type': 'application/json' }});
  }
}
