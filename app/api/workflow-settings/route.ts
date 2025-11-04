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
    console.log('[Settings] Data directory exists:', dataDir);
  } catch {
    console.log('[Settings] Creating data directory:', dataDir);
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Get current settings
async function getSettings() {
  try {
    await ensureDataDir();
    console.log('[Settings] Reading from:', SETTINGS_FILE);
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    console.log('[Settings] Successfully read settings');
    return parsed;
  } catch (error: any) {
    console.log('[Settings] File not found or error reading, returning defaults:', error.message);
    // Return default structure if file doesn't exist
    const defaults = {
      workflowOrder: [],
      workflowNotes: {},
      emailOrders: {}
    };
    
    // Try to create the file with defaults
    try {
      await ensureDataDir();
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
      console.log('[Settings] Created default settings file');
    } catch (writeError: any) {
      console.error('[Settings] Failed to create default file:', writeError.message);
    }
    
    return defaults;
  }
}

// Save settings
async function saveSettings(settings: any) {
  try {
    await ensureDataDir();
    console.log('[Settings] Saving to:', SETTINGS_FILE);
    console.log('[Settings] Data to save:', JSON.stringify(settings, null, 2));
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[Settings] Successfully saved settings');
    
    // Verify the write
    const verification = await fs.readFile(SETTINGS_FILE, 'utf-8');
    console.log('[Settings] Verification read successful');
    return true;
  } catch (error: any) {
    console.error('[Settings] Error saving settings:', error.message);
    console.error('[Settings] Stack:', error.stack);
    throw error;
  }
}

// GET - Retrieve settings
export async function GET(request: NextRequest) {
  try {
    console.log('[Settings API] GET request received');
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('[Settings API] Error in GET:', error.message);
    return NextResponse.json(
      { error: 'Failed to read settings', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Update settings
export async function POST(request: NextRequest) {
  try {
    console.log('[Settings API] POST request received');
    const body = await request.json();
    console.log('[Settings API] Request body:', JSON.stringify(body, null, 2));
    
    const currentSettings = await getSettings();
    console.log('[Settings API] Current settings loaded');
    
    // Merge new settings with existing ones
    const updatedSettings = {
      workflowOrder: body.workflowOrder !== undefined ? body.workflowOrder : currentSettings.workflowOrder,
      workflowNotes: body.workflowNotes !== undefined ? { ...currentSettings.workflowNotes, ...body.workflowNotes } : currentSettings.workflowNotes,
      emailOrders: body.emailOrders !== undefined ? { ...currentSettings.emailOrders, ...body.emailOrders } : currentSettings.emailOrders
    };
    
    console.log('[Settings API] Merged settings:', JSON.stringify(updatedSettings, null, 2));
    
    await saveSettings(updatedSettings);
    
    console.log('[Settings API] Settings saved successfully');
    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error: any) {
    console.error('[Settings API] Error in POST:', error.message);
    console.error('[Settings API] Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to save settings', details: error.message },
      { status: 500 }
    );
  }
}
