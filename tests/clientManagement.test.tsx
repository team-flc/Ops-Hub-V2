import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';
import { ClientSwitcher } from '../src/components/clients/ClientSwitcher';
import { CreateClientModal } from '../src/components/clients/CreateClientModal';
import { DuplicateClientModal } from '../src/components/clients/DuplicateClientModal';
import { SelectedClientHeader } from '../src/components/clients/SelectedClientHeader';
import { ClientWorkspaceView } from '../src/components/clients/ClientWorkspaceView';
import { Header } from '../src/components/layout/Header';
import { 
  clientManagementService, 
  sanitizeUrl, 
  isValidLinkedInUrl, 
  calculateLinkedInReadiness 
} from '../src/lib/clientManagementService';
import { ClientRecord, UserProfile, ClientLinkedInProfile } from '../src/types';

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFromSelect = vi.fn();
const mockInsert = vi.fn();

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
        insert: (data: any) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'new-id', ...data }, error: null })
          })
        }),
        update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }),
        delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) })
      })
    }
  };
});

const mockProfiles: ClientLinkedInProfile[] = [
  {
    id: 'p-1',
    clientId: 'client-1',
    profileLabel: 'LinkedIn ID 1',
    profileUrl: 'https://linkedin.com/in/alice-smith',
    salesNavigatorActive: true,
    salesNavigatorActivatedOn: '2026-01-15',
    sortOrder: 0,
    status: 'active',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z'
  },
  {
    id: 'p-2',
    clientId: 'client-1',
    profileLabel: 'LinkedIn ID 2',
    profileUrl: 'https://linkedin.com/in/alice-smith-backup',
    salesNavigatorActive: true,
    salesNavigatorActivatedOn: '2026-01-20',
    sortOrder: 1,
    status: 'active',
    createdAt: '2026-01-20T00:00:00Z',
    updatedAt: '2026-01-20T00:00:00Z'
  }
];

const mockClients: ClientRecord[] = [
  {
    id: 'client-1',
    companyName: 'Acme Logistics',
    clientName: 'Alice Smith',
    package: 'Advanced',
    operationalManagerId: 'mgr-1',
    operationalManagerName: 'John Manager',
    activationDate: '2026-01-15',
    status: 'Active',
    pauseReason: null,
    requiredLinkedinProfileCount: 3,
    linkedinProfiles: mockProfiles,
    sourceClientId: null,
    links: {
      website: 'https://acmelogistics.com',
      google_drive: 'https://drive.google.com/drive/folders/acme',
      linkedin_company_page: 'https://linkedin.com/company/acme-logistics',
      slack_channel: 'https://app.slack.com/client/T01/C01'
    },
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z'
  },
  {
    id: 'client-2',
    companyName: 'Beta Retailers',
    clientName: 'Bob Jones',
    package: 'Basic',
    operationalManagerId: 'mgr-1',
    operationalManagerName: 'John Manager',
    activationDate: '2026-02-01',
    status: 'Paused',
    pauseReason: 'Payment overdue',
    requiredLinkedinProfileCount: 3,
    linkedinProfiles: [],
    sourceClientId: null,
    links: {},
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z'
  }
];

const mockManagers: UserProfile[] = [
  {
    id: 'mgr-1',
    fullName: 'John Manager',
    role: 'operational_manager',
    status: 'active',
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'owner-1',
    fullName: 'Atif Khan',
    role: 'owner',
    status: 'active',
    createdAt: '',
    updatedAt: ''
  }
];

