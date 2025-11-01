import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// File to store workflow settings
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'workflow-settings.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Get current settings
async function getSettings() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Return default structure if file doesn't exist
    return {
      workflowOrder: [],
      workflowNotes: {},
      emailOrders: {}
    };
  }
}

// Save settings
async function saveSettings(settings: any) {
  await ensureDataDir();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

// GET - Retrieve settings
export async function GET(request: NextRequest) {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    return NextResponse.json(
      { error: 'Failed to read settings' },
      { status: 500 }
    );
  }
}

// POST - Update settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentSettings = await getSettings();
    
    // Merge new settings with existing ones
    const updatedSettings = {
      workflowOrder: body.workflowOrder !== undefined ? body.workflowOrder : currentSettings.workflowOrder,
      workflowNotes: body.workflowNotes !== undefined ? { ...currentSettings.workflowNotes, ...body.workflowNotes } : currentSettings.workflowNotes,
      emailOrders: body.emailOrders !== undefined ? { ...currentSettings.emailOrders, ...body.emailOrders } : currentSettings.emailOrders
    };
    
    await saveSettings(updatedSettings);
    
    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
