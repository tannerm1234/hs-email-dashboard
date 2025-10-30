'use client';

import { useState, useEffect } from 'react';

export default function DebugPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/debug')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setData({ error: err.message });
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>HubSpot Workflow Debug</h1>
      <pre style={{ 
        background: '#f5f5f5', 
        padding: '20px', 
        overflow: 'auto',
        fontSize: '12px',
        lineHeight: '1.5'
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
