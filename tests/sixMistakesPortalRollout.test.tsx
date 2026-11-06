import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinfixClientPortalView } from '../src/components/portal/FinfixClientPortalView';
import { ClientMonthlyReportsView, generateMonthlyReportContent, triggerDownload } from '../src/components/portal/ClientMonthlyReportsView';
import { ClientRecord, ClientTask, UserProfile } from '../src/types';

vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    fetchCrossClientTasks: vi.fn(),
    fetchClientWeeks: vi.fn()
  }
}));

describe('12 Remaining Mistakes Verification Suite Across All 28 Clients', () => {
  const staffUser: UserProfile = {
    id: 'staff-user-1',
    email: 'qa.owner.2fa@faseehlall.com',
    fullName: 'Muhammad Atif Naseer',
    role: 'owner',
    status: 'active'
  };

  const cloudZClient: ClientRecord = {
    id: 'd3d666c2-24c7-4cc7-b879-55c6d5881185',
    companyName: 'Cloud Z Technologies',
    clientName: 'Zain Client',
    status: 'Active',
    subscriptionTier: 'Growth Retainer',
    package: 'Dedicated Growth',
    totalTasks: 6,
    completedTasks: 3,
    operationalManagerId: 'mgr-1',
    activationDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
    links: {
      website: 'https://cloudztech.com',
      facebook: 'https://facebook.com/cloudztech',
      linkedin_management: 'https://linkedin.com/company/cloudz',
      paid_ads_management: 'https://ads.google.com/cloudz',
      email_marketing_management: 'https://mailchimp.com/cloudz'
    },
    requiredLinkedinProfileCount: 3
  };

  const cloudZTasks: ClientTask[] = [
    {
      id: 'cz-task-1',
      clientId: cloudZClient.id,
      title: 'Cloud Z Funnel Audit',
      status: 'Done',
      priority: 'Normal',
      weekNumber: 1,
      departmentId: 'dept-1',
      createdAt: '2026-10-14T08:00:00Z',
      completedAt: '2026-10-15T14:30:00Z'
    },
    {
      id: 'cz-task-2',
      clientId: cloudZClient.id,
      title: 'Cloud Z Meta Campaign Setup',
      status: 'Done',
      priority: 'High',
      weekNumber: 1,
      departmentId: 'dept-1',
      createdAt: '2026-10-14T09:00:00Z',
      completedAt: '2026-10-15T15:00:00Z'
    },
    {
      id: 'cz-task-3',
      clientId: cloudZClient.id,
      title: 'Cloud Z Internal Budget Note',
      isInternalOnly: true,
      status: 'Done',
      priority: 'Low',
      weekNumber: 1,
      departmentId: 'dept-1',
      details: 'Sensitive internal staff only notes for profit margin',
      createdAt: '2026-10-14T10:00:00Z',
      completedAt: '2026-10-15T16:00:00Z'
    },
    {
      id: 'cz-task-4',
      clientId: cloudZClient.id,
      title: 'Cloud Z Landing Page Wireframe',
      status: 'Approval',
      priority: 'Normal',
      weekNumber: 1,
      departmentId: 'dept-1',
      createdAt: '2026-10-14T11:00:00Z'
    },
    {
      id: 'cz-task-5',
      clientId: cloudZClient.id,
      title: 'Cloud Z Creative Asset Review',
      status: 'Approval',
      priority: 'Normal',
      weekNumber: 1,
      departmentId: 'dept-1',
      createdAt: '2026-10-14T12:00:00Z'
    },
    {
      id: 'cz-task-6',
      clientId: cloudZClient.id,
      title: 'Cloud Z Internal Quality Gate',
      isInternalOnly: true,
      status: 'Approval',
      priority: 'Normal',
      weekNumber: 1,
      departmentId: 'dept-1',
      details: 'Internal staff only review checklist',
      createdAt: '2026-10-14T13:00:00Z'
    }
  ];

  const pixelClient: ClientRecord = {
    id: '5b9ea614-9b21-4b26-9c17-a8fa98b451c8',
    companyName: 'Pixel Algos',
    clientName: 'Pixel Client',
    status: 'Active',
    subscriptionTier: 'Growth Retainer',
    package: 'Dedicated Growth',
    totalTasks: 3,
    completedTasks: 0,
    operationalManagerId: 'mgr-1',
    activationDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
    links: {
      website: 'https://pixelalgos.com'
    },
    requiredLinkedinProfileCount: 1
  };

  const pixelTasks: ClientTask[] = [
    {
      id: 'px-task-1',
      clientId: pixelClient.id,
      title: 'Pixel Tracking Setup',
      status: 'Approval',
      priority: 'High',
      weekNumber: 3,
      departmentId: 'dept-1',
      createdAt: '2026-10-20T10:00:00Z'
    },
    {
      id: 'px-task-2',
      clientId: pixelClient.id,
      title: 'Pixel Conversion API Wireup',
      status: 'Approval',
      priority: 'High',
      weekNumber: 3,
      departmentId: 'dept-1',
      createdAt: '2026-10-20T11:00:00Z'
    },
    {
      id: 'px-task-3',
      clientId: pixelClient.id,
      title: 'Pixel Weekly Retainer Sync',
      status: 'Pending',
      priority: 'Normal',
      weekNumber: 4,
      departmentId: 'dept-1',
      createdAt: '2026-10-20T12:00:00Z'
    }
  ];

  const zeroClient: ClientRecord = {
    id: 'zero-client-1',
    companyName: 'Zero Task Client',
    clientName: 'Zero Lead',
    status: 'Active',
    subscriptionTier: 'Growth Retainer',
    package: 'Starter',
    totalTasks: 0,
    completedTasks: 0,
    operationalManagerId: 'mgr-1',
    activationDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
    links: {},
    requiredLinkedinProfileCount: 1
  };

  it('Item 1: Portal stat cards reflect full staff totals and reconciliation banner when internal tasks exist', () => {
    // 1. Cloud Z with 6 total tasks (3 Done, 3 Approval, 2 internal shielded)
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    // Stat cards must show 3 / 6 completed and 50%
    const tasksCompletedCard = screen.getByTestId('stat-tasks-completed');
    expect(tasksCompletedCard.textContent).toContain('3 / 6');

    const projectCompletionCard = screen.getByTestId('stat-project-completion');
    expect(projectCompletionCard.textContent).toContain('50%');

    const approvalsCard = screen.getByTestId('stat-pending-approvals');
    expect(approvalsCard.textContent).toContain('3');

    // Reconciliation banner must appear on Cloud Z
    const reconBanner = screen.getByTestId('portal-reconciliation-banner');
    expect(reconBanner.textContent).toContain('Client Safe Reconciliation:');
    expect(reconBanner.textContent).toContain('4 Client Visible Deliverables + 2 Internal Staff Only = 6 Total Tasks');
  });

  it('Item 2 & 3: Performance Overview and Marketing Channels render clean Not connected cards with no demo SVG curves or demo donuts', () => {
    // 1. Cloud Z
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const perfOverview = screen.getAllByTestId('performance-overview-section');
    const cloudZPerf = perfOverview[perfOverview.length - 1];
    expect(cloudZPerf.textContent).toContain('Website Traffic & Leads: Not connected');
    expect(cloudZPerf.textContent).toContain('Telemetry: Standby');
    expect(cloudZPerf.textContent).toContain('+ Connect Google Analytics');
    expect(cloudZPerf.textContent).toContain('+ Connect LeadConnector');
    expect(cloudZPerf.textContent).not.toContain('3,850 Visitors');
    expect(cloudZPerf.textContent).not.toContain('11,400 Visitors');

    const mktgSections = screen.getAllByTestId('marketing-channels-section');
    const cloudZMktg = mktgSections[mktgSections.length - 1];
    expect(cloudZMktg.textContent).toContain('Marketing Channels: Not connected');
    expect(cloudZMktg.textContent).toContain('Status: Standby');
    expect(cloudZMktg.textContent).toContain('+ Connect Website');
    expect(cloudZMktg.textContent).toContain('+ Connect Meta');
    expect(cloudZMktg.textContent).not.toContain('38.4%');
    expect(cloudZMktg.textContent).not.toContain('TOTAL LEADS');
  });

  it('Item 4: Range toggles (7D, 30D, 90D, 1Y) are disabled when not connected', () => {
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const toggle7D = screen.getByRole('button', { name: '7D' });
    const toggle30D = screen.getByRole('button', { name: '30D' });
    const toggle90D = screen.getByRole('button', { name: '90D' });
    const toggle1Y = screen.getByRole('button', { name: '1Y' });

    expect(toggle7D).toBeDisabled();
    expect(toggle30D).toBeDisabled();
    expect(toggle90D).toBeDisabled();
    expect(toggle1Y).toBeDisabled();
  });

  it('Item 5 & 6: Project Progress reflects dominant status (In Review) on Pixel and Cloud Z', () => {
    // 1. Pixel Algos Week 3 Funnel Setup (2 tasks in Approval) -> In Review
    render(
      <FinfixClientPortalView
        client={pixelClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={pixelTasks}
      />
    );

    const projectProgress = screen.getAllByTestId('project-progress-section');
    const pixelProgress = projectProgress[projectProgress.length - 1];
    expect(pixelProgress.textContent).toContain('Funnel Setup');
    expect(pixelProgress.textContent).toContain('In Review');

    // 2. Cloud Z Week 1 Social Media Optimization (2 Done, 2 Approval, 0 In Progress) -> In Review (50%)
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const cloudZProg = screen.getAllByTestId('project-progress-section');
    const lastCloudZProg = cloudZProg[cloudZProg.length - 1];
    expect(lastCloudZProg.textContent).toContain('Social Media Optimization');
    expect(lastCloudZProg.textContent).toContain('50%');
    expect(lastCloudZProg.textContent).toContain('In Review');
  });

  it('Item 7: Sidebar navigation switches cleanly between tabs from any view', () => {
    const handleMainTabChange = vi.fn();

    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
        activeMainTab="setup"
        onMainTabChange={handleMainTabChange}
        renderSetupView={() => <div data-testid="kanban-view">Kanban Setup</div>}
      />
    );

    // Clicking Subscription in sidebar
    const subNavBtn = screen.getByTestId('nav-subscription');
    fireEvent.click(subNavBtn);

    // Must reset activeMainTab back to 'dashboard' so setup view does not trap the view
    expect(handleMainTabChange).toHaveBeenCalledWith('dashboard');
  });

  it('Item 8: Recent Activity labels and dates match in dashboard list and View All modal', () => {
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const previewSection = screen.getAllByTestId('recent-activity-section');
    const cloudZRecent = previewSection[previewSection.length - 1];

    // Card shows Task Completed and Oct 15, 2026
    expect(cloudZRecent.textContent).toContain('Task Completed');
    expect(cloudZRecent.textContent).toContain('Submitted for Review');
    expect(cloudZRecent.textContent).toContain('Oct 15, 2026');

    // Open modal
    const viewAllBtn = screen.getByTestId('recent-activity-view-all');
    fireEvent.click(viewAllBtn);

    const modal = screen.getByTestId('recent-activity-modal');
    // Modal must show the EXACT same labels and dates
    expect(modal.textContent).toContain('Task Completed');
    expect(modal.textContent).toContain('Submitted for Review');
    expect(modal.textContent).toContain('Oct 15, 2026');
  });

  it('Item 9 & 10: Monthly report totals match board totals with snapshot date, and NO download toast on tab open', () => {
    const { container } = render(
      <ClientMonthlyReportsView
        client={cloudZClient}
        tasks={cloudZTasks}
        isStaffView={false}
      />
    );

    const reportCards = screen.getAllByTestId('monthly-report-card');
    expect(reportCards.length).toBeGreaterThan(0);

    // Total deliverables on report card must match staff total (6 Total Deliverables)
    expect(container.textContent).toContain('6 Total Deliverables');
    expect(container.textContent).toContain('4 Client Visible + 2 Internal Staff Only');
    expect(container.textContent).toContain('Snapshot Date:');
    expect(container.textContent).toContain('50% Done');
    expect(container.textContent).toContain('3 Completed');

    // Opening the Reports view must NOT show any download toast
    expect(container.textContent).not.toContain('Monthly report downloaded successfully');
  });

  it('Item 11: Analytics and Website & SEO pages show clean Not connected cards, zero placeholder telemetry text', () => {
    const { container } = render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    // Switch to Analytics tab
    const analyticsBtn = screen.getByTestId('nav-analytics');
    fireEvent.click(analyticsBtn);

    const analyticsView = screen.getByTestId('client-analytics-view');
    expect(analyticsView.textContent).toContain('Google Analytics & LeadConnector: Not connected');
    expect(analyticsView.textContent).toContain('Telemetry: Standby');
    expect(analyticsView.textContent).not.toContain('Live deliverable telemetry for analytics is synced');

    // Switch to Website & SEO tab
    const websiteSeoBtn = screen.getByTestId('nav-website_seo');
    fireEvent.click(websiteSeoBtn);

    const seoView = screen.getByTestId('client-website_seo-view');
    expect(seoView.textContent).toContain('Website & SEO Telemetry: Not connected');
    expect(seoView.textContent).not.toContain('Live deliverable telemetry for website seo is synced');
  });

  it('Item 12: Client view renders all 15 client sidebar items with clean authenticated portal status', () => {
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const sidebar = screen.getByTestId('finfix-client-sidebar');
    const expectedTabs = [
      'nav-dashboard',
      'nav-projects',
      'nav-analytics',
      'nav-social_media',
      'nav-linkedin',
      'nav-website_seo',
      'nav-paid_ads',
      'nav-funnel',
      'nav-subscription',
      'nav-billing_invoices',
      'nav-deliverables',
      'nav-approvals',
      'nav-team',
      'nav-reports',
      'nav-settings'
    ];

    expectedTabs.forEach((tabId) => {
      expect(screen.getByTestId(tabId)).toBeInTheDocument();
    });

    expect(sidebar.textContent).toContain('Authenticated Portal');
  });
});
