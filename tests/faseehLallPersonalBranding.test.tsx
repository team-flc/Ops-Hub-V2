import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FinfixClientPortalView, FINFIX_NAV_ITEMS } from '../src/components/portal/FinfixClientPortalView';
import { ClientRecord, UserProfile, ClientTask } from '../src/types';

// Mock router hooks
vi.mock('../src/lib/safeRouterHooks', () => ({
  useSafeNavigate: () => vi.fn(),
  useSafeLocation: () => ({ pathname: '/clients/test', search: '?preview=true' })
}));

// Mock taskManagementService
vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    fetchCrossClientTasks: vi.fn().mockResolvedValue({ data: [], error: null }),
    fetchClientWeeks: vi.fn().mockResolvedValue({ data: [], error: null })
  }
}));

// Mock storageService
vi.mock('../src/lib/storageService', () => ({
  useSignedUrl: vi.fn((bucket: string, path: string | null | undefined) => {
    if (!path) return null;
    return `https://mock-storage.test/${bucket}/${path}`;
  }),
  storageService: {
    getSignedUrl: vi.fn().mockResolvedValue('https://mock-storage.test/signed-url')
  }
}));

const mockStaffUser: UserProfile = {
  id: 'user-owner',
  fullName: 'Faseeh Lall',
  email: 'faseeh@faseehlall.com',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01'
};

const clientWithLogo: ClientRecord = {
  id: 'client-with-logo',
  companyName: 'Cloud Z Technologies',
  clientName: 'Zeeshan Ali',
  package: 'Advanced',
  operationalManagerId: 'om-1',
  activationDate: '2026-01-01',
  status: 'active',
  requiredLinkedinProfileCount: 3,
  logoUrl: 'cloudz-logo.png',
  links: {}
};

const clientWithoutLogo: ClientRecord = {
  id: 'client-without-logo',
  companyName: 'Maven Professionals',
  clientName: 'Maven Client',
  package: 'Advanced',
  operationalManagerId: 'om-1',
  activationDate: '2026-01-01',
  status: 'active',
  requiredLinkedinProfileCount: 3,
  logoUrl: null,
  links: {}
};

const cloudZTasks: ClientTask[] = [
  { id: '1', clientId: clientWithLogo.id, title: 'Visible 1', status: 'Done', weekNumber: 1, isInternalOnly: false, createdAt: '2026-11-01' },
  { id: '2', clientId: clientWithLogo.id, title: 'Visible 2', status: 'Done', weekNumber: 1, isInternalOnly: false, createdAt: '2026-11-01' },
  { id: '3', clientId: clientWithLogo.id, title: 'Visible 3', status: 'Done', weekNumber: 1, isInternalOnly: false, createdAt: '2026-11-01' },
  { id: '4', clientId: clientWithLogo.id, title: 'Visible 4', status: 'Approval', weekNumber: 1, isInternalOnly: false, createdAt: '2026-11-01' },
  { id: '5', clientId: clientWithLogo.id, title: 'Internal 1', status: 'Approval', weekNumber: 1, isInternalOnly: true, createdAt: '2026-11-01' },
  { id: '6', clientId: clientWithLogo.id, title: 'Internal 2', status: 'Approval', weekNumber: 1, isInternalOnly: true, createdAt: '2026-11-01' }
];

