import { NextRequest, NextResponse } from 'next/server';
import {
  getAllWorkflows,
  getWorkflowDetails,
  getWorkflowEnrollments,
  getMarketingEmail,
  extractMarketingEmailIds,
  hasMarketingEmailActions,
} from '@/lib/hubspot';
import type { DashboardData, HubSpotWorkflow, HubSpotMarketingEmail, EnrollmentStats } from '@/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    const allWorkflows = await getAllWorkflows(accessToken, maxWorkflows, apiDelay);
    
    console.log(`Found ${allWorkflows.length} workflows, filtering for marketing email workflows...`);
    
    // Filter workflows that have marketing email actions
    const workflowsWithEmails: any[] = [];
    for (const workflow of allWorkflows) {
      await delay(apiDelay);
      
      try {
        const details = await getWorkflowDetails(workflow.id, accessToken);
        
        if (hasMarketingEmailActions(details)) {
          workflowsWithEmails.push(details);
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
      const emailIds = extractMarketingEmailIds(workflow);
      workflowEmailMap.set(workflow.id, emailIds);
      emailIds.forEach(id => emailIdSet.add(id));
    }

    console.log(`Found ${emailIdSet.size} unique marketing emails`);

    // Fetch email details
    const emailPromises: Promise<any>[] = [];
    for (const emailId of emailIdSet) {
      await delay(apiDelay);
      emailPromises.push(
        getMarketingEmail(emailId, accessToken).catch(error => {
          console.error(`Error fetching email ${emailId}:`, error);
          return null;
        })
      );
    }

    const emailDetails = (await Promise.all(emailPromises)).filter(e => e !== null);

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
        const count = await getWorkflowEnrollments(workflow.id, accessToken);
        enrollmentStats.push({
          workflowId: workflow.id,
          last7Days: count,
        });
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
