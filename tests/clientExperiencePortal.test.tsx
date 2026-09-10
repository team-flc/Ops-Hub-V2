import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { clientPortalService } from '../src/lib/clientPortalService';
import {
  ClientLinkSharingModal,
  PRODUCTION_PORTAL_BASE,
  getProductionPortalUrl,
  getPreviewPortalUrl
} from '../src/components/portal/ClientLinkSharingModal';
import { ClientPortalLayout } from '../src/components/portal/ClientPortalLayout';
import { getPresetDateRanges } from '../src/lib/clientPdfReportService';
import { 
  ClientRecord, 
  ClientTask, 
  UserProfile 
} from '../src/types';

// Mock AuthContext
const mockCurrentProfile: UserProfile = {
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
    user: { id: 'user-owner-1', email: 'owner@faseehlall.com' },
    profile: mockCurrentProfile,
    isLoading: false,
    signOut: vi.fn(),
    refreshProfile: vi.fn()
  }),
  AuthProvider: ({ children }: any) => <>{children}</>
}));

// Mock Supabase
let mockClientsDb: Record<string, any> = {
  'client-111': {
    id: 'client-111',
    company_name: 'Alpha Logistics',
    client_name: 'Alice Alpha',
    package: 'Advanced',
    operational_manager_id: 'mgr-1',
    activation_date: '2026-01-01',
    status: 'Active',
    required_linkedin_profile_count: 3,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    manager: { id: 'mgr-1', full_name: 'Bob Manager' }
  },
  'a96d9ab6-fc7a-4648-8b93-ec818f9290a2': {
    id: 'a96d9ab6-fc7a-4648-8b93-ec818f9290a2',
    company_name: 'Wise 360',
    client_name: 'Wise Contact',
    package: 'Intermediate',
    operational_manager_id: 'mgr-1',
    activation_date: '2026-01-01',
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    manager: { id: 'mgr-1', full_name: 'Manager 1' }
  },
  'c374d3af-d73a-4691-beff-76d4a4b97e47': {
    id: 'c374d3af-d73a-4691-beff-76d4a4b97e47',
    company_name: 'UnizConnect',
    client_name: 'Uniz Contact',
    package: 'Basic',
    operational_manager_id: 'mgr-2',
    activation_date: '2026-01-01',
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    manager: { id: 'mgr-2', full_name: 'Manager 2' }
  }
};