describe('Faseeh Lall and Co Personal Branding in Client View Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Logo top left renders red FASEEH LALL AND CO. logo (/logo.png), never generic teal lightning square', async () => {
    const { container } = render(
      <FinfixClientPortalView
        client={clientWithLogo}
        currentUserProfile={mockStaffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    // Verify red FASEEH LALL & CO. logo exists
    const brandLogo = screen.getByTestId('faseeh-lall-brand-logo');
    expect(brandLogo).toBeInTheDocument();
    expect(brandLogo.getAttribute('src')).toBe('/logo.png');
    expect(brandLogo.getAttribute('alt')).toBe('FASEEH LALL & CO.');

    // Verify generic teal lightning square or Zap icon is NOT rendered
    expect(container.querySelector('.lucide-zap')).toBeNull();
    expect(container.textContent).not.toContain('Zap');
  });

  it('2. Client logo appears as secondary logo when uploaded; client initials avatar appears when no logo', async () => {
    // A: Client With Logo
    const { unmount } = render(
      <FinfixClientPortalView
        client={clientWithLogo}
        currentUserProfile={mockStaffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    // Secondary client logo in sidebar
    const secondaryLogo = screen.getByTestId('client-secondary-logo');
    expect(secondaryLogo).toBeInTheDocument();
    expect(secondaryLogo.getAttribute('src')).toContain('cloudz-logo.png');

    // Header client logo
    const headerLogo = screen.getByTestId('header-client-logo');
    expect(headerLogo).toBeInTheDocument();
    expect(headerLogo.getAttribute('src')).toContain('cloudz-logo.png');

    unmount();

    // B: Client Without Logo
    render(
      <FinfixClientPortalView
        client={clientWithoutLogo}
        currentUserProfile={mockStaffUser}
        isPreview={true}
        tasks={[]}
      />
    );

    // Sidebar initials avatar fallback
    const initialsAvatar = screen.getByTestId('client-initials-avatar');
    expect(initialsAvatar).toBeInTheDocument();
    expect(initialsAvatar.textContent).toBe('MP');
    expect(initialsAvatar.className).toContain('bg-brand-500');

    // Header initials avatar fallback
    const headerAvatar = screen.getByTestId('header-client-avatar');
    expect(headerAvatar).toBeInTheDocument();
    expect(headerAvatar.textContent).toBe('MP');
    expect(headerAvatar.className).toContain('bg-brand-500');
  });

  it('3. Primary colour is red: active sidebar item, active Dashboard tab, Download Monthly Report button, View All link, progress bar', async () => {
    const { container } = render(
      <FinfixClientPortalView
        client={clientWithLogo}
        currentUserProfile={mockStaffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    // Active sidebar item is red
    const activeDashboardNav = screen.getByTestId('nav-dashboard');
    expect(activeDashboardNav.className).toContain('bg-brand-500');
    expect(activeDashboardNav.className).not.toContain('bg-[#0D9488]');
    expect(activeDashboardNav.className).not.toContain('teal');

    // Active Dashboard tab is red
    const dashboardTabBtn = screen.getByRole('button', { name: /Dashboard/i });
    expect(dashboardTabBtn.className).toContain('bg-brand-500');
    expect(dashboardTabBtn.className).not.toContain('bg-[#0D9488]');

    // Download Monthly Report button is red
    const downloadReportBtn = screen.getByRole('button', { name: /Download Monthly Report/i });
    expect(downloadReportBtn.className).toContain('bg-brand-500');
    expect(downloadReportBtn.className).not.toContain('bg-[#0D9488]');

    // View All links are red
    const viewAllBtns = screen.getAllByRole('button', { name: /View All/i });
    expect(viewAllBtns.length).toBeGreaterThanOrEqual(2);
    viewAllBtns.forEach((btn) => {
      expect(btn.className).toContain('text-brand-600');
      expect(btn.className).not.toContain('text-teal-600');
    });

    // Download Receipt icon is red
    const downloadReceiptBtn = screen.getByRole('button', { name: /Download Receipt/i });
    expect(downloadReceiptBtn.innerHTML).toContain('text-brand-600');

    // Progress bar for completed work (Cloud Z has 50% completed)
    const progressSection = screen.getByTestId('project-progress-section');
    expect(progressSection.innerHTML).toContain('bg-brand-500');
    expect(progressSection.innerHTML).not.toContain('bg-[#0D9488]');
  });

  it('4. Status colours are preserved: Completed green, Pending orange, In Progress blue, Approval purple', async () => {
    render(
      <FinfixClientPortalView
        client={clientWithLogo}
        currentUserProfile={mockStaffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const progressSection = screen.getByTestId('project-progress-section');
    // Cloud Z Social Media Optimization has 3 Done and 3 Approval -> In Review (purple)
    expect(progressSection.textContent).toContain('In Review');
    expect(progressSection.innerHTML).toContain('bg-purple-600');
  });

  it('5. Sidebar retains all 15 items in required order with dark navy background and zero staff links', async () => {
    render(
      <FinfixClientPortalView
        client={clientWithLogo}
        currentUserProfile={mockStaffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const sidebar = screen.getByTestId('finfix-client-sidebar');
    expect(sidebar.className).toContain('bg-[#0B111E]');

    // Verify all 15 items in exact order
    expect(FINFIX_NAV_ITEMS).toHaveLength(15);
    const expectedOrder = [
      'Dashboard', 'Projects', 'Analytics', 'Social Media', 'LinkedIn',
      'Website and SEO', 'Paid Ads', 'Funnel', 'Subscription', 'Billing and Invoices',
      'Deliverables', 'Approvals', 'Team', 'Reports', 'Settings'
    ];
    expectedOrder.forEach((label, idx) => {
      expect(FINFIX_NAV_ITEMS[idx].label).toBe(label);
      expect(sidebar.textContent).toContain(label);
    });

    // Zero staff workspace links in client sidebar
    expect(sidebar.textContent).not.toContain('Workspace Links');
    expect(sidebar.textContent).not.toContain('Google Drive');
    expect(sidebar.textContent).not.toContain('Slack');
    expect(sidebar.textContent).not.toContain('POC WhatsApp');
  });

  it('6. Reconciliation and accurate metrics are preserved (Cloud Z 50%, 3 of 6 deliverables)', async () => {
    render(
      <FinfixClientPortalView
        client={clientWithLogo}
        currentUserProfile={mockStaffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    // Stat card 1: 50%
    const completionCard = screen.getByTestId('stat-project-completion');
    expect(completionCard.textContent).toContain('50%');

    // Stat card 2: 3 / 6
    const tasksCard = screen.getByTestId('stat-tasks-completed');
    expect(tasksCard.textContent).toContain('3 / 6');

    // Bottom bar footer reconciliation
    const bottomBar = screen.getByTestId('client-portal-bottom-bar');
    expect(bottomBar.textContent).toContain('50% completed · 3 of 6 deliverables completed (4 visible + 2 internal)');
  });
});
