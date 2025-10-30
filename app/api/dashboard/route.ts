import { NextRequest, NextResponse } from 'next/server';
import type { DashboardData, HubSpotWorkflow, HubSpotMarketingEmail, EnrollmentStats } from '@/types';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * (i + 1);
        await delay(waitTime);
        continue;
      }
      if (!response.ok && i < retries - 1) {
        await delay(1000 * (i + 1));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.HUBSPOT_TOKEN;
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    const maxWorkflows = parseInt(process.env.MAX_WORKFLOWS || '25');
    const apiDelay = parseInt(process.env.API_DELAY_MS || '250');

    if (!accessToken || !portalId) {
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    // Step 1: Get all workflows
    const response = await fetchWithRetry(`${HUBSPOT_API_BASE}/automation/v4/flows?limit=${maxWorkflows}`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch workflows: ${response.statusText}`);
    }

    const workflowsData = await response.json();
    const allWorkflows = workflowsData.results || [];

    // Step 2: For each workflow, get all emails in that workflow
    const workflowsWithEmails: any[] = [];
    const emailIdSet = new Set<string>();
    const workflowEmailMap = new Map<string, any[]>();

    for (const workflow of allWorkflows) {
      await delay(apiDelay);
      
      try {
        // Get all email campaigns for this workflow
        const emailCampaignsResponse = await fetchWithRetry(
          `${HUBSPOT_API_BASE}/automation/v4/flows/email-campaigns?flowId=${workflow.id}`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );

        if (emailCampaignsResponse.ok) {
          const emailCampaignsData = await emailCampaignsResponse.json();
          const emailCampaigns = emailCampaignsData.results || [];
          
          if (emailCampaigns.length > 0) {
            workflowsWithEmails.push(workflow);
            workflowEmailMap.set(workflow.id, emailCampaigns);
            
            // Collect unique email IDs
            emailCampaigns.forEach((campaign: any) => {
              if (campaign.emailCampaignId) {
                emailIdSet.add(campaign.emailCampaignId.toString());
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching email campaigns for workflow ${workflow.id}:`, error);
      }
    }

    // Step 3: Get detailed info for each unique email
    const emailDetails: any[] = [];
    for (const emailId of Array.from(emailIdSet)) {
      await delay(apiDelay);
      
      try {
        const emailResponse = await fetchWithRetry(
          `${HUBSPOT_API_BASE}/marketing/v3/emails/${emailId}?includeStats=true`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );

        if (emailResponse.ok) {
          emailDetails.push(await emailResponse.json());
        }
      } catch (error) {
        console.error(`Error fetching email ${emailId}:`, error);
      }
    }

    // Step 4: Fetch enrollment stats
    const enrollmentStats: EnrollmentStats[] = [];
    for (const workflow of workflowsWithEmails) {
      await delay(apiDelay);
      
      try {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const enrollResponse = await fetchWithRetry(
          `${HUBSPOT_API_BASE}/automation/v4/flows/${workflow.id}/enrollments?limit=100&enrolledAfter=${sevenDaysAgo}`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );

        if (enrollResponse.ok) {
          const enrollData = await enrollResponse.json();
          enrollmentStats.push({ workflowId: workflow.id, last7Days: enrollData.total || 0 });
        } else {
          enrollmentStats.push({ workflowId: workflow.id, last7Days: 0 });
        }
      } catch (error) {
        enrollmentStats.push({ workflowId: workflow.id, last7Days: 0 });
      }
    }

    // Step 5: Create email to workflow mapping
    const emailToWorkflowsMap = new Map<string, string[]>();
    for (const [workflowId, emailCampaigns] of workflowEmailMap.entries()) {
      for (const campaign of emailCampaigns) {
        const emailId = campaign.emailCampaignId?.toString();
        if (emailId) {
          if (!emailToWorkflowsMap.has(emailId)) {
            emailToWorkflowsMap.set(emailId, []);
          }
          emailToWorkflowsMap.get(emailId)!.push(workflowId);
        }
      }
    }

    // Step 6: Format workflow data
    const workflows: HubSpotWorkflow[] = workflowsWithEmails.map(workflow => {
      const emailCampaigns = workflowEmailMap.get(workflow.id) || [];
      const emailIds = emailCampaigns
        .map(c => c.emailCampaignId?.toString())
        .filter((id): id is string => !!id);
      
      return {
        id: workflow.id,
        name: workflow.name || 'Unnamed Workflow',
        type: workflow.type || 'UNKNOWN',
        enabled: workflow.isEnabled || false,
        insertedAt: new Date(workflow.createdAt).getTime(),
        updatedAt: new Date(workflow.updatedAt).getTime(),
        lastExecutedAt: undefined,
        marketingEmailCount: emailIds.length,
        marketingEmailIds: emailIds,
      };
    });

    // Step 7: Format email data
    const emails: HubSpotMarketingEmail[] = emailDetails.map(email => {
      const workflowIds = emailToWorkflowsMap.get(email.id.toString()) || [];
      const workflowNames = workflowIds
        .map(wfId => workflows.find(w => w.id === wfId)?.name)
        .filter((name): name is string => !!name);

      return {
        id: email.id.toString(),
        name: email.name || 'Unnamed Email',
        subject: email.subject || '',
        htmlBody: email.htmlBody || email.body || '',
        previewUrl: `https://app.hubspot.com/preview/${portalId}/email/${email.id}`,
        editUrl: `https://app.hubspot.com/email/${portalId}/edit/${email.id}`,
        workflowIds,
        workflowNames,
      };
    });

    const dashboardData: DashboardData = { workflows, emails, enrollmentStats };
    return NextResponse.json(dashboardData);
    
  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
