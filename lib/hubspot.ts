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

export async function getAllWorkflows(
  accessToken: string,
  maxWorkflows: number,
  apiDelay: number
): Promise<any[]> {
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

  return allWorkflows.slice(0, maxWorkflows);
}

export async function getWorkflowDetails(
  workflowId: string,
  accessToken: string
): Promise<any> {
  const url = `${HUBSPOT_API_BASE}/automation/v4/flows/${workflowId}`;
  
  const response = await fetchWithRetry(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workflow ${workflowId}: ${response.statusText}`);
  }

  return response.json();
}

export async function getWorkflowEnrollments(
  workflowId: string,
  accessToken: string
): Promise<number> {
  try {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const url = `${HUBSPOT_API_BASE}/automation/v4/flows/${workflowId}/enrollments?limit=100&enrolledAfter=${sevenDaysAgo}`;
    
    const response = await fetchWithRetry(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch enrollments for workflow ${workflowId}`);
      return 0;
    }

    const data = await response.json();
    return data.total || 0;
  } catch (error) {
    console.warn(`Error fetching enrollments for workflow ${workflowId}:`, error);
    return 0;
  }
}

export async function getMarketingEmail(
  emailId: string,
  accessToken: string
): Promise<any> {
  const url = `${HUBSPOT_API_BASE}/marketing/v3/emails/${emailId}`;
  
  const response = await fetchWithRetry(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch email ${emailId}: ${response.statusText}`);
  }

  return response.json();
}

export function extractMarketingEmailIds(workflow: any): string[] {
  const emailIds: string[] = [];
  
  if (!workflow.actions || !Array.isArray(workflow.actions)) {
    return emailIds;
  }

  for (const action of workflow.actions) {
    if (action.type === 'SEND_MARKETING_EMAIL' && action.emailId) {
      emailIds.push(action.emailId.toString());
    }
  }

  return emailIds;
}

export function hasMarketingEmailActions(workflow: any): boolean {
  if (!workflow.actions || !Array.isArray(workflow.actions)) {
    return false;
  }

  return workflow.actions.some((action: any) => action.type === 'SEND_MARKETING_EMAIL');
}
