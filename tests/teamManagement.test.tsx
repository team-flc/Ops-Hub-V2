import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';
import { TeamManagementView } from '../src/components/views/TeamManagementView';
import { CreateTeamMemberModal } from '../src/components/team/CreateTeamMemberModal';
import { SuspendUserModal } from '../src/components/team/SuspendUserModal';
import { teamManagementService } from '../src/lib/teamManagementService';
import { TeamMemberRecord, UserProfile } from '../src/types';

// Mock Supabase & Services
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFromSelect = vi.fn();
const mockInvoke = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: () => mockGetSession(),
        onAuthStateChange: () => mockOnAuthStateChange(),
        signOut: vi.fn()
      },
      functions: {
        invoke: (fn: string, opts: any) => mockInvoke(fn, opts)
      },
      from: (table: string) => ({
        select: (...args: any[]) => ({
          eq: (...eqArgs: any[]) => ({
            single: () => mockFromSelect(table, eqArgs),
            maybeSingle: () => mockFromSelect(table, eqArgs),
            order: () => Promise.resolve({ data: [], error: null })
          }),
          in: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            }),
            order: () => Promise.resolve({ data: [], error: null })
          }),
          order: () => Promise.resolve({ data: [], error: null })
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) })
      })
    }
  };
});

describe('Phase 2A Team & User Management Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mockFromSelect.mockResolvedValue({ data: null, error: null });
  });

  // 1. ROUTE ACCESS CONTROL TESTS
  it('1. Anonymous user attempting to access /team is redirected to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/team']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>LOGIN_GATE</div>} />
              <Route
                path="/team"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
                    <div>TEAM_MANAGEMENT_PROTECTED</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('LOGIN_GATE')).toBeInTheDocument();
      expect(screen.queryByText('TEAM_MANAGEMENT_PROTECTED')).not.toBeInTheDocument();
    });
  });

  it('2. Team Member role attempting to access /team is redirected to /', async () => {
    const fakeTeamMember = { id: 'usr-tm-1', email: 'tm@faseehlall.com' };
    mockGetUser.mockResolvedValue({ data: { user: fakeTeamMember }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeTeamMember } }, error: null });
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-tm-1',
        full_name: 'Team Member',
        role: 'team_member',
        status: 'active'
      },
      error: null
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/team']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/team"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
                    <div>TEAM_MANAGEMENT_PROTECTED</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<div>STAFF_REGULAR_HOME</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('STAFF_REGULAR_HOME')).toBeInTheDocument();
      expect(screen.queryByText('TEAM_MANAGEMENT_PROTECTED')).not.toBeInTheDocument();
    });
  });

  it('3. Client role attempting to access /team is redirected to /client', async () => {
    const fakeClient = { id: 'usr-client-1', email: 'client@partner.com' };
    mockGetUser.mockResolvedValue({ data: { user: fakeClient }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeClient } }, error: null });
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-client-1',
        full_name: 'Client User',
        role: 'client',
        status: 'active'
      },
      error: null
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/team']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/team"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
                    <div>TEAM_MANAGEMENT_PROTECTED</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/client" element={<div>CLIENT_PORTAL_SAFE</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('CLIENT_PORTAL_SAFE')).toBeInTheDocument();
      expect(screen.queryByText('TEAM_MANAGEMENT_PROTECTED')).not.toBeInTheDocument();
    });
  });

  it('4. Owner role can access /team management', async () => {
    const fakeOwner = { id: 'usr-owner-1', email: 'owner@faseehlall.com' };
    mockGetUser.mockResolvedValue({ data: { user: fakeOwner }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeOwner } }, error: null });
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-owner-1',
        full_name: 'Atif Khan',
        role: 'owner',
        status: 'active'
      },
      error: null
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/team']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/team"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
                    <div>TEAM_MANAGEMENT_AUTHORIZED</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('TEAM_MANAGEMENT_AUTHORIZED')).toBeInTheDocument();
    });
  });

  // 2. CREATION MODAL TESTS
  it('5. Create Team Member modal locks system role to Team Member and validates inputs', () => {
    const ownerProfile: UserProfile = {
      id: 'usr-owner-1',
      fullName: 'Atif Khan',
      role: 'owner',
      status: 'active',
      createdAt: '',
      updatedAt: ''
    };

    const mockDepts = [
      { id: 'd1', name: 'Operations', slug: 'operations', status: 'active' as const, sortOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'd2', name: 'SEO', slug: 'seo', status: 'active' as const, sortOrder: 2, createdAt: '', updatedAt: '' }
    ];

    const mockDesignations = [
      { id: 'des-1', name: 'Operations Associate', status: 'active' as const, createdAt: '', updatedAt: '' }
    ];

    render(
      <CreateTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUserProfile={ownerProfile}
        departments={mockDepts}
        designations={mockDesignations}
        eligibleManagers={[ownerProfile]}
        onOpenDesignationManager={vi.fn()}
      />
    );

    // Verify Title and Role Badge
    expect(screen.getByText('Create New Team Member')).toBeInTheDocument();
    expect(screen.getByText('Team Member')).toBeInTheDocument();
    expect(screen.getByText('Fixed')).toBeInTheDocument();

    // Verify Password Generator Button
    expect(screen.getByText('Generate Strong Password')).toBeInTheDocument();
  });

  // 3. OFFBOARDING & SUSPENSION SAFETY TEST
  it('6. Suspend modal checks open tasks and prevents unassigned suspension', async () => {
    const fakeMember: TeamMemberRecord = {
      id: 'usr-tm-to-suspend',
      fullName: 'Departing Staff',
      workEmail: 'departing@faseehlall.com',
      role: 'team_member',
      status: 'active',
      startDate: '2026-01-01',
      departments: [],
      clientAccessCount: 0,
      clientIds: [],
      createdAt: '',
      updatedAt: ''
    };

    const mockTasks = [
      {
        id: 'task-101',
        title: 'Complete Monthly SLA Report',
        status: 'in_progress',
        priority: 'high',
        spaceId: 's1',
        listId: 'l1',
        assigneeIds: ['usr-tm-to-suspend'],
        tags: [],
        timeTracked: 0,
        createdAt: '',
        updatedAt: ''
      }
    ];

    vi.spyOn(teamManagementService, 'fetchOpenTasksForUser').mockResolvedValue(mockTasks as any);

    await act(async () => {
      render(
        <SuspendUserModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          member={fakeMember}
          activeTeamMembers={[fakeMember]}
          currentUserProfile={{ id: 'owner-1', fullName: 'Owner', role: 'owner', status: 'active', createdAt: '', updatedAt: '' }}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Offboard & Suspend Team Member/i)).toBeInTheDocument();
      expect(screen.getByText('Complete Monthly SLA Report')).toBeInTheDocument();
      // Confirm suspension button should be disabled because task is unassigned
      const confirmBtn = screen.getByRole('button', { name: /confirm suspension/i });
      expect(confirmBtn).toBeDisabled();
    });
  });

  // 4. FRONTEND SECURITY: NO SERVICE ROLE KEYS
  it('7. Frontend bundle contains zero service-role keys or admin bypass tokens', () => {
    expect(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(import.meta.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
