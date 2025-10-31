// ENHANCED DEBUG ROUTE
// Replace your app/api/dashboard/route.ts with this entire file
// This will show us EXACTLY what HubSpot is returning

import { NextRequest, NextResponse } from 'next/server';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
  const logs: string[] = [];
  const addLog = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const accessToken = process.env.HUBSPOT_TOKEN;
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    const maxWorkflows = parseInt(process.env.MAX_WORKFLOWS || '25');
    const apiDelay = parseInt(process.env.API_DELAY_MS || '250');

    addLog('=== ENHANCED DEBUG START ===');
    addLog(`Portal ID: ${portalId}`);
    addLog(`Max Workflows: ${maxWorkflows}`);

    if (!accessToken || !portalId) {
      return NextResponse.json({ error: 'Missing env vars', logs }, { status: 500 });
    }

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // STEP 1: Get workflows
    addLog('\n--- STEP 1: Get Workflows ---');
    const workflowsUrl = `${HUBSPOT_API_BASE}/automation/v4/flows?limit=${maxWorkflows}`;
    const workflowsRes = await fetch(workflowsUrl, { headers });
    addLog(`Status: ${workflowsRes.status}`);
    
    const workflowsData = await workflowsRes.json();
    const workflows = workflowsData.results || [];
    addLog(`Total workflows: ${workflows.length}`);

    if (workflows.length === 0) {
      return NextResponse.json({ 
        error: 'No workflows found in your HubSpot account',
        logs 
      });
    }

    // Show first 3 workflows
    workflows.slice(0, 3).forEach((wf: any, i: number) => {
      addLog(`  ${i+1}. ${wf.name} (ID: ${wf.id})`);
    });

    // STEP 2: Test email-campaigns endpoint WITHOUT flowId
    addLog('\n--- STEP 2: Get ALL Email Campaigns (no filter) ---');
    await delay(apiDelay);
    
    const allCampaignsUrl = `${HUBSPOT_API_BASE}/automation/v4/flows/email-campaigns`;
    addLog(`URL: ${allCampaignsUrl}`);
    const allCampaignsRes = await fetch(allCampaignsUrl, { headers });
    addLog(`Status: ${allCampaignsRes.status}`);
    
    const allCampaignsData = await allCampaignsRes.json();
    addLog(`Response keys: ${Object.keys(allCampaignsData).join(', ')}`);
    addLog(`Results: ${allCampaignsData.results?.length || 0}`);
    
    if (allCampaignsData.results?.length > 0) {
      addLog('FOUND EMAIL CAMPAIGNS!');
      allCampaignsData.results.slice(0, 5).forEach((camp: any, i: number) => {
        addLog(`  ${i+1}. flowId: ${camp.flowId}, emailCampaignId: ${camp.emailCampaignId}, emailContentId: ${camp.emailContentId}`);
      });
    } else {
      addLog('NO email campaigns found - workflows might not use marketing emails');
    }

    // STEP 3: Get detailed workflow to see action types
    addLog('\n--- STEP 3: Check First Workflow Actions ---');
    await delay(apiDelay);
    
    const firstWorkflow = workflows[0];
    const detailUrl = `${HUBSPOT_API_BASE}/automation/v4/flows/${firstWorkflow.id}`;
    addLog(`Getting details for: ${firstWorkflow.name}`);
    
    const detailRes = await fetch(detailUrl, { headers });
    const detailData = await detailRes.json();
    
    addLog(`Total actions: ${detailData.actions?.length || 0}`);
    
    if (detailData.actions && detailData.actions.length > 0) {
      // Count action types
      const actionCounts = new Map<string, number>();
      detailData.actions.forEach((action: any) => {
        const type = action.actionTypeId || 'unknown';
        actionCounts.set(type, (actionCounts.get(type) || 0) + 1);
      });
      
      addLog('Action types found:');
      actionCounts.forEach((count, type) => {
        addLog(`  - ${type}: ${count}`);
      });
      
      // Look specifically for email actions
      const emailActions = detailData.actions.filter((a: any) => 
        a.actionTypeId === '0-4' || 
        a.actionTypeId?.includes('email') ||
        a.type?.toLowerCase().includes('email')
      );
      
      if (emailActions.length > 0) {
        addLog(`\nFOUND ${emailActions.length} EMAIL ACTIONS!`);
        emailActions.forEach((action: any, i: number) => {
          addLog(`  Email Action ${i+1}:`);
          addLog(`    - actionTypeId: ${action.actionTypeId}`);
          addLog(`    - type: ${action.type}`);
          addLog(`    - fields: ${JSON.stringify(action.fields || {})}`);
        });
      } else {
        addLog('\nNO EMAIL ACTIONS (type 0-4) found in this workflow');
      }
    }

    // STEP 4: Test email-campaigns WITH flowId
    addLog('\n--- STEP 4: Email Campaigns for First Workflow ---');
    await delay(apiDelay);
    
    const campaignByFlowUrl = `${HUBSPOT_API_BASE}/automation/v4/flows/email-campaigns?flowId=${firstWorkflow.id}`;
    addLog(`URL: ${campaignByFlowUrl}`);
    const campaignByFlowRes = await fetch(campaignByFlowUrl, { headers });
    addLog(`Status: ${campaignByFlowRes.status}`);
    
    const campaignByFlowData = await campaignByFlowRes.json();
    addLog(`Results: ${campaignByFlowData.results?.length || 0}`);
    
    if (campaignByFlowData.results?.length > 0) {
      addLog('Found campaigns for this workflow!');
      campaignByFlowData.results.forEach((camp: any, i: number) => {
        addLog(`  ${i+1}. ${JSON.stringify(camp)}`);
      });
    }

    // STEP 5: Check marketing emails
    addLog('\n--- STEP 5: Marketing Emails in Account ---');
    await delay(apiDelay);
    
    const emailsUrl = `${HUBSPOT_API_BASE}/marketing/v3/emails?limit=10`;
    const emailsRes = await fetch(emailsUrl, { headers });
    addLog(`Status: ${emailsRes.status}`);
    
    if (emailsRes.ok) {
      const emailsData = await emailsRes.json();
      addLog(`Total emails: ${emailsData.total || emailsData.results?.length || 0}`);
      
      if (emailsData.results?.length > 0) {
        addLog('First 3 emails:');
        emailsData.results.slice(0, 3).forEach((email: any, i: number) => {
          addLog(`  ${i+1}. "${email.name}" (ID: ${email.id})`);
        });
      }
    }

    addLog('\n=== DEBUG COMPLETE ===');
    addLog('\n📋 SUMMARY:');
    addLog(`✓ Workflows in account: ${workflows.length}`);
    addLog(`✓ Email campaigns (unfiltered): ${allCampaignsData.results?.length || 0}`);
    addLog(`✓ Marketing emails: ${emailsRes.ok ? 'API accessible' : 'Check status'}`);

    return NextResponse.json({
      success: true,
      logs,
      rawData: {
        workflowCount: workflows.length,
        allEmailCampaigns: allCampaignsData.results?.length || 0,
        firstWorkflowActions: detailData.actions?.length || 0,
      }
    });

  } catch (error) {
    addLog(`\n❌ FATAL ERROR: ${error}`);
    return NextResponse.json({ error: String(error), logs }, { status: 500 });
  }
}
