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

    // Fetch ALL automated marketing emails with workflow names
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

    // Group emails by workflow
    const workflowMap = new Map<string, any>();
    
    allEmails.forEach((email: any) => {
      const workflows = email.workflowNames || [];
      
      workflows.forEach((workflowName: string) => {
        if (!workflowMap.has(workflowName)) {
          workflowMap.set(workflowName, {
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
      id: name, // Using workflow name as ID since we don't have the actual workflow ID
      name: data.name,
      type: 'AUTOMATED',
      enabled: true, // We don't know this from the email data
      insertedAt: 0, // We don't have this from email data
      updatedAt: Date.now(),
      lastExecutedAt: undefined,
      marketingEmailCount: data.emails.length,
      marketingEmailIds: data.emailIds,
    }));

    // Format email data
    const emails: HubSpotMarketingEmail[] = allEmails.map((email: any) => {
      const workflowNames = email.workflowNames || [];
      
      return {
        id: email.id.toString(),
        name: email.name || 'Unnamed Email',
        subject: email.subject || '',
        htmlBody: '', // Not included in this endpoint response
        previewUrl: `https://app.hubspot.com/preview/${portalId}/email/${email.id}`,
        editUrl: `https://app.hubspot.com/email/${portalId}/edit/${email.id}`,
        workflowIds: workflowNames, // Using names as IDs
        workflowNames: workflowNames,
      };
    });

    // Create placeholder enrollment stats (we'd need workflow IDs for real stats)
    const enrollmentStats: EnrollmentStats[] = workflows.map(wf => ({
      workflowId: wf.id,
      last7Days: 0, // Would need actual workflow API call to get this
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