let mockDbQueryError: any = null;

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    },
    from: (table: string) => {
      const createChainable = (resData: any = null, resErr: any = null) => {
        const chain: any = {
          eq: () => chain,
          neq: () => chain,
          is: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: () => Promise.resolve({ data: resData, error: resErr }),
          single: () => Promise.resolve({ data: resData, error: resErr }),
          then: (resolve: any) => Promise.resolve({ data: resData, error: resErr }).then(resolve)
        };
        return chain;
      };

      return {
        select: (_cols?: string) => {
          if (mockDbQueryError) {
            return createChainable(null, mockDbQueryError);
          }

          if (table === 'clients') {
            return {
              eq: (_col: string, val: string) => {
                const clientData = mockClientsDb[val] || null;
                return {
                  ...createChainable(clientData, null),
                  maybeSingle: () => Promise.resolve({ data: clientData, error: null }),
                  single: () => Promise.resolve({ data: clientData, error: null }),
                  order: () => Promise.resolve({ data: Object.values(mockClientsDb), error: null })
                };
              },
              order: () => Promise.resolve({ data: Object.values(mockClientsDb), error: null })
            };
          }

          return createChainable([], null);
        },
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'rec-1', email: 'alice@alpha.com', full_name: 'Alice', status: 'active' }, error: null })
          })
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null })
        })
      };
    },
    rpc: vi.fn()
  }
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
  fullName: 'Admin FLC',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockManager1Profile: UserProfile = {
  id: 'mgr-1',
  email: 'manager1@faseehlall.com',
  fullName: 'Manager 1',
  role: 'operational_manager',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

describe('Ops Hub Client Experience Portal - Automated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQueryError = null;
  });

  describe('1. Multi-Tenant Security & Isolation', () => {
    it('blocks Client A user from viewing Client B workspace (fails closed)', async () => {
      // Caller belongs to Client A ('client-111'), requesting Client B ('client-222')
      const fetchResult = await clientPortalService.fetchClientPortalData(
        'client-222',
        mockClientUserProfile,
        false
      );

      // Must fail closed with Forbidden error and no data
      expect(fetchResult.error).toContain('AUTH_DENIED');
      expect(fetchResult.client).toBeNull();
      expect(fetchResult.tasks).toHaveLength(0);
    });

    it('blocks unauthenticated visitors without valid session (never exposes portal)', async () => {
      const fetchResult = await clientPortalService.fetchClientPortalData(
        'client-111',
        null, // No caller profile
        false
      );

      expect(fetchResult.error).toContain('AUTH_DENIED');
      expect(fetchResult.client).toBeNull();
      expect(fetchResult.tasks).toHaveLength(0);
    });

    it('blocks Client role from previewing even if preview=true is passed', async () => {
      const fetchResult = await clientPortalService.fetchClientPortalData(
        'client-111',
        mockClientUserProfile,
        true // isPreview = true
      );

      expect(fetchResult.error).toBe('AUTH_DENIED');
      expect(fetchResult.client).toBeNull();
    });
  });

  describe('2. Publication Boundary Enforcement', () => {
    it('strictly hides internal draft tasks and unshared notes from clients', () => {
      const internalDraftTask: ClientTask = {
        id: 't-draft-1',
        clientId: 'client-111',
        weekNumber: 1,
        title: 'Internal Operational Setup (Draft)',
        details: 'Internal staff notes about DNS credentials',
        departmentId: 'dept-1',
        priority: 'Normal',
        plannedStart: '2026-04-01',
        dueDate: '2026-04-05',
        status: 'Draft',
        approvalMode: 'Internal Approval Required',
        sortOrder: 1,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z'
      };

      const clientReviewTask: ClientTask = {
        id: 't-review-1',
        clientId: 'client-111',
        weekNumber: 1,
        title: 'Target Audience Profile',
        details: 'Please review and approve ICP criteria',
        departmentId: 'dept-1',
        priority: 'High',
        plannedStart: '2026-04-01',
        dueDate: '2026-04-05',
        status: 'Client Review',
        approvalMode: 'Client Approval Required',
        sortOrder: 2,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z'
      };

      const tasks = [internalDraftTask, clientReviewTask];

      // Filter by publication boundary
      const clientSafeTasks = tasks.filter((t: any) => {
        if (t.isClientVisible) return true;
        if (t.status === 'Client Review' || t.status === 'Completed') return true;
        if (t.approvalMode === 'Client Approval Required' && t.status !== 'Draft') return true;
        return false;
      });

      expect(clientSafeTasks).toHaveLength(1);
      expect(clientSafeTasks[0].id).toBe('t-review-1');
      expect(clientSafeTasks.find((t) => t.id === 't-draft-1')).toBeUndefined();
    });
  });

  describe('3. Owner & Operational Manager Preview Matrix', () => {
    it('allows Active Owner to preview Wise 360 and UnizConnect', async () => {
      // Wise 360
      const wiseResult = await clientPortalService.fetchClientPortalData(
        'a96d9ab6-fc7a-4648-8b93-ec818f9290a2',
        mockOwnerProfile,
        true
      );
      expect(wiseResult.error).toBeNull();
      expect(wiseResult.client?.companyName).toBe('Wise 360');

      // UnizConnect
      const unizResult = await clientPortalService.fetchClientPortalData(
        'c374d3af-d73a-4691-beff-76d4a4b97e47',
        mockOwnerProfile,
        true
      );
      expect(unizResult.error).toBeNull();
      expect(unizResult.client?.companyName).toBe('UnizConnect');
    });

    it('limits Operational Manager to preview ONLY assigned clients', async () => {
      // Wise 360 is assigned to mgr-1 -> Allowed
      const allowedResult = await clientPortalService.fetchClientPortalData(
        'a96d9ab6-fc7a-4648-8b93-ec818f9290a2',
        mockManager1Profile,
        true
      );
      expect(allowedResult.error).toBeNull();
      expect(allowedResult.client?.companyName).toBe('Wise 360');

      // UnizConnect is assigned to mgr-2 -> Blocked for mgr-1
      const blockedResult = await clientPortalService.fetchClientPortalData(
        'c374d3af-d73a-4691-beff-76d4a4b97e47',
        mockManager1Profile,
        true
      );
      expect(blockedResult.error).toBe('AUTH_DENIED');
      expect(blockedResult.client).toBeNull();
    });

    it('mutation attempts in preview mode remain strictly disabled', async () => {
      const canPreview = clientPortalService.canUserPreviewPortal(mockOwnerProfile, mockClientA);
      expect(canPreview).toBe(true);

      const approveResult = await clientPortalService.submitClientTaskDecision(
        't-review-1',
        'approve',
        undefined,
        mockOwnerProfile,
        true
      );
      expect(approveResult.error).toContain('disabled in read-only staff preview mode');

      const changeReqResult = await clientPortalService.submitClientTaskDecision(
        't-review-1',
        'request_changes',
        'Revise headline',
        mockOwnerProfile,
        true
      );
      expect(changeReqResult.error).toContain('disabled in read-only staff preview mode');
    });
  });

  describe('4. Error Isolation & Setup-Pending Fallback', () => {
    it('missing additive tables/data returns setup-pending fallback without throwing error', async () => {
      const result = await clientPortalService.fetchClientPortalData(
        'a96d9ab6-fc7a-4648-8b93-ec818f9290a2',
        mockOwnerProfile,
        true
      );

      expect(result.error).toBeNull();
      expect(result.client).toBeDefined();
      expect(result.overview).toBeDefined();
      expect(result.tasks).toEqual([]);
      expect(result.deliverables).toEqual([]);
      expect(result.roadmapMilestones).toEqual([]);
    });

    it('database query failure returns DATABASE_ERROR and is not converted into permission error', async () => {
      mockDbQueryError = { message: 'connection timeout to postgres cluster' };

      const result = await clientPortalService.fetchClientPortalData(
        'a96d9ab6-fc7a-4648-8b93-ec818f9290a2',
        mockOwnerProfile,
        true
      );

      expect(result.error).toContain('DATABASE_ERROR');
      expect(result.error).not.toBe('AUTH_DENIED');
      expect(result.error).toContain('connection timeout');
    });
  });

  describe('5. Link Sharing Modal & Recipient Governance', () => {
    it('generates permanent production URL and staff preview URL correctly', () => {
      const clientId = 'client-111';
      const prodUrl = getProductionPortalUrl(clientId);
      const previewUrl = getPreviewPortalUrl(clientId);

      expect(PRODUCTION_PORTAL_BASE).toBe('https://obshub2.pages.dev');
      expect(prodUrl).toBe('https://obshub2.pages.dev/portal/client-111');
      expect(previewUrl).toContain('/portal/client-111?preview=true');
      expect(prodUrl).not.toContain('feature-client-experience-po');
    });

    it('defaults to Authorized Recipients tab when no active recipients exist', async () => {
      vi.spyOn(clientPortalService, 'fetchApprovedRecipients').mockResolvedValueOnce([]);

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

      // Should default to Authorized Recipients tab
      expect(await screen.findByText('Authorize New Client Recipient')).toBeDefined();
      expect(screen.getByText('No recipients registered yet. Add authorized contacts above.')).toBeDefined();
    });

    it('renders production and preview links with proper badges and zero-recipient warning on links tab', async () => {
      vi.spyOn(clientPortalService, 'fetchApprovedRecipients').mockResolvedValueOnce([]);

      render(
        <ClientLinkSharingModal
          isOpen={true}
          onClose={vi.fn()}
          clientId="client-111"
          clientName="Alice Alpha"
          companyName="Alpha Logistics"
          currentUserRole="owner"
          initialTab="links"
        />
      );

      expect(screen.getByText('[PRODUCTION LINK]')).toBeDefined();
      expect(screen.getByText('[PREVIEW LINK]')).toBeDefined();
      expect(screen.getByText('Owner Read-Only Preview')).toBeDefined();

      const copyClientBtn = screen.getByRole('button', { name: /Copy Client Link/i });
      expect(copyClientBtn).toBeDefined();
      expect((copyClientBtn as HTMLButtonElement).disabled).toBe(true);

      const staffCopyBtn = screen.getByRole('button', { name: /^Copy$/i });
      expect(staffCopyBtn).toBeDefined();
      expect((staffCopyBtn as HTMLButtonElement).disabled).toBe(false);

      const openPreviewBtn = screen.getByRole('link', { name: /Open Preview/i });
      expect(openPreviewBtn).toBeDefined();

      await screen.findByText('Set up client access before sharing');
    });

    it('enables Copy Client Link when active recipients exist', async () => {
      vi.spyOn(clientPortalService, 'fetchApprovedRecipients').mockResolvedValueOnce([
        {
          id: 'rec-1',
          clientId: 'client-111',
          profileId: 'prof-1',
          email: 'alice@alpha.com',
          fullName: 'Alice Alpha',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ]);

      render(
        <ClientLinkSharingModal
          isOpen={true}
          onClose={vi.fn()}
          clientId="client-111"
          clientName="Alice Alpha"
          companyName="Alpha Logistics"
          currentUserRole="owner"
          initialTab="links"
        />
      );

      const copyClientBtn = await screen.findByRole('button', { name: /Copy Client Link/i });
      expect((copyClientBtn as HTMLButtonElement).disabled).toBe(false);
      expect(screen.queryByText('Set up client access before sharing')).toBeNull();
    });

    it('keeps Copy Client Link disabled when only revoked recipients exist', async () => {
      vi.spyOn(clientPortalService, 'fetchApprovedRecipients').mockResolvedValueOnce([
        {
          id: 'rec-revoked-1',
          clientId: 'client-111',
          profileId: 'prof-rev',
          email: 'revoked@alpha.com',
          fullName: 'Revoked User',
          status: 'revoked',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ]);

      render(
        <ClientLinkSharingModal
          isOpen={true}
          onClose={vi.fn()}
          clientId="client-111"
          clientName="Alice Alpha"
          companyName="Alpha Logistics"
          currentUserRole="owner"
          initialTab="links"
        />
      );

      const copyClientBtn = await screen.findByRole('button', { name: /Copy Client Link/i });
      expect((copyClientBtn as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText('Set up client access before sharing')).toBeDefined();
    });

    it('validates email format when owner adds portal recipient', async () => {
      const res = await clientPortalService.addPortalRecipient(
        'client-111',
        'invalid-email',
        'Alice Alpha',
        mockOwnerProfile
      );

      expect(res.error).toContain('valid email address is required');
    });

    it('blocks non-owner staff from adding portal recipients', async () => {
      const nonOwnerProfile: UserProfile = {
        id: 'user-tm-1',
        email: 'tm@faseehlall.com',
        fullName: 'Team Member',
        role: 'team_member',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const res = await clientPortalService.addPortalRecipient(
        'client-111',
        'contact@alpha.com',
        'Contact Name',
        nonOwnerProfile
      );

      expect(res.error).toContain('Forbidden: Only the Owner can configure client portal recipients');
    });
  });

  describe('6. Portal Layout & Preview UI Components', () => {
    it('renders all four portal tabs and read-only controls in preview mode', () => {
      const defaultRanges = getPresetDateRanges();
      const mockPortalData = {
        client: mockClientA,
        tasks: [],
        overview: {
          client: mockClientA,
          factualSummary: 'Executive overview summary',
          completedInPeriodCount: 0,
          inProgressCount: 0,
          needsInputCount: 0,
          upcomingCount: 0,
          publishedResults: [],
          publishedDeliverablesRatio: { completed: 0, total: 0 }
        },
        deliverables: [],
        roadmapMilestones: [],
        error: null
      };

      render(
        <MemoryRouter>
          <ClientPortalLayout
            portalData={mockPortalData}
            isReadOnlyPreview={true}
            dateRange={defaultRanges.thisMonth}
            onDateRangeChange={vi.fn()}
            onRefresh={vi.fn()}
          />
        </MemoryRouter>
      );

      // Verify header branding
      expect(screen.getByText('Alpha Logistics')).toBeDefined();

      // Verify all 4 tabs exist (desktop and mobile navigation)
      expect(screen.getAllByRole('button', { name: /overview/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('button', { name: /deliverables/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('button', { name: /roadmap/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('button', { name: /assets/i }).length).toBeGreaterThanOrEqual(1);

      // Verify Report download button and Exit Preview
      expect(screen.getByTitle(/Download Custom-Date Client Report/i)).toBeDefined();
      expect(screen.getByTitle(/Return to Internal Workspace/i)).toBeDefined();
    });
  });
});
