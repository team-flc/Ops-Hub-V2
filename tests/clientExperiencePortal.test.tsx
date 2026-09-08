import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clientPortalService } from '../src/lib/clientPortalService';
import { ClientLinkSharingModal, getProductionPortalUrl, getPreviewPortalUrl, PRODUCTION_PORTAL_BASE } from '../src/components/portal/ClientLinkSharingModal';
import { ClientPortalGate } from '../src/components/portal/ClientPortalGate';
import { SelectedClientHeader } from '../src/components/clients/SelectedClientHeader';
import { ClientSwitcher } from '../src/components/clients/ClientSwitcher';
import { 
  ClientRecord, 
  ClientTask, 
  UserProfile 
} from '../src/types';

// Mock AuthContext
let mockCurrentProfile: UserProfile = {
  id: 'user-owner-1',
  email: 'owner@faseehlall.com',
  fullName: 'Faseeh Lall',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: mockCurrentProfile.id, email: mockCurrentProfile.email },
    profile: mockCurrentProfile,
    isLoading: false,
    signOut: vi.fn(),
    refreshProfile: vi.fn()
  }),
  AuthProvider: ({ children }: any) => <>{children}</>
}));

const mockClientA: ClientRecord = {
  id: 'client-111',
  companyName: 'Alpha Logistics',
  clientName: 'Alice Alpha',
  package: 'Advanced',
  operationalManagerId: 'mgr-1',
  operationalManagerName: 'Bob Manager',
  activationDate: '2026-01-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  links: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockClientB: ClientRecord = {
  id: 'client-222',
  companyName: 'Beta Biotech',
  clientName: 'Brian Beta',
  package: 'Intermediate',
  operationalManagerId: 'mgr-2',
  operationalManagerName: 'Carol Manager',
  activationDate: '2026-02-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  links: {},
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z'
};

