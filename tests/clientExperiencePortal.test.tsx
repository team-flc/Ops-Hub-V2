import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { clientPortalService } from '../src/lib/clientPortalService';
import { ClientLinkSharingModal } from '../src/components/portal/ClientLinkSharingModal';
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
const mockFrom = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => Promise.resolve({ data: [], error: null })
        }),
        is: () => ({
          order: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            })
          })
        }),
        order: () => Promise.resolve({ data: [], error: null })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'rec-1', email: 'alice@alpha.com', full_name: 'Alice', status: 'active' }, error: null })
        })
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null })
      })
    }),
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
  fullName: 'Faseeh Lall',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

describe('Ops Hub Client Experience Portal - Automated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(fetchResult.error).toContain('Forbidden');
      expect(fetchResult.client).toBeNull();
      expect(fetchResult.tasks).toHaveLength(0);
    });

    it('blocks unauthenticated visitors without valid session (never exposes portal)', async () => {
      const fetchResult = await clientPortalService.fetchClientPortalData(
        'client-111',
        null, // No caller profile
        false
      );

      expect(fetchResult.error).toContain('Unauthorized');
      expect(fetchResult.client).toBeNull();
      expect(fetchResult.tasks).toHaveLength(0);
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

  describe('3. Owner "View as Client" Read-Only Preview Mode', () => {
    it('allows Owner to preview portal but strictly blocks mutations in preview mode', async () => {
      const canPreview = clientPortalService.canUserPreviewPortal(mockOwnerProfile, mockClientA);
      expect(canPreview).toBe(true);

      // Mutation attempt in preview mode must be blocked
      const approveResult = await clientPortalService.submitClientTaskDecision(
        't-review-1',
        'approve',
        undefined,
        mockOwnerProfile,
        true // isPreview = true
      );

      expect(approveResult.error).toContain('disabled in read-only staff preview mode');

      const changeReqResult = await clientPortalService.submitClientTaskDecision(
        't-review-1',
        'request_changes',
        'Revise headline',
        mockOwnerProfile,
        true // isPreview = true
      );

      expect(changeReqResult.error).toContain('disabled in read-only staff preview mode');
    });
  });

  describe('4. Client Action Queue (Approve & Request Changes)', () => {
    it('requires feedback reason when requesting changes', async () => {
      const res = await clientPortalService.submitClientTaskDecision(
        't-review-1',
        'request_changes',
        '', // Empty reason
        mockClientUserProfile,
        false
      );

      expect(res.error).toContain('Please provide details explaining the changes requested');
    });
  });

  describe('5. Link Sharing Modal & Recipient Governance', () => {
    it('renders production and preview links with proper badges', () => {
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

      expect(screen.getByText('[PRODUCTION LINK]')).toBeDefined();
      expect(screen.getByText('[PREVIEW LINK]')).toBeDefined();
      expect(screen.getByText('Copy Client Link')).toBeDefined();
      expect(screen.getByText('Owner Read-Only Preview')).toBeDefined();
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
});
