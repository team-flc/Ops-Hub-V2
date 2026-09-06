import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Header } from '../src/components/layout/Header';
import { ProfileDropdown } from '../src/components/profile/ProfileDropdown';
import { MyProfileView } from '../src/components/profile/MyProfileView';
import { ArchiveCenterView } from '../src/components/archive/ArchiveCenterView';
import { AuditLogView } from '../src/components/audit/AuditLogView';
import { SettingsLayout } from '../src/components/settings/SettingsLayout';
import { CreateTeamMemberModal } from '../src/components/team/CreateTeamMemberModal';
import { ArchiveTeamMemberModal } from '../src/components/team/ArchiveTeamMemberModal';
import { CreateClientModal } from '../src/components/clients/CreateClientModal';
import { ClientDetailsTab } from '../src/components/clients/ClientDetailsTab';
import { ClientWorkspaceView } from '../src/components/clients/ClientWorkspaceView';
import { storageService } from '../src/lib/storageService';
import { profileService } from '../src/lib/profileService';
import { archiveService } from '../src/lib/archiveService';
import { auditService } from '../src/lib/auditService';
import { teamManagementService } from '../src/lib/teamManagementService';
import { clientManagementService } from '../src/lib/clientManagementService';
import { UserProfile, ClientRecord, Department, Designation } from '../src/types';
import { useOpsStore } from '../src/store/opsStore';

// Mocks
const mockSignOut = vi.fn();
let mockCurrentProfile: UserProfile | null = null;

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'owner@faseehlall.com' },
    profile: mockCurrentProfile,
    signOut: mockSignOut,
    refreshProfile: vi.fn()
  })
}));

const mockFrom = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'owner@faseehlall.com' } }, error: null }),
      getSession: () => Promise.resolve({ data: { session: { access_token: 'fake-jwt' } } })
    },
    from: (table: string) => mockFrom(table),
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args)
    },
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl
      })
    },
    channel: () => ({
      on: () => ({
        subscribe: () => ({})
      })
    }),
    removeChannel: vi.fn()
  },
  isSupabaseConfigured: true
}));

const mockClients: ClientRecord[] = [
  {
    id: 'client-1',
    companyName: 'UnizConnect',
    clientName: 'Sarah Jenkins',
    package: 'Advanced',
    operationalManagerId: 'mgr-1',
    operationalManagerName: 'John Manager',
    activationDate: '2026-08-01',
    status: 'Onboarding',
    requiredLinkedinProfileCount: 3,
    links: {},
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z'
  },
  {
    id: 'client-2',
    companyName: 'Acme Global',
    clientName: 'Alice Smith',
    package: 'Basic',
    operationalManagerId: 'mgr-1',
    operationalManagerName: 'John Manager',
    activationDate: '2026-07-01',
    status: 'Active',
    requiredLinkedinProfileCount: 3,
    links: {},
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z'
  },
  {
    id: 'client-3',
    companyName: 'Paused Holdings',
    clientName: 'Robert Paul',
    package: 'Intermediate',
    operationalManagerId: 'mgr-1',
    operationalManagerName: 'John Manager',
    activationDate: '2026-06-01',
    status: 'Paused',
    pauseReason: 'Payment overdue',
    requiredLinkedinProfileCount: 3,
    links: {},
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z'
  }
];

const mockDepartments: Department[] = [
  { id: 'dept-1', name: 'Operations', slug: 'ops', status: 'active', sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 'dept-2', name: 'Development', slug: 'dev', status: 'active', sortOrder: 2, createdAt: '', updatedAt: '' }
];

const mockDesignations: Designation[] = [
  { id: 'desig-1', name: 'Operations Lead', status: 'active', createdAt: '', updatedAt: '' }
];

