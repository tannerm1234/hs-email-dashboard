'use client';

import { useState, useEffect } from 'react';
import type { DashboardData, HubSpotMarketingEmail } from '@/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<HubSpotMarketingEmail | null>(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [expandedBodyPreviews, setExpandedBodyPreviews] = useState<Set<string>>(new Set());
  const portalId = '6885872';

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
      
      // Expand all workflows by default
      const workflowNames = new Set(dashboardData.emails.map((e: any) => e.workflowName));
      setExpandedWorkflows(workflowNames);
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

  const renderEmailPreview = (email: HubSpotMarketingEmail) => {
    try {
      const content = JSON.parse(email.htmlBody);
      return <div dangerouslySetInnerHTML={{ __html: email.bodyText || 'No preview available' }} />;
    } catch {
      return <div>{email.bodyText || 'No preview available'}</div>;
    }
  };

  // Group emails by workflow
  const emailsByWorkflow = data?.emails.reduce((acc: any, email: any) => {
    const workflowName = email.workflowName;
    if (!acc[workflowName]) {
      acc[workflowName] = [];
    }
    acc[workflowName].push(email);
    return acc;
  }, {}) || {};

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
          const workflowId = (emails[0] as any).workflowId;
          
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
                </div>
              </div>
              
              {isExpanded && (
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{...styles.th, width: '20%'}}>Email Name</th>
                        <th style={{...styles.th, width: '20%'}}>Subject Line</th>
                        <th style={{...styles.th, width: '15%'}}>Actions</th>
                        <th style={{...styles.th, width: '20%'}}>From Name</th>
                        <th style={{...styles.th, width: '25%'}}>Body Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(emails as any[]).map((email) => {
                        const isBodyExpanded = expandedBodyPreviews.has(email.id);
                        
                        return (
                          <tr key={email.id} style={styles.tr}>
                            <td style={{...styles.td, width: '20%'}}>
                              <strong>{email.name}</strong>
                            </td>
                            <td style={{...styles.td, width: '20%'}}>{email.subject || 'No subject'}</td>
                            <td style={{...styles.td, width: '15%'}}>
                              <div style={styles.actionButtons}>
                                <a
                                  href={email.editUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={styles.editButton}
                                >
                                  Edit Email
                                </a>
                                <button
                                  onClick={() => setSelectedEmail(email)}
                                  style={styles.previewButton}
                                >
                                  Preview
                                </button>
                              </div>
                            </td>
                            <td style={{...styles.td, width: '20%'}}>{email.fromName || 'N/A'}</td>
                            <td style={{...styles.td, width: '25%'}}>
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
                                    onClick={() => toggleBodyPreview(email.id)}
                                    style={styles.expandBodyButton}
                                  >
                                    {isBodyExpanded ? '▲' : '▼'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Email Preview Modal */}
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
              <div style={styles.emailBodyPreview}>
                {renderEmailPreview(selectedEmail)}
              </div>
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
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '20px',
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
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '20px',
    color: '#d32f2f',
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
    ':hover': {
      backgroundColor: '#e9ecef',
    },
  },
  workflowHeaderContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
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
  emailBodyPreview: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '20px',
    minHeight: '400px',
    backgroundColor: '#fff',
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
