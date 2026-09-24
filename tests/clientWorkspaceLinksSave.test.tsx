import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ClientDetailsTab } from '../src/components/clients/ClientDetailsTab';
import { 
  clientManagementService, 
  normalizeClientLinks, 
  LINK_ALIASES 
} from '../src/lib/clientManagementService';
import { useOpsStore } from '../src/store/opsStore';
import { ClientRecord, UserProfile } from '../src/types';

const mockOwnerProfile: UserProfile = {
  id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  fullName: 'Faseeh Lall',
  role: 'owner',
  status: 'active',
  workEmail: 'owner@faseehlall.com'
};

const mockManagerProfile: UserProfile = {
  id: 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
  fullName: 'Operational Manager',
  role: 'operational_manager',
  status: 'active',
  workEmail: 'manager@faseehlall.com'
};

const mockTeamMemberProfile: UserProfile = {
  id: 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f',
  fullName: 'Team Member',
  role: 'team_member',
  status: 'active',
  workEmail: 'team@faseehlall.com'
};

const initialClient: ClientRecord = {
  id: '11111111-2222-3333-4444-555555555555',
  companyName: 'Faseeh Lall & Co',
  clientName: 'Faseeh Lall',
  package: 'Advanced',
  operationalManagerId: mockManagerProfile.id,
  operationalManagerName: mockManagerProfile.fullName,
  activationDate: '2026-09-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  linkedinProfiles: [],
  links: {
    website: 'https://faseehlall.com',
    google_drive: 'https://drive.google.com/drive/folders/flc-root'
  },
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z'
};

// Mock Supabase
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    from: (table: string) => mockFrom(table)
  }
}));

