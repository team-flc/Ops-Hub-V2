import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinfixClientPortalView } from '../src/components/portal/FinfixClientPortalView';
import { ClientWorkspaceView } from '../src/components/clients/ClientWorkspaceView';
import { ClientRecord, ClientTask, UserProfile } from '../src/types';

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
      }),
      fetchDepartments: vi.fn().mockResolvedValue([]),
      fetchEligibleAssignees: vi.fn().mockResolvedValue([])
    }
  };
});

describe('Client Dashboard 7 Failures & Unified Layout Test Suite', () => {
  const finfixClient: ClientRecord = {
    id: '5d585580-d378-44a5-8dc1-d2653d4d6d8a',
    companyName: 'Finfix Pro',
    clientName: 'Finfix Owner',
    status: 'Active',
    subscriptionTier: 'Basic Plan',
    activationDate: '2026-11-01',
    links: { website: 'https://finfixpro.com' }
  };

  const finfixTasks: ClientTask[] = [
    {
      id: 'finfix-1',
      clientId: finfixClient.id,
      title: 'Company Page Setup & Branding',
      status: 'Done',
      weekNumber: 1,
      approvalMode: 'Client Approval Required',
      evidenceUrl: 'https://loom.com/share/finfix1',
      createdAt: '2026-11-04T10:00:00Z'
    },
    {
      id: 'finfix-2',
      clientId: finfixClient.id,
      title: 'Sales Navigator Activation',
      status: 'Pending',
      weekNumber: 2,
      approvalMode: 'Internal Only',
      createdAt: '2026-11-04T11:00:00Z'
    },
    {
      id: 'finfix-3',
      clientId: finfixClient.id,
      title: 'Target Audience Profile Filters',
      status: 'In Progress',
      weekNumber: 2,
      approvalMode: 'Standard Internal Review',
      createdAt: '2026-11-04T12:00:00Z'
    },
    {
      id: 'finfix-4',
      clientId: finfixClient.id,
      title: 'Cold Outreach Message Copy',
      status: 'Approval',
      weekNumber: 2,
      approvalMode: 'Client Approval Required',
      createdAt: '2026-11-04T13:00:00Z'
    }
  ];

  const staffUser: UserProfile = {
    id: 'user-1',
    email: 'staff@faseehlall.com',
    fullName: 'Ops Staff',
    role: 'operational_manager',
    status: 'active'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Search opens modal, accepts query, filters deliverables for this client, and closes on Esc', async () => {
    render(
      <FinfixClientPortalView
        client={finfixClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={finfixTasks}
      />
    );

    // Search button exists and opens modal
    const searchBtn = screen.getByTestId('portal-search-button');
    fireEvent.click(searchBtn);

    const searchModal = screen.getByTestId('portal-search-modal');
    expect(searchModal).toBeDefined();

    const searchInput = screen.getByTestId('portal-search-input');
    fireEvent.change(searchInput, { target: { value: 'Cold Outreach' } });

    // Matching deliverable is listed
    expect(searchModal.textContent).toContain('Cold Outreach Message Copy');

    // Esc closes modal
    fireEvent.keyDown(searchInput, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('portal-search-modal')).toBeNull();
  });

  it('2. Notification bell displays real count without fake 3, and toggles real notifications panel', async () => {
    render(
      <FinfixClientPortalView
        client={finfixClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={finfixTasks}
      />
    );

    const notifBtn = screen.getByTestId('portal-notifications-button');
    // 1 pending approval in finfixTasks
    const badge = screen.getByTestId('portal-notifications-badge');
    expect(badge.textContent).toBe('1');

    // Click toggles panel
    fireEvent.click(notifBtn);
    const panel = screen.getByTestId('portal-notifications-panel');
    expect(panel).toBeDefined();
    expect(panel.textContent).toContain('Cold Outreach Message Copy');
    expect(panel.textContent).toContain('Target Audience Profile Filters');
  });

  it('3 & 4. Download Receipt and Download Monthly Report generate files and display confirmation toasts', async () => {
    // Mock document.createElement for 'a' to spy on clicks
    const originalCreateElement = document.createElement.bind(document);
    let downloadedFiles: string[] = [];

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = () => {
          if ((el as HTMLAnchorElement).download) {
            downloadedFiles.push((el as HTMLAnchorElement).download);
          }
        };
      }
      return el;
    });

    render(
      <FinfixClientPortalView
        client={finfixClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={finfixTasks}
      />
    );

    // Download Receipt
    const receiptBtn = screen.getByText('Download Receipt');
    fireEvent.click(receiptBtn);
    expect(downloadedFiles.some((f) => f.includes('finfix_pro_receipt.txt'))).toBe(true);

    // Download Monthly Report
    const reportBtn = screen.getByText('Download Monthly Report');
    fireEvent.click(reportBtn);

    await waitFor(() => {
      expect(downloadedFiles.some((f) => (f.includes('finfix_pro') && f.includes('monthly_report.txt')))).toBe(true);
    });

    vi.restoreAllMocks();
  });

  it('5. Recent Activity "View All" opens the Recent Activity modal and does NOT switch to Deliverables placeholder', async () => {
    render(
      <FinfixClientPortalView
        client={finfixClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={finfixTasks}
      />
    );

    const viewAllBtn = screen.getByTestId('recent-activity-view-all');
    fireEvent.click(viewAllBtn);

    const modal = screen.getByTestId('recent-activity-modal');
    expect(modal).toBeDefined();
    expect(modal.textContent).toContain('Recent Activity • Finfix Pro');
    expect(modal.textContent).toContain('Company Page Setup & Branding');
    expect(modal.textContent).toContain('Cold Outreach Message Copy');

    // Deliverables placeholder should NOT be rendered
    expect(screen.queryByTestId('client-deliverables-view')).toBeNull();
  });

  it('6. Full Dark Mode classes are applied across all portal cards and headers', async () => {
    const { container } = render(
      <FinfixClientPortalView
        client={finfixClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={finfixTasks}
      />
    );

    // Dark classes on root
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('dark:bg-dark-400');

    // Dark classes on header
    const header = screen.getByTestId('finfix-client-header');
    expect(header.className).toContain('dark:bg-dark-card');

    // Dark classes on stat cards
    const statCard = screen.getByTestId('stat-project-completion');
    expect(statCard.className).toContain('dark:bg-dark-card');

    // Dark classes on performance overview & subscription & recent activity
    const perf = screen.getByTestId('performance-overview-section');
    expect(perf.className).toContain('dark:bg-dark-card');

    const sub = screen.getByTestId('subscription-billing-card');
    expect(sub.className).toContain('dark:bg-dark-card');

    const recent = screen.getByTestId('recent-activity-section');
    expect(recent.className).toContain('dark:bg-dark-card');
  });

  it('7. Unified Dashboard layout is active across Dashboard, 30-Day Setup, and 90-Day Work Plans', async () => {
    const { taskManagementService } = await import('../src/lib/taskManagementService');
    (taskManagementService.fetchCrossClientTasks as any).mockResolvedValue({
      data: finfixTasks,
      error: null
    });

    render(
      <ClientWorkspaceView
        client={finfixClient}
        currentUserProfile={staffUser}
        eligibleManagers={[]}
        onClientUpdated={vi.fn()}
        isClientView={true}
      />
    );

    // Initial Dashboard tab has sidebar and stat cards
    expect(screen.getByTestId('finfix-client-sidebar')).toBeDefined();
    expect(screen.getByTestId('stat-project-completion')).toBeDefined();
    expect(screen.getByTestId('stat-tasks-completed')).toBeDefined();

    // Switch to 30-Day Setup
    const setupTabBtn = screen.getByTestId('tab-setup');
    fireEvent.click(setupTabBtn);

    // Sidebar and stat cards remain persistent!
    expect(screen.getByTestId('finfix-client-sidebar')).toBeDefined();
    expect(screen.getByTestId('stat-project-completion')).toBeDefined();
    expect(screen.getByTestId('client-week-stepper')).toBeDefined();

    // Switch to 90-Day Work Plans
    const workplansTabBtn = screen.getByTestId('tab-workplans');
    fireEvent.click(workplansTabBtn);

    // Sidebar and stat cards remain persistent!
    expect(screen.getByTestId('finfix-client-sidebar')).toBeDefined();
    expect(screen.getByTestId('stat-project-completion')).toBeDefined();
  });
});