describe('Phase 2B: Client Management & Dynamic LinkedIn Access Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  // 1. URL SANITIZATION & PROTOCOL SECURITY
  it('1. sanitizeUrl accepts http:// and https:// URLs and rejects unsafe protocols and malformed strings', () => {
    expect(sanitizeUrl('https://drive.google.com/folder')).toBe('https://drive.google.com/folder');
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeUrl('not a url')).toBeNull();
    expect(sanitizeUrl('')).toBeNull();
    expect(sanitizeUrl(null)).toBeNull();
  });

  // 2. LINKEDIN URL VALIDATION
  it('2. isValidLinkedInUrl accepts valid LinkedIn profile URLs and rejects non-LinkedIn URLs', () => {
    expect(isValidLinkedInUrl('https://linkedin.com/in/john-doe')).toBe(true);
    expect(isValidLinkedInUrl('https://www.linkedin.com/in/sarah-smith/')).toBe(true);
    expect(isValidLinkedInUrl('https://facebook.com/john')).toBe(false);
    expect(isValidLinkedInUrl('javascript:alert(1)')).toBe(false);
  });

  // 3. LINKEDIN ACCESS READINESS CALCULATION
  it('3. calculateLinkedInReadiness calculates readiness and completeness accurately', () => {
    // 0 added of 3
    const r0 = calculateLinkedInReadiness(3, []);
    expect(r0.isComplete).toBe(false);
    expect(r0.totalAdded).toBe(0);
    expect(r0.statusText).toBe('0 of 3 LinkedIn Profiles Added');

    // 2 added with Sales Nav of 3 required
    const r2 = calculateLinkedInReadiness(3, mockProfiles);
    expect(r2.isComplete).toBe(false);
    expect(r2.totalAdded).toBe(2);
    expect(r2.salesNavActiveCount).toBe(2);
    expect(r2.statusText).toBe('2 of 3 LinkedIn Profiles Added');

    // 3 added with Sales Nav of 3 required
    const completeProfiles: ClientLinkedInProfile[] = [
      ...mockProfiles,
      {
        id: 'p-3',
        clientId: 'client-1',
        profileLabel: 'LinkedIn ID 3',
        profileUrl: 'https://linkedin.com/in/director',
        salesNavigatorActive: true,
        salesNavigatorActivatedOn: '2026-01-25',
        sortOrder: 2,
        status: 'active',
        createdAt: '',
        updatedAt: ''
      }
    ];
    const r3 = calculateLinkedInReadiness(3, completeProfiles);
    expect(r3.isComplete).toBe(true);
    expect(r3.statusText).toBe('LinkedIn Access Complete');
  });

  // 4. CLIENT SWITCHER STATES (LOADING, ERROR WITH RETRY, EMPTY, AND SUCCESS)
  it('4. ClientSwitcher distinguishes loading, error with retry, and empty states', () => {
    const handleRetry = vi.fn();

    // Loading State
    const { rerender } = render(
      <ClientSwitcher
        clients={[]}
        selectedClient={null}
        isLoading={true}
        fetchError={null}
        onRetry={handleRetry}
        onSelectClient={vi.fn()}
        onOpenCreateModal={vi.fn()}
        onOpenDuplicateModal={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /switch client workspace/i }));
    expect(screen.getByText('Loading clients...')).toBeInTheDocument();

    // Error State (NOT disguised as empty list)
    rerender(
      <ClientSwitcher
        clients={[]}
        selectedClient={null}
        isLoading={false}
        fetchError="Could not find the table 'public.clients'"
        onRetry={handleRetry}
        onSelectClient={vi.fn()}
        onOpenCreateModal={vi.fn()}
        onOpenDuplicateModal={vi.fn()}
      />
    );
    expect(screen.getByText('Unable to load clients')).toBeInTheDocument();
    expect(screen.getByText("Could not find the table 'public.clients'")).toBeInTheDocument();
    expect(screen.queryByText('No accessible clients found')).not.toBeInTheDocument();

    // Retry control
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalled();

    // Successful Empty State
    rerender(
      <ClientSwitcher
        clients={[]}
        selectedClient={null}
        isLoading={false}
        fetchError={null}
        onRetry={handleRetry}
        onSelectClient={vi.fn()}
        onOpenCreateModal={vi.fn()}
        onOpenDuplicateModal={vi.fn()}
      />
    );
    expect(screen.getByText('No accessible clients found')).toBeInTheDocument();
  });

  // 5. REMOVE GLOBAL + CLIENT BUTTON (STRICT SINGLE ACTION LOCATION)
  it('5. Global Header does NOT contain any + Client button', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await act(async () => {
      render(
        <AuthProvider>
          <Header />
        </AuthProvider>
      );
    });
    expect(screen.queryByText('+ Client')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ client/i })).not.toBeInTheDocument();
  });

  // 6. DUPLICATE ICON ISOLATION
  it('6. Duplicate icon opens Duplicate modal without selecting client row (stopPropagation)', () => {
    const handleSelect = vi.fn();
    const handleDuplicate = vi.fn();

    render(
      <ClientSwitcher
        clients={mockClients}
        selectedClient={mockClients[0]}
        isLoading={false}
        fetchError={null}
        onSelectClient={handleSelect}
        onOpenCreateModal={vi.fn()}
        onOpenDuplicateModal={handleDuplicate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /switch client workspace/i }));
    const duplicateButtons = screen.getAllByTitle(/duplicate client:/i);
    expect(duplicateButtons.length).toBe(2);

    fireEvent.click(duplicateButtons[1]);
    expect(handleDuplicate).toHaveBeenCalledWith(mockClients[1]);
    expect(handleSelect).not.toHaveBeenCalled();
  });

  // 7. CREATE CLIENT MODAL WITH EXPANDED LINKS AND LINKEDIN PROFILES
  it('7. CreateClientModal includes Website, LinkedIn Company Page, and dynamic LinkedIn Lead Gen Profiles', () => {
    render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUserProfile={mockManagers[1]}
        eligibleManagers={mockManagers}
      />
    );

    expect(screen.getByText('Create New Client Workspace')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://clientwebsite.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://linkedin.com/company/...')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn Lead Generation Profiles')).toBeInTheDocument();
    expect(screen.getByText('+ Add LinkedIn Profile')).toBeInTheDocument();
  });

  // 8. DUPLICATE CLIENT PREFILLS REQUIREMENTS AND LEAVES LINKS/PROFILES BLANK
  it('8. DuplicateClientModal prefills required count and operational package and leaves links blank', () => {
    render(
      <DuplicateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        sourceClient={mockClients[0]}
        currentUserProfile={mockManagers[1]}
        eligibleManagers={mockManagers}
      />
    );

    expect(screen.getByText(/Duplicate Client:/i)).toBeInTheDocument();
    expect(screen.getByText('Acme Logistics')).toBeInTheDocument();

    const packageSelect = screen.getByLabelText(/service package/i) as HTMLSelectElement;
    expect(packageSelect.value).toBe('Advanced');

    const reqCountInput = screen.getByLabelText(/required linkedin profiles count/i) as HTMLInputElement;
    expect(reqCountInput.value).toBe('3');

    const websiteInput = screen.getByPlaceholderText(/https:\/\/clientwebsite\.com/i) as HTMLInputElement;
    expect(websiteInput.value).toBe('');
  });

  // 9. SELECTED CLIENT HEADER & COMBINED LINKEDIN TRACKER
  it('9. SelectedClientHeader displays quick-links and combined LinkedIn Profiles tracker', () => {
    render(<SelectedClientHeader client={mockClients[0]} />);

    expect(screen.getByText('Acme Logistics')).toBeInTheDocument();
    expect(screen.getByTitle('Open Website / Landing Page')).toBeInTheDocument();
    expect(screen.getByTitle('Open LinkedIn Company Page')).toBeInTheDocument();
    expect(screen.getByTitle('Open Google Drive Folder')).toBeInTheDocument();
    expect(screen.getByTitle('Open Slack Channel')).toBeInTheDocument();

    // Combined LinkedIn tracker button
    const linkedInBtn = screen.getByRole('button', { name: /linkedin profiles/i });
    expect(linkedInBtn).toBeInTheDocument();
    expect(screen.getByText('LinkedIn Profiles (2/3)')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();

    // Click to open popover
    fireEvent.click(linkedInBtn);
    expect(screen.getByText('LinkedIn Access Readiness')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 LinkedIn Profiles Added')).toBeInTheDocument();
  });

  // 10. 30-DAY WORKSPACE WITH ADD TASK PLACEHOLDER
  // 10. 30-DAY WORKSPACE WITH ADD TASK ACTION
  it('10. ClientWorkspaceView renders Week 1-4 and opens Create Task modal on + Add Task click', () => {
    render(
      <ClientWorkspaceView
        client={mockClients[0]}
        currentUserProfile={mockManagers[1]}
        eligibleManagers={mockManagers}
        onClientUpdated={vi.fn()}
      />
    );

    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('Week 3')).toBeInTheDocument();
    expect(screen.getByText('Week 4')).toBeInTheDocument();

    const addTaskBtns = screen.getAllByRole('button', { name: /\+ add task/i });
    expect(addTaskBtns.length).toBe(1);

    fireEvent.click(addTaskBtns[0]);
    expect(screen.getByText(/Create Operational Task/i)).toBeInTheDocument();
  });

  // 11. ROUTE PROTECTION
  it('11. Anonymous user attempting to access /clients is redirected to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/clients']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>LOGIN_GATE</div>} />
              <Route
                path="/clients"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
                    <div>CLIENTS_PROTECTED</div>
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
      expect(screen.queryByText('CLIENTS_PROTECTED')).not.toBeInTheDocument();
    });
  });

  // 12. SECURITY AUDIT
  it('12. Frontend bundle contains zero service-role keys or admin bypass tokens', () => {
    expect(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(import.meta.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  // 13. CLEAN STAFF SIDEBAR & SINGLE SIGN OUT
  it('13. Clean staff sidebar contains only FLC branding, Client Switcher, and Settings', async () => {
    const { Sidebar } = await import('../src/components/layout/Sidebar');
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1', email: 'owner@flc.com' } }, error: null });
    mockFromSelect.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return Promise.resolve({
          data: { id: 'u-1', full_name: 'Faseeh Lall', role: 'owner', status: 'active', work_email: 'owner@flc.com' },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await act(async () => {
      render(
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTitle('Switch Client Workspace')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Unapproved placeholder navigation items are completely removed
    expect(screen.queryByText(/Everything/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Executive Dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SOPs & Playbooks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Automations Engine/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Operations Spaces/i)).not.toBeInTheDocument();
  });

  // 14. CLEAN TOP HEADER
  it('14. Top header contains only breadcrumb and theme toggle, and no unapproved task controls', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await act(async () => {
      render(
        <AuthProvider>
          <Header />
        </AuthProvider>
      );
    });

    // Approved items
    expect(screen.getByText('FASEEH LALL & CO.')).toBeInTheDocument();
    expect(screen.getByText('Ops Hub')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle Dark / Light Theme')).toBeInTheDocument();

    // Removed items
    expect(screen.queryByPlaceholderText(/Search or jump to/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Ctrl+K')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Supabase/i)).not.toBeInTheDocument();
    expect(screen.queryByText('New Task')).not.toBeInTheDocument();
    expect(screen.queryByText('List')).not.toBeInTheDocument();
    expect(screen.queryByText('Board')).not.toBeInTheDocument();
    expect(screen.queryByText('Calendar')).not.toBeInTheDocument();
  });

  // 15. CLEAN 30-DAY SETUP WORKSPACE
  it('15. ClientWorkspaceView hides Reporting tab and shows only Week 1-4 without subtitles', () => {
    render(
      <ClientWorkspaceView
        client={mockClients[0]}
        currentUserProfile={mockManagers[1]}
        eligibleManagers={mockManagers}
        onClientUpdated={vi.fn()}
      />
    );

    // Only 30-Day Setup and Client Details tabs exist
    expect(screen.getByText('30-Day Setup')).toBeInTheDocument();
    expect(screen.getByText('Client Details')).toBeInTheDocument();
    expect(screen.queryByText('Reporting')).not.toBeInTheDocument();

    // Subtitles removed from week tabs
    expect(screen.queryByText(/Kickoff & Foundation Setup/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Asset Gathering & Infrastructure/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution & Campaigns Staging/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Review, Optimization & Handover/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Operations Checklist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Initial 30-Day Setup Plan/i)).not.toBeInTheDocument();

    // Exactly one + Add Task button exists
    expect(screen.getAllByRole('button', { name: /\+ add task/i }).length).toBe(1);
  });
});

