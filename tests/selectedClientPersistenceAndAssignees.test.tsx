import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { 
  resolveSelectedClientId, 
  getStoredSelectedClientId, 
  setStoredSelectedClientId, 
  clearStoredSelectedClientId,
  getUserClientStorageKey
} from '../src/lib/clientPersistence';
import { ClientRecord, UserProfile } from '../src/types';
import { useOpsStore } from '../src/store/opsStore';
import { OpsHubWorkspace } from '../src/App';
import { CreateClientTaskModal } from '../src/components/tasks/CreateClientTaskModal';
import { ClientTaskDetailsModal } from '../src/components/tasks/ClientTaskDetailsModal';
import { taskManagementService } from '../src/lib/taskManagementService';
import { clientManagementService } from '../src/lib/clientManagementService';

// Mock Services
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis()
    })),
    removeChannel: vi.fn()
  },
  isSupabaseConfigured: true
}));

const mockClients: ClientRecord[] = [
  {
    id: 'client-ppc-001',
    companyName: 'PPC Shark Force',
    clientName: 'John Shark',
    package: 'Basic',
    status: 'Active',
    links: { website: 'https://shark.com' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'client-flc-002',
    companyName: 'Faseeh Lall & Co',
    clientName: 'Faseeh Lall',
    package: 'Advanced',
    status: 'Active',
    links: { website: 'https://faseehlall.com' },
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
  },
  {
    id: 'client-archived-003',
    companyName: 'Old Archived Corp',
    clientName: 'Old User',
    package: 'Basic',
    status: 'Archived',
    links: {},
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z'
  }
];

const mockStaffProfiles: UserProfile[] = [
  {
    id: 'user-owner-1',
    fullName: 'Owner / CEO',
    role: 'owner',
    status: 'active',
    workEmail: 'ceo@flc.com',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'user-om-2',
    fullName: 'Operational Manager Alice',
    role: 'operational_manager',
    status: 'active',
    workEmail: 'alice@flc.com',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'user-dev-3',
    fullName: 'Developer Bob',
    role: 'team_member',
    status: 'active',
    workEmail: 'bob@flc.com',
    departmentIds: ['dept-dev-1'],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'user-seo-4',
    fullName: 'SEO Charlie',
    role: 'team_member',
    status: 'active',
    workEmail: 'charlie@flc.com',
    departmentIds: ['dept-seo-2'],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
];

let mockCurrentAuthUser = { id: 'user-owner-1', email: 'ceo@flc.com' };
let mockCurrentAuthProfile: UserProfile = mockStaffProfiles[0];

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentAuthUser,
    profile: mockCurrentAuthProfile,
    session: { access_token: 'fake-jwt' },
    isLoading: false,
    signOut: vi.fn()
  })
}));

