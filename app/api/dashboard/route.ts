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
        
        // Extract stats if available
        const stats = email.stats || {};
        const counters = stats.counters || {};
        const ratios = stats.ratios || {};
        
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
          // Stats
          sent: counters.sent || 0,
          opened: counters.open || 0,
          clicked: counters.click || 0,
          openRate: ratios.open || 0,
          clickRate: ratios.click || 0,
        });
      });
    });

    console.log(`Created ${emailWorkflowPairs.length} email-workflow pairs`);

    // Step 4: SAFE WORKFLOW SEQUENCING (won't break if it fails)
    try {
      console.log('Starting workflow sequencing analysis...');
      
      // 4a: Fetch all workflows from v4 API with pagination
      let allWorkflows: any[] = [];
      let workflowNextUrl: string | null = `${HUBSPOT_API_BASE}/automation/v4/flows?limit=100`;
      
      while (workflowNextUrl) {
        await delay(apiDelay);
        const workflowResponse: Response = await fetch(workflowNextUrl, { headers });
        
        if (workflowResponse.ok) {
          const workflowData = await workflowResponse.json();
          const batchWorkflows = workflowData.results || [];
          allWorkflows = allWorkflows.concat(batchWorkflows);
          
          console.log(`Fetched ${batchWorkflows.length} workflows, total: ${allWorkflows.length}`);
          
          if (workflowData.paging?.next?.after) {
            workflowNextUrl = `${HUBSPOT_API_BASE}/automation/v4/flows?limit=100&after=${workflowData.paging.next.after}`;
          } else {
            workflowNextUrl = null;
          }
        } else {
          console.warn('Failed to fetch workflows, skipping sequencing');
          workflowNextUrl = null;
        }
      }
      
      console.log(`Total workflows fetched: ${allWorkflows.length}`);
      
      // 4b: Create map of workflow name to workflow ID for detailed fetch
      const workflowNameToDetailId = new Map<string, string>();
      allWorkflows.forEach(wf => {
        if (wf.name && wf.id) {
          workflowNameToDetailId.set(wf.name, wf.id);
        }
      });
      
      // 4c: Get unique workflow names from our email pairs
      const uniqueWorkflowNames = new Set<string>();
      emailWorkflowPairs.forEach((pair: any) => {
        if (pair.workflowName) {
          uniqueWorkflowNames.add(pair.workflowName);
        }
      });
      
      console.log(`Found ${uniqueWorkflowNames.size} unique workflows to analyze`);
      
      // 4d: For each workflow, fetch detailed actions and find email sequence
      const workflowEmailSequences = new Map<string, Map<string, number>>();
      const workflowValidEmails = new Map<string, Set<string>>(); // Track which emails are actually in workflow
      
      for (const workflowName of uniqueWorkflowNames) {
        const flowId = workflowNameToDetailId.get(workflowName);
        
        if (!flowId) {
          console.warn(`No flowId found for workflow: ${workflowName}`);
          continue;
        }
        
        try {
          await delay(apiDelay);
          const detailResponse: Response = await fetch(
            `${HUBSPOT_API_BASE}/automation/v4/flows/${flowId}`,
            { headers }
          );
          
          if (!detailResponse.ok) {
            console.warn(`Failed to fetch details for workflow ${flowId}`);
            continue;
          }
          
          const flowDetail = await detailResponse.json();
          const actions = flowDetail.actions || [];
          const startActionId = flowDetail.startActionId;
          
          if (!startActionId || actions.length === 0) {
            console.warn(`No startActionId or actions for workflow ${flowId}`);
            continue;
          }
          
          // Build action lookup map
          const actionMap = new Map<string, any>();
          actions.forEach((action: any) => {
            if (action.actionId) {
              actionMap.set(action.actionId, action);
            }
          });
          
          // Traverse workflow from startActionId following connections
          const emailSequence: Array<{ emailId: string; order: number }> = [];
          const visited = new Set<string>();
          let orderCounter = 1;
          
          const traverseAction = (actionId: string) => {
            if (!actionId || visited.has(actionId)) return;
            visited.add(actionId);
            
            const action = actionMap.get(actionId);
            if (!action) return;
            
            // If this is an email send action, record it
            if (action.actionTypeId === "0-4") {
              const emailId = action.body?.content_id || action.fields?.content_id;
              if (emailId) {
                emailSequence.push({ emailId: emailId.toString(), order: orderCounter++ });
              }
            }
            
            // Follow connections
            if (action.connection?.nextActionId) {
              traverseAction(action.connection.nextActionId);
            }
            
            // Handle branches
            if (action.staticBranches) {
              action.staticBranches.forEach((branch: any) => {
                if (branch.connection?.nextActionId) {
                  traverseAction(branch.connection.nextActionId);
                }
              });
            }
            
            if (action.listBranches) {
              action.listBranches.forEach((branch: any) => {
                if (branch.connection?.nextActionId) {
                  traverseAction(branch.connection.nextActionId);
                }
              });
            }
            
            if (action.defaultBranch?.nextActionId) {
              traverseAction(action.defaultBranch.nextActionId);
            }
          };
          
          // Start traversal
          traverseAction(startActionId);
          
          if (emailSequence.length === 0) {
            continue;
          }
          
          // Create map of email ID to sequence number
          const emailSequenceMap = new Map<string, number>();
          const validEmailSet = new Set<string>();
          
          emailSequence.forEach(({ emailId, order }) => {
            emailSequenceMap.set(emailId, order);
            validEmailSet.add(emailId);
          });
          
          workflowEmailSequences.set(workflowName, emailSequenceMap);
          workflowValidEmails.set(workflowName, validEmailSet);
          console.log(`Workflow "${workflowName}": Found ${emailSequenceMap.size} emails in execution order`);
          
        } catch (error) {
          console.error(`Error processing workflow ${workflowName}:`, error);
          continue;
        }
      }
      
      // 4e: Filter email pairs to only include emails that exist in current workflow
      // AND add sequence numbers
      const filteredEmailPairs: any[] = [];
      
      emailWorkflowPairs.forEach((pair: any) => {
        const validEmails = workflowValidEmails.get(pair.workflowName);
        
        // If we have valid email info for this workflow, check if email is valid
        if (validEmails) {
          // Only include if email is in the current workflow
          if (validEmails.has(pair.emailId)) {
            const sequenceMap = workflowEmailSequences.get(pair.workflowName);
            pair.emailSequence = sequenceMap?.get(pair.emailId) || null;
            filteredEmailPairs.push(pair);
          } else {
            console.log(`Filtering out removed email ${pair.emailId} from workflow ${pair.workflowName}`);
          }
        } else {
          // If we don't have workflow detail info, keep the email (fail-safe)
          pair.emailSequence = null;
          filteredEmailPairs.push(pair);
        }
      });
      
      console.log(`Filtered from ${emailWorkflowPairs.length} to ${filteredEmailPairs.length} email pairs`);
      
      // Replace emailWorkflowPairs with filtered version
      emailWorkflowPairs.length = 0;
      emailWorkflowPairs.push(...filteredEmailPairs);
      
      console.log('Workflow sequencing completed successfully');
      
    } catch (error) {
      console.error('Error in workflow sequencing (non-critical):', error);
      // Don't fail - just continue without sequence numbers
    }

    // Step 5: Fetch individual workflow details to get updatedAt timestamps
    const workflowDetailsMap = new Map<string, any>();
    try {
      console.log('Fetching individual workflow details for updatedAt timestamps...');
      
      for (const [workflowName, workflowData] of workflowMap.entries()) {
        const workflowId = workflowData.id;
        
        try {
          await delay(apiDelay);
          const detailResponse = await fetch(
            `${HUBSPOT_API_BASE}/automation/v3/workflows/${workflowId}`,
            { headers }
          );
          
          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            workflowDetailsMap.set(workflowName, detail);
            console.log(`Fetched details for workflow: ${workflowName}`);
          } else {
            console.warn(`Failed to fetch details for workflow ${workflowId}`);
          }
        } catch (error) {
          console.error(`Error fetching details for workflow ${workflowName}:`, error);
        }
      }
      
      console.log(`Successfully fetched details for ${workflowDetailsMap.size} workflows`);
    } catch (error) {
      console.error('Error fetching workflow details (non-critical):', error);
    }

    // Convert workflow map to array for stats
    const workflows: HubSpotWorkflow[] = Array.from(workflowMap.entries()).map(([name, data]) => {
      const details = workflowDetailsMap.get(name);
      return {
        id: data.id,
        name: data.name,
        type: 'AUTOMATED',
        enabled: true,
        insertedAt: 0,
        updatedAt: details?.updatedAt || Date.now(),
        lastExecutedAt: undefined,
        marketingEmailCount: data.emailCount,
        marketingEmailIds: [],
      };
    });

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
