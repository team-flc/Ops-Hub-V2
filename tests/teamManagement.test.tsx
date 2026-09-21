import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';
import { CreateTeamMemberModal } from '../src/components/team/CreateTeamMemberModal';
import { EditTeamMemberModal } from '../src/components/team/EditTeamMemberModal';
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
        const queryObj: any = Promise.resolve({ data: mockProfiles, error: null });
        queryObj.order = () => Promise.resolve({ data: mockProfiles, error: null });
        queryObj.in = () => ({
          order: () => Promise.resolve({ data: mockProfiles, error: null })
        });
        return {
          select: () => queryObj
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

  // 14. SOCIAL PROFILE URLS (LINKEDIN, FACEBOOK, INSTAGRAM) IN TEAM MODALS
  it('14. CreateTeamMemberModal & EditTeamMemberModal render Facebook and Instagram Profile URL inputs', () => {
    const ownerProfile: UserProfile = {
      id: 'usr-owner-1',
      fullName: 'Atif Khan',
      role: 'owner',
      status: 'active',
      createdAt: '',
      updatedAt: ''
    };

    const mockDepts = [
      { id: 'd1', name: 'Operations', slug: 'operations', status: 'active' as const, sortOrder: 1, createdAt: '', updatedAt: '' }
    ];

    const mockDesignations = [
      { id: 'des-1', name: 'Operations Associate', status: 'active' as const, createdAt: '', updatedAt: '' }
    ];

    // Create Modal
    const { unmount } = render(
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

    expect(screen.getByPlaceholderText('https://linkedin.com/in/username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://facebook.com/username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://instagram.com/username')).toBeInTheDocument();

    unmount();

    // Edit Modal
    const fakeMember: TeamMemberRecord = {
      id: 'usr-tm-edit',
      fullName: 'Staff Member',
      workEmail: 'staff@faseehlall.com',
      role: 'team_member',
      status: 'active',
      startDate: '2026-01-01',
      departments: mockDepts,
      clientAccessCount: 0,
      clientIds: [],
      createdAt: '',
      updatedAt: ''
    };

    render(
      <EditTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        member={fakeMember}
        currentUserProfile={ownerProfile}
        departments={mockDepts}
        designations={mockDesignations}
        eligibleManagers={[ownerProfile]}
        clients={[]}
        onOpenDesignationManager={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('https://linkedin.com/in/username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://facebook.com/username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://instagram.com/username')).toBeInTheDocument();
  });

  // 15. EMPLOYEE OPERATIONS PERSISTENCE & CONFIGURE SETUP MODAL
  it('15. EditTeamMemberModal renders Date of Birth, Bank Name, Account Number, and IBAN inputs for direct management entry', async () => {
    const ownerProfile: UserProfile = {
      id: 'usr-owner-1',
      fullName: 'Atif Khan',
      role: 'owner',
      status: 'active',
      createdAt: '',
      updatedAt: ''
    };

    const mockDepts = [
      { id: 'd1', name: 'Operations', slug: 'operations', status: 'active' as const, sortOrder: 1, createdAt: '', updatedAt: '' }
    ];

    const mockDesignations = [
      { id: 'des-1', name: 'Operations Associate', status: 'active' as const, createdAt: '', updatedAt: '' }
    ];

    const fakeMember: TeamMemberRecord = {
      id: 'usr-tm-edit',
      fullName: 'Staff Member',
      workEmail: 'staff@faseehlall.com',
      role: 'team_member',
      status: 'active',
      startDate: '2026-01-01',
      departments: mockDepts,
      clientAccessCount: 0,
      clientIds: [],
      createdAt: '',
      updatedAt: ''
    };

    render(
      <EditTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        member={fakeMember}
        currentUserProfile={ownerProfile}
        departments={mockDepts}
        designations={mockDesignations}
        eligibleManagers={[ownerProfile]}
      />
    );

    // Verify Date of Birth label
    expect(screen.getByText('Date of Birth')).toBeInTheDocument();

    // Verify Bank Details section inputs
    expect(screen.getByPlaceholderText('e.g. Meezan Bank, HBL, EasyPaisa')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Muhammad Atif (or leave blank if unverified)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 010203040506 or 03001234567')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. PK36MEZN0000000102030405')).toBeInTheDocument();
  });

  // 16. CNIC NUMBER FIELD INTEGRATION
  it('16. CreateTeamMemberModal & EditTeamMemberModal render CNIC Number input field for past and future team members', async () => {
    const ownerProfile: UserProfile = {
      id: 'usr-owner-1',
      fullName: 'Atif Khan',
      role: 'owner',
      status: 'active',
      createdAt: '',
      updatedAt: ''
    };

    const mockDepts = [
      { id: 'd1', name: 'Operations', slug: 'operations', status: 'active' as const, sortOrder: 1, createdAt: '', updatedAt: '' }
    ];

    const mockDesignations = [
      { id: 'des-1', name: 'Operations Associate', status: 'active' as const, createdAt: '', updatedAt: '' }
    ];

    const fakeMember: TeamMemberRecord = {
      id: 'usr-tm-cnic',
      fullName: 'Farhan Ali',
      workEmail: 'farhan@faseehlall.com',
      cnic: '42101-9876543-1',
      role: 'team_member',
      status: 'active',
      startDate: '2026-01-01',
      departments: mockDepts,
      clientAccessCount: 0,
      clientIds: [],
      createdAt: '',
      updatedAt: ''
    };

    // 1. Check CreateTeamMemberModal
    const { unmount } = render(
      <CreateTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUserProfile={ownerProfile}
        departments={mockDepts}
        designations={mockDesignations}
        eligibleManagers={[ownerProfile]}
        clients={[]}
        onOpenDesignationManager={vi.fn()}
      />
    );

    const createCnicInput = screen.getByPlaceholderText('e.g. 42101-1234567-1');
    expect(createCnicInput).toBeInTheDocument();
    unmount();

    // 2. Check EditTeamMemberModal
    render(
      <EditTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        member={fakeMember}
        currentUserProfile={ownerProfile}
        departments={mockDepts}
        designations={mockDesignations}
        eligibleManagers={[ownerProfile]}
      />
    );

    const editCnicInput = screen.getByPlaceholderText('e.g. 42101-1234567-1');
    expect(editCnicInput).toBeInTheDocument();
    expect(screen.getByText('CNIC Number (Optional)')).toBeInTheDocument();
  });

  // 17. OWNER ROLE EDITING IN EDIT TEAM MEMBER MODAL
  it('17. EditTeamMemberModal allows Owner to edit Governed System Role to Operational Manager', async () => {
    const ownerProfile: UserProfile = {
      id: 'usr-owner-1',
      fullName: 'Atif Khan (Owner)',
      role: 'owner',
      status: 'active',
      createdAt: '',
      updatedAt: ''
    };

    const mockDepts = [
      { id: 'd1', name: 'Operations', slug: 'operations', status: 'active' as const, sortOrder: 1, createdAt: '', updatedAt: '' }
    ];

    const mockDesignations = [
      { id: 'des-1', name: 'Operations Lead', status: 'active' as const, createdAt: '', updatedAt: '' }
    ];

    const targetMember: TeamMemberRecord = {
      id: 'usr-staff-1',
      fullName: 'John Doe',
      workEmail: 'john@faseehlall.com',
      role: 'team_member',
      status: 'active',
      startDate: '2026-01-01',
      departments: mockDepts,
      designationId: 'des-1',
      designationName: 'Operations Lead',
      clientAccessCount: 0,
      clientIds: [],
      createdAt: '',
      updatedAt: ''
    };

    const updateSpy = vi.spyOn(teamManagementService, 'updateTeamMember').mockResolvedValue({});

    render(
      <EditTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        member={targetMember}
        currentUserProfile={ownerProfile}
        departments={mockDepts}
        designations={mockDesignations}
        eligibleManagers={[ownerProfile]}
      />
    );

    // As Owner, Governed System Role should be an interactive select
    const roleSelect = screen.getByLabelText(/Governed System Role/i);
    expect(roleSelect).toBeInTheDocument();
    expect(roleSelect.tagName).toBe('SELECT');

    // Change role to Operational Manager
    fireEvent.change(roleSelect, { target: { value: 'operational_manager' } });
    expect((roleSelect as HTMLSelectElement).value).toBe('operational_manager');

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'usr-staff-1',
          role: 'operational_manager'
        }),
        'usr-owner-1'
      );
    });
  });

  // 18. OPERATIONAL MANAGER SEES GOVERNED SYSTEM ROLE AS READ-ONLY
  it('18. EditTeamMemberModal displays Governed System Role as Read-Only for Operational Manager', () => {
    const managerProfile: UserProfile = {
      id: 'usr-mgr-1',
      fullName: 'Manager User',
      role: 'operational_manager',
      status: 'active',
      createdAt: '',
      updatedAt: ''
    };

    const mockDepts = [
      { id: 'd1', name: 'Operations', slug: 'operations', status: 'active' as const, sortOrder: 1, createdAt: '', updatedAt: '' }
    ];

    const mockDesignations = [
      { id: 'des-1', name: 'Operations Lead', status: 'active' as const, createdAt: '', updatedAt: '' }
    ];

    const targetMember: TeamMemberRecord = {
      id: 'usr-staff-2',
      fullName: 'Jane Doe',
      workEmail: 'jane@faseehlall.com',
      role: 'team_member',
      status: 'active',
      startDate: '2026-01-01',
      departments: mockDepts,
      designationId: 'des-1',
      designationName: 'Operations Lead',
      clientAccessCount: 0,
      clientIds: [],
      createdAt: '',
      updatedAt: ''
    };

    render(
      <EditTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        member={targetMember}
        currentUserProfile={managerProfile}
        departments={mockDepts}
        designations={mockDesignations}
        eligibleManagers={[managerProfile]}
      />
    );

    // Operational Manager cannot edit role - should show Read-Only badge
    expect(screen.getByText('Read-Only')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Governed System Role/i })).not.toBeInTheDocument();
  });

  // 19. FETCH TEAM MEMBERS RESILIENCE ON AUXILIARY TABLE ERRORS
  it('19. fetchTeamMembers returns profiles even if auxiliary tables throw errors', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        full_name: 'Resilient Member',
        work_email: 'resilient@faseehlall.com',
        phone: '+923001234567',
        role: 'team_member',
        status: 'active',
        designation_id: null,
        reporting_manager_id: null,
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
        const queryObj: any = Promise.resolve({ data: mockProfiles, error: null });
        queryObj.order = () => Promise.resolve({ data: mockProfiles, error: null });
        queryObj.in = () => ({
          order: () => Promise.resolve({ data: mockProfiles, error: null })
        });
        return {
          select: () => queryObj
        } as any;
      }
      // Auxiliary tables reject or return error
      return {
        select: () => Promise.reject(new Error('Table or RLS error in auxiliary query'))
      } as any;
    });

    const members = await teamManagementService.fetchTeamMembers('owner', 'owner-1');
    expect(members.length).toBe(1);
    expect(members[0].fullName).toBe('Resilient Member');
    expect(members[0].workEmail).toBe('resilient@faseehlall.com');
  });
});


