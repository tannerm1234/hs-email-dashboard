import { getEmail } from '../../../../lib/emailHelpers';

export async function GET(_req, { params }) {
  const id = params.id;
  try {
    const { html } = await getCompiledHtml(id);
    return new Response(html || '<p>No HTML body found for this email.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }});
  } catch (e) {
    return new Response(`<pre>${String(e)}</pre>`, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' }});
  }
}

// local helpers so we don't export from main lib
import { hsGet } from '../../../../lib/privateHubspot';
async function getEmailMeta(eid) {
  return hsGet(`/marketing/v3/emails/${eid}`);
}
async function getCompiledHtml(eid) {
  const meta = await getEmailMeta(eid);
  const html = meta.htmlContent || meta.html || meta?.htmlPage?.body || '';
  return { html: typeof html === 'string' ? html : '' };
}
