import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.HUBSPOT_TOKEN;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'No token' }, { status: 500 });
    }

    // Fetch just the first few workflows
    const response = await fetch('https://api.hubapi.com/automation/v4/flows?limit=5', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `API error: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    
    // Get details for first workflow
    if (data.results && data.results.length > 0) {
      const firstWorkflow = data.results[0];
      
      const detailResponse = await fetch(`https://api.hubapi.com/automation/v4/flows/${firstWorkflow.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (detailResponse.ok) {
        const details = await detailResponse.json();
        
        return NextResponse.json({
          summary: {
            totalWorkflows: data.results.length,
            firstWorkflowId: firstWorkflow.id,
            firstWorkflowName: details.name,
            actionsCount: details.actions?.length || 0
          },
          actions: details.actions || [],
          fullWorkflow: details
        });
      }
    }

    return NextResponse.json({ message: 'No workflows found', data });
    
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
