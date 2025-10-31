# 🚀 QUICK START GUIDE

## Copy/Paste to GitHub - Follow These Steps EXACTLY:

### Step 1: Download All Files
Download the entire `hubspot-dashboard` folder.

### Step 2: Push to GitHub
```bash
cd hubspot-dashboard
git init
git add .
git commit -m "Initial commit: HubSpot Email Dashboard"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 3: Deploy to Vercel
1. Go to vercel.com and sign in
2. Click "New Project"
3. Import your GitHub repository
4. **BEFORE deploying**, add these Environment Variables:
   - `HUBSPOT_TOKEN` = your HubSpot private app token
   - `HUBSPOT_PORTAL_ID` = your portal ID (6885872 based on your setup)
   - `MAX_WORKFLOWS` = 25
   - `API_DELAY_MS` = 250
5. Click "Deploy"

### Step 4: Get Your HubSpot Token
1. Go to HubSpot → Settings → Integrations → Private Apps
2. Create a new private app (or use existing)
3. **CRITICAL:** Enable the `automation` scope in the Scopes tab
4. Save and copy the access token
5. Add this token to Vercel environment variables as `HUBSPOT_TOKEN`
6. **MUST REDEPLOY** after adding the token

### Step 5: Test It!
1. After deployment, go to: `https://your-app.vercel.app/debug`
2. Click "Test API Call"
3. Look at the logs to see if it's working
4. If successful, go to `https://your-app.vercel.app` for the full dashboard

## ❌ If Nothing Shows Up:

### First: Check /debug page
Visit `/debug` and click "Test API Call". The logs will tell you exactly what's wrong.

### Most Common Issues:

**1. "HUBSPOT_TOKEN is not set"**
- Go to Vercel → Your Project → Settings → Environment Variables
- Add `HUBSPOT_TOKEN` with your private app token
- **REDEPLOY** (this is critical!)

**2. "401 Unauthorized"**
- Your token is wrong or expired
- Regenerate in HubSpot
- Update in Vercel
- Redeploy

**3. "403 Forbidden"**  
- Your private app doesn't have `automation` scope
- Edit your private app in HubSpot
- Enable `automation` scope
- Get new token
- Update in Vercel
- Redeploy

**4. "No workflows found"**
- Check if you have workflows in HubSpot
- Try increasing `MAX_WORKFLOWS` to 50
- Make sure workflows have marketing email actions

## 📁 What's Included:

- ✅ Complete Next.js app
- ✅ Main dashboard (`/`)
- ✅ Debug page (`/debug`)
- ✅ API route (`/api/dashboard`)
- ✅ Full README with troubleshooting
- ✅ Environment variable examples
- ✅ TypeScript types
- ✅ All configuration files

## 🎯 Files You Need:

ALL OF THEM! The structure is:
```
hubspot-dashboard/
├── .env.local.example
├── .gitignore
├── README.md
├── STRUCTURE.txt
├── next.config.js
├── package.json
├── tsconfig.json
├── types.ts
└── app/
    ├── api/dashboard/route.ts
    ├── debug/page.tsx
    ├── globals.css
    ├── layout.tsx
    └── page.tsx
```

Copy the ENTIRE folder to GitHub.

## 🔍 Debugging Checklist:

- [ ] All files copied to GitHub
- [ ] Repository imported to Vercel
- [ ] `HUBSPOT_TOKEN` set in Vercel environment variables
- [ ] `HUBSPOT_PORTAL_ID` set in Vercel environment variables
- [ ] Redeployed after adding environment variables
- [ ] HubSpot private app has `automation` scope
- [ ] Token is valid (not expired)
- [ ] Tested `/debug` page
- [ ] Checked Vercel logs
- [ ] Checked browser console (F12)

## Need More Help?

Read the full README.md included in the folder for comprehensive troubleshooting!