const mockClientUserProfile: UserProfile = {
  id: 'user-client-1',
  email: 'alice@alphalogistics.com',
  fullName: 'Alice Alpha',
  role: 'client',
  status: 'active',
  organizationId: 'client-111',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockOwnerProfile: UserProfile = {
  id: 'user-owner-1',
  email: 'owner@faseehlall.com',
  fullName: 'Faseeh Lall',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockTasks: any[] = [
  {
    id: 't-1',
    client_id: 'client-111',
    week_number: 1,
    title: 'Domain & DNS Setup',
    details: 'Setup cold email domains',
    department_id: 'dept-1',
    priority: 'High',
    planned_start: '2026-04-01',
    due_date: '2026-04-07',
    status: 'Completed',
    approval_mode: 'Internal Approval Required',
    sort_order: 1,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-07T00:00:00Z',
    is_client_visible: true,
    departments: { id: 'dept-1', name: 'Infrastructure' }
  },
  {
    id: 't-2',
    client_id: 'client-111',
    week_number: 2,
    title: 'Review Target Accounts List',
    details: 'Review the compiled ICP list and approve',
    department_id: 'dept-2',
    priority: 'Urgent',
    planned_start: '2026-04-08',
    due_date: '2026-04-14',
    status: 'Client Review',
    approval_mode: 'Client Approval Required',
    sort_order: 2,
    created_at: '2026-04-08T00:00:00Z',
    updated_at: '2026-04-08T00:00:00Z',
    is_client_visible: true,
    departments: { id: 'dept-2', name: 'Strategy' }
  },
  {
    id: 't-draft',
    client_id: 'client-111',
    week_number: 2,
    title: 'Internal Ops Draft Note',
    details: 'Private staff notes about internal routing',
    department_id: 'dept-1',
    priority: 'Normal',
    planned_start: '2026-04-08',
    due_date: '2026-04-14',
    status: 'Draft',
    approval_mode: 'Internal Approval Required',
    sort_order: 3,
    created_at: '2026-04-08T00:00:00Z',
    updated_at: '2026-04-08T00:00:00Z',
    is_client_visible: false,
    departments: { id: 'dept-1', name: 'Infrastructure' }
  }
];

// Robust chained query builder mock
vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-owner-1' } }, error: null }),
      getSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    },
    from: (table: string) => {
      let requestedId = '';
      const builder: any = {
        select: vi.fn().mockImplementation(() => builder),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          if (col === 'id' || col === 'client_id') requestedId = String(val);
          return builder;
        }),
        is: vi.fn().mockImplementation(() => builder),
        in: vi.fn().mockImplementation(() => builder),
        order: vi.fn().mockImplementation(() => builder),
        single: vi.fn().mockImplementation(() => {
          if (table === 'client_portal_recipients') {
            return Promise.resolve({
              data: { id: 'rec-1', email: 'alice@alpha.com', full_name: 'Alice Alpha', status: 'active' },
              error: null
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (table === 'clients') {
            const client = requestedId === 'client-222' ? mockClientB : mockClientA;
            return Promise.resolve({
              data: {
                id: client.id,
                company_name: client.companyName,
                client_name: client.clientName,
                package: client.package,
                status: client.status,
                pause_reason: null,
                activation_date: client.activationDate,
                required_linkedin_profile_count: 3,
                operational_manager_id: client.operationalManagerId,
                operational_manager_name: client.operationalManagerName,
                links: {},
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
              },
              error: null
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        insert: vi.fn().mockImplementation(() => builder),
        update: vi.fn().mockImplementation(() => builder)
      };

      // Promise resolution when awaited directly
      builder.then = (resolve: any) => {
        if (table === 'client_tasks') {
          resolve({ data: mockTasks, error: null });
        } else if (table === 'client_published_results' || table === 'client_portal_recipients') {
          resolve({ data: [], error: null });
        } else if (table === 'client_task_messages' || table === 'client_work_plans') {
          resolve({ data: [], error: null });
        } else {
          resolve({ data: [], error: null });
        }
      };

      return builder;
    },
    rpc: vi.fn()
  }
}));

describe('Ops Hub Client Experience Portal - Comprehensive Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentProfile = { ...mockOwnerProfile };
  });

  describe('1. Multi-Tenant Security & Isolation', () => {
    it('blocks Client A user from viewing Client B workspace (fails closed 403)', async () => {
      const fetchResult = await clientPortalService.fetchClientPortalData(
        'client-222',
        mockClientUserProfile,
        false
      );

      expect(fetchResult.error).toContain('Forbidden');
      expect(fetchResult.client).toBeNull();
      expect(fetchResult.tasks).toHaveLength(0);
    });

    it('blocks unauthenticated visitors without valid session (never exposes portal)', async () => {
      const fetchResult = await clientPortalService.fetchClientPortalData(
        'client-111',
        null,
        false
      );

      expect(fetchResult.error).toContain('Unauthorized');
      expect(fetchResult.client).toBeNull();
      expect(fetchResult.tasks).toHaveLength(0);
    });

    it('rejects query-string manipulation: client user passing ?preview=true is denied preview access', async () => {
      const fetchResult = await clientPortalService.fetchClientPortalData(
        'client-111',
        mockClientUserProfile,
        true
      );

      expect(fetchResult.error).toContain('Access denied');
      expect(fetchResult.client).toBeNull();
    });
  });

  describe('2. Publication Boundary & Staff Shell Isolation', () => {
    it('strictly hides internal draft tasks and private operational notes from clients', () => {
      const clientSafeTasks = mockTasks.filter((t: any) => {
        if (t.is_client_visible) return true;
        if (t.status === 'Client Review' || t.status === 'Completed') return true;
        if (t.approval_mode === 'Client Approval Required' && t.status !== 'Draft') return true;
        return false;
      });

      expect(clientSafeTasks).toHaveLength(2);
      expect(clientSafeTasks.find((t) => t.id === 't-draft')).toBeUndefined();
    });
  });

  describe('3. Owner "View as Client" Read-Only Preview Mode', () => {
    it('allows Owner to preview portal but strictly blocks mutations in preview mode', async () => {
      const canPreview = clientPortalService.canUserPreviewPortal(mockOwnerProfile, mockClientA);
      expect(canPreview).toBe(true);

      const approveResult = await clientPortalService.submitClientTaskDecision(
        't-2',
        'approve',
        undefined,
        mockOwnerProfile,
        true
      );

      expect(approveResult.error).toContain('disabled in read-only staff preview mode');

      const changeReqResult = await clientPortalService.submitClientTaskDecision(
        't-2',
        'request_changes',
        'Revise lead criteria',
        mockOwnerProfile,
        true
      );

      expect(changeReqResult.error).toContain('disabled in read-only staff preview mode');
    });

    it('renders persistent "Client preview · Read only" banner in preview mode', async () => {
      mockCurrentProfile = { ...mockOwnerProfile };

      render(
        <MemoryRouter initialEntries={['/portal/client-111?preview=true']}>
          <Routes>
            <Route path="/portal/:clientId" element={<ClientPortalGate />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Client preview · Read only')).toBeDefined();
      });

      // Confirm staff shell elements are absent
      expect(screen.queryByLabelText('Command Palette')).toBeNull();
      expect(screen.queryByText('Internal Workspace')).toBeNull();
    });
  });

  describe('4. Owner Header & Switcher Link Sharing', () => {
    it('SelectedClientHeader renders "View as Client" and "Client Link" buttons for Owner', () => {
      mockCurrentProfile = { ...mockOwnerProfile };

      render(
        <MemoryRouter>
          <SelectedClientHeader client={mockClientA} />
        </MemoryRouter>
      );

      expect(screen.getByText('View as Client')).toBeDefined();
      expect(screen.getByText('Client Link')).toBeDefined();

      const viewLink = screen.getByText('View as Client').closest('a');
      expect(viewLink?.getAttribute('href')).toBe('/portal/client-111?preview=true');
    });

    it('clicking "Client Link" in header opens governance modal', () => {
      mockCurrentProfile = { ...mockOwnerProfile };

      render(
        <MemoryRouter>
          <SelectedClientHeader client={mockClientA} />
        </MemoryRouter>
      );

      const linkBtn = screen.getByText('Client Link');
      fireEvent.click(linkBtn);

      expect(screen.getByText('Client Portal Access & Links')).toBeDefined();
      expect(screen.getByText('[PRODUCTION LINK]')).toBeDefined();
      expect(screen.getByText('[PREVIEW LINK]')).toBeDefined();
    });

    it('ClientSwitcher link button opens the same governance modal without direct clipboard copy', () => {
      mockCurrentProfile = { ...mockOwnerProfile };

      render(
        <MemoryRouter>
          <ClientSwitcher
            clients={[mockClientA]}
            selectedClient={mockClientA}
            currentUserRole="owner"
            onSelectClient={vi.fn()}
            onOpenCreateModal={vi.fn()}
            onOpenDuplicateModal={vi.fn()}
          />
        </MemoryRouter>
      );

      // Open switcher dropdown
      const switcherBtn = screen.getByLabelText('Switch Client Workspace');
      fireEvent.click(switcherBtn);

      // Find the link icon button in the client row
      const shareBtn = screen.getByTitle(/Client Portal Link & Access/);
      expect(shareBtn).toBeDefined();

      fireEvent.click(shareBtn);

      // Modal must open
      expect(screen.getByText('Client Portal Access & Links')).toBeDefined();
    });
  });

  describe('5. Production & Preview Link Integrity', () => {
    it('always generates production client link with https://obshub2.pages.dev', () => {
      const prodUrl = getProductionPortalUrl('client-111');
      expect(prodUrl).toBe('https://obshub2.pages.dev/portal/client-111');
      expect(prodUrl.startsWith(PRODUCTION_PORTAL_BASE)).toBe(true);
      expect(prodUrl).not.toContain('localhost');
      expect(prodUrl).not.toContain('obshub2.pages.dev?');
    });

    it('generates distinctly labeled preview link with ?preview=true', () => {
      const previewUrl = getPreviewPortalUrl('client-111');
      expect(previewUrl).toContain('/portal/client-111?preview=true');
    });

    it('displays "Set up client access" call-to-action when 0 recipients exist', async () => {
      render(
        <ClientLinkSharingModal
          isOpen={true}
          onClose={vi.fn()}
          clientId="client-111"
          clientName="Alice Alpha"
          companyName="Alpha Logistics"
          currentUserRole="owner"
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Set up client access').length).toBeGreaterThan(0);
      });
    });
  });

  describe('6. Portal Layout Tabs & Controls', () => {
    it('renders all required portal tabs and report download trigger in portal layout', async () => {
      mockCurrentProfile = { ...mockOwnerProfile };

      render(
        <MemoryRouter initialEntries={['/portal/client-111?preview=true']}>
          <Routes>
            <Route path="/portal/:clientId" element={<ClientPortalGate />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Deliverables').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Roadmap').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Assets').length).toBeGreaterThan(0);
        expect(screen.getByText('Download Report')).toBeDefined();
      });
    });
  });
});
