export interface HubSpotWorkflow {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  insertedAt: number;
  updatedAt: number;
  lastExecutedAt?: number;
  enrollmentCount?: number;
  marketingEmailCount: number;
  marketingEmailIds: string[];
}

export interface HubSpotMarketingEmail {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  htmlContent?: string; // Add field for rendered HTML content
  previewUrl: string;
  editUrl: string;
  workflowIds: string[];
  workflowNames: string[];
  fromName?: string;
  bodyText?: string;
  emailSequence?: number | null; // Can be edited by user
}

export interface EnrollmentStats {
  workflowId: string;
  last7Days: number;
}

export interface DashboardData {
  workflows: HubSpotWorkflow[];
  emails: HubSpotMarketingEmail[];
  enrollmentStats: EnrollmentStats[];
}
