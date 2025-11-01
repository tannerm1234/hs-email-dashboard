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

// Sortable row component
function SortableEmailRow({ 
  email, 
  onSequenceChange,
  onPreview,
  onBodyToggle,
  isBodyExpanded,
  portalId
}: { 
  email: any;
  onSequenceChange: (id: string, sequence: number | null) => void;
  onPreview: (email: any) => void;
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
      <td style={{...styles.td, width: '12%'}}>{email.subject || 'No subject'}</td>
      <td style={{...styles.td, width: '6%'}}>
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
      <td style={{...styles.td, width: '8%'}}>{email.fromName || 'N/A'}</td>
      <td style={{...styles.td, width: '5%', textAlign: 'center'}}>{email.sent || 0}</td>
      <td style={{...styles.td, width: '5%', textAlign: 'center'}}>{email.opened || 0}</td>
      <td style={{...styles.td, width: '5%', textAlign: 'center'}}>{email.clicked || 0}</td>
      <td style={{...styles.td, width: '47%'}}>
        <div style={styles.bodyPreviewContainer}>
          <div style={{
            ...styles.bodyPreview,
            whiteSpace: isBodyExpanded ? 'normal' : 'nowrap',
            overflow: isBodyExpanded ? 'visible' : 'hidden'
          }}>
            {email.bodyText || 'No preview'}
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<HubSpotMarketingEmail | null>(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set()); // Changed: Default to empty set (all collapsed)
  const [expandedBodyPreviews, setExpandedBodyPreviews] = useState<Set<string>>(new Set());
  const [emailsByWorkflow, setEmailsByWorkflow] = useState<Record<string, any[]>>({});
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
      const response = await fetch('/api/dashboard');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dashboard data');
      }
      
      const dashboardData: DashboardData = await response.json();
      setData(dashboardData);
      
      // Group emails by workflow - NO DEFAULT EXPANSION
      const grouped = dashboardData.emails.reduce((acc: any, email: any) => {
        const workflowName = email.workflowName;
        if (!acc[workflowName]) {
          acc[workflowName] = [];
        }
        acc[workflowName].push(email);
        return acc;
      }, {});
      
      setEmailsByWorkflow(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
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

  const handleDragEnd = (event: DragEndEvent, workflowName: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setEmailsByWorkflow(prev => {
      const workflowEmails = [...prev[workflowName]];
      const oldIndex = workflowEmails.findIndex(e => e.id === active.id);
      const newIndex = workflowEmails.findIndex(e => e.id === over.id);

      const reorderedEmails = arrayMove(workflowEmails, oldIndex, newIndex);

      return {
        ...prev,
        [workflowName]: reorderedEmails
      };
    });
  };

  const handleSequenceChange = (emailId: string, sequence: number | null) => {
    setEmailsByWorkflow(prev => {
      const newWorkflows = { ...prev };
      
      // Find which workflow contains this email
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

  // Get workflow info for displaying last updated
  const getWorkflowInfo = (workflowName: string) => {
    return data.workflows.find(w => w.name === workflowName);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>HubSpot Workflow Emails</h1>
        <button onClick={fetchDashboardData} style={styles.refreshButton}>
          Refresh Data
        </button>
      </header>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <h3>Workflows</h3>
          <p style={styles.statNumber}>{Object.keys(emailsByWorkflow).length}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Total Email Instances</h3>
          <p style={styles.statNumber}>{data.emails.length}</p>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Emails by Workflow</h2>
        
        {Object.entries(emailsByWorkflow).sort(([a], [b]) => a.localeCompare(b)).map(([workflowName, emails]: [string, any]) => {
          const isExpanded = expandedWorkflows.has(workflowName);
          const workflowInfo = getWorkflowInfo(workflowName);
          const workflowId = (emails[0] as any).workflowId;
          
          // Sort emails for this workflow
          const sortedEmails = [...emails].sort((a, b) => {
            if (a.emailSequence && b.emailSequence) {
              return a.emailSequence - b.emailSequence;
            }
            if (a.emailSequence && !b.emailSequence) return -1;
            if (!a.emailSequence && b.emailSequence) return 1;
            return 0;
          });
          
          return (
            <div key={workflowName} style={styles.workflowGroup}>
              <div 
                style={styles.workflowHeader}
                onClick={() => toggleWorkflow(workflowName)}
              >
                <div style={styles.workflowHeaderContent}>
                  <span style={styles.expandIcon}>
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
                    onDragEnd={(event) => handleDragEnd(event, workflowName)}
                  >
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={{...styles.th, width: '2%'}}>Move</th>
                          <th style={{...styles.th, width: '10%'}}>Email Name</th>
                          <th style={{...styles.th, width: '12%'}}>Subject Line</th>
                          <th style={{...styles.th, width: '6%'}}>Actions</th>
                          <th style={{...styles.th, width: '8%'}}>From Name</th>
                          <th style={{...styles.th, width: '5%'}}>Sent</th>
                          <th style={{...styles.th, width: '5%'}}>Opened</th>
                          <th style={{...styles.th, width: '5%'}}>Clicked</th>
                          <th style={{...styles.th, width: '47%'}}>Body Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        <SortableContext
                          items={sortedEmails.map(e => e.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {sortedEmails.map((email) => (
                            <SortableEmailRow
                              key={email.id}
                              email={email}
                              onSequenceChange={handleSequenceChange}
                              onPreview={setSelectedEmail}
                              onBodyToggle={toggleBodyPreview}
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
        })}
      </section>

      {/* Email Preview Modal with iframe */}
      {selectedEmail && (
        <div style={styles.modal} onClick={() => setSelectedEmail(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2>{selectedEmail.name}</h2>
                <p style={styles.modalSubject}>Subject: {selectedEmail.subject}</p>
                <p style={styles.modalFrom}>From: {selectedEmail.fromName}</p>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              <iframe
                src={selectedEmail.previewUrl}
                style={styles.previewIframe}
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
            <div style={styles.modalFooter}>
              <a
                href={selectedEmail.editUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.modalEditButton}
              >
                Edit in HubSpot
              </a>
            </div>
          </div>
        </div>
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
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s',
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
  },
  workflowName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#007bff',
    textDecoration: 'none',
    flex: 1,
  },
  emailCount: {
    fontSize: '14px',
    color: '#666',
    fontWeight: 'normal',
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
  previewButton: {
    padding: '8px 12px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
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
    maxWidth: '900px',
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
  modalSubject: {
    fontSize: '14px',
    color: '#666',
    marginTop: '5px',
  },
  modalFrom: {
    fontSize: '14px',
    color: '#666',
    marginTop: '5px',
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
  previewIframe: {
    width: '100%',
    height: '600px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
  },
  modalFooter: {
    padding: '20px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  modalEditButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
  },
};
