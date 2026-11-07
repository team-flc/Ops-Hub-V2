import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { FinfixClientPortalView, FINFIX_NAV_ITEMS } from '../src/components/portal/FinfixClientPortalView';
import { ClientRecord, ClientTask, UserProfile } from '../src/types';
import { filterAndSanitizeClientDeliverables } from '../src/components/clients/ClientWorkspaceView';
import { isInternalOnlyTask, sanitizeClientDeliverableTitle } from '../src/lib/permissions';

// Mock taskManagementService
vi.mock('../src/lib/taskManagementService', () => {
  return {
    taskManagementService: {
      fetchCrossClientTasks: vi.fn(),
      fetchClientWeeks: vi.fn().mockResolvedValue({
        data: {
          1: 'Foundations & Social Media',
          2: 'LinkedIn Optimization',
          3: 'Funnel Setup',
          4: 'Paid Ads Setup'
        },
        error: null
      })
    }
  };
});

describe('Finfix Pro Client Portal & Security Leak Fix Suite', () => {
  const mavenClient: ClientRecord = {
    id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3',
    companyName: 'Maven Professionals',
    clientName: 'Faseeh Lall',
    operationalManagerName: 'Muhammad Atif Naseer',
    clientEmail: 'contact@mavenprofessionals.com',
    status: 'Active',
    subscriptionTier: 'Growth Retainer',
    totalTasks: 10,
    completedTasks: 0,
    overdueTasks: 0,
    healthScore: 92,
    links: {
      website: 'https://mavenprofessionals.com',
      flc_landing_page: 'https://faseehlall.com/maven',
      brand_identity: 'https://brand.maven.com',
      google_drive: 'https://drive.google.com/drive/folders/internal-staff-only',
      slack_channel: 'https://slack.com/archives/C12345',
      whatsapp_group: 'https://chat.whatsapp.com/invite999',
      poc_number: 'https://wa.me/923001234567',
      poc_email: 'poc@maven.com'
    }
  };

  const archivedClient: ClientRecord = {
    ...mavenClient,
    id: 'archived-client-123',
    companyName: 'QA DUMMY Client',
    status: 'Archived'
  };

  const staffUser: UserProfile = {
    id: 'staff-1',
    email: 'atif@faseehlall.com',
    fullName: 'Muhammad Atif Naseer',
    role: 'operational_manager',
    status: 'active'
  };

  // Staff board has 10 tasks for Maven Week 3:
  // 1 task is internal invoice / operational reminder (In Progress)
  // 1 task is client deliverable (In Progress)
  // 8 tasks are client deliverables (Approval)
  // Total: 0 Pending, 2 In Progress, 8 Approval, 0 Done = 10 Tasks
  const maven10Tasks: ClientTask[] = [
    {
      id: 'task-internal-1',
      clientId: mavenClient.id,
      title: 'Invoice Payment Followup PKR 18,300',
      status: 'In Progress',
      approvalMode: 'Internal Only',
      weekNumber: 3,
      details: 'remind Faseeh about the Maven 6 PM shift and collect invoice',
      completionNotes: 'Internal finance update',
      assigneeName: 'Muhammad Atif Naseer',
      timerStartedAt: '2026-11-04T02:00:00Z',
      timeSpentSeconds: 3600,
      evidenceUrl: 'https://drive.google.com/drive/folders/invoice123'
    },
    {
      id: 'task-client-in-flight',
      clientId: mavenClient.id,
      title: 'Funnel Landing Page Draft',
      status: 'In Progress',
      approvalMode: 'Client Approval Required',
      weekNumber: 3,
      details: 'Sensitive internal copy notes',
      completionNotes: 'Draft ready by Maaz',
      assigneeName: 'Maaz Staff',
      evidenceUrl: 'https://loom.com/share/deliverable1'
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `task-approval-${i + 1}`,
      clientId: mavenClient.id,
      title: `Funnel Setup Milestone Step ${i + 1}`,
      status: 'Approval' as const,
      approvalMode: 'Client Approval Required' as const,
      weekNumber: 3,
      details: `Internal notes ${i + 1}`,
      completionNotes: `Staff completion summary ${i + 1}`,
      assigneeName: 'Staff Assignee',
      evidenceUrl: 'https://loom.com/share/deliverable-approved'
    }))
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1.1 Sidebar renders exactly 15 navigation items in strict required order without staff links or 24 workspace links', async () => {
    const { taskManagementService } = await import('../src/lib/taskManagementService');
    (taskManagementService.fetchCrossClientTasks as any).mockResolvedValue({
      data: maven10Tasks,
      error: null
    });

    const { container } = render(
      <FinfixClientPortalView
        client={mavenClient}
        currentUserProfile={staffUser}
        isPreview={true}
      />
    );

    const sidebar = screen.getByTestId('finfix-client-sidebar');
    expect(sidebar).toBeDefined();

    // Verify 15 exact items
    expect(FINFIX_NAV_ITEMS).toHaveLength(15);
    const expectedOrder = [
      'Dashboard',
      'Projects',
      'Analytics',
      'Social Media',
      'LinkedIn',
      'Website and SEO',
      'Paid Ads',
      'Funnel',
      'Subscription',
      'Billing and Invoices',
      'Deliverables',
      'Approvals',
      'Team',
      'Reports',
      'Settings'
    ];

    expectedOrder.forEach((label, idx) => {
      expect(FINFIX_NAV_ITEMS[idx].label).toBe(label);
      expect(sidebar.textContent).toContain(label);
    });

    // Zero internal tool links or staff 24 links
    expect(sidebar.textContent).not.toContain('Workspace Links');
    expect(sidebar.textContent).not.toContain('24 active');
    expect(sidebar.textContent).not.toContain('Google Drive');
    expect(sidebar.textContent).not.toContain('Slack');
    expect(sidebar.textContent).not.toContain('POC WhatsApp');
    expect(sidebar.textContent).not.toContain('POC Email');
  });

  it('1.2 Header renders client greeting with real client name, date, client banner, and NO staff breadcrumb/menu/banner', async () => {
    const { taskManagementService } = await import('../src/lib/taskManagementService');
    (taskManagementService.fetchCrossClientTasks as any).mockResolvedValue({
      data: maven10Tasks,
      error: null
    });

    const { container } = render(
      <FinfixClientPortalView
        client={mavenClient}
        currentUserProfile={staffUser}
        isPreview={true}
      />
    );

    const header = screen.getByTestId('finfix-client-header');
    expect(header.textContent).toContain('Welcome back, Maven Professionals');

    // Banner
    const banner = screen.getByTestId('client-portal-banner');
    expect(banner.textContent).toContain('Client Portal • Active Workspace for Maven Professionals');

    // Strictly NO staff breadcrumb, NO staff profile menu, NO staff banner, NO Exit Preview banner
    expect(header.textContent).not.toContain('Workspaces >');
    expect(header.textContent).not.toContain('Muhammad Atif Naseer');
    expect(container.textContent).not.toContain('Client Preview Mode • Read-Only');
    expect(container.textContent).not.toContain('Exit Preview');
  });

  it('1.3 Four stat cards calculate correctly from client data (Project Completion %, Tasks Completed, Pending Approvals, Subscription)', async () => {
    const { taskManagementService } = await import('../src/lib/taskManagementService');
    (taskManagementService.fetchCrossClientTasks as any).mockResolvedValue({
      data: maven10Tasks,
      error: null
    });

    render(
      <FinfixClientPortalView
        client={mavenClient}
        currentUserProfile={staffUser}
        isPreview={true}
      />
    );

    // Wait for async task loading to populate
    await waitFor(() => {
      const tasksCard = screen.getByTestId('stat-tasks-completed');
      expect(tasksCard.textContent).toContain('0/10');
    });

    const completionCard = screen.getByTestId('stat-project-completion');
    expect(completionCard.textContent).toContain('0%');

    // 8 tasks in Approval
    const approvalsCard = screen.getByTestId('stat-pending-approvals');
    expect(approvalsCard.textContent).toContain('8');

    // Subscription card
    const subCard = screen.getByTestId('stat-subscription');
    expect(subCard.textContent).toContain('Growth Retainer');
    expect(subCard.textContent).toContain('Active');
  });

  it('1.4 Performance Overview & 1.8 Marketing Channels display "Not connected" and do not draw invented data', async () => {
    const { taskManagementService } = await import('../src/lib/taskManagementService');
    (taskManagementService.fetchCrossClientTasks as any).mockResolvedValue({
      data: maven10Tasks,
      error: null
    });

    render(
      <FinfixClientPortalView
        client={mavenClient}
        currentUserProfile={staffUser}
        isPreview={true}
      />
    );

    const perfSection = screen.getByTestId('performance-overview-section');
    expect(perfSection.textContent).toContain('Website Traffic & Leads: Not connected');

    // Toggles 7D, 30D, 90D, 1Y
    expect(perfSection.textContent).toContain('7D');
    expect(perfSection.textContent).toContain('30D');
    expect(perfSection.textContent).toContain('90D');
    expect(perfSection.textContent).toContain('1Y');

    const mktgSection = screen.getByTestId('marketing-channels-section');
    expect(mktgSection.textContent).toContain('Marketing Channels: Not connected');
  });

  it('1.5 Project Progress renders one row per client project with progress % and status', async () => {
    const { taskManagementService } = await import('../src/lib/taskManagementService');
    (taskManagementService.fetchCrossClientTasks as any).mockResolvedValue({
      data: maven10Tasks,
      error: null
    });

    render(
      <FinfixClientPortalView
        client={mavenClient}
        currentUserProfile={staffUser}
        isPreview={true}
      />
    );

    await waitFor(() => {
      const projSection = screen.getByTestId('project-progress-section');
      expect(projSection.textContent).toContain('Funnel Setup');
      expect(projSection.textContent).toContain('In Review');
    });

    const projSection = screen.getByTestId('project-progress-section');
    expect(projSection.textContent).toContain('Social Media Optimization');
    expect(projSection.textContent).toContain('LinkedIn Optimization');
    expect(projSection.textContent).toContain('Paid Ads Setup');
  });

  it('1.9 Download Monthly Report button triggers report generation from real client data', async () => {
    const { taskManagementService } = await import('../src/lib/taskManagementService');
    (taskManagementService.fetchCrossClientTasks as any).mockResolvedValue({
      data: maven10Tasks,
      error: null
    });

    render(
      <FinfixClientPortalView
        client={mavenClient}
        currentUserProfile={staffUser}
        isPreview={true}
      />
    );

    const dlBtn = screen.getByRole('button', { name: /Download Monthly Report/i });
    expect(dlBtn).toBeDefined();

    act(() => {
      fireEvent.click(dlBtn);
    });

    // Check loading/generating text
    expect(screen.getByText(/Generating.../i)).toBeDefined();
  });

  it('2.1, 2.2, 2.3 Server filter & count rule: Maven Week 3 has 9 client visible tasks, 1 internal task filtered out', () => {
    expect(maven10Tasks).toHaveLength(10);

    // Identify internal task
    const internalTask = maven10Tasks.find(isInternalOnlyTask);
    expect(internalTask).toBeDefined();
    expect(internalTask?.id).toBe('task-internal-1');

    // Filter and sanitize
    const clientSafeTasks = filterAndSanitizeClientDeliverables(maven10Tasks);

    // Rule 2.3: client visible total (9) = staff total (10) - internal only tasks (1)
    expect(clientSafeTasks).toHaveLength(9);

    // Ensure zero leakage of internal details
    clientSafeTasks.forEach((t) => {
      expect(t.details).toBeUndefined();
      expect(t.completionNotes).toBeUndefined();
      expect(t.assigneeName).toBeUndefined();
      expect(t.timerStartedAt).toBeNull();
      expect(t.timeSpentSeconds).toBeUndefined();
    });

    // Counts: 0 Pending, 1 In Progress, 8 Approval, 0 Done
    const pendingCount = clientSafeTasks.filter((t) => t.status === 'Pending').length;
    const inProgressCount = clientSafeTasks.filter((t) => t.status === 'In Progress').length;
    const approvalCount = clientSafeTasks.filter((t) => t.status === 'Approval').length;
    const doneCount = clientSafeTasks.filter((t) => t.status === 'Completed' || t.status === 'Done').length;

    expect(pendingCount).toBe(0);
    expect(inProgressCount).toBe(1);
    expect(approvalCount).toBe(8);
    expect(doneCount).toBe(0);
    expect(pendingCount + inProgressCount + approvalCount + doneCount).toBe(9);
  });

  it('2.4 Archived workspace is fully read-only with rename week blocked', async () => {
    const { taskManagementService } = await import('../src/lib/taskManagementService');
    (taskManagementService.fetchCrossClientTasks as any).mockResolvedValue({
      data: [],
      error: null
    });

    const { container } = render(
      <FinfixClientPortalView
        client={archivedClient}
        currentUserProfile={staffUser}
        isPreview={true}
      />
    );

    // Banner indicates archived read-only
    expect(container.textContent).toContain('Archived (Read-Only)');

    // No rename controls
    expect(container.querySelector('[data-testid^="rename-week-btn"]')).toBeNull();
  });
});
