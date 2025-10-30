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

## API limits
If you hit 429s on HubSpot:
- In Vercel > Settings > Environment Variables, add:
  - `API_DELAY_MS` = 250 (or 500)
  - `MAX_WORKFLOWS` = 150 (to cap detail fetch on first load)
- Redeploy, then visit `/api/debug` to confirm counts.

- Optional: `HUBSPOT_PORTAL_ID` to enable Edit/Preview links.
