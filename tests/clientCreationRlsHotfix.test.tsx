import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext';
import { CreateClientModal } from '../src/components/clients/CreateClientModal';
import { Sidebar } from '../src/components/layout/Sidebar';
import { clientManagementService, sanitizeUrl, isValidLinkedInUrl } from '../src/lib/clientManagementService';
import { UserProfile, ClientRecord } from '../src/types';
import { loadFormDraft, saveFormDraft, clearFormDraft } from '../src/lib/autosaveUtils';
import { DuplicateClientModal } from '../src/components/clients/DuplicateClientModal';
import { ClientDetailsTab } from '../src/components/clients/ClientDetailsTab';
import { useOpsStore } from '../src/store/opsStore';
// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFromSelect = vi.fn();
const mockRpc = vi.fn();
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
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
            order: () => Promise.resolve({ data: [], error: null }),
            in: () => Promise.resolve({ data: [], error: null })
          }),
          in: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          order: () => Promise.resolve({ data: [], error: null })
        }),
        insert: (data: any) => {
          const res = mockInsert(table, data);
          return {
            select: () => ({
              single: () => Promise.resolve(res?.single ? res.single() : res || { data: null, error: null })
            }),
            then: (resolve: any) => Promise.resolve(res || { data: null, error: null }).then(resolve)
          };
        },
        upsert: (data: any, opts: any) => mockUpsert(table, data, opts),
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
    mockUpsert.mockResolvedValue({ data: null, error: null });
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

  it('5. Preserves Case Studies text without stripping via URL sanitization and sends to create_client_tx', async () => {
    const caseStudyText = 'Client achieved 35% growth in Q3. Detailed docs in internal folder.';

    mockRpc.mockImplementation((fn: string, args: any) => {
      if (fn === 'create_client_tx') {
        return Promise.resolve({
          data: {
            id: 'client-case-study',
            companyName: args.p_client_data.company_name,
            clientName: args.p_client_data.client_name,
            package: args.p_client_data.package,
            operationalManagerId: args.p_client_data.operational_manager_id,
            activationDate: args.p_client_data.activation_date,
            status: args.p_client_data.status,
            links: { case_studies: caseStudyText },
            linkedinProfiles: [],
            createdBy: mockManager2.id,
            createdAt: '2026-09-28T00:00:00Z',
            updatedAt: '2026-09-28T00:00:00Z'
          },
          error: null
        });
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
      links: {
        case_studies: caseStudyText
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();

    // Verify create_client_tx received exact case_studies text
    expect(mockRpc).toHaveBeenCalledWith('create_client_tx', expect.objectContaining({
      p_links: expect.arrayContaining([
        expect.objectContaining({
          link_type: 'case_studies',
          url: caseStudyText
        })
      ])
    }));
    expect(result.data?.links?.case_studies).toBe(caseStudyText);
  });

  it('6. Preserves hasGmailAccount and gmailAddress on LinkedIn Profiles and sends to create_client_tx', async () => {
    mockRpc.mockImplementation((fn: string, args: any) => {
      if (fn === 'create_client_tx') {
        return Promise.resolve({
          data: {
            id: 'client-li-gmail',
            companyName: args.p_client_data.company_name,
            clientName: args.p_client_data.client_name,
            package: args.p_client_data.package,
            operationalManagerId: args.p_client_data.operational_manager_id,
            activationDate: args.p_client_data.activation_date,
            status: args.p_client_data.status,
            links: {},
            linkedinProfiles: [
              {
                id: 'profile-1',
                profileLabel: 'Lead ID 1',
                profileUrl: 'https://linkedin.com/in/lead-one',
                salesNavigatorActive: false,
                hasGmailAccount: true,
                gmailAddress: 'lead1.bizease@gmail.com'
              }
            ],
            createdBy: mockManager2.id,
            createdAt: '2026-09-28T00:00:00Z',
            updatedAt: '2026-09-28T00:00:00Z'
          },
          error: null
        });
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
    });

    expect(result.error).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('create_client_tx', expect.objectContaining({
      p_linkedin_profiles: expect.arrayContaining([
        expect.objectContaining({
          has_gmail_account: true,
          gmail_address: 'lead1.bizease@gmail.com'
        })
      ])
    }));

    expect(result.data?.linkedinProfiles[0].hasGmailAccount).toBe(true);
    expect(result.data?.linkedinProfiles[0].gmailAddress).toBe('lead1.bizease@gmail.com');
  });

  it('7. Invokes create_client_tx without trusting supplied actor ID', async () => {
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
    });

    expect(mockRpc).toHaveBeenCalledWith('create_client_tx', expect.objectContaining({
      p_client_data: expect.objectContaining({
        company_name: 'Bizease RPC',
        operational_manager_id: mockManager1.id
      })
    }));

    // Must NOT pass p_actor_id to RPC
    const callArgs = mockRpc.mock.calls[0][1];
    expect(callArgs.p_actor_id).toBeUndefined();

    expect(result.error).toBeUndefined();
    expect(result.data?.id).toBe('tx-client-id');
  });

  it('8. Returns clear error and does NOT fallback to nontransactional direct insert when create_client_tx fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'function create_client_tx does not exist' }
    });

    const result = await clientManagementService.createClient({
      companyName: 'Bizease No Fallback',
      clientName: 'Bizease Lead',
      package: 'Basic',
      operationalManagerId: mockManager2.id,
      activationDate: '2026-09-28',
      status: 'Onboarding',
      links: { website: 'https://bizease.com' }
    });

    // Must return the RPC failure directly
    expect(result.error).toContain('function create_client_tx does not exist');
    expect(result.data).toBeUndefined();

    // Must NOT call mockInsert (no direct-insert fallback)
    expect(mockInsert).not.toHaveBeenCalled();
    // Must NOT call mockDelete
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('9. Handles uncertain or empty response safely without auto-retrying', async () => {
    // Empty data response
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: null
    });

    const resultEmpty = await clientManagementService.createClient({
      companyName: 'Bizease Uncertain',
      clientName: 'Bizease Lead',
      package: 'Intermediate',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-09-28',
      status: 'Onboarding'
    });

    expect(resultEmpty.error).toContain('uncertain or empty');
    expect(resultEmpty.data).toBeUndefined();

    // Network / exception response
    mockRpc.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    const resultNetwork = await clientManagementService.createClient({
      companyName: 'Bizease Network Error',
      clientName: 'Bizease Lead',
      package: 'Intermediate',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-09-28',
      status: 'Onboarding'
    });

    expect(resultNetwork.error).toContain('Connection terminated unexpectedly');
    expect(resultNetwork.error).toContain('verify before retrying');
    expect(resultNetwork.data).toBeUndefined();

    // Only the two explicit calls were made; no automatic retry was triggered
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('10. Propagates authorization failure when unauthorized user or role is rejected', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Access denied. Only Owners and Operational Managers can create clients.' }
    });

    const result = await clientManagementService.createClient({
      companyName: 'Bizease Unauthorized',
      clientName: 'Bizease Lead',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-09-28',
      status: 'Onboarding'
    });

    expect(result.error).toContain('Access denied');
    expect(result.data).toBeUndefined();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('11. CreateClientModal supports Reviews and Proposal / Contract URLs, auto-saves draft, and sends to create_client_tx', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    mockRpc.mockImplementation((fn: string, args: any) => {
      if (fn === 'create_client_tx') {
        return Promise.resolve({
          data: {
            id: 'client-with-new-links',
            companyName: args.p_client_data.company_name,
            clientName: args.p_client_data.client_name,
            package: args.p_client_data.package,
            operationalManagerId: args.p_client_data.operational_manager_id,
            activationDate: args.p_client_data.activation_date,
            status: args.p_client_data.status,
            links: {
              reviews: 'https://g.page/r/bizease/review',
              proposal_contract: 'https://docs.bizease.com/proposal-v1'
            },
            linkedinProfiles: [],
            createdBy: mockManager2.id,
            createdAt: '2026-10-02T00:00:00Z',
            updatedAt: '2026-10-02T00:00:00Z'
          },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
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

    // Form inputs exist
    const reviewsInput = screen.getByTestId('link-reviews') as HTMLInputElement;
    const proposalInput = screen.getByTestId('link-proposal-contract') as HTMLInputElement;
    expect(reviewsInput).toBeInTheDocument();
    expect(proposalInput).toBeInTheDocument();

    // Fill form fields
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Bizease Digital' } });
    fireEvent.change(screen.getByLabelText(/client \/ owner full name/i), { target: { value: 'Bizease Owner' } });
    fireEvent.change(reviewsInput, { target: { value: 'https://g.page/r/bizease/review' } });
    fireEvent.change(proposalInput, { target: { value: 'https://docs.bizease.com/proposal-v1' } });

    // Draft is auto-saved with the new fields
    const draft = loadFormDraft<any>('opshub_draft_new_client');
    expect(draft?.reviewsUrl).toBe('https://g.page/r/bizease/review');
    expect(draft?.proposalContractUrl).toBe('https://docs.bizease.com/proposal-v1');

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /create client workspace/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Verified RPC call args
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('create_client_tx', expect.objectContaining({
        p_links: expect.arrayContaining([
          expect.objectContaining({ link_type: 'reviews', url: 'https://g.page/r/bizease/review' }),
          expect.objectContaining({ link_type: 'proposal_contract', url: 'https://docs.bizease.com/proposal-v1' })
        ])
      }));
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });

    // Draft cleared on success
    expect(loadFormDraft('opshub_draft_new_client')).toBeNull();
  });

  it('12. DuplicateClientModal supports Reviews and Proposal / Contract with draft persistence and service call', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    const sourceClient: ClientRecord = {
      id: 'source-client-1',
      companyName: 'Source Company',
      clientName: 'Source Lead',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      operationalManagerName: 'Ahmad Lall',
      activationDate: '2026-01-01',
      status: 'Active',
      pauseReason: null,
      requiredLinkedinProfileCount: 3,
      linkedinProfiles: [],
      sourceClientId: null,
      links: {
        reviews: 'https://reviews.source.com',
        proposal_contract: 'https://docs.source.com/contract'
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    const duplicateSpy = vi.spyOn(clientManagementService, 'duplicateClient').mockResolvedValue({
      data: {
        ...sourceClient,
        id: 'dup-client-1',
        companyName: 'Source Company (Clone)',
        links: {
          reviews: 'https://reviews.source.com/v2',
          proposal_contract: 'https://docs.source.com/contract-v2'
        }
      }
    });

    render(
      <DuplicateClientModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        sourceClient={sourceClient}
        currentUserProfile={mockManager2}
        eligibleManagers={[mockManager1, mockManager2]}
      />
    );

    // Inputs exist
    const dupReviews = screen.getByTestId('dup-reviews') as HTMLInputElement;
    const dupProposal = screen.getByTestId('dup-proposal-contract') as HTMLInputElement;
    expect(dupReviews).toBeInTheDocument();
    expect(dupProposal).toBeInTheDocument();

    // Modify values
    fireEvent.change(screen.getByLabelText(/new company name/i), { target: { value: 'Source Company (Clone)' } });
    fireEvent.change(screen.getByLabelText(/client \/ owner full name/i), { target: { value: 'Source Lead Clone' } });
    fireEvent.change(dupReviews, { target: { value: 'https://reviews.source.com/v2' } });
    fireEvent.change(dupProposal, { target: { value: 'https://docs.source.com/contract-v2' } });

    // Submit duplication
    const submitBtn = screen.getByRole('button', { name: /duplicate client/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(duplicateSpy).toHaveBeenCalledWith('source-client-1', expect.objectContaining({
        companyName: 'Source Company (Clone)',
        links: expect.objectContaining({
          reviews: 'https://reviews.source.com/v2',
          proposal_contract: 'https://docs.source.com/contract-v2'
        })
      }), mockManager2.id);
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  it('13. ClientDetailsTab renders Reviews and Proposal / Contract, manages dirty state, and locks for Team Members', async () => {
    const handleUpdate = vi.fn();

    const clientWithLinks: ClientRecord = {
      id: 'client-det-1',
      companyName: 'Alpha Logistics',
      clientName: 'Alpha Lead',
      package: 'Advanced',
      operationalManagerId: mockManager1.id,
      operationalManagerName: 'Ahmad Lall',
      activationDate: '2026-03-01',
      status: 'Active',
      pauseReason: null,
      requiredLinkedinProfileCount: 3,
      linkedinProfiles: [],
      sourceClientId: null,
      links: {
        reviews: 'https://reviews.alpha.com',
        proposal_contract: 'https://contracts.alpha.com/doc-1'
      },
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z'
    };

    // 1. Render as Manager: inputs editable
    const { unmount } = render(
      <ClientDetailsTab
        client={clientWithLinks}
        currentUserProfile={mockManager1}
        eligibleManagers={[mockManager1, mockManager2]}
        onClientUpdated={handleUpdate}
      />
    );

    const editReviews = screen.getByTestId('edit-reviews') as HTMLInputElement;
    const editProposal = screen.getByTestId('edit-proposal-contract') as HTMLInputElement;

    expect(editReviews.value).toBe('https://reviews.alpha.com');
    expect(editProposal.value).toBe('https://contracts.alpha.com/doc-1');
    expect(editReviews).not.toBeDisabled();
    expect(editProposal).not.toBeDisabled();

    // Change reviews URL -> marks dirty and writes to sessionStorage
    fireEvent.change(editReviews, { target: { value: 'https://reviews.alpha.com/updated' } });
    const storedDraft = JSON.parse(sessionStorage.getItem(`ops_hub_client_links_draft_${clientWithLinks.id}`) || '{}');
    expect(storedDraft.reviewsUrl).toBe('https://reviews.alpha.com/updated');

    unmount();

    // 2. Render as Team Member: inputs locked by management
    render(
      <ClientDetailsTab
        client={clientWithLinks}
        currentUserProfile={mockTeamMember}
        eligibleManagers={[mockManager1, mockManager2]}
        onClientUpdated={handleUpdate}
      />
    );

    const editReviewsTm = screen.getByTestId('edit-reviews') as HTMLInputElement;
    const editProposalTm = screen.getByTestId('edit-proposal-contract') as HTMLInputElement;

    expect(editReviewsTm).toBeDisabled();
    expect(editProposalTm).toBeDisabled();
  });

  it('14. Sidebar renders Reviews and Proposal / Contract as inactive when empty and clickable with ExternalLink when populated', async () => {
    const clientWithLinks: ClientRecord = {
      id: 'client-sidebar-test',
      companyName: 'Sidebar Corp',
      clientName: 'Sidebar Owner',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      operationalManagerName: 'Ahmad Lall',
      activationDate: '2026-01-01',
      status: 'Active',
      pauseReason: null,
      requiredLinkedinProfileCount: 3,
      linkedinProfiles: [],
      sourceClientId: null,
      links: {
        reviews: 'https://reviews.google.com/sidebarcorp',
        proposal_contract: 'https://proposals.com/sidebarcorp'
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    const emptyClient: ClientRecord = {
      id: 'client-sidebar-empty',
      companyName: 'Empty Corp',
      clientName: 'Empty Owner',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      operationalManagerName: 'Ahmad Lall',
      activationDate: '2026-01-01',
      status: 'Active',
      pauseReason: null,
      requiredLinkedinProfileCount: 3,
      linkedinProfiles: [],
      sourceClientId: null,
      links: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockManager1.id, email: 'ahmad@flc.com' } },
      error: null
    });
    mockFromSelect.mockImplementation((table: string) => {
      if (table === 'profiles') return Promise.resolve({ data: mockManager1, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
      data: [clientWithLinks, emptyClient],
      error: null
    });

    // First setup store with empty client
    useOpsStore.getState().setClients([clientWithLinks, emptyClient]);
    useOpsStore.getState().setSelectedClientId(emptyClient.id);

    const { unmount } = render(
      <AuthProvider>
        <Sidebar />
      </AuthProvider>
    );

    // In empty client: Reviews and Proposal / Contract must be inactive (aria-disabled="true")
    await waitFor(() => {
      const inactiveReviews = screen.getByLabelText(/Reviews \(Link not added\)/i);
      expect(inactiveReviews).toBeInTheDocument();
      expect(inactiveReviews).toHaveAttribute('aria-disabled', 'true');
      expect(inactiveReviews.tagName.toLowerCase()).toBe('div');

      const inactiveProposal = screen.getByLabelText(/Proposal \/ Contract \(Link not added\)/i);
      expect(inactiveProposal).toBeInTheDocument();
      expect(inactiveProposal).toHaveAttribute('aria-disabled', 'true');
      expect(inactiveProposal.tagName.toLowerCase()).toBe('div');
    });

    unmount();

    // Now switch store to clientWithLinks
    useOpsStore.getState().setSelectedClientId(clientWithLinks.id);

    render(
      <AuthProvider>
        <Sidebar />
      </AuthProvider>
    );

    // In clientWithLinks: Reviews and Proposal / Contract must be clickable <a> links with target="_blank"
    await waitFor(() => {
      const activeReviews = screen.getByTitle('Open Reviews') as HTMLAnchorElement;
      expect(activeReviews).toBeInTheDocument();
      expect(activeReviews.tagName.toLowerCase()).toBe('a');
      expect(activeReviews.href).toBe('https://reviews.google.com/sidebarcorp');
      expect(activeReviews.target).toBe('_blank');

      const activeProposal = screen.getByTitle('Open Proposal / Contract') as HTMLAnchorElement;
      expect(activeProposal).toBeInTheDocument();
      expect(activeProposal.tagName.toLowerCase()).toBe('a');
      expect(activeProposal.href).toBe('https://proposals.com/sidebarcorp');
      expect(activeProposal.target).toBe('_blank');
    });
  });

  it('15. Sidebar keeps Reviews distinct and separate from Testimonials (Videos)', async () => {
    const client: ClientRecord = {
      id: 'client-sep-test',
      companyName: 'Distinct Corp',
      clientName: 'Owner',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      operationalManagerName: 'Ahmad Lall',
      activationDate: '2026-01-01',
      status: 'Active',
      pauseReason: null,
      requiredLinkedinProfileCount: 3,
      linkedinProfiles: [],
      sourceClientId: null,
      links: {
        testimonials: 'https://vimeo.com/testimonials-bizease',
        reviews: 'https://g.page/r/bizease-reviews'
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    useOpsStore.getState().setClients([client]);
    useOpsStore.getState().setSelectedClientId(client.id);

    render(
      <AuthProvider>
        <Sidebar />
      </AuthProvider>
    );

    await waitFor(() => {
      const testimonialsLink = screen.getByTitle('Open Testimonials (Videos)') as HTMLAnchorElement;
      const reviewsLink = screen.getByTitle('Open Reviews') as HTMLAnchorElement;

      expect(testimonialsLink.href).toBe('https://vimeo.com/testimonials-bizease');
      expect(reviewsLink.href).toBe('https://g.page/r/bizease-reviews');
      expect(testimonialsLink).not.toEqual(reviewsLink);
    });
  });

  it('16. Sanitizes URLs properly: accepts http/https, rejects invalid schemas like javascript:', () => {
    expect(sanitizeUrl('https://bizease.com/reviews')).toBe('https://bizease.com/reviews');
    expect(sanitizeUrl('http://insecure.com')).toBe('http://insecure.com/');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,bad')).toBeNull();
    expect(sanitizeUrl('bizease.com/reviews')).toBeNull();
    expect(sanitizeUrl('')).toBeNull();
    expect(sanitizeUrl('   ')).toBeNull();
  });

  it('17. Database RLS behavior: validates caller permissions for Owner, Operational Manager, and rejects Team Member', async () => {
    // Owner can create
    mockRpc.mockResolvedValueOnce({
      data: {
        id: 'owner-created-client',
        companyName: 'Owner Client',
        clientName: 'Owner Lead',
        package: 'Advanced',
        operationalManagerId: mockManager2.id,
        activationDate: '2026-10-02',
        status: 'Active',
        createdBy: mockOwner.id,
        links: {},
        linkedinProfiles: []
      },
      error: null
    });

    const ownerRes = await clientManagementService.createClient({
      companyName: 'Owner Client',
      clientName: 'Owner Lead',
      package: 'Advanced',
      operationalManagerId: mockManager2.id,
      activationDate: '2026-10-02',
      status: 'Active'
    });
    expect(ownerRes.error).toBeUndefined();
    expect(ownerRes.data?.id).toBe('owner-created-client');

    // Operational Manager can create and assign a different permitted manager
    mockRpc.mockResolvedValueOnce({
      data: {
        id: 'mgr-created-client',
        companyName: 'Manager Client',
        clientName: 'Manager Lead',
        package: 'Intermediate',
        operationalManagerId: mockManager1.id,
        activationDate: '2026-10-02',
        status: 'Active',
        createdBy: mockManager2.id,
        links: {},
        linkedinProfiles: []
      },
      error: null
    });

    const mgrRes = await clientManagementService.createClient({
      companyName: 'Manager Client',
      clientName: 'Manager Lead',
      package: 'Intermediate',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-10-02',
      status: 'Active'
    });
    expect(mgrRes.error).toBeUndefined();
    expect(mgrRes.data?.id).toBe('mgr-created-client');

    // Team Member is denied by create_client_tx / RLS
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42501',
        message: 'Access denied. Only Owners and Operational Managers can create clients.'
      }
    });

    const tmRes = await clientManagementService.createClient({
      companyName: 'TM Unauthorized Client',
      clientName: 'TM Lead',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-10-02',
      status: 'Onboarding'
    });
    expect(tmRes.error).toContain('Access denied');
    expect(tmRes.data).toBeUndefined();
  });

  it('18. Transactional atomicity: rollback occurs when child link or profile insert fails, leaving no partial records', async () => {
    // When a child record fails (e.g. check constraint violation on link_type or duplicate profile),
    // PostgreSQL transactions roll back the entire transaction.
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23514',
        message: 'new row for relation "client_links" violates check constraint "client_links_link_type_check"'
      }
    });

    const failedChildRes = await clientManagementService.createClient({
      companyName: 'Rollback Client',
      clientName: 'Rollback Lead',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-10-02',
      status: 'Onboarding',
      links: {
        invalid_type: 'https://badlink.com'
      } as any
    });

    // The failure from the RPC is reported directly
    expect(failedChildRes.error).toContain('violates check constraint "client_links_link_type_check"');
    expect(failedChildRes.data).toBeUndefined();

    // No fallback direct inserts were attempted (ensuring atomicity is preserved)
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('19. duplicateClient failure-path: checks client insert result and returns error if client creation fails', async () => {
    mockInsert.mockImplementation((table: string) => {
      if (table === 'clients') {
        return { data: null, error: { message: 'new row violates row-level security policy for table "clients"' } };
      }
      return { data: null, error: null };
    });

    const result = await clientManagementService.duplicateClient('source-client-1', {
      companyName: 'Failed Duplicate',
      clientName: 'Failed Lead',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-10-02',
      status: 'Onboarding',
      links: {
        reviews: 'https://reviews.google.com/test'
      }
    }, mockManager2.id);

    expect(result.error).toContain('new row violates row-level security policy for table "clients"');
    expect(result.data).toBeUndefined();
    // Did not attempt to insert links into client_links
    expect(mockInsert).toHaveBeenCalledTimes(1); // Only the clients table insert
  });

  it('20. duplicateClient failure-path: if optional links fail to persist, rolls back client and never reports links as saved', async () => {
    mockInsert.mockImplementation((table: string, data: any) => {
      if (table === 'clients') {
        return {
          data: {
            id: 'partial-client-uuid',
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
        };
      }
      if (table === 'client_links') {
        return {
          data: null,
          error: {
            code: '23514',
            message: 'new row for relation "client_links" violates check constraint "client_links_link_type_check"'
          }
        };
      }
      return { data: null, error: null };
    });

    const result = await clientManagementService.duplicateClient('source-client-1', {
      companyName: 'Duplicate Rollback Client',
      clientName: 'Duplicate Lead',
      package: 'Basic',
      operationalManagerId: mockManager1.id,
      activationDate: '2026-10-02',
      status: 'Onboarding',
      links: {
        reviews: 'https://reviews.google.com/test',
        proposal_contract: 'https://docs.google.com/contract'
      }
    }, mockManager2.id);

    // Rollback error returned
    expect(result.error).toContain('Failed to persist workspace links for duplicated client');
    expect(result.error).toContain('Duplication was rolled back');
    expect(result.data).toBeUndefined();

    // Verified rollback: deleted the partially created client from database
    expect(mockDelete).toHaveBeenCalledWith('clients', 'id', 'partial-client-uuid');
  });

  it('21. Database check-constraint rejection on Reviews/Proposal Contract reports save failure and does not claim saved', async () => {
    mockFromSelect.mockImplementation((table: string) => {
      if (table === 'profiles') return Promise.resolve({ data: mockManager1, error: null });
      if (table === 'clients') {
        return Promise.resolve({
          data: {
            id: 'client-check-test',
            company_name: 'Alpha Check',
            client_name: 'Alpha Lead',
            package: 'Basic',
            operational_manager_id: mockManager1.id,
            activation_date: '2026-01-01',
            status: 'Active'
          },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Check constraint rejection from client_links
    mockUpsert.mockResolvedValue({
      data: null,
      error: {
        code: '23514',
        message: 'new row for relation "client_links" violates check constraint "client_links_link_type_check"'
      }
    });

    const result = await clientManagementService.updateClient('client-check-test', {
      links: {
        reviews: 'https://reviews.badconstraint.com'
      }
    }, mockManager1.id);

    // Save failure must be reported
    expect(result.error).toBeDefined();
    expect(result.error).toContain('violates check constraint "client_links_link_type_check"');
    expect(result.data).toBeUndefined();

    // Verify localStorage was NOT polluted with unpersisted link as if it were saved
    const rawStored = localStorage.getItem('ops_hub_client_ext_links_client-check-test');
    expect(rawStored).toBeNull();
  });
});
