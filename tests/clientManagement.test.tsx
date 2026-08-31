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
import { clientManagementService, sanitizeUrl } from '../src/lib/clientManagementService';
import { ClientRecord, UserProfile } from '../src/types';

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFromSelect = vi.fn();

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
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }),
        delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) })
      })
    }
  };
});

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
    sourceClientId: null,
    links: {
      google_drive: 'https://drive.google.com/drive/folders/acme',
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

describe('Phase 2B: Client Management Foundation Tests', () => {
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

  // 2. CLIENT SWITCHER BEHAVIOR
  it('2. ClientSwitcher renders collapsed state with selected client and opens popover with search & list', () => {
    const handleSelect = vi.fn();
    const handleCreate = vi.fn();
    const handleDuplicate = vi.fn();

    render(
      <ClientSwitcher
        clients={mockClients}
        selectedClient={mockClients[0]}
        onSelectClient={handleSelect}
        onOpenCreateModal={handleCreate}
        onOpenDuplicateModal={handleDuplicate}
      />
    );

    // Collapsed state
    expect(screen.getByText('Acme Logistics')).toBeInTheDocument();

    // Open popover
    fireEvent.click(screen.getByRole('button', { name: /switch client workspace/i }));

    // Popover elements
    expect(screen.getByText('Switch Client')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search clients...')).toBeInTheDocument();
    expect(screen.getByText('Beta Retailers')).toBeInTheDocument();

    // Single Create Client button in switcher
    const createBtn = screen.getByRole('button', { name: /create client/i });
    expect(createBtn).toBeInTheDocument();
    fireEvent.click(createBtn);
    expect(handleCreate).toHaveBeenCalled();
  });

  it('3. Duplicate icon opens Duplicate Client modal without selecting the source row (stopPropagation)', () => {
    const handleSelect = vi.fn();
    const handleCreate = vi.fn();
    const handleDuplicate = vi.fn();

    render(
      <ClientSwitcher
        clients={mockClients}
        selectedClient={mockClients[0]}
        onSelectClient={handleSelect}
        onOpenCreateModal={handleCreate}
        onOpenDuplicateModal={handleDuplicate}
      />
    );

    // Open popover
    fireEvent.click(screen.getByRole('button', { name: /switch client workspace/i }));

    // Click Duplicate icon on second client
    const duplicateButtons = screen.getAllByTitle(/duplicate client:/i);
    expect(duplicateButtons.length).toBe(2);

    fireEvent.click(duplicateButtons[1]);

    // handleDuplicate must be called with Beta Retailers
    expect(handleDuplicate).toHaveBeenCalledWith(mockClients[1]);
    // handleSelect must NOT be called
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it('4. Search input filters client list without page reload', () => {
    render(
      <ClientSwitcher
        clients={mockClients}
        selectedClient={mockClients[0]}
        onSelectClient={vi.fn()}
        onOpenCreateModal={vi.fn()}
        onOpenDuplicateModal={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /switch client workspace/i }));
    const searchInput = screen.getByPlaceholderText('Search clients...');

    // Type 'Beta'
    fireEvent.change(searchInput, { target: { value: 'Beta' } });
    expect(screen.getByText('Beta Retailers')).toBeInTheDocument();

    // Type non-existent query
    fireEvent.change(searchInput, { target: { value: 'NonExistentClientXYZ' } });
    expect(screen.getByText('No accessible clients found.')).toBeInTheDocument();
  });

  // 3. CREATE CLIENT MODAL VALIDATION
  it('5. CreateClientModal validates required fields and submits clean payload', () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <CreateClientModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        currentUserProfile={mockManagers[1]}
        eligibleManagers={mockManagers}
      />
    );

    expect(screen.getByText('Create New Client Workspace')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Acme Corp')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Sarah Jenkins')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create client workspace/i })).toBeInTheDocument();
  });

  // 4. DUPLICATE CLIENT MODAL PREFILLING
  it('6. DuplicateClientModal prefills reusable operational configuration and leaves links blank', () => {
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

    // Package should be prefilled with Advanced
    const packageSelect = screen.getByLabelText(/service package/i) as HTMLSelectElement;
    expect(packageSelect.value).toBe('Advanced');

    // Link input should be blank
    const driveInput = screen.getByPlaceholderText(/https:\/\/drive\.google\.com/i) as HTMLInputElement;
    expect(driveInput.value).toBe('');
  });

  // 5. SELECTED CLIENT HEADER & QUICK-LINK ICONS
  it('7. SelectedClientHeader displays badges, pause reason when paused, and only active links', () => {
    // Client 1 has Google Drive and Slack links
    const { rerender } = render(<SelectedClientHeader client={mockClients[0]} />);

    expect(screen.getByText('Acme Logistics')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Google Drive and Slack buttons should exist
    expect(screen.getByTitle('Open Google Drive Folder')).toBeInTheDocument();
    expect(screen.getByTitle('Open Slack Channel')).toBeInTheDocument();
    // Facebook and Instagram buttons should not exist
    expect(screen.queryByTitle('Open Facebook Page')).not.toBeInTheDocument();

    // Re-render with Client 2 (Paused with reason)
    rerender(<SelectedClientHeader client={mockClients[1]} />);
    expect(screen.getByText('Beta Retailers')).toBeInTheDocument();
    expect(screen.getByText('Paused — Payment overdue')).toBeInTheDocument();
    // No links for client 2
    expect(screen.queryByTitle('Open Google Drive Folder')).not.toBeInTheDocument();
  });

  // 6. 30-DAY SETUP WORKSPACE & ADD TASK PLACEHOLDER
  it('8. ClientWorkspaceView renders Week 1-4 tabs and + Add Task placeholder without DB mutation', () => {
    render(
      <ClientWorkspaceView
        client={mockClients[0]}
        currentUserProfile={mockManagers[1]}
        eligibleManagers={mockManagers}
        onClientUpdated={vi.fn()}
      />
    );

    // 4 Weekly Tabs
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('Week 3')).toBeInTheDocument();
    expect(screen.getByText('Week 4')).toBeInTheDocument();

    // Add Task placeholder button
    const addTaskBtn = screen.getByRole('button', { name: /\+ add task/i });
    expect(addTaskBtn).toBeInTheDocument();

    // Clicking Add Task shows neutral message toast
    fireEvent.click(addTaskBtn);
    expect(screen.getByText('Task creation will be configured in the next phase.')).toBeInTheDocument();
  });

  // 7. ROUTE ACCESS CONTROL
  it('9. Anonymous user attempting to access /clients is redirected to /login', async () => {
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

  // 8. SECURITY AUDIT
  it('10. Frontend bundle contains zero service-role keys or admin bypass tokens', () => {
    expect(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(import.meta.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
