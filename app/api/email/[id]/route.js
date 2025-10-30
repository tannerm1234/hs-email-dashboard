
import 'server-only';

const BASE = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_TOKEN;

async function hsGet(url) {
  const r = await fetch(`${BASE}${url}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HubSpot GET ${url} ${r.status} ${t.slice(0,300)}`);
  }
  return r.json();
}

export async function GET(_req, { params }) {
  const id = params.id;
  try {
    const meta = await hsGet(`/marketing/v3/emails/${id}`);
    const html = meta.htmlContent || meta.html || (meta?.htmlPage && meta.htmlPage.body) || '';
    const body = typeof html === 'string' ? html : '';
    return new Response(body || '<p>No HTML body found for this email.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (e) {
    return new Response(`<pre>${String(e)}</pre>`, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' }});
  }
}
