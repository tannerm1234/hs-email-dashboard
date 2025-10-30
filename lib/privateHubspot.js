import 'server-only';
const BASE = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_TOKEN;
if (!TOKEN) throw new Error('Missing HUBSPOT_TOKEN.');
export async function hsGet(url, params) {
  const qp = params ? `?${new URLSearchParams(params)}` : '';
  const r = await fetch(`${BASE}${url}${qp}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HubSpot GET ${url} ${r.status} ${t.slice(0,300)}`);
  }
  return r.json();
}
