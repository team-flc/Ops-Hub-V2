import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext';
import { CreateClientModal } from '../src/components/clients/CreateClientModal';
import { Sidebar } from '../src/components/layout/Sidebar';
import { clientManagementService, sanitizeUrl, isValidLinkedInUrl } from '../src/lib/clientManagementService';
import { UserProfile, ClientRecord } from '../src/types';
import { loadFormDraft, saveFormDraft, clearFormDraft } from '../src/lib/autosaveUtils';

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFromSelect = vi.fn();
const mockRpc = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

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
      rpc: (...args: any[]) => mockRpc(...args),
      from: (table: string) => ({
        select: (...args: any[]) => ({
          eq: (...eqArgs: any[]) => ({
            single: () => mockFromSelect(table, eqArgs),
            maybeSingle: () => mockFromSelect(table, eqArgs),
            order: () => Promise.resolve({ data: [], error: null })
          }),
          in: () => ({
            order: () => Promise.resolve({ data: [], error: null })
          }),
          order: () => Promise.resolve({ data: [], error: null })
        }),
        insert: (data: any) => mockInsert(table, data),
        update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }),
        delete: () => ({
          eq: (col: string, val: any) => mockDelete(table, col, val)
        })
      })
    }
  };
});

const mockManager1: UserProfile = {
  id: 'mgr-uuid-1',
  fullName: 'Ahmad Lall',
  role: 'operational_manager',
  status: 'active',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

const mockManager2: UserProfile = {
  id: 'mgr-uuid-2',
  fullName: 'Zainab Manager',
  role: 'operational_manager',
  status: 'active',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

const mockOwner: UserProfile = {
  id: 'owner-uuid-1',
  fullName: 'Faseeh Lall',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

const mockTeamMember: UserProfile = {
  id: 'tm-uuid-1',
  fullName: 'Tariq Member',
  role: 'team_member',
  status: 'active',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

describe('Hotfix Verification: Client Creation RLS, Persistence & Atomicity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    clearFormDraft('opshub_draft_new_client');
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    mockDelete.mockReturnValue({
      eq: () => Promise.resolve({ data: null, error: null })
    });
  });

  it('1. Sidebar passes currentUserProfile to CreateClientModal so default manager matches current user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockManager2.id, email: 'zainab@flc.com' } },
      error: null
    });
    mockFromSelect.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return Promise.resolve({
          data: mockManager2,
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({ data: [], error: null });
    vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue([mockManager1, mockManager2]);

    await act(async () => {
      render(
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      );
    });

    // Open Create Client modal via Client Switcher -> + Create New Client
    const switcherBtn = screen.getByTitle('Switch Client Workspace');
    fireEvent.click(switcherBtn);

    const createBtn = screen.getByRole('button', { name: /create client/i });
    fireEvent.click(createBtn);

    // Modal is opened; default manager should be Zainab (the logged-in manager), NOT Ahmad (first alphabetical)
    await waitFor(() => {
      expect(screen.getByText('Create New Client Workspace')).toBeInTheDocument();
    });

    const managerSelect = screen.getByLabelText(/operational manager/i) as HTMLSelectElement;
    expect(managerSelect.value).toBe(mockManager2.id);
  });

  it('2. CreateClientModal falls back to useAuth profile when currentUserProfile prop is not passed', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockManager2.id, email: 'zainab@flc.com' } },
      error: null
    });
    mockFromSelect.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return Promise.resolve({
          data: mockManager2,
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await act(async () => {
      render(
        <AuthProvider>
          <CreateClientModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            currentUserProfile={undefined}
            eligibleManagers={[mockManager1, mockManager2]}
          />
        </AuthProvider>
      );
    });

    await waitFor(() => {
      const managerSelect = screen.getByLabelText(/operational manager/i) as HTMLSelectElement;
      expect(managerSelect.value).toBe(mockManager2.id);
    });
  });

  it('3. Preserves draft in state and localStorage on creation error, and displays RLS error clearly', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    vi.spyOn(clientManagementService, 'createClient').mockResolvedValue({
      error: 'new row violates row-level security policy for table "clients"'
    });

    render(
      <CreateClientModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        currentUserProfile={mockManager2}
        eligibleManagers={[mockManager1, mockManager2]}
      />
    );

    // Fill form
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Bizease' } });
    fireEvent.change(screen.getByLabelText(/client \/ owner full name/i), { target: { value: 'Bizease Lead' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /create client workspace/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Error message must be rendered
    await waitFor(() => {
      expect(screen.getByText(/new row violates row-level security policy for table "clients"/i)).toBeInTheDocument();
    });

    // Modal must NOT be closed, success callback not called
    expect(handleSuccess).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();

    // Draft must still be intact in the input field
    const companyInput = screen.getByLabelText(/company name/i) as HTMLInputElement;
    expect(companyInput.value).toBe('Bizease');

    // Draft must also be preserved in localStorage
    const savedDraft = loadFormDraft<any>('opshub_draft_new_client');
    expect(savedDraft).not.toBeNull();
    expect(savedDraft?.companyName).toBe('Bizease');
  });

  it('4. Clears draft and triggers onSuccess callback on successful client creation', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    const createdClient: ClientRecord = {
      id: 'new-client-bizease',
      companyName: 'Bizease',
      clientName: 'Bizease Lead',
      package: 'Basic',
      operationalManagerId: mockManager2.id,
      operationalManagerName: 'Zainab Manager',
      activationDate: '2026-09-28',
      status: 'Onboarding',
      pauseReason: null,
      requiredLinkedinProfileCount: 3,
      linkedinProfiles: [],
      sourceClientId: null,
      links: {},
      createdAt: '2026-09-28T00:00:00Z',
      updatedAt: '2026-09-28T00:00:00Z'
    };

    vi.spyOn(clientManagementService, 'createClient').mockResolvedValue({
      data: createdClient
    });

    render(
      <CreateClientModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        currentUserProfile={mockManager2}
        eligibleManagers={[mockManager1, mockManager2]}
      />
    );

    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Bizease' } });
    fireEvent.change(screen.getByLabelText(/client \/ owner full name/i), { target: { value: 'Bizease Lead' } });

    const submitBtn = screen.getByRole('button', { name: /create client workspace/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(createdClient);
      expect(handleClose).toHaveBeenCalled();
    });

    // Draft must be cleared from storage
    const savedDraft = loadFormDraft<any>('opshub_draft_new_client');
    expect(savedDraft).toBeNull();
  });

  it('5. Preserves Case Studies text without stripping via URL sanitization', async () => {
    let capturedClientInsert: any = null;
    let capturedLinksInsert: any = null;

    mockInsert.mockImplementation((table: string, data: any) => {
      if (table === 'clients') {
        capturedClientInsert = data;
        return {
          select: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'client-case-study',
                company_name: data.company_name,
                client_name: data.client_name,
                package: data.package,
                operational_manager_id: data.operational_manager_id,
                activation_date: data.activation_date,
                status: data.status,
                pause_reason: data.pause_reason,
                required_linkedin_profile_count: data.required_linkedin_profile_count,
                created_by: data.created_by,
                created_at: data.created_at,
                updated_at: data.updated_at
              },
              error: null
            })
          })
        };
      }
      if (table === 'client_links') {
        capturedLinksInsert = data;
        return Promise.resolve({ data, error: null });
      }
      if (table === 'client_linkedin_profiles') {
        return {
          select: () => Promise.resolve({ data: [], error: null })
        };
      }
      if (table === 'client_audit_log') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const caseStudyText = 'Client achieved 35% growth in Q3. Detailed docs in internal folder.';

    const result = await clientManagementService.createClient({
      companyName: 'Bizease',
      clientName: 'Bizease Lead',
      package: 'Basic',
      operationalManagerId: mockManager2.id,
      activationDate: '2026-09-28',
      status: 'Onboarding',
      links: {
        case_studies: caseStudyText
      }
    }, mockManager2.id);

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();

    // Verify links insert received exact text
    expect(capturedLinksInsert).toBeDefined();
    const caseStudyEntry = capturedLinksInsert.find((l: any) => l.link_type === 'case_studies');
    expect(caseStudyEntry).toBeDefined();
    expect(caseStudyEntry.url).toBe(caseStudyText);
    expect(result.data?.links?.case_studies).toBe(caseStudyText);
  });

  it('6. Preserves hasGmailAccount and gmailAddress on LinkedIn Profiles during creation', async () => {
    let capturedProfilesInsert: any = null;

    mockInsert.mockImplementation((table: string, data: any) => {
      if (table === 'clients') {
        return {
          select: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'client-li-gmail',
                company_name: data.company_name,
                client_name: data.client_name,
                package: data.package,
                operational_manager_id: data.operational_manager_id,
                activation_date: data.activation_date,
                status: data.status,
                created_by: data.created_by,
                created_at: data.created_at,
                updated_at: data.updated_at
              },
              error: null
            })
          })
        };
      }
      if (table === 'client_linkedin_profiles') {
        capturedProfilesInsert = data;
        return {
          select: () => Promise.resolve({
            data: data.map((d: any, idx: number) => ({
              id: `profile-${idx}`,
              ...d
            })),
            error: null
          })
        };
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await clientManagementService.createClient({
      companyName: 'Bizease',
      clientName: 'Bizease Lead',
      package: 'Basic',
      operationalManagerId: mockManager2.id,
      activationDate: '2026-09-28',
      status: 'Onboarding',
      linkedinProfiles: [
        {
          profileLabel: 'Lead ID 1',
          profileUrl: 'https://linkedin.com/in/lead-one',
          salesNavigatorActive: false,
          hasGmailAccount: true,
          gmailAddress: 'lead1.bizease@gmail.com'
        }
      ]
    }, mockManager2.id);

    expect(result.error).toBeUndefined();
    expect(capturedProfilesInsert).toBeDefined();
    expect(capturedProfilesInsert[0].has_gmail_account).toBe(true);
    expect(capturedProfilesInsert[0].gmail_address).toBe('lead1.bizease@gmail.com');

    expect(result.data?.linkedinProfiles[0].hasGmailAccount).toBe(true);
    expect(result.data?.linkedinProfiles[0].gmailAddress).toBe('lead1.bizease@gmail.com');
  });

  it('7. Invokes atomic transactional RPC create_client_tx when available', async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: 'tx-client-id',
        companyName: 'Bizease RPC',
        clientName: 'Bizease Lead',
        package: 'Advanced',
        operationalManagerId: mockManager1.id,
        activationDate: '2026-09-28',
        status: 'Onboarding',
        pauseReason: null,
        requiredLinkedinProfileCount: 3,
        links: { website: 'https://bizease.com' },
        linkedinProfiles: [],
        createdBy: mockManager2.id,
        createdAt: '2026-09-28T00:00:00Z',
        updatedAt: '2026-09-28T00:00:00Z'
      },
      error: null
    });

    const result = await clientManagementService.createClient({
      companyName: 'Bizease RPC',
      clientName: 'Bizease Lead',
      package: 'Advanced',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-09-28',
      status: 'Onboarding',
      links: { website: 'https://bizease.com' }
    }, mockManager2.id);

    expect(mockRpc).toHaveBeenCalledWith('create_client_tx', expect.objectContaining({
      p_client_data: expect.objectContaining({
        company_name: 'Bizease RPC',
        operational_manager_id: mockManager1.id
      }),
      p_actor_id: mockManager2.id
    }));

    expect(result.error).toBeUndefined();
    expect(result.data?.id).toBe('tx-client-id');
    expect(result.data?.createdBy).toBe(mockManager2.id);
  });

  it('8. Performs compensating rollback (ACID cleanup) if child records fail in direct fallback flow', async () => {
    let deleteCalled = false;
    let deletedClientId = '';

    mockInsert.mockImplementation((table: string, data: any) => {
      if (table === 'clients') {
        return {
          select: () => ({
            single: () => Promise.resolve({
              data: { id: 'client-to-rollback', ...data },
              error: null
            })
          })
        };
      }
      if (table === 'client_links') {
        return Promise.resolve({
          data: null,
          error: { message: 'Foreign key constraint violation' }
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockDelete.mockImplementation((table: string, col: string, val: any) => {
      if (table === 'clients' && col === 'id') {
        deleteCalled = true;
        deletedClientId = val;
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await clientManagementService.createClient({
      companyName: 'Bizease Failing Child',
      clientName: 'Bizease Lead',
      package: 'Basic',
      operationalManagerId: mockManager2.id,
      activationDate: '2026-09-28',
      status: 'Onboarding',
      links: { website: 'https://bizease.com' }
    }, mockManager2.id);

    // Should return error
    expect(result.error).toContain('Failed to save workspace links');
    expect(result.error).toContain('Client creation rolled back');

    // Compensating delete must have run on the client
    expect(deleteCalled).toBe(true);
    expect(deletedClientId).toBe('client-to-rollback');
  });

  it('9. Operational Manager assigning client to another manager sets created_by to creator', async () => {
    let capturedClientInsert: any = null;

    mockInsert.mockImplementation((table: string, data: any) => {
      if (table === 'clients') {
        capturedClientInsert = data;
        return {
          select: () => ({
            single: () => Promise.resolve({
              data: { id: 'client-reassigned', ...data },
              error: null
            })
          })
        };
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Manager 2 creates a client and assigns it to Manager 1
    const result = await clientManagementService.createClient({
      companyName: 'Bizease Cross Manager',
      clientName: 'Bizease Lead',
      package: 'Intermediate',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-09-28',
      status: 'Onboarding'
    }, mockManager2.id);

    expect(result.error).toBeUndefined();
    expect(capturedClientInsert.operational_manager_id).toBe(mockManager1.id);
    expect(capturedClientInsert.created_by).toBe(mockManager2.id);
    expect(result.data?.operationalManagerId).toBe(mockManager1.id);
    expect(result.data?.createdBy).toBe(mockManager2.id);
  });
});
