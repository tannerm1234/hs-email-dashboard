import { revalidatePath } from 'next/cache';
export const dynamic = 'force-dynamic';
export async function GET() {
  revalidatePath('/');
  revalidatePath('/emails');
  return new Response(JSON.stringify({ ok: true, revalidated: true, at: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json' }});
}
