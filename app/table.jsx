'use client';
import { useMemo, useState } from 'react';

export default function Table({ columns, rows, searchKeys, showActiveToggle=false }) {
  const [q, setQ] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return rows.filter(r => {
      if (showActiveToggle && onlyActive && String(r.active) !== 'true') return false;
      if (!needle) return true;
      return searchKeys.some(k => String(r[k] ?? '').toLowerCase().includes(needle));
    });
  }, [q, rows, searchKeys, onlyActive, showActiveToggle]);

  return (
    <div>
      <div style={{display:'flex', gap:'12px', alignItems:'center', marginBottom:'8px'}}>
        <input
          placeholder="Search…"
          value={q}
          onChange={e=>setQ(e.target.value)}
          style={{padding:'8px', borderRadius:'6px', border:'1px solid #3f3f46', background:'#09090b', color:'#e5e7eb'}}
        />
        {showActiveToggle && (
          <label style={{display:'flex', alignItems:'center', gap:'6px'}}>
            <input type="checkbox" checked={onlyActive} onChange={e=>setOnlyActive(e.target.checked)} />
            Active only
          </label>
        )}
        <div style={{marginLeft:'auto', color:'#a1a1aa'}}>{filtered.length} of {rows.length}</div>
      </div>
      <div style={{overflow:'auto', border:'1px solid #27272a', borderRadius:'8px'}}>
        <table style={{minWidth:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key} style={{textAlign:'left', padding:'8px 12px', borderBottom:'1px solid #27272a'}}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r,i)=>(
              <tr key={i} style={{background:i%2 ? '#0b0b0b' : 'transparent'}}>
                {columns.map(([key]) => (
                  <td key={key} style={{padding:'8px 12px', verticalAlign:'top'}}>{String(r[key] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
