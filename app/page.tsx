'use client';

import { useState, useEffect } from 'react';
import type { DashboardData, HubSpotMarketingEmail } from '@/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<HubSpotMarketingEmail | null>(null);
  const portalId = '6885872'; // Your portal ID

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

  const renderEmailPreview = (email: HubSpotMarketingEmail) => {
    try {
      const content = JSON.parse(email.htmlBody);
      // This is a simplified preview - you might need to enhance based on HubSpot's structure
      return <div dangerouslySetInnerHTML={{ __html: email.bodyText || 'No preview available' }} />;
    } catch {
      return <div>{email.bodyText || 'No preview available'}</div>;
    }
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
        <h1 style={styles.title}>HubSpot Workflow Emails</h1>
        <button onClick={fetchDashboardData} style={styles.refreshButton}>
          Refresh Data
        </button>
      </header>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <h3>Workflows</h3>
          <p style={styles.statNumber}>{data.workflows.length}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Emails in Workflows</h3>
          <p style={styles.statNumber}>{data.emails.length}</p>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Automated Marketing Emails</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Email Name</th>
                <th style={styles.th}>Subject Line</th>
                <th style={styles.th}>From Name</th>
                <th style={styles.th}>Body Preview</th>
                <th style={styles.th}>Workflows</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.emails.map((email) => (
                <tr key={email.id} style={styles.tr}>
                  <td style={styles.td}>
                    <strong>{email.name}</strong>
                  </td>
                  <td style={styles.td}>{email.subject || 'No subject'}</td>
                  <td style={styles.td}>{email.fromName || 'N/A'}</td>
                  <td style={styles.td}>
                    <div style={styles.bodyPreview}>
                      {email.bodyText || 'No preview'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.workflowLinks}>
                      {email.workflowNames.map((name, index) => {
                        const workflowId = email.workflowIds[index];
                        return (
                          <div key={index} style={styles.workflowItem}>
                            <a
                              href={`https://app.hubspot.com/workflows/${portalId}/platform/flow/${workflowId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={styles.workflowLink}
                            >
                              {name}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td style={styles.td}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  bodyPreview: {
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: '#666',
    fontSize: '13px',
  },
  workflowLinks: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  workflowItem: {
    marginBottom: '5px',
  },
  workflowLink: {
    color: '#007bff',
    textDecoration: 'none',
    fontSize: '13px',
    display: 'inline-block',
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
