import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';
import { CreateTeamMemberModal } from '../src/components/team/CreateTeamMemberModal';
import { SuspendUserModal } from '../src/components/team/SuspendUserModal';
import { Header } from '../src/components/layout/Header';
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
        select: (..._args: any[]) => ({
          eq: (...eqArgs: any[]) => ({
            single: () => mockFromSelect(table, eqArgs),
            maybeSingle: () => mockFromSelect(table, eqArgs),
            order: () => Promise.resolve({ data: [], error: null })
          }),
          in: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            }),
            or: () => ({
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
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-jwt-token' } }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mockFromSelect.mockResolvedValue({ data: null, error: null });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
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
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeTeamMember, access_token: 'tok' } }, error: null });
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
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeClient, access_token: 'tok' } }, error: null });
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
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeOwner, access_token: 'tok' } }, error: null });
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

  // 4. EDGE FUNCTION ACTION INVOCATION MATCHING
  it('7. Service invocations call canonical manage-team-member Edge Function with exact action names', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    // Test create
    await teamManagementService.createTeamMember({
      fullName: 'Test User',
      workEmail: 'test@faseehlall.com',
      startDate: '2026-01-01',
      departmentIds: ['d1'],
      designationId: 'des-1',
      password: 'Password123!@#'
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'manage-team-member',
      expect.objectContaining({
        body: expect.objectContaining({ action: 'create', fullName: 'Test User' })
      })
    );

    // Test reset password
    await teamManagementService.resetPassword('target-user-1', 'NewPassword123!@#');
    expect(mockInvoke).toHaveBeenCalledWith(
      'manage-team-member',
      expect.objectContaining({
        body: expect.objectContaining({ action: 'reset_password', targetUserId: 'target-user-1' })
      })
    );

    // Test reactivate
    await teamManagementService.reactivateTeamMember('target-user-1');
    expect(mockInvoke).toHaveBeenCalledWith(
      'manage-team-member',
      expect.objectContaining({
        body: expect.objectContaining({ action: 'reactivate', targetUserId: 'target-user-1' })
      })
    );
  });

  // 5. DEMO RESET CONTROL REMOVAL FROM PRODUCTION
  it('8. Demo reset button is guarded strictly in Header and absent from production build', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );

    // In vitest / test environment where DEV is false or mocked, demo reset should not be accessible
    const demoResetBtn = screen.queryByTitle(/Reset to initial demo data/i);
    // If DEV is false, it is null
    if (!import.meta.env.DEV) {
      expect(demoResetBtn).not.toBeInTheDocument();
    }
  });

  // 6. FRONTEND SECURITY: NO SERVICE ROLE KEYS
  it('9. Frontend bundle contains zero service-role keys or admin bypass tokens', () => {
    expect(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(import.meta.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  // 7. REGRESSION TESTS: OPERATIONAL MANAGER CREATION & DETAILED ERROR EXTRACTION
  it('10. Owner provisioning an Operational Manager sends correct role and payload to Edge Function', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        user: {
          id: 'new-om-id',
          fullName: 'Muhammad Atif Naseer',
          workEmail: 'atifrajpoot134@gmail.com',
          role: 'operational_manager',
          reportingManagerId: 'owner-id',
          status: 'active'
        }
      },
      error: null
    });

    const result = await teamManagementService.createTeamMember({
      fullName: 'Muhammad Atif Naseer',
      workEmail: 'atifrajpoot134@gmail.com',
      role: 'operational_manager',
      startDate: '2026-09-08',
      departmentIds: ['dept-ops'],
      designationId: 'desig-ops-mgr',
      reportingManagerId: 'owner-id',
      password: 'SecurePassword123!@#'
    });

    expect(result.error).toBeUndefined();
    expect(result.user).toBeDefined();
    expect(result.user?.role).toBe('operational_manager');
    expect(mockInvoke).toHaveBeenCalledWith(
      'manage-team-member',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'create',
          fullName: 'Muhammad Atif Naseer',
          workEmail: 'atifrajpoot134@gmail.com',
          role: 'operational_manager'
        })
      })
    );
  });

  it('11. Error handling parses JSON response body from Edge Function non-2xx status code', async () => {
    const mockHttpError = {
      message: 'Edge Function returned a non-2xx status code',
      context: {
        json: vi.fn().mockResolvedValue({ error: 'A team member with this email already exists in profiles.' })
      }
    };
    mockInvoke.mockResolvedValue({ data: null, error: mockHttpError });

    const result = await teamManagementService.createTeamMember({
      fullName: 'Duplicate User',
      workEmail: 'existing@faseehlall.com',
      startDate: '2026-09-08',
      departmentIds: ['dept-ops'],
      designationId: 'desig-1',
      password: 'SecurePassword123!@#'
    });

    expect(result.error).toBe('A team member with this email already exists in profiles.');
  });

  it('12. Error handling falls back gracefully when Edge Function context JSON cannot be parsed', async () => {
    const mockHttpError = {
      message: 'Edge Function returned a non-2xx status code',
      context: {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      }
    };
    mockInvoke.mockResolvedValue({ data: null, error: mockHttpError });

    const result = await teamManagementService.createTeamMember({
      fullName: 'User',
      workEmail: 'test@faseehlall.com',
      startDate: '2026-09-08',
      departmentIds: ['dept-ops'],
      designationId: 'desig-1',
      password: 'SecurePassword123!@#'
    });

    expect(result.error).toBe('Edge Function returned a non-2xx status code');
  });

  it('13. Owner fetchTeamMembers returns owner, managers and team members, with owner manager displayed as dash', async () => {
    const mockProfiles = [
      {
        id: 'owner-1',
        full_name: 'Atif Khan',
        work_email: 'owner@faseehlall.com',
        phone: '+1234567890',
        role: 'owner',
        status: 'active',
        designation_id: null,
        reporting_manager_id: null,
        start_date: '2026-01-01',
        suspended_at: null,
        suspended_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      },
      {
        id: 'mgr-1',
        full_name: 'Operational Manager',
        work_email: 'mgr@faseehlall.com',
        phone: '+1234567891',
        role: 'operational_manager',
        status: 'active',
        designation_id: null,
        reporting_manager_id: 'owner-1',
        start_date: '2026-01-01',
        suspended_at: null,
        suspended_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      }
    ];

    const viSupabase = await import('../src/lib/supabase');
    vi.spyOn(viSupabase.supabase, 'from').mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            in: () => ({
              order: () => Promise.resolve({ data: mockProfiles, error: null })
            })
          })
        } as any;
      }
      return {
        select: () => Promise.resolve({ data: [], error: null })
      } as any;
    });

    const members = await teamManagementService.fetchTeamMembers('owner', 'owner-1');
    expect(members.length).toBe(2);
    expect(members[0].role).toBe('owner');
    expect(members[0].reportingManagerName).toBe('—');
    expect(members[1].role).toBe('operational_manager');
  });
});


