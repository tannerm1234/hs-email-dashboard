# HubSpot Email Dashboard

A Next.js dashboard to view and manage automated marketing emails from HubSpot workflows.

## Features

- 📊 View all workflows with marketing email actions
- 📧 See all marketing emails used in workflows
- 🔗 Direct links to preview and edit emails in HubSpot
- 📈 7-day enrollment statistics
- 🔍 Email body preview
- 🐛 Built-in debug page for troubleshooting

## Prerequisites

- Node.js 18+ installed
- A HubSpot account with Marketing Hub or Operations Hub
- A HubSpot Private App with `automation` scope

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd hubspot-email-dashboard
npm install
```

### 2. Create HubSpot Private App

1. Go to HubSpot Settings → Integrations → Private Apps
2. Click "Create a private app"
3. Give it a name (e.g., "Email Dashboard")
4. Go to the "Scopes" tab
5. **CRITICAL:** Enable the `automation` scope
6. Click "Create app"
7. Copy the access token (you'll need this next)

### 3. Configure Environment Variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your values:

```env
HUBSPOT_TOKEN=your_hubspot_private_app_token_here
HUBSPOT_PORTAL_ID=your_portal_id_here
MAX_WORKFLOWS=25
API_DELAY_MS=250
```

**How to find your Portal ID:**
- Log into HubSpot
- Look at the URL: `https://app.hubspot.com/contacts/{PORTAL_ID}/contacts`
- The number after `/contacts/` is your Portal ID

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Test with Debug Page

Visit [http://localhost:3000/debug](http://localhost:3000/debug) to test the API and see detailed logs.

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Add Environment Variables:
   - `HUBSPOT_TOKEN`
   - `HUBSPOT_PORTAL_ID`
   - `MAX_WORKFLOWS` (optional, defaults to 25)
   - `API_DELAY_MS` (optional, defaults to 250)
5. Click "Deploy"

### 3. Test Your Deployment

After deployment:
1. Visit `https://your-app.vercel.app/debug`
2. Click "Test API Call"
3. Check if data loads correctly

## Troubleshooting

### Nothing Shows Up?

**Use the debug page first:** Visit `/debug` and click "Test API Call"

### Common Issues:

#### 1. "HUBSPOT_TOKEN environment variable is not set"

**Fix:**
- Vercel: Go to Project Settings → Environment Variables → Add `HUBSPOT_TOKEN`
- Local: Make sure `.env.local` exists with the token
- **IMPORTANT:** After adding env vars in Vercel, you MUST redeploy

#### 2. "401 Unauthorized"

**Fix:**
- Your token is invalid or expired
- Regenerate the token in HubSpot
- Make sure you copied the full token
- Update in Vercel environment variables
- Redeploy

#### 3. "403 Forbidden"

**Fix:**
- Your private app doesn't have the `automation` scope
- Go to HubSpot → Settings → Integrations → Private Apps
- Edit your app → Scopes tab
- Enable `automation` scope
- Get the new token
- Update environment variables

#### 4. "No workflows found"

**Possible causes:**
- You don't have any workflows in HubSpot
- Workflows don't have marketing email actions
- Try increasing `MAX_WORKFLOWS` if you have many workflows

#### 5. API Timeout

**Fix:**
- Reduce `MAX_WORKFLOWS` to 10
- Increase `API_DELAY_MS` to 500
- You might be hitting rate limits

### Check Vercel Logs

1. Go to your Vercel project dashboard
2. Click on your deployment
3. Click "Functions" tab
4. Click on `/api/dashboard`
5. See the logs

### Check Browser Console

1. Press F12 in your browser
2. Go to Console tab
3. Look for errors
4. Go to Network tab
5. Find the `/api/dashboard` request
6. Check the response

## Project Structure

```
hubspot-email-dashboard/
├── app/
│   ├── api/
│   │   └── dashboard/
│   │       └── route.ts          # Main API endpoint
│   ├── debug/
│   │   └── page.tsx              # Debug page for testing
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main dashboard page
├── .env.local.example            # Example environment variables
├── .gitignore
├── next.config.js
├── package.json
├── README.md
├── tsconfig.json
└── types.ts                      # TypeScript types
```

## How It Works

1. **Fetches all workflows** from HubSpot using the v4 Automation API
2. **For each workflow**, checks for email campaigns using the `/email-campaigns` endpoint
3. **Fetches email details** for all unique emails found
4. **Gets enrollment stats** for the last 7 days
5. **Displays everything** in an easy-to-read dashboard

## API Endpoints Used

- `GET /automation/v4/flows` - List all workflows
- `GET /automation/v4/flows/email-campaigns?flowId={id}` - Get emails in a workflow
- `GET /marketing/v3/emails/{id}` - Get email details
- `GET /automation/v4/flows/{id}/enrollments` - Get enrollment stats

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HUBSPOT_TOKEN` | ✅ Yes | - | HubSpot Private App access token |
| `HUBSPOT_PORTAL_ID` | ✅ Yes | - | Your HubSpot Portal ID |
| `MAX_WORKFLOWS` | No | 25 | Maximum workflows to fetch |
| `API_DELAY_MS` | No | 250 | Delay between API calls (ms) |

## Need Help?

1. First, try the `/debug` page
2. Check Vercel logs
3. Check browser console
4. Verify environment variables are set correctly
5. Make sure your HubSpot token has the `automation` scope

## License

MIT
