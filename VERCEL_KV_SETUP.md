# Vercel KV Setup Guide - REQUIRED FOR PRODUCTION

## Why You Need This

Your app is deployed on Vercel, which has a **read-only file system**. The current file-based persistence won't work. You **must** use Vercel KV (key-value database) instead.

## Step 1: Install Vercel KV

```bash
npm install @vercel/kv
```

## Step 2: Replace the API Route

Replace the content of `app/api/workflow-settings/route.ts` with the content from `route-vercel-kv.ts`:

```bash
# From your project root
cp app/api/workflow-settings/route-vercel-kv.ts app/api/workflow-settings/route.ts
```

Or manually copy the content.

## Step 3: Add Vercel KV to Your Project

### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **"Storage"** tab
4. Click **"Create Database"**
5. Select **"KV"** (Key-Value)
6. Click **"Create"**
7. Name it something like "workflow-settings"
8. Environment variables will be added automatically

### Option B: Via Vercel CLI

```bash
vercel link
vercel env pull .env.local
```

## Step 4: Redeploy

```bash
git add .
git commit -m "Add Vercel KV for persistence"
git push
```

Or click "Redeploy" in Vercel dashboard.

## Step 5: Verify It Works

1. Visit your deployed site
2. Open browser console (F12)
3. Try reordering a workflow
4. Look for:
   ```
   [Settings] Saving to Vercel KV
   [Settings] Successfully saved settings
   ```
5. Refresh the page
6. Workflow should stay in new position

## What Vercel KV Does

- **Stores data persistently** in Redis-compatible database
- **Free tier**: 30,000 commands/month
- **Fast**: Sub-millisecond latency
- **Automatic**: No setup beyond adding to project
- **Shared**: All users see the same data

## Updated Files

The route-vercel-kv.ts file includes:
- ✅ Email sequence number persistence
- ✅ Workflow order persistence
- ✅ Notes persistence
- ✅ Email order persistence
- ✅ Better error handling
- ✅ Console logging

## Data Structure

Vercel KV stores a single object with key `workflow-settings`:

```json
{
  "workflowOrder": ["Workflow A", "Workflow B"],
  "workflowNotes": {
    "Workflow A": "Important notes here"
  },
  "emailOrders": {
    "Workflow A": ["email-id-1", "email-id-2"]
  },
  "emailSequences": {
    "Workflow A": {
      "email-id-1": 1,
      "email-id-2": 2
    }
  }
}
```

## Troubleshooting

### "kv is not defined"
**Solution:** Make sure you ran `npm install @vercel/kv`

### "KV_REST_API_URL is not defined"
**Solution:** 
1. Go to Vercel dashboard
2. Storage → Create KV Database
3. Redeploy your app

### Still getting 500 errors
**Solution:**
1. Check Vercel logs: Dashboard → Deployments → Click deployment → Functions
2. Look for detailed error message
3. Make sure environment variables are set

## Cost

Vercel KV is **FREE** for your usage:
- Free tier: 30,000 commands/month
- Your app uses ~3-5 commands per save
- Even with 100 users making changes, you'll stay well within limits

## Alternative: If You Don't Want to Use Vercel KV

If you don't want to use Vercel KV, you can use:

### Option 1: Upstash Redis (Works Anywhere)
```bash
npm install @upstash/redis
```

Sign up at https://upstash.com (free tier)

### Option 2: MongoDB
```bash
npm install mongodb
```

Use MongoDB Atlas (free tier)

### Option 3: PostgreSQL
```bash
npm install @vercel/postgres
```

Use Vercel Postgres

But Vercel KV is the simplest and recommended solution.

## Summary

1. ✅ Install: `npm install @vercel/kv`
2. ✅ Replace: Copy route-vercel-kv.ts to route.ts
3. ✅ Add Storage: Create KV database in Vercel dashboard
4. ✅ Deploy: `git push`
5. ✅ Test: Reorder workflow, refresh, verify it persists

That's it! Your persistence will work perfectly after this.