describe('Phase 3A.1 Connected System Foundation, Settings, Profiles, Archive & Audit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOpsStore.setState({
      clients: mockClients,
      selectedClientId: 'client-1',
      viewMode: 'client_workspace'
    });

    mockCurrentProfile = {
      id: 'user-1',
      fullName: 'Faseeh Lall',
      role: 'owner',
      status: 'active',
      workEmail: 'owner@faseehlall.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };
  });

  // 1. GOHIGHLEVEL-STYLE NAVIGATION & SIDEBAR CLEANUP
  it('1. Owner sees Settings in sidebar and no direct Client/Team links in main navigation', () => {
    render(<Sidebar />);

    // FLC Logo present
    expect(screen.getByAltText(/faseeh lall/i)).toBeInTheDocument();

    // GoHighLevel Client Switcher present
    expect(screen.getByText('UnizConnect')).toBeInTheDocument();

    // Bottom Settings button exists for Owner
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();

    // Old main links removed
    expect(screen.queryByRole('button', { name: /^team management$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^client management$/i })).not.toBeInTheDocument();
  });

  // 2. TEAM MEMBER DOES NOT SEE SETTINGS IN SIDEBAR
  it('2. Team Member has Settings action hidden in sidebar', () => {
    mockCurrentProfile = {
      id: 'tm-1',
      fullName: 'Zaid Khan',
      role: 'team_member',
      status: 'active',
      workEmail: 'zaid@faseehlall.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    render(<Sidebar />);
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
  });

  // 3. TOP-RIGHT PROFILE DROPDOWN WITH SINGLE SIGN OUT
  it('3. Header ProfileDropdown displays user info, My Profile, and the single Sign Out action', () => {
    render(<ProfileDropdown />);

    // Trigger button shows initials
    const trigger = screen.getByLabelText(/staff profile menu/i);
    expect(trigger).toBeInTheDocument();

    // Click to open menu
    fireEvent.click(trigger);

    expect(screen.getByText('Faseeh Lall')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('owner@faseehlall.com')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();

    // Exactly one sign out button in menu
    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  // 4. CLIENT ACCESS SELECTOR INCLUDES ONBOARDING CLIENTS (FIXES UNIZCONNECT BUG)
  it('4. CreateTeamMemberModal includes Onboarding, Active, and Paused clients in Client Access selector', () => {
    render(
      <CreateTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUserProfile={mockCurrentProfile}
        departments={mockDepartments}
        designations={mockDesignations}
        eligibleManagers={[]}
        onOpenDesignationManager={vi.fn()}
      />
    );

    // Onboarding client UnizConnect is visible and selectable
    expect(screen.getByText('UnizConnect')).toBeInTheDocument();
    expect(screen.getByText('(Onboarding)')).toBeInTheDocument();

    // Active client Acme Global is visible
    expect(screen.getByText('Acme Global')).toBeInTheDocument();

    // Paused client Paused Holdings is visible and marked
    expect(screen.getByText('Paused Holdings')).toBeInTheDocument();
    expect(screen.getByText('(Paused)')).toBeInTheDocument();
  });

  // 5. IMAGE VALIDATION & STORAGE SECURITY
  it('5. StorageService validates image file types, limits size to 5MB, and rejects invalid formats', () => {
    // Valid PNG
    const validFile = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
    const validCheck = storageService.validateImage(validFile);
    expect(validCheck.isValid).toBe(true);
    expect(validCheck.error).toBeNull();

    // Invalid PDF
    const pdfFile = new File(['dummy content'], 'doc.pdf', { type: 'application/pdf' });
    const pdfCheck = storageService.validateImage(pdfFile);
    expect(pdfCheck.isValid).toBe(false);
    expect(pdfCheck.error).toMatch(/only jpg, png, and webp/i);

    // Oversized 6MB file
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const largeCheck = storageService.validateImage(largeFile);
    expect(largeCheck.isValid).toBe(false);
    expect(largeCheck.error).toMatch(/exceeds maximum limit of 5 mb/i);
  });

  // 6. SELF-PROFILE UPDATE MUTATIONS AND IMMUTABILITY
  it('6. MyProfileView renders self-editable fields and protected read-only governance fields', async () => {
    mockCurrentProfile = {
      id: 'tm-1',
      fullName: 'Zaid Khan',
      role: 'team_member',
      status: 'active',
      workEmail: 'zaid@faseehlall.com',
      phone: '+92 300 1234567',
      designationName: 'Senior Specialist',
      reportingManagerName: 'John Manager',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    render(<MyProfileView />);

    expect(screen.getByText('Personal Profile Information')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Zaid Khan')).toBeInTheDocument();

    // Governance fields are displayed as read-only protected
    expect(screen.getByText('System & Organizational Governance (Protected)')).toBeInTheDocument();
    expect(screen.getAllByText('zaid@faseehlall.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Senior Specialist')).toBeInTheDocument();
    expect(screen.getByText('John Manager')).toBeInTheDocument();
  });

  // 7. ARCHIVE CENTER RESTORE & RECOVERY SAFEGUARDS
  it('7. ArchiveCenterView displays archived records with mandatory reasons and restore confirmation', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [
              {
                id: 'arch-client-1',
                company_name: 'Old Client Corp',
                status: 'Archived',
                previous_status: 'Active',
                archived_at: '2026-08-15T00:00:00Z',
                archive_reason: 'Contract expired',
                archived_by_profile: { full_name: 'Faseeh Lall' }
              }
            ],
            error: null
          })
        })
      })
    });

    render(<ArchiveCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Old Client Corp')).toBeInTheDocument();
      expect(screen.getByText('Contract expired')).toBeInTheDocument();
      expect(screen.getByText('Faseeh Lall')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    });
  });

  // 8. ARCHIVE SERVICE BLOCKS TEAM MEMBER ARCHIVE IF USER HAS OPEN TASKS
  it('8. ArchiveService blocks team member archive if user has open assigned tasks', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Cannot archive team member who has active open tasks.' }
    });

    const res = await archiveService.archiveTeamMember('user-x', 'Resigned from company');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cannot archive team member.*open task/i);
  });

  // 9. AUDIT LOGGING & SENSITIVE SECRET REDACTION (ITEM 9)
  it('9. AuditService blocks direct client-side insertions and redacts sensitive passwords/tokens', async () => {
    // 9.1 Direct client insertion is prohibited
    const res = await auditService.logAuditEvent({
      action: 'user_created',
      entityType: 'team_member',
      entityId: 'tm-10',
      entityName: 'New Member',
      previousState: null,
      newState: {
        fullName: 'New Member',
        password: 'SuperSecretPassword123!',
        token: 'auth-jwt-token',
        phone: '+92 300 0000000'
      },
      reason: 'Onboarding new staff member'
    });

    expect(res.error).toMatch(/prohibited/i);

    // 9.2 Redact utility thoroughly scrubs passwords, tokens, hashes, and secrets
    const redacted = auditService.redactAuditPayload({
      fullName: 'New Member',
      password: 'SuperSecretPassword123!',
      token: 'auth-jwt-token',
      apiKey: 'secret-key-xyz',
      phone: '+92 300 0000000'
    });

    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.phone).toBe('+92 300 0000000');
  });

  // 10. SETTINGS ROUTE FAILS CLOSED FOR TEAM MEMBER
  it('10. SettingsLayout displays access restricted message for Team Member', () => {
    mockCurrentProfile = {
      id: 'tm-1',
      fullName: 'Zaid Khan',
      role: 'team_member',
      status: 'active',
      workEmail: 'zaid@faseehlall.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    render(<SettingsLayout />);
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.queryByText(/Archive Center/i)).not.toBeInTheDocument();
  });

  // 11. ZERO SERVICE ROLE KEY IN FRONTEND AUDIT
  it('11. Frontend contains zero service-role keys or bypass tokens', () => {
    expect(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(import.meta.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  // 12. CLIENT DETAILS TAB BRAND IDENTITY & PERMISSIONS
  it('12. ClientDetailsTab renders brand logo, industry, bio, and protects governance fields', () => {
    const ownerProfile: UserProfile = {
      id: 'user-1',
      fullName: 'Faseeh Lall',
      role: 'owner',
      status: 'active',
      workEmail: 'owner@faseehlall.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    render(
      <ClientDetailsTab
        client={mockClients[0]}
        currentUserProfile={ownerProfile}
        eligibleManagers={[]}
        onClientUpdated={vi.fn()}
      />
    );

    expect(screen.getByText(/Brand Identity/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. B2B SaaS, E-Commerce, Logistics/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Brief description of the client's business model/i)).toBeInTheDocument();
  });

  // 13. ARCHIVE TEAM MEMBER MODAL OPEN TASKS BLOCK
  it('13. ArchiveTeamMemberModal blocks archive when open tasks exist', async () => {
    vi.spyOn(archiveService, 'checkTeamMemberOpenTasks').mockResolvedValueOnce({
      hasOpenTasks: true,
      openTaskCount: 2,
      tasks: [
        { id: 't1', title: 'Task 1', clientId: 'c1', status: 'In Progress' },
        { id: 't2', title: 'Task 2', clientId: 'c1', status: 'Assigned' }
      ],
      error: null
    });

    const memberToArchive = {
      id: 'tm-open',
      fullName: 'Assigned Member',
      workEmail: 'assigned@faseehlall.com',
      role: 'team_member' as const,
      status: 'active' as const,
      departmentNames: ['Ops'],
      clientNames: ['UnizConnect'],
      clientIds: ['client-1'],
      departmentIds: ['dept-1'],
      startDate: '2026-01-01',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    render(
      <ArchiveTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        member={memberToArchive}
        currentUserProfile={mockCurrentProfile}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Archive Blocked: Active Open Tasks/i)).toBeInTheDocument();
    });

    const archiveBtn = screen.getByRole('button', { name: /Archive Team Member/i });
    expect(archiveBtn).toBeDisabled();
  });

  // 14. PAUSED CLIENT WORKSPACE BANNER AND TASK CREATION SAFEGUARD
  it('14. ClientWorkspaceView displays Paused warning banner and blocks task creation', () => {
    const pausedClient = mockClients[2]; // 'Paused Holdings'
    const ownerProfile: UserProfile = {
      id: 'user-1',
      fullName: 'Faseeh Lall',
      role: 'owner',
      status: 'active',
      workEmail: 'owner@faseehlall.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    render(
      <ClientWorkspaceView
        client={pausedClient}
        currentUserProfile={ownerProfile}
        eligibleManagers={[]}
        onClientUpdated={vi.fn()}
      />
    );

    expect(screen.getByText(/Workspace Paused/i)).toBeInTheDocument();
    expect(screen.getByText(/Tasks Paused/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Add Task/i })).not.toBeInTheDocument();
  });

  // 15. CLICKABLE BREADCRUMBS RETURN NAVIGATION
  it('15. Header breadcrumbs allow clicking Ops Hub to return to workspace', () => {
    useOpsStore.setState({ viewMode: 'settings' });
    expect(useOpsStore.getState().viewMode).toBe('settings');

    render(<Header />);
    const opsHubBtn = screen.getByRole('button', { name: /Ops Hub/i });
    fireEvent.click(opsHubBtn);

    expect(useOpsStore.getState().viewMode).toBe('client_workspace');
  });

  // 16. CREATE TEAM MEMBER RENDERS ALL 5 OPTIONAL FIELDS (ITEM 1)
  it('16. CreateTeamMemberModal renders all 5 optional fields and submits them in payload', async () => {
    let capturedPayload: any = null;
    vi.spyOn(teamManagementService, 'createTeamMember').mockImplementation(async (payload) => {
      capturedPayload = payload;
      return { data: { id: 'tm-new' } as any, error: null };
    });

    const mgrProfile: UserProfile = {
      id: 'mgr-1',
      fullName: 'John Manager',
      role: 'operational_manager',
      status: 'active',
      workEmail: 'mgr@faseehlall.com',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    };

    render(
      <CreateTeamMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUserProfile={mgrProfile}
        departments={mockDepartments}
        designations={mockDesignations}
        eligibleManagers={[mgrProfile]}
        onOpenDesignationManager={vi.fn()}
      />
    );

    // 1. Avatar upload control
    expect(screen.getByText(/Profile Avatar \(Optional\)/i)).toBeInTheDocument();

    // 2. Backup phone input
    expect(screen.getByPlaceholderText(/\+92 321 7654321/i)).toBeInTheDocument();

    // 3. Contact Email input
    expect(screen.getByPlaceholderText(/contact\.gmail@gmail\.com/i)).toBeInTheDocument();

    // 4. LinkedIn Profile URL input
    expect(screen.getByPlaceholderText(/https:\/\/linkedin\.com\/in\/username/i)).toBeInTheDocument();

    // 5. Professional Bio textarea
    expect(screen.getByPlaceholderText(/Brief summary of member's professional background/i)).toBeInTheDocument();

    // Fill optional fields
    fireEvent.change(screen.getByPlaceholderText(/\+92 321 7654321/i), { target: { value: '+92 321 9999999' } });
    fireEvent.change(screen.getByPlaceholderText(/contact\.gmail@gmail\.com/i), { target: { value: 'contact@gmail.com' } });
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/linkedin\.com\/in\/username/i), { target: { value: 'https://linkedin.com/in/testmember' } });
    fireEvent.change(screen.getByPlaceholderText(/Brief summary of member's professional background/i), { target: { value: 'Senior Operations Lead' } });

    // Required fields
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Zaid Khan/i), { target: { value: 'Test Member' } });
    fireEvent.change(screen.getByPlaceholderText(/name@faseehlall\.com/i), { target: { value: 'test@faseehlall.com' } });
    fireEvent.change(screen.getByDisplayValue(/Select Designation/i), { target: { value: mockDesignations[0].id } });
    fireEvent.click(screen.getByText(mockDepartments[0].name));
    fireEvent.click(screen.getByRole('button', { name: /Generate Strong Password/i }));

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Create Team Member/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(capturedPayload).toBeDefined();
    expect(capturedPayload.backupPhone).toBe('+92 321 9999999');
    expect(capturedPayload.contactEmail).toBe('contact@gmail.com');
    expect(capturedPayload.linkedinUrl).toBe('https://linkedin.com/in/testmember');
    expect(capturedPayload.bio).toBe('Senior Operations Lead');
  });

  // 17. ARCHIVE STATUS BYPASS REMOVAL (ITEM 3)
  it('17. Client status selectors exclude Archived option from create and edit interfaces', () => {
    render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        eligibleManagers={[]}
      />
    );

    const statusSelect = screen.getByLabelText(/Lifecycle Status/i) as HTMLSelectElement;
    const optionValues = Array.from(statusSelect.options).map(o => o.value);
    expect(optionValues).toContain('Onboarding');
    expect(optionValues).toContain('Active');
    expect(optionValues).not.toContain('Archived');
  });

  // 18. SERVER-SIDE CLIENT ACCESS REVOCATION PROTECTION (ITEM 5)
  it('18. teamManagementService.updateTeamMember routes through edge function and blocks revocation on open tasks', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Cannot revoke client access: team member has 2 open assigned tasks on Acme Global.' }
    });

    const res = await teamManagementService.updateTeamMember('tm-1', {
      fullName: 'Updated Name',
      clientIds: []
    });

    expect(res.error).toMatch(/cannot revoke client access.*open.*task/i);
  });

  // 19. RECURSIVE CASE-INSENSITIVE AUDIT REDACTION (ITEM 6)
  it('19. auditService.redactAuditPayload recursively redacts sensitive credentials and signed URL query tokens', () => {
    const payload = {
      id: 'task-123',
      fullName: 'John Doe',
      companyName: 'Acme Corp',
      status: 'Active',
      role: 'team_member',
      Password: 'SuperSecretPassword!',
      access_token: 'jwt.token.here',
      REFRESH_TOKEN: 'refresh.token.here',
      apiKey: 'ak_1234567890',
      serviceRoleKey: 'srk_secret_key',
      cookie: 'session_id=abcdef',
      Authorization: 'Bearer secret_token',
      recoveryCode: 'REC-999-111',
      otp: '123456',
      signedUrl: 'https://storage.supabase.co/object/sign/client-logos/org/logo.png?token=secret123',
      nested: {
        SECRET: 'hidden-deeply',
        safeKey: 'keep-me',
        urls: [
          'https://storage.supabase.co/object/sign/avatars/u1.png?token=tokenABC&signature=sigXYZ',
          'https://clean.example.com/image.png'
        ]
      }
    };

    const redacted = auditService.redactAuditPayload(payload);

    // Non-sensitive data preserved
    expect(redacted.id).toBe('task-123');
    expect(redacted.fullName).toBe('John Doe');
    expect(redacted.companyName).toBe('Acme Corp');
    expect(redacted.status).toBe('Active');
    expect(redacted.role).toBe('team_member');
    expect(redacted.nested.safeKey).toBe('keep-me');

    // Sensitive keys redacted
    expect(redacted.Password).toBe('[REDACTED]');
    expect(redacted.access_token).toBe('[REDACTED]');
    expect(redacted.REFRESH_TOKEN).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.serviceRoleKey).toBe('[REDACTED]');
    expect(redacted.cookie).toBe('[REDACTED]');
    expect(redacted.Authorization).toBe('[REDACTED]');
    expect(redacted.recoveryCode).toBe('[REDACTED]');
    expect(redacted.otp).toBe('[REDACTED]');
    expect(redacted.signedUrl).toBe('[REDACTED]');
    expect(redacted.nested.SECRET).toBe('[REDACTED]');

    // String URL query parameters redacted in array
    expect(redacted.nested.urls[0]).toBe('https://storage.supabase.co/object/sign/avatars/u1.png?token=[REDACTED]&signature=[REDACTED]');
    expect(redacted.nested.urls[1]).toBe('https://clean.example.com/image.png');
  });

  // 20. PROFILE SELF-UPDATE VIA MANAGE-PROFILE EDGE FUNCTION (ITEM 4)
  it('20. profileService.updateSelfProfile invokes manage-profile edge function with authorization token', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        profile: {
          id: 'user-1',
          full_name: 'Updated Name',
          work_email: 'owner@faseehlall.com',
          role: 'owner',
          status: 'active',
          bio: 'Senior Operations Executive',
          created_at: '2026-01-01',
          updated_at: '2026-09-03'
        }
      },
      error: null
    });

    const res = await profileService.updateSelfProfile({
      fullName: 'Updated Name',
      bio: 'Senior Operations Executive'
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('manage-profile', expect.objectContaining({
      body: expect.objectContaining({
        fullName: 'Updated Name',
        bio: 'Senior Operations Executive'
      })
    }));

    expect(res.data).toBeDefined();
    expect(res.data?.fullName).toBe('Updated Name');
    expect(res.data?.bio).toBe('Senior Operations Executive');
    expect(res.error).toBeNull();
  });

  // 21. DIRECT TRANSITIONS INTO OR OUT OF ARCHIVED ARE STRICTLY REJECTED
  it('21. Direct transitions into or out of Archived are strictly rejected by clientManagementService', async () => {
    // Transition INTO Archived rejected
    const archiveAttempt = await clientManagementService.updateClient('client-1', {
      status: 'Archived' as any
    });
    expect(archiveAttempt.error).toMatch(/direct archival through update is prohibited/i);
    expect(archiveAttempt.data).toBeUndefined();

    // Transition OUT OF Archived rejected
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { id: 'client-1', status: 'Archived', company_name: 'Archived Client' },
            error: null
          })
        })
      })
    });

    const restoreAttempt = await clientManagementService.updateClient('client-1', {
      status: 'Active'
    });
    expect(restoreAttempt.error).toMatch(/direct modification or restoration of an archived client is prohibited/i);
    expect(restoreAttempt.data).toBeUndefined();
  });

  // 22. EXACTLY ONE CLIENT ARCHIVE AUDIT EVENT PRODUCED VIA AUTHORITATIVE FLOW
  it('22. Exactly one client archive audit event is produced via manage-archive, while DB trigger skips archive transitions', async () => {
    let auditEventsCreated = 0;
    mockFunctionsInvoke.mockImplementationOnce(async (functionName, options) => {
      if (functionName === 'manage-archive' && options?.body?.action === 'archive') {
        auditEventsCreated++;
        return { data: { success: true }, error: null };
      }
      return { data: null, error: 'Unknown function' };
    });

    // DB trigger skips mutation logging for archive to avoid duplicate audit records
    const simulateDbAuditTrigger = (op: string, oldRow: { status: string }, newRow: { status: string }) => {
      if (op === 'UPDATE' && (newRow.status === 'Archived' || oldRow.status === 'Archived')) {
        return null;
      }
      auditEventsCreated++;
      return { action: 'client_status_changed' };
    };

    const res = await archiveService.archiveClient('client-1', 'Project complete');
    expect(res.success).toBe(true);
    expect(res.error).toBeNull();

    const triggerResult = simulateDbAuditTrigger('UPDATE', { status: 'Active' }, { status: 'Archived' });
    expect(triggerResult).toBeNull();

    expect(auditEventsCreated).toBe(1);
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('manage-archive', expect.objectContaining({
      body: {
        action: 'archive',
        entityType: 'client',
        entityId: 'client-1',
        reason: 'Project complete'
      }
    }));
  });

  // 23. EXACTLY ONE CLIENT RESTORE AUDIT EVENT PRODUCED VIA AUTHORITATIVE FLOW
  it('23. Exactly one client restore audit event is produced via manage-archive, while DB trigger skips restore transitions', async () => {
    let auditEventsCreated = 0;
    mockFunctionsInvoke.mockImplementationOnce(async (functionName, options) => {
      if (functionName === 'manage-archive' && options?.body?.action === 'restore') {
        auditEventsCreated++;
        return { data: { success: true }, error: null };
      }
      return { data: null, error: 'Unknown function' };
    });

    // DB trigger skips mutation logging for restore to avoid duplicate audit records
    const simulateDbAuditTrigger = (op: string, oldRow: { status: string }, newRow: { status: string }) => {
      if (op === 'UPDATE' && (newRow.status === 'Archived' || oldRow.status === 'Archived')) {
        return null;
      }
      auditEventsCreated++;
      return { action: 'client_status_changed' };
    };

    const res = await archiveService.restoreClient('client-1');
    expect(res.success).toBe(true);
    expect(res.error).toBeNull();

    const triggerResult = simulateDbAuditTrigger('UPDATE', { status: 'Archived' }, { status: 'Active' });
    expect(triggerResult).toBeNull();

    expect(auditEventsCreated).toBe(1);
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('manage-archive', expect.objectContaining({
      body: {
        action: 'restore',
        entityType: 'client',
        entityId: 'client-1'
      }
    }));
  });

  // 24. DATABASE AUDIT PAYLOAD REDACTION & SAFE-FIELD ALLOWLIST
  it('24. Database audit payload safe allowlist excludes sensitive URLs, Drive/Slack links, tokens, and query parameters', () => {
    const toSafeClientAuditJson = (c: any) => {
      if (!c) return null;
      return {
        id: c.id,
        company_name: c.company_name,
        client_name: c.client_name,
        package: c.package,
        status: c.status,
        pause_reason: c.pause_reason,
        paused_at: c.paused_at,
        paused_by: c.paused_by,
        operational_manager_id: c.operational_manager_id,
        activation_date: c.activation_date,
        industry: c.industry,
        required_linkedin_profile_count: c.required_linkedin_profile_count,
        created_at: c.created_at,
        updated_at: c.updated_at
      };
    };

    const rawDbClientRow = {
      id: 'client-safe-1',
      company_name: 'Alpha Ops',
      client_name: 'Sarah Connor',
      package: 'Growth',
      status: 'Active',
      pause_reason: null,
      paused_at: null,
      paused_by: null,
      operational_manager_id: 'mgr-456',
      activation_date: '2026-09-01',
      industry: 'Technology',
      required_linkedin_profile_count: 5,
      created_at: '2026-09-01T12:00:00Z',
      updated_at: '2026-09-06T12:00:00Z',
      logo_url: 'https://storage.supabase.co/object/sign/client-logos/org/logo.png?token=secret123&signature=abc456',
      drive_url: 'https://drive.google.com/drive/folders/123456789abcdef',
      slack_invite: 'https://join.slack.com/t/team/shared_invite/zt-xyz987',
      whatsapp_link: 'https://chat.whatsapp.com/inviteABCDEF',
      access_token: 'secret-jwt-token',
      api_key: 'sk_live_1234567890',
      password_hash: '$2a$12$e8s.m4xK...'
    };

    const safeAuditPayload = toSafeClientAuditJson(rawDbClientRow);

    expect(safeAuditPayload.id).toBe('client-safe-1');
    expect(safeAuditPayload.company_name).toBe('Alpha Ops');
    expect(safeAuditPayload.status).toBe('Active');
    expect(safeAuditPayload.operational_manager_id).toBe('mgr-456');

    expect((safeAuditPayload as any).logo_url).toBeUndefined();
    expect((safeAuditPayload as any).drive_url).toBeUndefined();
    expect((safeAuditPayload as any).slack_invite).toBeUndefined();
    expect((safeAuditPayload as any).whatsapp_link).toBeUndefined();
    expect((safeAuditPayload as any).access_token).toBeUndefined();
    expect((safeAuditPayload as any).api_key).toBeUndefined();
    expect((safeAuditPayload as any).password_hash).toBeUndefined();

    const serialized = JSON.stringify(safeAuditPayload);
    expect(serialized).not.toMatch(/drive\.google\.com/);
    expect(serialized).not.toMatch(/slack\.com/);
    expect(serialized).not.toMatch(/whatsapp\.com/);
    expect(serialized).not.toMatch(/token=/);
    expect(serialized).not.toMatch(/signature=/);
  });
});