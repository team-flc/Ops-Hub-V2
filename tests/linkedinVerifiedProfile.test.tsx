import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ClientDetailsTab } from '../src/components/clients/ClientDetailsTab';
import { CreateClientModal } from '../src/components/clients/CreateClientModal';
import { clientManagementService } from '../src/lib/clientManagementService';
import { ClientRecord, UserProfile, ClientLinkedInProfile } from '../src/types';

// Mock Supabase
const mockFrom = vi.fn();
vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-owner', email: 'owner@test.com' } },
        error: null
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    from: (table: string) => mockFrom(table)
  }
}));

const mockOwner: UserProfile = {
  id: 'user-owner',
  fullName: 'Owner Admin',
  role: 'owner',
  status: 'active',
  workEmail: 'owner@test.com'
};

const mockProfiles: ClientLinkedInProfile[] = [
  {
    id: 'li-1',
    clientId: 'client-1',
    profileLabel: 'LinkedIn ID 1',
    profileUrl: 'https://linkedin.com/in/user1',
    salesNavigatorActive: false,
    salesNavigatorActivatedOn: null,
    linkedinVerified: false,
    sortOrder: 0,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'li-2',
    clientId: 'client-1',
    profileLabel: 'LinkedIn ID 2',
    profileUrl: 'https://linkedin.com/in/user2',
    salesNavigatorActive: true,
    salesNavigatorActivatedOn: '2026-02-01',
    linkedinVerified: true,
    sortOrder: 1,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'li-3',
    clientId: 'client-1',
    profileLabel: 'LinkedIn ID 3',
    profileUrl: 'https://linkedin.com/in/user3',
    salesNavigatorActive: true,
    salesNavigatorActivatedOn: '2026-02-05',
    linkedinVerified: false,
    sortOrder: 2,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'li-4',
    clientId: 'client-1',
    profileLabel: 'LinkedIn ID 4',
    profileUrl: 'https://linkedin.com/in/user4',
    salesNavigatorActive: false,
    salesNavigatorActivatedOn: null,
    // Existing profile without linkedinVerified explicit value (testing backward compatibility default)
    sortOrder: 3,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  } as ClientLinkedInProfile
];

