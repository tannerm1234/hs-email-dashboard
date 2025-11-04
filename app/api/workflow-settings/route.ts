import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function initTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS workflow_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL
      )
    `;
    await sql`
      INSERT INTO workflow_settings (id, data) 
      VALUES (1, '{"workflowOrder":[],"workflowNotes":{},"emailOrders":{},"emailSequences":{}}')
      ON CONFLICT (id) DO NOTHING
    `;
  } catch (e) {
    console.error('Init error:', e);
  }
}

export async function GET() {
  try {
    await initTable();
    const result = await sql`SELECT data FROM workflow_settings WHERE id = 1`;
    return NextResponse.json(result[0]?.data || {workflowOrder:[],workflowNotes:{},emailOrders:{},emailSequences:{}});
  } catch (error: any) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initTable();
    const body = await request.json();
    const current = await sql`SELECT data FROM workflow_settings WHERE id = 1`;
    const currentData = current[0]?.data || {};
    
    const updated = {
      workflowOrder: body.workflowOrder ?? currentData.workflowOrder,
      workflowNotes: body.workflowNotes ? {...currentData.workflowNotes, ...body.workflowNotes} : currentData.workflowNotes,
      emailOrders: body.emailOrders ? {...currentData.emailOrders, ...body.emailOrders} : currentData.emailOrders,
      emailSequences: body.emailSequences ? {...currentData.emailSequences, ...body.emailSequences} : currentData.emailSequences
    };
    
    await sql`UPDATE workflow_settings SET data = ${JSON.stringify(updated)} WHERE id = 1`;
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error('POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}