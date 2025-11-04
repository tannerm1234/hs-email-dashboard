# Persistence Troubleshooting Guide

## Problem: Settings Not Saving

If your workflow order, notes, or email order are not persisting after page refresh, follow these steps:

## Step 1: Check Console Logs

1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Look for messages starting with `[Frontend]` or `[Settings]`
4. Check for any errors (red text)

### What to Look For:

**Good (Working):**
```
[Frontend] Saving settings: {...}
[Settings API] POST request received
[Settings] Saving to: /path/to/data/workflow-settings.json
[Settings] Successfully saved settings
[Frontend] Settings saved successfully
```

**Bad (Not Working):**
```
[Settings API] Error in POST: EACCES: permission denied
[Settings] Failed to create default file: ENOENT: no such file or directory
```

## Step 2: Verify File System Permissions

The app needs to write to the `/data` directory. Check:

### Option A: Manual Directory Creation
```bash
# From your project root
mkdir -p data
chmod 777 data
echo '{"workflowOrder":[],"workflowNotes":{},"emailOrders":{}}' > data/workflow-settings.json
chmod 666 data/workflow-settings.json
```

### Option B: Check Current Permissions
```bash
# From your project root
ls -la data/
# Should show read/write permissions
```

## Step 3: Check Server Logs

Look at your Next.js server console (where you ran `npm run dev`):

```
[Settings] Data directory exists: /path/to/project/data
[Settings API] POST request received
[Settings] Successfully saved settings
```

If you see errors here, the file system is not writable.

## Step 4: Alternative Solutions

### Solution 1: Use Environment Variable Storage

If file system isn't working, use a database or environment variables.

Create `.env.local`:
```bash
WORKFLOW_SETTINGS='{"workflowOrder":[],"workflowNotes":{},"emailOrders":{}}'
```

### Solution 2: Use a Database

For production, consider using:
- **Vercel KV** (if deploying to Vercel)
- **Upstash Redis** (free tier available)
- **MongoDB** (for more complex data)
- **PostgreSQL** with a simple key-value table

### Solution 3: Use a Cloud Storage Service

- **AWS S3** with a single JSON file
- **Google Cloud Storage**
- **Cloudinary** or similar

## Step 5: Quick Test

Run this test to see if file writing works:

```bash
# From project root
node -e "const fs = require('fs'); const path = require('path'); const dir = path.join(process.cwd(), 'data'); try { fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(path.join(dir, 'test.json'), '{}'); console.log('✓ File system is writable'); } catch(e) { console.error('✗ File system error:', e.message); }"
```

## Step 6: Verify API Endpoint

Test the API endpoint manually:

### Test GET:
```bash
curl http://localhost:3000/api/workflow-settings
```

Should return:
```json
{"workflowOrder":[],"workflowNotes":{},"emailOrders":{}}
```

### Test POST:
```bash
curl -X POST http://localhost:3000/api/workflow-settings \
  -H "Content-Type: application/json" \
  -d '{"workflowOrder":["Test Workflow"]}'
```

Should return:
```json
{"success":true,"settings":{...}}
```

Then test GET again to see if it persisted.

## Common Issues & Solutions

### Issue: "EACCES: permission denied"
**Solution:** Run `chmod 777 data` to give write permissions

### Issue: "ENOENT: no such file or directory"
**Solution:** Run `mkdir -p data` to create the directory

### Issue: File exists but changes don't persist
**Solution:** 
1. Check if file is being written: `cat data/workflow-settings.json`
2. Verify file permissions: `ls -la data/workflow-settings.json`
3. Check if process has write access

### Issue: Works locally but not in production
**Solution:** 
- Most hosting platforms have read-only file systems
- Use a database or cloud storage instead
- For Vercel: Use Vercel KV or Vercel Postgres
- For AWS: Use S3 or DynamoDB
- For other platforms: Use their recommended storage solution

## Production Deployment

For production, you MUST use a database or cloud storage, not the file system.

### Recommended: Vercel KV (Free Tier)

1. Install Vercel KV:
```bash
npm install @vercel/kv
```

2. Update `app/api/workflow-settings/route.ts`:
```typescript
import { kv } from '@vercel/kv';

export async function GET() {
  const settings = await kv.get('workflow-settings') || {
    workflowOrder: [],
    workflowNotes: {},
    emailOrders: {}
  };
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const current = await kv.get('workflow-settings') || {};
  const updated = { ...current, ...body };
  await kv.set('workflow-settings', updated);
  return NextResponse.json({ success: true, settings: updated });
}
```

3. Add to Vercel dashboard:
- Go to your project settings
- Storage → Create KV Database
- Environment variables will be added automatically

## Debugging Checklist

- [ ] Console shows "[Frontend] Saving settings"
- [ ] Console shows "[Settings API] POST request received"
- [ ] Console shows "[Settings] Successfully saved settings"
- [ ] Console shows "✓ Saved" in the UI
- [ ] No red error messages in console
- [ ] Server logs show successful write
- [ ] File exists: `data/workflow-settings.json`
- [ ] File is readable: `cat data/workflow-settings.json`
- [ ] File contains your data (not empty or defaults)
- [ ] Refresh page and check console for "[Frontend] Loaded settings"
- [ ] Settings are applied correctly after refresh

## Still Not Working?

1. **Check browser console** for exact error messages
2. **Check server console** for backend errors
3. **Verify file permissions** on the data directory
4. **Test API endpoints** manually with curl
5. **Consider using a database** for production

## Contact Support

If persistence still isn't working after following all steps:

1. Share console logs (both browser and server)
2. Share output of `ls -la data/`
3. Share output of the file system test command
4. Share your hosting environment (local, Vercel, AWS, etc.)