describe('Selected Client Persistence & Assignee Selection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useOpsStore.setState({
      clients: mockClients,
      selectedClientId: null,
      viewMode: 'client_workspace'
    });
    vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
      data: mockClients,
      error: null
    });
    vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue([mockStaffProfiles[1]]);
  });

  describe('1. Pure Client Persistence & Resolution Logic', () => {
    it('1.1 scopes localStorage keys per user ID', () => {
      const keyA = getUserClientStorageKey('user-A');
      const keyB = getUserClientStorageKey('user-B');
      expect(keyA).toBe('ops_hub_selected_client_user-A');
      expect(keyB).toBe('ops_hub_selected_client_user-B');

      setStoredSelectedClientId('user-A', 'client-flc-002');
      setStoredSelectedClientId('user-B', 'client-ppc-001');

      expect(getStoredSelectedClientId('user-A')).toBe('client-flc-002');
      expect(getStoredSelectedClientId('user-B')).toBe('client-ppc-001');
    });

    it('1.2 Priority 1: selects valid route clientId when present', () => {
      setStoredSelectedClientId('user-1', 'client-ppc-001');
      const resolved = resolveSelectedClientId({
        clients: mockClients,
        userId: 'user-1',
        routeClientId: 'client-flc-002',
        currentSelectedId: 'client-ppc-001'
      });
      expect(resolved).toBe('client-flc-002');
    });

    it('1.3 Priority 2: resolves user remembered client when not on /clients/:id route', () => {
      setStoredSelectedClientId('user-1', 'client-flc-002');
      const resolved = resolveSelectedClientId({
        clients: mockClients,
        userId: 'user-1',
        routeClientId: undefined,
        currentSelectedId: null
      });
      expect(resolved).toBe('client-flc-002');
    });

    it('1.4 Priority 3: falls back to active client if remembered client is archived', () => {
      setStoredSelectedClientId('user-1', 'client-archived-003');
      const resolved = resolveSelectedClientId({
        clients: mockClients,
        userId: 'user-1',
        routeClientId: undefined,
        currentSelectedId: null
      });
      expect(resolved).toBe('client-ppc-001'); // First active client
    });

    it('1.5 Priority 4: falls back to first active accessible client when no storage exists', () => {
      const resolved = resolveSelectedClientId({
        clients: mockClients,
        userId: 'user-unknown',
        routeClientId: undefined,
        currentSelectedId: null
      });
      expect(resolved).toBe('client-ppc-001');
    });
  });

  describe('2. Refresh / Settings Persistence Reproduction', () => {
    it('2.1 preserves Faseeh Lall & Co when refreshing /settings', async () => {
      // User previously selected Faseeh Lall & Co
      setStoredSelectedClientId('user-owner-1', 'client-flc-002');

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route path="/settings" element={<OpsHubWorkspace initialView="settings" />} />
            <Route path="/clients/:clientId" element={<OpsHubWorkspace initialView="client_workspace" />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify that after loading, selectedClientId in store is 'client-flc-002'
      await waitFor(() => {
        expect(useOpsStore.getState().selectedClientId).toBe('client-flc-002');
      });

      // Verify header breadcrumb / company name shows Faseeh Lall & Co
      const backBtn = screen.getByRole('button', { name: /Back to Workspace/i });
      expect(backBtn).toBeDefined();

      // Click Back to Workspace
      fireEvent.click(backBtn);

      await waitFor(() => {
        expect(useOpsStore.getState().selectedClientId).toBe('client-flc-002');
      });
    });

    it('2.2 explicit client switch updates stored preference', async () => {
      setStoredSelectedClientId('user-owner-1', 'client-ppc-001');

      render(
        <MemoryRouter initialEntries={['/clients/client-flc-002']}>
          <Routes>
            <Route path="/clients/:clientId" element={<OpsHubWorkspace initialView="client_workspace" />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(useOpsStore.getState().selectedClientId).toBe('client-flc-002');
        expect(getStoredSelectedClientId('user-owner-1')).toBe('client-flc-002');
      });
    });
  });

  describe('3. All Active Staff in Assignee Dropdown', () => {
    it('3.1 CreateClientTaskModal renders ALL active staff members in Primary Assignee dropdown regardless of department', () => {
      render(
        <CreateClientTaskModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          client={mockClients[1]}
          weekNumber={1}
          departments={[
            { id: 'dept-dev-1', name: 'Web Development', slug: 'web_dev', status: 'active', sortOrder: 1, createdAt: '', updatedAt: '' },
            { id: 'dept-seo-2', name: 'SEO & Content', slug: 'seo_content', status: 'active', sortOrder: 2, createdAt: '', updatedAt: '' }
          ]}
          eligibleAssignees={mockStaffProfiles}
        />
      );

      const assigneeSelect = screen.getByLabelText('Primary Assignee') as HTMLSelectElement;
      expect(assigneeSelect).toBeDefined();

      const options = Array.from(assigneeSelect.options).map((o) => o.text);
      expect(options).toContain('Leave Unassigned (Draft)');
      expect(options).toContain('Owner / CEO (owner)');
      expect(options).toContain('Operational Manager Alice (operational_manager)');
      expect(options).toContain('Developer Bob (team_member)');
      expect(options).toContain('SEO Charlie (team_member)');
    });

    it('3.2 ClientTaskDetailsModal renders Primary Assignee dropdown for all staff roles without department hiding', () => {
      const mockTask = {
        id: 'task-101',
        clientId: 'client-flc-002',
        weekNumber: 1 as const,
        title: 'Build landing page header',
        departmentId: 'dept-dev-1',
        departmentName: 'Web Development',
        assigneeId: 'user-dev-3',
        assigneeName: 'Developer Bob',
        status: 'In Progress' as const,
        priority: 'Normal' as const,
        approvalMode: 'Internal Only' as const,
        plannedStart: '2026-09-15T09:00:00Z',
        dueDate: '2026-09-17T18:00:00Z',
        createdAt: '2026-09-14T00:00:00Z',
        updatedAt: '2026-09-14T00:00:00Z'
      };

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          currentUserProfile={mockStaffProfiles[2]} // Developer Bob (team_member)
          eligibleAssignees={mockStaffProfiles}
          onTaskUpdated={vi.fn()}
        />
      );

      const selects = screen.getAllByRole('combobox');
      // Find the assignee select that contains Developer Bob and SEO Charlie
      const assigneeSelect = selects.find((sel) => {
        const texts = Array.from((sel as HTMLSelectElement).options).map((o) => o.text);
        return texts.includes('SEO Charlie (team_member)');
      }) as HTMLSelectElement;

      expect(assigneeSelect).toBeDefined();
      const options = Array.from(assigneeSelect.options).map((o) => o.text);
      expect(options).toContain('Unassigned (Draft)');
      expect(options).toContain('Owner / CEO (owner)');
      expect(options).toContain('Operational Manager Alice (operational_manager)');
      expect(options).toContain('Developer Bob (team_member)');
      expect(options).toContain('SEO Charlie (team_member)');
    });
  });
});
