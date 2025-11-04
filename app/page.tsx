'use client';

import { useState, useEffect } from 'react';
import type { DashboardData, HubSpotMarketingEmail } from '@/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Helper function to clean personalization tokens
function cleanPersonalizationTokens(text: string): string {
  if (!text) return text;
  
  // Match {{ personalization_token('fieldname', 'backup_value') }}
  const regex = /\{\{\s*personalization_token\(['"]([^'"]+)['"],\s*['"][^'"]*['"]\)\s*\}\}/g;
  return text.replace(regex, '$1');
}

// Sortable Workflow Group component
function SortableWorkflowGroup({ 
  workflowName,
  workflowId,
  emails,
  isExpanded,
  workflowInfo,
  note,
  portalId,
  onToggle,
  onNoteClick,
  onDragEnd,
  onSequenceChange,
  onBodyToggle,
  expandedBodyPreviews,
  sensors
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workflowName });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  const sortedEmails = [...emails].sort((a: any, b: any) => {
    if (a.emailSequence && b.emailSequence) {
      return a.emailSequence - b.emailSequence;
    }
    if (a.emailSequence && !b.emailSequence) return -1;
    if (!a.emailSequence && b.emailSequence) return 1;
    return 0;
  });

  return (
    <div ref={setNodeRef} style={{...styles.workflowGroup, ...style}}>
      <div 
        style={styles.workflowHeader}
      >
        <div style={styles.workflowHeaderContent}>
          <span 
            style={{...styles.dragHandle, cursor: 'grab', marginRight: '8px'}}
            {...listeners} 
            {...attributes}
          >
            ⋮⋮
          </span>
          <span 
            style={styles.expandIcon}
            onClick={() => onToggle(workflowName)}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
          <a
            href={`https://app.hubspot.com/workflows/${portalId}/platform/flow/${workflowId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.workflowName}
            onClick={(e) => e.stopPropagation()}
          >
            {workflowName}
          </a>
          <span style={styles.emailCount}>({emails.length} email{emails.length !== 1 ? 's' : ''})</span>
          
          {note && (
            <span style={styles.notePreview}>
              📝 {note.substring(0, 50)}{note.length > 50 ? '...' : ''}
            </span>
          )}
          
          <button
            onClick={() => onNoteClick(workflowName)}
            style={note ? styles.editNoteButton : styles.addNoteButton}
          >
            {note ? 'Edit Note' : '+ Add Note'}
          </button>
          
          {workflowInfo && workflowInfo.updatedAt && (
            <span style={styles.lastUpdated}>
              Last updated: {new Date(workflowInfo.updatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div style={styles.tableContainer}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => onDragEnd(event, workflowName)}
          >
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{...styles.th, width: '2%'}}></th>
                  <th style={{...styles.th, width: '10%'}}>Email Name</th>
                  <th style={{...styles.th, width: '12%'}}>Subject Line</th>
                  <th style={{...styles.th, width: '8%'}}>Actions</th>
                  <th style={{...styles.th, width: '7%'}}>From Name</th>
                  <th style={{...styles.th, width: '5%'}}>Sent</th>
                  <th style={{...styles.th, width: '5%'}}>Opened</th>
                  <th style={{...styles.th, width: '5%'}}>Clicked</th>
                  <th style={{...styles.th, width: '46%'}}>Body Preview</th>
                </tr>
              </thead>
              <tbody>
                <SortableContext
                  items={sortedEmails.map((e: any) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedEmails.map((email: any) => (
                    <SortableEmailRow
                      key={email.id}
                      email={email}
                      onSequenceChange={onSequenceChange}
                      onBodyToggle={onBodyToggle}
                      isBodyExpanded={expandedBodyPreviews.has(email.id)}
                      portalId={portalId}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
      )}
    </div>
  );
}

// Sortable row component
function SortableEmailRow({ 
  email, 
  onSequenceChange,
  onBodyToggle,
  isBodyExpanded,
  portalId
}: { 
  email: any;
  onSequenceChange: (id: string, sequence: number | null) => void;
  onBodyToggle: (id: string) => void;
  isBodyExpanded: boolean;
  portalId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: email.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Clean up the subject and body text
  const cleanSubject = cleanPersonalizationTokens(email.subject || 'No subject');
  const cleanBodyText = cleanPersonalizationTokens(email.bodyText || 'No preview');

  return (
    <tr ref={setNodeRef} style={{...styles.tr, ...style}}>
      <td style={{...styles.td, width: '2%', cursor: 'grab'}} {...listeners} {...attributes}>
        <span style={styles.dragHandle}>⋮⋮</span>
      </td>
      <td style={{...styles.td, width: '10%'}}>
        <div style={styles.emailNameCell}>
          <input
            type="number"
            value={email.emailSequence || ''}
            onChange={(e) => {
              const val = e.target.value === '' ? null : parseInt(e.target.value);
              onSequenceChange(email.id, val);
            }}
            style={styles.sequenceInput}
            placeholder="#"
            min="1"
          />
          <strong>{email.name}</strong>
        </div>
      </td>
      <td style={{...styles.td, width: '12%'}}>{cleanSubject}</td>
      <td style={{...styles.td, width: '8%'}}>
        <div style={styles.actionButtons}>
          <a
            href={email.editUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.editButton}
          >
            Edit Email
          </a>
        </div>
      </td>
      <td style={{...styles.td, width: '7%'}}>{email.fromName || 'N/A'}</td>
      <td style={{...styles.td, width: '5%', textAlign: 'center'}}>{email.sent || 0}</td>
      <td style={{...styles.td, width: '5%', textAlign: 'center'}}>{email.opened || 0}</td>
      <td style={{...styles.td, width: '5%', textAlign: 'center'}}>{email.clicked || 0}</td>
      <td style={{...styles.td, width: '46%'}}>
        <div style={styles.bodyPreviewContainer}>
          <div style={{
            ...styles.bodyPreview,
            whiteSpace: isBodyExpanded ? 'normal' : 'nowrap',
            overflow: isBodyExpanded ? 'visible' : 'hidden'
          }}>
            {cleanBodyText}
          </div>
          {email.bodyText && email.bodyText.length > 100 && (
            <button
              onClick={() => onBodyToggle(email.id)}
              style={styles.expandBodyButton}
            >
              {isBodyExpanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// Note Modal Component
function NoteModal({ workflowName, currentNote, onSave, onClose }: any) {
  const [note, setNote] = useState(currentNote || '');

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={{margin: 0, fontSize: '20px'}}>Workflow Note</h2>
            <p style={{margin: '5px 0 0 0', color: '#666', fontSize: '14px'}}>{workflowName}</p>
          </div>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>
        <div style={styles.modalBody}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={styles.noteTextarea}
            placeholder="Enter notes about this workflow..."
            rows={10}
          />
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelButton}>
            Cancel
          </button>
          <button 
            onClick={() => {
              onSave(note);
              onClose();
            }} 
            style={styles.saveButton}
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [expandedBodyPreviews, setExpandedBodyPreviews] = useState<Set<string>>(new Set());
  const [emailsByWorkflow, setEmailsByWorkflow] = useState<Record<string, any[]>>({});
  const [workflowOrder, setWorkflowOrder] = useState<string[]>([]);
  const [workflowNotes, setWorkflowNotes] = useState<Record<string, string>>({});
  const [showNoteModal, setShowNoteModal] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<string>('');
  const portalId = '6885872';

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch dashboard data
      const response = await fetch('/api/dashboard');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dashboard data');
      }
      
      const dashboardData: DashboardData = await response.json();
      setData(dashboardData);
      
      // Group emails by workflow
      const grouped = dashboardData.emails.reduce((acc: any, email: any) => {
        const workflowName = email.workflowName;
        if (!acc[workflowName]) {
          acc[workflowName] = [];
        }
        acc[workflowName].push(email);
        return acc;
      }, {});
      
      // Fetch saved settings
      try {
        console.log('[Frontend] Fetching saved settings...');
        const settingsResponse = await fetch('/api/workflow-settings');
        console.log('[Frontend] Settings response status:', settingsResponse.status);
        
        if (settingsResponse.ok) {
          const settings = await settingsResponse.json();
          console.log('[Frontend] Loaded settings:', settings);
          
          // Apply saved workflow order or use alphabetical
          const workflowNames = Object.keys(grouped);
          if (settings.workflowOrder && settings.workflowOrder.length > 0) {
            console.log('[Frontend] Applying saved workflow order');
            // Use saved order, adding any new workflows at the end
            const savedOrder = settings.workflowOrder.filter((name: string) => workflowNames.includes(name));
            const newWorkflows = workflowNames.filter((name: string) => !settings.workflowOrder.includes(name)).sort();
            setWorkflowOrder([...savedOrder, ...newWorkflows]);
          } else {
            console.log('[Frontend] No saved order, using alphabetical');
            setWorkflowOrder(workflowNames.sort());
          }
          
          // Load saved notes
          if (settings.workflowNotes) {
            console.log('[Frontend] Applying saved notes:', settings.workflowNotes);
            setWorkflowNotes(settings.workflowNotes);
          }
          
          // Apply saved email orders
          if (settings.emailOrders) {
            console.log('[Frontend] Applying saved email orders');
            Object.keys(settings.emailOrders).forEach(workflowName => {
              if (grouped[workflowName]) {
                const savedOrder = settings.emailOrders[workflowName];
                grouped[workflowName] = grouped[workflowName].sort((a: any, b: any) => {
                  const aIndex = savedOrder.indexOf(a.id);
                  const bIndex = savedOrder.indexOf(b.id);
                  if (aIndex === -1 && bIndex === -1) return 0;
                  if (aIndex === -1) return 1;
                  if (bIndex === -1) return -1;
                  return aIndex - bIndex;
                });
              }
            });
          }
        } else {
          // No saved settings, use alphabetical order
          setWorkflowOrder(Object.keys(grouped).sort());
        }
      } catch (settingsError) {
        console.error('Error loading settings:', settingsError);
        setWorkflowOrder(Object.keys(grouped).sort());
      }
      
      setEmailsByWorkflow(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updates: any) => {
    try {
      console.log('[Frontend] Saving settings:', updates);
      setSavingStatus('Saving...');
      
      const response = await fetch('/api/workflow-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Frontend] Failed to save settings:', errorData);
        setSavingStatus('❌ Save failed');
        setTimeout(() => setSavingStatus(''), 3000);
        alert('Failed to save settings. Check console for details.');
        return false;
      }
      
      const result = await response.json();
      console.log('[Frontend] Settings saved successfully:', result);
      setSavingStatus('✓ Saved');
      setTimeout(() => setSavingStatus(''), 2000);
      return true;
    } catch (error) {
      console.error('[Frontend] Error saving settings:', error);
      setSavingStatus('❌ Save error');
      setTimeout(() => setSavingStatus(''), 3000);
      alert('Error saving settings. Check console for details.');
      return false;
    }
  };

  const toggleWorkflow = (workflowName: string) => {
    setExpandedWorkflows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workflowName)) {
        newSet.delete(workflowName);
      } else {
        newSet.add(workflowName);
      }
      return newSet;
    });
  };

  const toggleBodyPreview = (emailId: string) => {
    setExpandedBodyPreviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const handleWorkflowDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setWorkflowOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const newOrder = arrayMove(prev, oldIndex, newIndex);
      
      // Save to backend
      saveSettings({ workflowOrder: newOrder });
      
      return newOrder;
    });
  };

  const handleEmailDragEnd = (event: DragEndEvent, workflowName: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setEmailsByWorkflow(prev => {
      const workflowEmails = [...prev[workflowName]];
      const oldIndex = workflowEmails.findIndex(e => e.id === active.id);
      const newIndex = workflowEmails.findIndex(e => e.id === over.id);

      const reorderedEmails = arrayMove(workflowEmails, oldIndex, newIndex);
      
      const newState = {
        ...prev,
        [workflowName]: reorderedEmails
      };
      
      // Save email order to backend
      const emailOrders = {
        [workflowName]: reorderedEmails.map(e => e.id)
      };
      saveSettings({ emailOrders });

      return newState;
    });
  };

  const handleSequenceChange = (emailId: string, sequence: number | null) => {
    setEmailsByWorkflow(prev => {
      const newWorkflows = { ...prev };
      
      for (const workflowName in newWorkflows) {
        const emailIndex = newWorkflows[workflowName].findIndex(e => e.id === emailId);
        if (emailIndex !== -1) {
          newWorkflows[workflowName] = [...newWorkflows[workflowName]];
          newWorkflows[workflowName][emailIndex] = {
            ...newWorkflows[workflowName][emailIndex],
            emailSequence: sequence
          };
          break;
        }
      }
      
      return newWorkflows;
    });
  };

  const handleNoteSave = (workflowName: string, note: string) => {
    const updatedNotes = {
      ...workflowNotes,
      [workflowName]: note
    };
    setWorkflowNotes(updatedNotes);
    
    // Save to backend
    saveSettings({ workflowNotes: { [workflowName]: note } });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h2>Error Loading Dashboard</h2>
          <p>{error}</p>
          <button onClick={fetchDashboardData} style={styles.button}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const getWorkflowInfo = (workflowName: string) => {
    return data.workflows.find(w => w.name === workflowName);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>HubSpot Workflow Emails</h1>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          {savingStatus && (
            <span style={{
              fontSize: '14px',
              color: savingStatus.includes('✓') ? '#28a745' : '#dc3545',
              fontWeight: '500'
            }}>
              {savingStatus}
            </span>
          )}
          <button onClick={fetchDashboardData} style={styles.refreshButton}>
            Refresh Data
          </button>
        </div>
      </header>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <h3>Workflows</h3>
          <p style={styles.statNumber}>{workflowOrder.length}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Total Email Instances</h3>
          <p style={styles.statNumber}>{data.emails.length}</p>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Emails by Workflow</h2>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleWorkflowDragEnd}
        >
          <SortableContext
            items={workflowOrder}
            strategy={verticalListSortingStrategy}
          >
            {workflowOrder.map((workflowName) => {
              const emails = emailsByWorkflow[workflowName] || [];
              if (emails.length === 0) return null;
              
              const isExpanded = expandedWorkflows.has(workflowName);
              const workflowInfo = getWorkflowInfo(workflowName);
              const workflowId = emails[0]?.workflowId;
              const note = workflowNotes[workflowName];
              
              return (
                <SortableWorkflowGroup
                  key={workflowName}
                  workflowName={workflowName}
                  workflowId={workflowId}
                  emails={emails}
                  isExpanded={isExpanded}
                  workflowInfo={workflowInfo}
                  note={note}
                  portalId={portalId}
                  onToggle={toggleWorkflow}
                  onNoteClick={(name: string) => setShowNoteModal(name)}
                  onDragEnd={handleEmailDragEnd}
                  onSequenceChange={handleSequenceChange}
                  onBodyToggle={toggleBodyPreview}
                  expandedBodyPreviews={expandedBodyPreviews}
                  sensors={sensors}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </section>

      {showNoteModal && (
        <NoteModal
          workflowName={showNoteModal}
          currentNote={workflowNotes[showNoteModal]}
          onSave={(note: string) => handleNoteSave(showNoteModal, note)}
          onClose={() => setShowNoteModal(null)}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f5f5f5',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
  },
  error: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  refreshButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center' as const,
  },
  statNumber: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#007bff',
    margin: '10px 0 0 0',
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#333',
  },
  workflowGroup: {
    marginBottom: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  workflowHeader: {
    padding: '15px 20px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
  },
  workflowHeaderContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    flexWrap: 'wrap' as const,
  },
  expandIcon: {
    fontSize: '14px',
    color: '#666',
    minWidth: '15px',
    cursor: 'pointer',
  },
  workflowName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#007bff',
    textDecoration: 'none',
    flex: '0 0 auto',
  },
  emailCount: {
    fontSize: '14px',
    color: '#666',
    fontWeight: 'normal',
  },
  notePreview: {
    fontSize: '13px',
    color: '#555',
    fontStyle: 'italic',
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  addNoteButton: {
    padding: '4px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
  },
  editNoteButton: {
    padding: '4px 12px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
  },
  lastUpdated: {
    fontSize: '12px',
    color: '#999',
    fontStyle: 'italic',
    marginLeft: 'auto',
  },
  tableContainer: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
  },
  th: {
    padding: '15px',
    textAlign: 'left' as const,
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 'bold',
    color: '#555',
    backgroundColor: '#fafafa',
    fontSize: '14px',
  },
  tr: {
    borderBottom: '1px solid #e0e0e0',
  },
  td: {
    padding: '15px',
    fontSize: '14px',
    verticalAlign: 'top' as const,
    wordWrap: 'break-word' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dragHandle: {
    fontSize: '18px',
    color: '#999',
    userSelect: 'none' as const,
  },
  emailNameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  sequenceInput: {
    width: '50px',
    padding: '4px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  bodyPreviewContainer: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  bodyPreview: {
    flex: 1,
    color: '#666',
    fontSize: '13px',
    lineHeight: '1.5',
    textOverflow: 'ellipsis',
  },
  expandBodyButton: {
    padding: '2px 8px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#666',
    minWidth: '24px',
  },
  actionButtons: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  editButton: {
    padding: '8px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    textAlign: 'center' as const,
    display: 'inline-block',
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '8px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '32px',
    cursor: 'pointer',
    color: '#999',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: '20px',
    overflow: 'auto' as const,
    flex: 1,
  },
  noteTextarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    minHeight: '200px',
  },
  modalFooter: {
    padding: '20px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
};
