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

    // Step 1: Fetch ALL automated marketing emails with workflow names
    const emailsUrl = `${HUBSPOT_API_BASE}/marketing/v3/emails/?workflowNames=true&includeStats=true&isPublished=true&limit=10000&sort=updatedAt&type=AUTOMATED_EMAIL`;
    
    console.log('Fetching emails from:', emailsUrl);
    
    const emailsResponse = await fetch(emailsUrl, { headers });
    
    if (!emailsResponse.ok) {
      const errorText = await emailsResponse.text();
      console.error('Error fetching emails:', errorText);
      return NextResponse.json({ 
        error: `Failed to fetch emails: ${emailsResponse.status}` 
      }, { status: emailsResponse.status });
    }

    const emailsData = await emailsResponse.json();
    const allEmails = emailsData.results || [];
    
    console.log(`Found ${allEmails.length} automated emails`);

    // Filter to only emails used in workflows
    const emailsInWorkflows = allEmails.filter((email: any) => 
      email.workflowNames && email.workflowNames.length > 0
    );

    console.log(`${emailsInWorkflows.length} emails are used in workflows`);

    // Step 2: Get all workflows to map names to IDs
    const workflowsUrl = `${HUBSPOT_API_BASE}/automation/v4/flows?limit=500`;
    const workflowsResponse = await fetch(workflowsUrl, { headers });
    
    let workflowNameToId = new Map<string, string>();
    
    if (workflowsResponse.ok) {
      const workflowsData = await workflowsResponse.json();
      const workflows = workflowsData.results || [];
      
      workflows.forEach((wf: any) => {
        workflowNameToId.set(wf.name, wf.id);
      });
      
      console.log(`Mapped ${workflowNameToId.size} workflow names to IDs`);
    }

    // Step 3: Group emails by workflow
    const workflowMap = new Map<string, any>();
    
    emailsInWorkflows.forEach((email: any) => {
      const workflows = email.workflowNames || [];
      
      workflows.forEach((workflowName: string) => {
        if (!workflowMap.has(workflowName)) {
          const workflowId = workflowNameToId.get(workflowName) || workflowName;
          workflowMap.set(workflowName, {
            id: workflowId,
            name: workflowName,
            emails: [],
            emailIds: [],
          });
        }
        
        const workflow = workflowMap.get(workflowName)!;
        workflow.emails.push(email);
        workflow.emailIds.push(email.id);
      });
    });

    // Convert workflow map to array
    const workflows: HubSpotWorkflow[] = Array.from(workflowMap.entries()).map(([name, data]) => ({
      id: data.id,
      name: data.name,
      type: 'AUTOMATED',
      enabled: true,
      insertedAt: 0,
      updatedAt: Date.now(),
      lastExecutedAt: undefined,
      marketingEmailCount: data.emails.length,
      marketingEmailIds: data.emailIds,
    }));

    // Step 4: Format email data with workflow IDs
    const emails: HubSpotMarketingEmail[] = emailsInWorkflows.map((email: any) => {
      const workflowNames = email.workflowNames || [];
      const workflowIds = workflowNames.map((name: string) => 
        workflowNameToId.get(name) || name
      );
      
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
      
      return {
        id: email.id.toString(),
        name: email.name || 'Unnamed Email',
        subject: email.subject || '',
        htmlBody: JSON.stringify(email.content || {}), // Store full content for preview
        previewUrl: `https://app.hubspot.com/preview/${portalId}/email/${email.id}`,
        editUrl: `https://app.hubspot.com/email/${portalId}/edit/${email.id}/content`,
        workflowIds: workflowIds,
        workflowNames: workflowNames,
        fromName: email.from?.fromName || '',
        bodyText: bodyText.trim().substring(0, 200), // First 200 chars
      };
    });

    // Create placeholder enrollment stats
    const enrollmentStats: EnrollmentStats[] = workflows.map(wf => ({
      workflowId: wf.id,
      last7Days: 0,
    }));

    const dashboardData: DashboardData = { 
      workflows, 
      emails, 
      enrollmentStats 
    };
    
    console.log(`Returning ${workflows.length} workflows and ${emails.length} emails`);
    
    return NextResponse.json(dashboardData);
    
  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
