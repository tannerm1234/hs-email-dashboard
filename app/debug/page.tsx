'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const testAPI = async () => {
    setLoading(true);
    setError(null);
    setLogs([]);
    setData(null);

    try {
      addLog('Starting API call to /api/dashboard');
      
      const response = await fetch('/api/dashboard');
      addLog(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        addLog(`Error response: ${errorText}`);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      addLog(`Success! Received data`);
      addLog(`Workflows count: ${result.workflows?.length || 0}`);
      addLog(`Emails count: ${result.emails?.length || 0}`);
      
      setData(result);
    } catch (err: any) {
      addLog(`ERROR: ${err.message}`);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>API Debug Page</h1>
        
        <button
          onClick={testAPI}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#9CA3AF' : '#2563EB',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          {loading ? 'Testing API...' : 'Test API Call'}
        </button>

        {/* Logs Section */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Logs</h2>
          <div style={{ backgroundColor: '#1F2937', color: '#10B981', padding: '16px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px', height: '300px', overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <p style={{ color: '#6B7280' }}>Click "Test API Call" to see logs...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
              ))
            )}
          </div>
        </div>

        {/* Error Section */}
        {error && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#991B1B', marginBottom: '8px' }}>Error</h2>
            <pre style={{ color: '#DC2626', whiteSpace: 'pre-wrap', fontSize: '14px' }}>{error}</pre>
          </div>
        )}

        {/* Data Section */}
        {data && (
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Data Received</h2>
            
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px' }}>Summary</h3>
              <p>Workflows: {data.workflows?.length || 0}</p>
              <p>Emails: {data.emails?.length || 0}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px' }}>Workflows</h3>
              {data.workflows?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.workflows.slice(0, 3).map((wf: any, i: number) => (
                    <div key={i} style={{ backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '6px' }}>
                      <p style={{ fontWeight: '600' }}>{wf.name}</p>
                      <p style={{ fontSize: '13px', color: '#6B7280' }}>ID: {wf.id} | Emails: {wf.marketingEmailCount}</p>
                    </div>
                  ))}
                  {data.workflows.length > 3 && (
                    <p style={{ fontSize: '13px', color: '#6B7280' }}>...and {data.workflows.length - 3} more</p>
                  )}
                </div>
              ) : (
                <p style={{ color: '#6B7280' }}>No workflows found</p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px' }}>Emails</h3>
              {data.emails?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.emails.slice(0, 3).map((email: any, i: number) => (
                    <div key={i} style={{ backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '6px' }}>
                      <p style={{ fontWeight: '600' }}>{email.name}</p>
                      <p style={{ fontSize: '13px', color: '#6B7280' }}>Subject: {email.subject}</p>
                    </div>
                  ))}
                  {data.emails.length > 3 && (
                    <p style={{ fontSize: '13px', color: '#6B7280' }}>...and {data.emails.length - 3} more</p>
                  )}
                </div>
              ) : (
                <p style={{ color: '#6B7280' }}>No emails found</p>
              )}
            </div>

            <details style={{ marginTop: '24px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#2563EB' }}>
                View Raw JSON
              </summary>
              <pre style={{ marginTop: '16px', backgroundColor: '#1F2937', color: 'white', padding: '16px', borderRadius: '6px', overflowX: 'auto', fontSize: '11px' }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