const mockClient: ClientRecord = {
  id: 'client-1',
  companyName: 'Acme Test Corp',
  clientName: 'Acme Contact',
  package: 'Enterprise',
  operationalManagerId: 'user-owner',
  operationalManagerName: 'Owner Admin',
  activationDate: '2026-01-01',
  status: 'Active',
  requiredLinkedinProfileCount: 4,
  linkedinProfiles: mockProfiles,
  links: {
    website: 'https://acme.test'
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

describe('LinkedIn Verified Checkbox Feature Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('1. Renders LinkedIn Verified checkbox directly below Sales Navigator for each LinkedIn ID with separate states', () => {
    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={mockClient}
          currentUserProfile={mockOwner}
          eligibleManagers={[mockOwner]}
          onClientUpdated={vi.fn()}
        />
      </MemoryRouter>
    );

    // Should render 4 existing LinkedIn Verified checkboxes + 1 in the "Add Additional LinkedIn Profile" drawer
    const verifiedCheckboxes = screen.getAllByRole('checkbox', { name: /LinkedIn Verified/i });
    expect(verifiedCheckboxes.length).toBe(5);

    // Profile 1: Sales Nav Inactive, Verified = false (unchecked)
    expect(verifiedCheckboxes[0]).not.toBeChecked();

    // Profile 2: Sales Nav Active, Verified = true (checked)
    expect(verifiedCheckboxes[1]).toBeChecked();

    // Profile 3: Sales Nav Active, Verified = false (unchecked)
    expect(verifiedCheckboxes[2]).not.toBeChecked();

    // Profile 4: Existing ID without property, defaults to unchecked
    expect(verifiedCheckboxes[3]).not.toBeChecked();

    // New profile form: unchecked
    expect(verifiedCheckboxes[4]).not.toBeChecked();
  });

  it('2. LinkedIn Verified checkbox toggles and saves independently of Sales Navigator', async () => {
    const updateSpy = vi.spyOn(clientManagementService, 'updateLinkedInProfile').mockResolvedValue({
      data: {
        ...mockProfiles[0],
        linkedinVerified: true
      }
    });

    const onClientUpdated = vi.fn();

    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={mockClient}
          currentUserProfile={mockOwner}
          eligibleManagers={[mockOwner]}
          onClientUpdated={onClientUpdated}
        />
      </MemoryRouter>
    );

    const verifiedCheckboxes = screen.getAllByRole('checkbox', { name: /LinkedIn Verified/i });

    // Click verified on Profile 1 (which has salesNavigatorActive = false)
    fireEvent.click(verifiedCheckboxes[0]);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'li-1',
        { linkedinVerified: true },
        'user-owner'
      );
    });

    expect(onClientUpdated).toHaveBeenCalled();
    const updatedClient = onClientUpdated.mock.calls[0][0];
    expect(updatedClient.linkedinProfiles[0].linkedinVerified).toBe(true);
    // Profile 1's salesNavigatorActive remains false
    expect(updatedClient.linkedinProfiles[0].salesNavigatorActive).toBe(false);
    // Other profiles are preserved without modification
    expect(updatedClient.linkedinProfiles.length).toBe(4);
    expect(updatedClient.linkedinProfiles[1].id).toBe('li-2');
  });

  it('3. Adding a new profile in ClientDetailsTab saves linkedinVerified and resets form', async () => {
    const addSpy = vi.spyOn(clientManagementService, 'addLinkedInProfile').mockResolvedValue({
      data: {
        id: 'li-5',
        clientId: 'client-1',
        profileLabel: 'LinkedIn ID 5',
        profileUrl: 'https://linkedin.com/in/user5',
        salesNavigatorActive: false,
        salesNavigatorActivatedOn: null,
        linkedinVerified: true,
        sortOrder: 4,
        status: 'active',
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z'
      }
    });

    const onClientUpdated = vi.fn();

    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={mockClient}
          currentUserProfile={mockOwner}
          eligibleManagers={[mockOwner]}
          onClientUpdated={onClientUpdated}
        />
      </MemoryRouter>
    );

    // Fill new profile form
    const urlInput = screen.getByPlaceholderText('https://linkedin.com/in/...');
    fireEvent.change(urlInput, { target: { value: 'https://linkedin.com/in/user5' } });

    // Check the verified checkbox in the drawer (the 5th one)
    const verifiedCheckboxes = screen.getAllByRole('checkbox', { name: /LinkedIn Verified/i });
    fireEvent.click(verifiedCheckboxes[4]);
    expect(verifiedCheckboxes[4]).toBeChecked();

    const addBtn = screen.getByRole('button', { name: /Add Profile/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith(
        'client-1',
        expect.objectContaining({
          profileUrl: 'https://linkedin.com/in/user5',
          salesNavigatorActive: false,
          linkedinVerified: true
        }),
        'user-owner'
      );
    });

    // Form should reset
    await waitFor(() => {
      const refreshedCheckboxes = screen.getAllByRole('checkbox', { name: /LinkedIn Verified/i });
      // Last checkbox (the drawer's) should be reset to unchecked
      expect(refreshedCheckboxes[refreshedCheckboxes.length - 1]).not.toBeChecked();
    });
  });

  it('4. CreateClientModal supports 1–5 IDs with independent LinkedIn Verified checkboxes and submits them', async () => {
    const createSpy = vi.spyOn(clientManagementService, 'createClient').mockResolvedValue({
      data: mockClient
    });

    const onSuccess = vi.fn();

    render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        currentUserProfile={mockOwner}
        eligibleManagers={[mockOwner]}
      />
    );

    // Initially 3 profile rows
    let verifiedCheckboxes = screen.getAllByRole('checkbox', { name: /LinkedIn Verified/i });
    expect(verifiedCheckboxes.length).toBe(3);
    expect(verifiedCheckboxes[0]).not.toBeChecked();
    expect(verifiedCheckboxes[1]).not.toBeChecked();
    expect(verifiedCheckboxes[2]).not.toBeChecked();

    // Add 2 more rows to make 5 IDs
    const addRowBtn = screen.getByRole('button', { name: /\+ Add LinkedIn Profile/i });
    fireEvent.click(addRowBtn);
    fireEvent.click(addRowBtn);

    verifiedCheckboxes = screen.getAllByRole('checkbox', { name: /LinkedIn Verified/i });
    expect(verifiedCheckboxes.length).toBe(5);

    // Fill URLs for rows 1, 2, and 5
    const urlInputs = screen.getAllByPlaceholderText('https://linkedin.com/in/...');
    fireEvent.change(urlInputs[0], { target: { value: 'https://linkedin.com/in/test-id-1' } });
    fireEvent.change(urlInputs[1], { target: { value: 'https://linkedin.com/in/test-id-2' } });
    fireEvent.change(urlInputs[4], { target: { value: 'https://linkedin.com/in/test-id-5' } });

    // Check LinkedIn Verified only on row 1 and row 5
    fireEvent.click(verifiedCheckboxes[0]); // row 1 = true
    fireEvent.click(verifiedCheckboxes[4]); // row 5 = true

    expect(verifiedCheckboxes[0]).toBeChecked();
    expect(verifiedCheckboxes[1]).not.toBeChecked();
    expect(verifiedCheckboxes[4]).toBeChecked();

    // Fill required client fields
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: 'New Test Co' } });
    fireEvent.change(screen.getByLabelText(/Client \/ Owner Full Name/i), { target: { value: 'Test Contact' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Create Client Workspace/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled();
    });

    const createPayload = createSpy.mock.calls[0][0];
    expect(createPayload.linkedinProfiles).toBeDefined();
    expect(createPayload.linkedinProfiles?.length).toBe(3); // 3 non-blank profiles

    // Profile 1: verified = true
    expect(createPayload.linkedinProfiles?.[0]).toEqual(
      expect.objectContaining({
        profileUrl: 'https://linkedin.com/in/test-id-1',
        linkedinVerified: true,
        salesNavigatorActive: false
      })
    );

    // Profile 2: verified = false
    expect(createPayload.linkedinProfiles?.[1]).toEqual(
      expect.objectContaining({
        profileUrl: 'https://linkedin.com/in/test-id-2',
        linkedinVerified: false,
        salesNavigatorActive: false
      })
    );

    // Profile 5: verified = true
    expect(createPayload.linkedinProfiles?.[2]).toEqual(
      expect.objectContaining({
        profileUrl: 'https://linkedin.com/in/test-id-5',
        linkedinVerified: true,
        salesNavigatorActive: false
      })
    );
  });

  it('5. Service Layer: fetchClients and fetchClientById map linkedin_verified properly', async () => {
    // Test fetchClientById mapping
    const mockClientData = {
      id: 'client-1',
      company_name: 'Acme Test Corp',
      client_name: 'Acme Contact',
      package: 'Enterprise',
      operational_manager_id: 'user-owner',
      activation_date: '2026-01-01',
      status: 'Active',
      manager: { full_name: 'Owner Admin' }
    };

    const mockProfilesDb = [
      {
        id: 'p-1',
        client_id: 'client-1',
        profile_label: 'ID 1',
        profile_url: 'https://linkedin.com/in/p1',
        sales_navigator_active: false,
        sales_navigator_activated_on: null,
        linkedin_verified: true,
        sort_order: 0,
        status: 'active'
      },
      {
        id: 'p-2',
        client_id: 'client-1',
        profile_label: 'ID 2',
        profile_url: 'https://linkedin.com/in/p2',
        sales_navigator_active: true,
        sales_navigator_activated_on: '2026-01-01',
        linkedin_verified: false,
        sort_order: 1,
        status: 'active'
      },
      {
        id: 'p-3',
        client_id: 'client-1',
        profile_label: 'ID 3',
        profile_url: 'https://linkedin.com/in/p3',
        sales_navigator_active: false,
        sales_navigator_activated_on: null,
        linkedin_verified: null, // Null from database
        sort_order: 2,
        status: 'active'
      }
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockClientData, error: null })
        };
      }
      if (table === 'client_links') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      }
      if (table === 'client_linkedin_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockProfilesDb, error: null })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const client = await clientManagementService.fetchClientById('client-1');
    expect(client).not.toBeNull();
    expect(client?.linkedinProfiles).toHaveLength(3);
    expect(client?.linkedinProfiles[0].linkedinVerified).toBe(true);
    expect(client?.linkedinProfiles[1].linkedinVerified).toBe(false);
    expect(client?.linkedinProfiles[2].linkedinVerified).toBe(false); // null mapped to false
  });

  it('9. Gmail Account: Renders checkbox below LinkedIn Verified and conditionally reveals Gmail address field', async () => {
    const clientWithGmail: ClientRecord = {
      ...mockClient,
      linkedinProfiles: [
        {
          id: 'li-gmail-1',
          clientId: 'client-1',
          profileLabel: 'Lead ID 1',
          profileUrl: 'https://linkedin.com/in/lead1',
          salesNavigatorActive: true,
          salesNavigatorActivatedOn: '2026-02-01',
          linkedinVerified: true,
          hasGmailAccount: true,
          gmailAddress: 'lead1.outreach@gmail.com',
          sortOrder: 0,
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        },
        {
          id: 'li-gmail-2',
          clientId: 'client-1',
          profileLabel: 'Lead ID 2',
          profileUrl: 'https://linkedin.com/in/lead2',
          salesNavigatorActive: false,
          salesNavigatorActivatedOn: null,
          linkedinVerified: false,
          hasGmailAccount: false,
          gmailAddress: null,
          sortOrder: 1,
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ]
    };

    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={clientWithGmail}
          currentUserProfile={mockOwner}
          eligibleManagers={[mockOwner]}
          onClientUpdated={vi.fn()}
        />
      </MemoryRouter>
    );

    // Should find Gmail Account checkboxes (2 existing + 1 in drawer)
    const gmailCheckboxes = screen.getAllByRole('checkbox', { name: /Gmail Account/i });
    expect(gmailCheckboxes.length).toBe(3);

    // Profile 1: hasGmailAccount is true -> checkbox is checked and email input is visible with value
    expect(gmailCheckboxes[0]).toBeChecked();
    const emailInput = screen.getByDisplayValue('lead1.outreach@gmail.com');
    expect(emailInput).toBeInTheDocument();

    // Profile 2: hasGmailAccount is false -> checkbox is unchecked
    expect(gmailCheckboxes[1]).not.toBeChecked();

    // Drawer: hasGmailAccount is false -> unchecked
    expect(gmailCheckboxes[2]).not.toBeChecked();
  });

  it('10. Gmail Account: toggles checkbox and saves independently with email address', async () => {
    const updateSpy = vi.spyOn(clientManagementService, 'updateLinkedInProfile').mockResolvedValue({
      data: {
        ...mockProfiles[0],
        hasGmailAccount: true,
        gmailAddress: 'new.lead@gmail.com'
      }
    });

    render(
      <MemoryRouter>
        <ClientDetailsTab
          client={mockClient}
          currentUserProfile={mockOwner}
          eligibleManagers={[mockOwner]}
          onClientUpdated={vi.fn()}
        />
      </MemoryRouter>
    );

    const gmailCheckboxes = screen.getAllByRole('checkbox', { name: /Gmail Account/i });
    expect(gmailCheckboxes[0]).not.toBeChecked();

    // Toggle profile 1 Gmail Account checkbox
    fireEvent.click(gmailCheckboxes[0]);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'li-1',
        expect.objectContaining({
          hasGmailAccount: true
        }),
        'user-owner'
      );
    });
  });

  it('11. Gmail Account: clientManagementService maps has_gmail_account and gmail_address from DB correctly', async () => {
    const mockClientData = {
      id: 'client-1',
      companyName: 'Acme Test Corp',
      client_name: 'Acme Contact',
      package: 'Enterprise',
      operational_manager_id: 'user-owner',
      activation_date: '2026-01-01',
      status: 'Active',
      required_linkedin_profile_count: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const mockProfilesDb = [
      {
        id: 'p-1',
        client_id: 'client-1',
        profile_label: 'ID 1',
        profile_url: 'https://linkedin.com/in/p1',
        sales_navigator_active: true,
        sales_navigator_activated_on: '2026-01-01',
        linkedin_verified: true,
        has_gmail_account: true,
        gmail_address: 'p1@gmail.com',
        sort_order: 0,
        status: 'active'
      },
      {
        id: 'p-2',
        client_id: 'client-1',
        profile_label: 'ID 2',
        profile_url: 'https://linkedin.com/in/p2',
        sales_navigator_active: false,
        sales_navigator_activated_on: null,
        linkedin_verified: false,
        has_gmail_account: false,
        gmail_address: null,
        sort_order: 1,
        status: 'active'
      }
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockClientData, error: null })
        };
      }
      if (table === 'client_links') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      }
      if (table === 'client_linkedin_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockProfilesDb, error: null })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const client = await clientManagementService.fetchClientById('client-1');
    expect(client).not.toBeNull();
    expect(client?.linkedinProfiles).toHaveLength(2);
    expect(client?.linkedinProfiles[0].hasGmailAccount).toBe(true);
    expect(client?.linkedinProfiles[0].gmailAddress).toBe('p1@gmail.com');
    expect(client?.linkedinProfiles[1].hasGmailAccount).toBe(false);
    expect(client?.linkedinProfiles[1].gmailAddress).toBeNull();
  });
});