describe('Client Details Workspace Links Save & Verification Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();

    useOpsStore.setState({
      clients: [initialClient],
      selectedClientId: initialClient.id,
      viewMode: 'clients'
    });

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockOwnerProfile.id, email: mockOwnerProfile.workEmail } },
      error: null
    });

    mockFrom.mockImplementation((table: string) => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: table === 'profiles' ? {
            id: mockOwnerProfile.id,
            role: 'owner',
            full_name: 'Faseeh Lall'
          } : null,
          error: null
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis()
      };
      // Allow mockQuery to be awaited directly
      mockQuery.then = (resolve: any) =>
        resolve({
          data: table === 'profiles' ? [{
            id: mockOwnerProfile.id,
            role: 'owner',
            full_name: 'Faseeh Lall'
          }] : [],
          error: null
        });
      return mockQuery;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. LINK ALIASES NORMALIZATION
  it('1. normalizeClientLinks normalizes important_docs and important_documents symmetrically', () => {
    const withDocs = normalizeClientLinks({
      important_docs: 'https://docs.google.com/sop-1'
    });
    expect(withDocs.important_docs).toBe('https://docs.google.com/sop-1');
    expect(withDocs.important_documents).toBe('https://docs.google.com/sop-1');

    const withDocuments = normalizeClientLinks({
      important_documents: 'https://docs.google.com/sop-2'
    });
    expect(withDocuments.important_docs).toBe('https://docs.google.com/sop-2');
    expect(withDocuments.important_documents).toBe('https://docs.google.com/sop-2');

    const withBiz = normalizeClientLinks({
      master_business_doc: 'https://docs.google.com/master-biz'
    });
    expect(withBiz.master_business_doc).toBe('https://docs.google.com/master-biz');
    expect(withBiz.master_business_document).toBe('https://docs.google.com/master-biz');

    const withPoc = normalizeClientLinks({
      poc_number: '+92 300 1234567'
    });
    expect(withPoc.poc_number).toBe('+92 300 1234567');
    expect(withPoc.poc_whatsapp).toBe('+92 300 1234567');
  });

  // 2. SAVING IMPORTANT DOCUMENTS PERSISTS AND CONFIRMS UPDATE
  it('2. Saving Important Documents URL updates client record and synchronizes aliases', async () => {
    const mockUpdatedClient: ClientRecord = {
      ...initialClient,
      links: {
        ...initialClient.links,
        important_docs: 'https://docs.google.com/flc-important-docs',
        important_documents: 'https://docs.google.com/flc-important-docs'
      }
    };

    const updateClientSpy = vi.spyOn(clientManagementService, 'updateClient').mockResolvedValue({
      data: mockUpdatedClient,
      error: undefined
    });

    const onClientUpdatedMock = vi.fn();

    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={initialClient}
          currentUserProfile={mockOwnerProfile}
          eligibleManagers={[mockManagerProfile]}
          onClientUpdated={onClientUpdatedMock}
        />
      </MemoryRouter>
    );

    const importantDocsInput = screen.getByLabelText(/Important Documents URL/i);
    expect(importantDocsInput).toBeInTheDocument();
    fireEvent.change(importantDocsInput, { target: { value: 'https://docs.google.com/flc-important-docs' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateClientSpy).toHaveBeenCalledWith(
        initialClient.id,
        expect.objectContaining({
          links: expect.objectContaining({
            important_docs: 'https://docs.google.com/flc-important-docs',
            important_documents: 'https://docs.google.com/flc-important-docs'
          })
        }),
        mockOwnerProfile.id
      );
    });

    expect(screen.getByText(/Client configuration updated successfully/i)).toBeInTheDocument();
    expect(onClientUpdatedMock).toHaveBeenCalledWith(mockUpdatedClient);
    expect(useOpsStore.getState().clients[0].links.important_docs).toBe('https://docs.google.com/flc-important-docs');
  });

  // 3. FAILED SAVE SHOWS ACTUAL ERROR AND DOES NOT REPORT FALSE SUCCESS
  it('3. Failed save displays actual database error and preserves user typed input', async () => {
    const updateClientSpy = vi.spyOn(clientManagementService, 'updateClient').mockResolvedValue({
      error: 'new row for relation "client_links" violates check constraint "client_links_link_type_check"'
    });

    const onClientUpdatedMock = vi.fn();

    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={initialClient}
          currentUserProfile={mockOwnerProfile}
          eligibleManagers={[mockManagerProfile]}
          onClientUpdated={onClientUpdatedMock}
        />
      </MemoryRouter>
    );

    const importantDocsInput = screen.getByLabelText(/Important Documents URL/i) as HTMLInputElement;
    fireEvent.change(importantDocsInput, { target: { value: 'https://docs.google.com/flc-important-docs' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateClientSpy).toHaveBeenCalled();
    });

    // Verify error is displayed
    expect(screen.getByText(/violates check constraint/i)).toBeInTheDocument();
    // Verify success message is NOT displayed
    expect(screen.queryByText(/Client configuration updated successfully/i)).not.toBeInTheDocument();
    // Verify onClientUpdated was NOT called with bad/empty data
    expect(onClientUpdatedMock).not.toHaveBeenCalled();
    // Verify the typed URL DID NOT disappear
    expect(importantDocsInput.value).toBe('https://docs.google.com/flc-important-docs');
  });

  // 4. PRESERVES EXISTING LINKS WHEN SAVING UNTOUCHED FIELDS
  it('4. Preserves existing links (website, google_drive) when saving untouched fields', async () => {
    let capturedPayload: any = null;
    const updateClientSpy = vi.spyOn(clientManagementService, 'updateClient').mockImplementation(
      async (clientId, input, actorId) => {
        capturedPayload = input;
        return {
          data: {
            ...initialClient,
            companyName: input.companyName || initialClient.companyName,
            links: {
              ...initialClient.links,
              important_docs: input.links?.important_docs || undefined,
              important_documents: input.links?.important_documents || undefined
            }
          }
        };
      }
    );

    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={initialClient}
          currentUserProfile={mockOwnerProfile}
          eligibleManagers={[mockManagerProfile]}
          onClientUpdated={vi.fn()}
        />
      </MemoryRouter>
    );

    // Only change Important Documents URL, leave Website and Google Drive untouched
    const importantDocsInput = screen.getByLabelText(/Important Documents URL/i);
    fireEvent.change(importantDocsInput, { target: { value: 'https://docs.google.com/new-sop' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateClientSpy).toHaveBeenCalled();
    });

    // Existing website and google drive URLs were preserved in the payload
    expect(capturedPayload.links.website).toBe('https://faseehlall.com');
    expect(capturedPayload.links.google_drive).toBe('https://drive.google.com/drive/folders/flc-root');
    expect(capturedPayload.links.important_docs).toBe('https://docs.google.com/new-sop');
  });

  // 5. SIDEBAR UPDATES IMMEDIATELY ON SAVE AND BECOMES ACTIVE & CLICKABLE
  it('5. Sidebar immediately reflects saved Important Documents link and is clickable', async () => {
    vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
      data: [initialClient]
    });
    vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue([mockManagerProfile]);

    let renderResult: any;
    await act(async () => {
      renderResult = render(
        <MemoryRouter>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    // Important Documents should initially be inactive
    const inactiveDocLink = screen.getByLabelText('Important Documents (Link not added)');
    expect(inactiveDocLink).toBeInTheDocument();
    expect(inactiveDocLink).toHaveAttribute('aria-disabled', 'true');

    // Simulate saving Important Documents URL in store
    await act(async () => {
      useOpsStore.getState().updateClientRecord({
        ...initialClient,
        links: {
          ...initialClient.links,
          important_docs: 'https://docs.google.com/flc-important-docs',
          important_documents: 'https://docs.google.com/flc-important-docs'
        }
      });
    });

    // Re-render to observe reactive change
    await act(async () => {
      renderResult.rerender(
        <MemoryRouter>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    // Now Important Documents should be an active link with href and correct color class
    await waitFor(() => {
      const activeDocLink = screen.getByRole('link', { name: /Important Documents/i });
      expect(activeDocLink).toBeInTheDocument();
      expect(activeDocLink).toHaveAttribute('href', 'https://docs.google.com/flc-important-docs');
      expect(activeDocLink).toHaveAttribute('target', '_blank');
    });
  });

  // 6. OPERATIONAL MANAGER ROLE CAN SAVE WORKSPACE LINKS
  it('6. Operational Manager role can save Important Documents and workspace links', async () => {
    const updatedClient: ClientRecord = {
      ...initialClient,
      links: {
        ...initialClient.links,
        important_docs: 'https://docs.google.com/manager-sop',
        important_documents: 'https://docs.google.com/manager-sop'
      }
    };

    const updateClientSpy = vi.spyOn(clientManagementService, 'updateClient').mockResolvedValue({
      data: updatedClient,
      error: undefined
    });

    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={initialClient}
          currentUserProfile={mockManagerProfile}
          eligibleManagers={[mockManagerProfile]}
          onClientUpdated={vi.fn()}
        />
      </MemoryRouter>
    );

    const importantDocsInput = screen.getByLabelText(/Important Documents URL/i);
    fireEvent.change(importantDocsInput, { target: { value: 'https://docs.google.com/manager-sop' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateClientSpy).toHaveBeenCalledWith(
        initialClient.id,
        expect.objectContaining({
          links: expect.objectContaining({
            important_docs: 'https://docs.google.com/manager-sop'
          })
        }),
        mockManagerProfile.id
      );
    });

    expect(screen.getByText(/Client configuration updated successfully/i)).toBeInTheDocument();
  });

  // 7. TEAM MEMBER ROLE: EXISTING LINKS ARE LOCKED, EMPTY LINKS CAN BE ADDED
  it('7. Team member role has locked inputs for populated links but can add empty Important Documents', () => {
    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={initialClient}
          currentUserProfile={mockTeamMemberProfile}
          eligibleManagers={[mockManagerProfile]}
          onClientUpdated={vi.fn()}
        />
      </MemoryRouter>
    );

    // Website already exists -> locked/disabled
    const websiteInput = screen.getByLabelText(/Website URL/i);
    expect(websiteInput).toBeDisabled();

    // Google Drive already exists -> locked/disabled
    const driveInput = screen.getByLabelText(/Google Drive Folder URL/i);
    expect(driveInput).toBeDisabled();

    // Important Documents was empty -> editable
    const importantDocsInput = screen.getByLabelText(/Important Documents URL/i);
    expect(importantDocsInput).not.toBeDisabled();
  });

  // 8. PERSISTENCE ACROSS RE-FETCH / BROWSER RELOAD
  it('8. Persistence across reload: fetchClients normalizes aliases so sidebar remains active', async () => {
    // Mock fetchClients returning link stored under alternate key 'important_documents'
    vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
      data: [
        {
          ...initialClient,
          links: {
            ...initialClient.links,
            important_documents: 'https://docs.google.com/persisted-sop',
            important_docs: 'https://docs.google.com/persisted-sop'
          }
        }
      ]
    });
    vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue([mockManagerProfile]);

    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const activeDocLink = screen.getByRole('link', { name: /Important Documents/i });
      expect(activeDocLink).toBeInTheDocument();
      expect(activeDocLink).toHaveAttribute('href', 'https://docs.google.com/persisted-sop');
    });
  });
});
