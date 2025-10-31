import { NextRequest, NextResponse } from 'next/server';
import type { DashboardData, HubSpotWorkflow, HubSpotMarketingEmail, EnrollmentStats } from '@/types';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.HUBSPOT_TOKEN;
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    const apiDelay = parseInt(process.env.API_DELAY_MS || '250');

    if (!accessToken || !portalId) {
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Step 1: Fetch ALL automated marketing emails with workflow names (WITH PAGINATION)
    let allEmails: any[] = [];
    let nextUrl: string | null = `${HUBSPOT_API_BASE}/marketing/v3/emails/?workflowNames=true&includeStats=true&isPublished=true&limit=10000&sort=updatedAt&type=AUTOMATED_EMAIL`;
    
    console.log('Starting to fetch emails with pagination...');
    
    // Pagination loop
    while (nextUrl) {
      console.log('Fetching from:', nextUrl);
      
      const emailsResponse: Response = await fetch(nextUrl, { headers });
      
      if (!emailsResponse.ok) {
        const errorText = await emailsResponse.text();
        console.error('Error fetching emails:', errorText);
        return NextResponse.json({ 
          error: `Failed to fetch emails: ${emailsResponse.status}` 
        }, { status: emailsResponse.status });
      }

      const emailsData = await emailsResponse.json();
      const batchEmails = emailsData.results || [];
      allEmails = allEmails.concat(batchEmails);
      
      console.log(`Fetched ${batchEmails.length} emails, total so far: ${allEmails.length}`);
      
      // Check for next page
      if (emailsData.paging?.next?.link) {
        nextUrl = emailsData.paging.next.link;
        await delay(apiDelay); // Rate limiting between pages
      } else {
        nextUrl = null;
      }
    }
    
    console.log(`Total emails fetched after pagination: ${allEmails.length}`);

    // Filter to only emails used in workflows
    const emailsInWorkflows = allEmails.filter((email: any) => 
      email.workflowNames && email.workflowNames.length > 0
    );

    console.log(`${emailsInWorkflows.length} emails are used in workflows`);

    // Step 2: Get all workflows using v3 API to get IDs
    const workflowsUrl = `${HUBSPOT_API_BASE}/automation/v3/workflows`;
    const workflowsResponse = await fetch(workflowsUrl, { headers });
    
    let workflowNameToId = new Map<string, string>();
    
    if (workflowsResponse.ok) {
      const workflowsData = await workflowsResponse.json();
      const workflows = workflowsData.workflows || [];
      
      workflows.forEach((wf: any) => {
        workflowNameToId.set(wf.name, wf.id.toString());
      });
      
      console.log(`Mapped ${workflowNameToId.size} workflow names to IDs from v3 API`);
    }

    // Step 3: Create email-workflow pairs (one row per pairing)
    const emailWorkflowPairs: any[] = [];
    const workflowMap = new Map<string, any>();
    
    emailsInWorkflows.forEach((email: any) => {
      const workflows = email.workflowNames || [];
      
      workflows.forEach((workflowName: string) => {
        const workflowId = workflowNameToId.get(workflowName) || workflowName;
        
        // Track workflow for stats
        if (!workflowMap.has(workflowName)) {
          workflowMap.set(workflowName, {
            id: workflowId,
            name: workflowName,
            emailCount: 0,
          });
        }
        workflowMap.get(workflowName)!.emailCount++;
        
        // Extract body text from HTML (simple version)
        let bodyText = '';
        if (email.content?.widgets) {
          Object.values(email.content.widgets).forEach((widget: any) => {
            if (widget.body?.html) {
              // Strip HTML tags for preview
              bodyText += widget.body.html.replace(/<[^>]*>/g, ' ') + ' ';
            }
          });
        }
        
        // Create a unique entry for this email-workflow pair
        emailWorkflowPairs.push({
          id: `${email.id}-${workflowId}`, // Unique ID for this pairing
          emailId: email.id.toString(),
          name: email.name || 'Unnamed Email',
          subject: email.subject || '',
          htmlBody: JSON.stringify(email.content || {}),
          previewUrl: `https://app.hubspot.com/preview/${portalId}/email/${email.id}`,
          editUrl: `https://app.hubspot.com/email/${portalId}/edit/${email.id}/content`,
          workflowId: workflowId,
          workflowName: workflowName,
          workflowIds: [workflowId], // Keep for compatibility
          workflowNames: [workflowName], // Keep for compatibility
          fromName: email.from?.fromName || '',
          bodyText: bodyText.trim().substring(0, 500), // First 500 chars for preview
        });
      });
    });

    console.log(`Created ${emailWorkflowPairs.length} email-workflow pairs`);

    // Convert workflow map to array for stats
    const workflows: HubSpotWorkflow[] = Array.from(workflowMap.entries()).map(([name, data]) => ({
      id: data.id,
      name: data.name,
      type: 'AUTOMATED',
      enabled: true,
      insertedAt: 0,
      updatedAt: Date.now(),
      lastExecutedAt: undefined,
      marketingEmailCount: data.emailCount,
      marketingEmailIds: [],
    }));

    // Create placeholder enrollment stats
    const enrollmentStats: EnrollmentStats[] = workflows.map(wf => ({
      workflowId: wf.id,
      last7Days: 0,
    }));

    const dashboardData: DashboardData = { 
      workflows, 
      emails: emailWorkflowPairs, // Now contains email-workflow pairs
      enrollmentStats 
    };
    
    console.log(`Returning ${workflows.length} workflows and ${emailWorkflowPairs.length} email-workflow pairs`);
    
    return NextResponse.json(dashboardData);
    
  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
