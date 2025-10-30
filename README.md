# HubSpot Workflow Email Inventory (Simple Dashboard)

One-folder Next.js app. Read-only. Shows:
- Workflows -> email actions (all branches)
- Emails -> 30-day metrics + "used in" count
- CSV exports

## Deploy to Vercel (easiest)
1. Create a new GitHub repo and upload this folder, or drag-drop in Vercel's "New Project".
2. In Vercel Project Settings > Environment Variables, add:
   - `HUBSPOT_TOKEN` = your HubSpot Private App token (read-only scopes for automation + marketing email)
3. Deploy. Visit the app URL.
   - Home = by Workflow
   - /emails = by Email
   - /api/export/workflows and /api/export/emails for CSVs

## Run locally
- `npm install`
- Create `.env.local` with `HUBSPOT_TOKEN=...`
- `npm run dev` and open http://localhost:3000

## Notes
- v1 excludes Sales Sequences.
- "Refresh now" endpoint simply forces a rebuild on Vercel; pages use server-side fetch on each request here.
- This is read-only. No write scopes needed.
