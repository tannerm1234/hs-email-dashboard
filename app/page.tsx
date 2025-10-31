'use client';

import { useState, useEffect } from 'react';
import type { DashboardData, HubSpotWorkflow, HubSpotMarketingEmail, EnrollmentStats } from '@/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<HubSpotMarketingEmail | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getEnrollmentCount = (workflowId: string): number => {
    const stat = data?.enrollmentStats.find(s => s.workflowId === workflowId);
    return stat?.last7Days || 0;
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>HubSpot Email Automation Dashboard</h1>
        <button onClick={fetchDashboardData} style={styles.refreshButton}>
          Refresh Data
        </button>
      </header>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <h3>Active Workflows</h3>
          <p style={styles.statNumber}>{data.workflows.length}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Marketing Emails</h3>
          <p style={styles.statNumber}>{data.emails.length}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Total Enrollments (7d)</h3>
          <p style={styles.statNumber}>
            {data.enrollmentStats.reduce((sum, stat) => sum + stat.last7Days, 0)}
          </p>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Workflows with Marketing Emails</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Workflow Name</th>
                <th style={styles.th}>Last Action</th>
                <th style={styles.th}>Updated On</th>
                <th style={styles.th}>Enrolled (7d)</th>
                <th style={styles.th}>Marketing Emails</th>
              </tr>
            </thead>
            <tbody>
              {data.workflows.map((workflow) => (
                <tr key={workflow.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.workflowName}>
                      {workflow.name}
                      {!workflow.enabled && (
                        <span style={styles.disabledBadge}>Disabled</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {workflow.lastExecutedAt
                      ? formatDate(workflow.lastExecutedAt)
                      : 'Never'}
                  </td>
                  <td style={styles.td}>{formatDate(workflow.updatedAt)}</td>
                  <td style={styles.td}>{getEnrollmentCount(workflow.id)}</td>
                  <td style={styles.td}>{workflow.marketingEmailCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Marketing Emails</h2>
        <div style={styles.emailGrid}>
          {data.emails.map((email) => (
            <div key={email.id} style={styles.emailCard}>
              <div style={styles.emailHeader}>
                <h3 style={styles.emailName}>{email.name}</h3>
                <div style={styles.emailActions}>
                  <a
                    href={email.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.previewLink}
                  >
                    Preview
                  </a>
                  <a
                    href={email.editUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.editLink}
                  >
                    Edit
                  </a>
                </div>
              </div>
              
              <div style={styles.emailSubject}>
                <strong>Subject:</strong> {email.subject || 'No subject'}
              </div>
              
              <div style={styles.emailWorkflows}>
                <strong>Used in workflows:</strong>
                {email.workflowNames.length > 0 ? (
                  <ul style={styles.workflowList}>
                    {email.workflowNames.map((name, index) => (
                      <li key={index}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={styles.noWorkflows}> None</span>
                )}
              </div>
              
              <button
                onClick={() => setSelectedEmail(email)}
                style={styles.viewBodyButton}
              >
                View Email Body
              </button>
            </div>
          ))}
        </div>
      </section>

      {selectedEmail && (
        <div style={styles.modal} onClick={() => setSelectedEmail(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>{selectedEmail.name}</h2>
              <button
                onClick={() => setSelectedEmail(null)}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.emailBodyPreview}>
                <iframe
                  srcDoc={selectedEmail.htmlBody}
                  style={styles.iframe}
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
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
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    padding: '15px',
    textAlign: 'left' as const,
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 'bold',
    color: '#555',
    backgroundColor: '#f9f9f9',
  },
  tr: {
    borderBottom: '1px solid #e0e0e0',
  },
  td: {
    padding: '15px',
  },
  workflowName: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  disabledBadge: {
    padding: '2px 8px',
    backgroundColor: '#ff9800',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  emailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
  },
  emailCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  emailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '15px',
  },
  emailName: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
    flex: 1,
  },
  emailActions: {
    display: 'flex',
    gap: '10px',
  },
  previewLink: {
    padding: '5px 12px',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500',
  },
  editLink: {
    padding: '5px 12px',
    backgroundColor: '#f3e5f5',
    color: '#7b1fa2',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500',
  },
  emailSubject: {
    marginBottom: '15px',
    fontSize: '14px',
    color: '#666',
  },
  emailWorkflows: {
    marginBottom: '15px',
    fontSize: '14px',
    color: '#666',
  },
  workflowList: {
    marginTop: '8px',
    marginLeft: '20px',
    fontSize: '13px',
  },
  noWorkflows: {
    color: '#999',
    fontStyle: 'italic' as const,
  },
  viewBodyButton: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
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
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  emailBodyPreview: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    minHeight: '400px',
  },
  iframe: {
    width: '100%',
    minHeight: '400px',
    border: 'none',
  },
};
