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
import { storageService } from '../src/lib/storageService';
import { profileService } from '../src/lib/profileService';
import { archiveService } from '../src/lib/archiveService';
import { auditService } from '../src/lib/auditService';
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

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'owner@faseehlall.com' } }, error: null }),
      getSession: () => Promise.resolve({ data: { session: { access_token: 'fake-jwt' } } })
    },
    from: (table: string) => mockFrom(table),
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

  // 8. OPEN-TASK REASSIGNMENT SAFEGUARD BEFORE ARCHIVING TEAM MEMBER
  it('8. ArchiveService blocks team member archive if user has open assigned tasks', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          in: () => ({
            is: () => Promise.resolve({
              data: [
                { id: 'task-1', title: 'Open Deliverable', client_id: 'c1', status: 'In Progress' }
              ],
              error: null
            })
          })
        })
      })
    });

    const res = await archiveService.archiveTeamMember('user-x', 'Resigned from company');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cannot archive team member.*open task/i);
  });

  // 9. AUDIT LOGGING & SENSITIVE SECRET REDACTION
  it('9. AuditService logs system audit events and redacts sensitive passwords/tokens', async () => {
    let insertedPayload: any = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { full_name: 'Faseeh Lall', role: 'owner' }, error: null })
            })
          })
        };
      }
      if (table === 'system_audit_events') {
        return {
          insert: (payload: any) => {
            insertedPayload = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'evt-1', ...payload, created_at: new Date().toISOString() }, error: null })
              })
            };
          }
        };
      }
      return {};
    });

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

    expect(res.error).toBeNull();
    expect(insertedPayload).toBeDefined();
    expect(insertedPayload.new_state.password).toBe('[REDACTED]');
    expect(insertedPayload.new_state.token).toBe('[REDACTED]');
    expect(insertedPayload.new_state.phone).toBe('+92 300 0000000');
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
});