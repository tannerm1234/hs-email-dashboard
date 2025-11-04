import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const SETTINGS_KEY = 'workflow-settings';

// Get current settings
async function getSettings() {
  try {
    console.log('[Settings] Reading from Vercel KV');
    const settings = await kv.get(SETTINGS_KEY);
    
    if (!settings) {
      console.log('[Settings] No settings found, returning defaults');
      const defaults = {
        workflowOrder: [],
        workflowNotes: {},
        emailOrders: {},
        emailSequences: {}
      };
      // Initialize with defaults
      await kv.set(SETTINGS_KEY, defaults);
      return defaults;
    }
    
    console.log('[Settings] Successfully read settings');
    return settings;
  } catch (error: any) {
    console.error('[Settings] Error reading from KV:', error.message);
    return {
      workflowOrder: [],
      workflowNotes: {},
      emailOrders: {},
      emailSequences: {}
    };
  }
}

// Save settings
async function saveSettings(settings: any) {
  try {
    console.log('[Settings] Saving to Vercel KV');
    console.log('[Settings] Data to save:', JSON.stringify(settings, null, 2));
    await kv.set(SETTINGS_KEY, settings);
    console.log('[Settings] Successfully saved settings');
    return true;
  } catch (error: any) {
    console.error('[Settings] Error saving to KV:', error.message);
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
      emailOrders: body.emailOrders !== undefined ? { ...currentSettings.emailOrders, ...body.emailOrders } : currentSettings.emailOrders,
      emailSequences: body.emailSequences !== undefined ? { ...currentSettings.emailSequences, ...body.emailSequences } : currentSettings.emailSequences
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
