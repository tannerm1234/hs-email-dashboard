import { NextRequest, NextResponse } from 'next/server';
import type { DashboardData, HubSpotWorkflow, HubSpotMarketingEmail, EnrollmentStats } from '@/types';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * (i + 1);
        console.log(`Rate limited, waiting ${waitTime}ms...`);
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

    if (!accessToken) {
      return NextResponse.json(
        { error: 'HUBSPOT_TOKEN environment variable is not set' },
        { status: 500 }
      );
    }

    if (!portalId) {
      return NextResponse.json(
        { error: 'HUBSPOT_PORTAL_ID environment variable is not set' },
        { status: 500 }
      );
    }

    console.log('Fetching workflows...');
    
    // Fetch all workflows
    const allWorkflows: any[] = [];
    let hasMore = true;
    let offset = 0;
    const limit = 100;

    while (hasMore && allWorkflows.length < maxWorkflows) {
      const url = `${HUBSPOT_API_BASE}/automation/v4/flows?limit=${limit}&offset=${offset}`;
      
      const response = await fetchWithRetry(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        allWorkflows.push(...data.results);
        hasMore = data.paging?.next?.after ? true : false;
        offset += limit;
        
        if (hasMore && allWorkflows.length < maxWorkflows) {
          await delay(apiDelay);
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allWorkflows.length} workflows, filtering for marketing email workflows...`);
    
    // Filter workflows that have marketing email actions
    const workflowsWithEmails: any[] = [];
    for (const workflow of allWorkflows.slice(0, maxWorkflows)) {
      await delay(apiDelay);
      
      try {
        // Get workflow details
        const detailsUrl = `${HUBSPOT_API_BASE}/automation/v4/flows/${workflow.id}`;
        const detailsResponse = await fetchWithRetry(detailsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!detailsResponse.ok) {
          console.error(`Failed to fetch workflow ${workflow.id}`);
          continue;
        }

        const details = await detailsResponse.json();
        
        // Check if workflow has marketing email actions
        if (details.actions && Array.isArray(details.actions)) {
          const hasEmailAction = details.actions.some((action: any) => 
            action.type === 'SEND_MARKETING_EMAIL'
          );
          
          if (hasEmailAction) {
            workflowsWithEmails.push(details);
          }
        }
      } catch (error) {
        console.error(`Error fetching details for workflow ${workflow.id}:`, error);
      }
    }

    console.log(`Found ${workflowsWithEmails.length} workflows with marketing emails`);

    // Extract all unique email IDs from workflows
    const emailIdSet = new Set<string>();
    const workflowEmailMap = new Map<string, string[]>();

    for (const workflow of workflowsWithEmails) {
      const emailIds: string[] = [];
      
      if (workflow.actions && Array.isArray(workflow.actions)) {
        for (const action of workflow.actions) {
          if (action.type === 'SEND_MARKETING_EMAIL' && action.emailId) {
            emailIds.push(action.emailId.toString());
          }
        }
      }
      
      workflowEmailMap.set(workflow.id, emailIds);
      emailIds.forEach(id => emailIdSet.add(id));
    }

    console.log(`Found ${emailIdSet.size} unique marketing emails`);

    // Fetch email details
    const emailDetails: any[] = [];
    for (const emailId of Array.from(emailIdSet)) {
      await delay(apiDelay);
      
      try {
        const emailUrl = `${HUBSPOT_API_BASE}/marketing/v3/emails/${emailId}`;
        const emailResponse = await fetchWithRetry(emailUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (emailResponse.ok) {
          const email = await emailResponse.json();
          emailDetails.push(email);
        } else {
          console.error(`Failed to fetch email ${emailId}`);
        }
      } catch (error) {
        console.error(`Error fetching email ${emailId}:`, error);
      }
    }

    console.log(`Successfully fetched ${emailDetails.length} email details`);

    // Create email to workflow mapping
    const emailToWorkflowsMap = new Map<string, string[]>();
    for (const [workflowId, emailIds] of workflowEmailMap.entries()) {
      for (const emailId of emailIds) {
        if (!emailToWorkflowsMap.has(emailId)) {
          emailToWorkflowsMap.set(emailId, []);
        }
        emailToWorkflowsMap.get(emailId)!.push(workflowId);
      }
    }

    // Fetch enrollment stats
    console.log('Fetching enrollment statistics...');
    const enrollmentStats: EnrollmentStats[] = [];
    for (const workflow of workflowsWithEmails) {
      await delay(apiDelay);
      
      try {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const enrollUrl = `${HUBSPOT_API_BASE}/automation/v4/flows/${workflow.id}/enrollments?limit=100&enrolledAfter=${sevenDaysAgo}`;
        
        const enrollResponse = await fetchWithRetry(enrollUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (enrollResponse.ok) {
          const enrollData = await enrollResponse.json();
          enrollmentStats.push({
            workflowId: workflow.id,
            last7Days: enrollData.total || 0,
          });
        } else {
          enrollmentStats.push({
            workflowId: workflow.id,
            last7Days: 0,
          });
        }
      } catch (error) {
        console.error(`Error fetching enrollments for workflow ${workflow.id}:`, error);
        enrollmentStats.push({
          workflowId: workflow.id,
          last7Days: 0,
        });
      }
    }

    // Format workflow data
    const workflows: HubSpotWorkflow[] = workflowsWithEmails.map(workflow => {
      const emailIds = workflowEmailMap.get(workflow.id) || [];
      
      return {
        id: workflow.id,
        name: workflow.name || 'Unnamed Workflow',
        type: workflow.type || 'UNKNOWN',
        enabled: workflow.enabled || false,
        insertedAt: workflow.insertedAt || 0,
        updatedAt: workflow.updatedAt || 0,
        lastExecutedAt: workflow.lastExecutedAt,
        marketingEmailCount: emailIds.length,
        marketingEmailIds: emailIds,
      };
    });

    // Format email data
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

    const dashboardData: DashboardData = {
      workflows,
      emails,
      enrollmentStats,
    };

    console.log('Dashboard data prepared successfully');

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
