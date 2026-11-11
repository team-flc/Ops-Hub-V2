import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardView } from '../src/components/views/DashboardView';
import { ClientWorkspaceView } from '../src/components/clients/ClientWorkspaceView';
import { UserProfile, ClientRecord, ClientTask } from '../src/types';

// Mock Services
vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    fetchCrossClientTasks: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'task-1',
          clientId: 'client-1',
          clientName: 'Finfix Pro',
          title: 'Prepare Q3 Accounts',
          status: 'In Progress',
          dueDate: '2026-11-15',
          timerStartedAt: new Date().toISOString(),
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z'
        },
        {
          id: 'task-2',
          clientId: 'client-1',
          clientName: 'Finfix Pro',
          title: 'Review Financial Statements',
          status: 'Client Review',
          dueDate: '2026-11-16',
          approvalMode: true,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z'
        }
      ]
    }),
    fetchDepartments: vi.fn().mockResolvedValue([]),
    fetchEligibleAssignees: vi.fn().mockResolvedValue([]),
    fetchClientWeeks: vi.fn().mockResolvedValue({ data: [] }),
    updateKanbanStatus: vi.fn().mockResolvedValue({ error: null }),
    reopenTask: vi.fn().mockResolvedValue({ error: null })
  }
}));

vi.mock('../src/lib/clientManagementService', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    clientManagementService: {
      ...actual.clientManagementService,
      fetchClients: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'client-1',
            companyName: 'Finfix Pro',
            clientName: 'Finfix Pro Client',
            status: 'Active',
            activePlanWeeks: 4,
            currentWeekNumber: 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z'
          }
        ]
      }),
      fetchEligibleManagers: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('../src/lib/teamManagementService', () => ({
  teamManagementService: {
    fetchTeamMembers: vi.fn().mockResolvedValue([
      {
        id: 'user-1',
        fullName: 'Faseeh Lall',
        role: 'owner',
        status: 'active'
      }
    ])
  }
}));

vi.mock('../src/lib/employeeOperationsService', () => ({
  employeeOperationsService: {
    fetchEmployeeRecord: vi.fn().mockResolvedValue(null),
    fetchWorkShifts: vi.fn().mockResolvedValue([]),
    fetchTodayAttendance: vi.fn().mockResolvedValue(null),
    getTodayWorkReport: vi.fn().mockResolvedValue(null),
    fetchWorkReports: vi.fn().mockResolvedValue([
      {
        id: 'rep-1',
        employeeId: 'user-1',
        period: '2026-11-11',
        summary: 'Completed financial reviews and audited accounts',
        status: 'submitted',
        tasksSummary: ['Review Financial Statements'],
        createdAt: '2026-11-11T00:00:00Z'
      }
    ]),
    reviewWorkReport: vi.fn().mockResolvedValue({ error: null })
  }
}));

vi.mock('../src/lib/safeRouterHooks', () => ({
  useSafeNavigate: () => vi.fn()
}));

const mockStaffProfile: UserProfile = {
  id: 'user-owner',
  fullName: 'Faseeh Lall',
  email: 'teamflc786@gmail.com',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockClientProfile: UserProfile = {
  id: 'user-client',
  fullName: 'Client Contact',
  email: 'client@finfixpro.com',
  role: 'client',
  organizationId: 'client-1',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

let currentTestProfile: UserProfile = mockStaffProfile;

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: currentTestProfile.id, email: currentTestProfile.email },
    profile: currentTestProfile,
    isLoading: false,
    profileError: null
  })
}));

describe('PROMPT 9: Staff Dashboard Analytics & Multi-Tenant Shielding Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTestProfile = mockStaffProfile;
    delete (window as any).location;
    window.location = new URL('https://ops.faseehlall.com/dashboard') as any;
  });

  it('renders all 7 analytics-style operational sections for staff with Staff Only badges', async () => {
    currentTestProfile = mockStaffProfile;

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardView />
      </MemoryRouter>
    );

    // 1. Operations Progress & Resolution Trends
    expect(await screen.findByText('Operations Progress & Resolution Trends')).toBeDefined();

    // 2. Quality Assurance & First-Pass Approval Rate
    expect(await screen.findByText('Quality Assurance & First-Pass Approval Rate')).toBeDefined();

    // 3. Client Operational Workload Distribution
    expect(await screen.findByText('Client Operational Workload Distribution')).toBeDefined();

    // 4. Cross-Client Operations Kanban
    expect(await screen.findByText('Cross-Client Operations Kanban')).toBeDefined();

    // 5. Company Approvals Queue
    expect(await screen.findByText('Company Approvals Queue')).toBeDefined();

    // 6. Live Active Timers
    expect(await screen.findByText('Live Active Timers')).toBeDefined();

    // 7. Submitted Daily Operations Reports
    expect(await screen.findByText('Submitted Daily Operations Reports')).toBeDefined();

    // Check header staff badge
    expect(screen.getByText(/Staff Only • Shielded from Client Preview/i)).toBeDefined();

    // Verify Staff Only badges are rendered
    const staffOnlyBadges = screen.getAllByText('Staff Only');
    expect(staffOnlyBadges.length).toBeGreaterThanOrEqual(4);
  });

  it('strictly shields DashboardView from Client Preview mode (?preview=true)', async () => {
    currentTestProfile = mockStaffProfile;
    // Set preview param in URL
    window.location = new URL('https://ops.faseehlall.com/dashboard?preview=true') as any;

    render(
      <MemoryRouter initialEntries={['/dashboard?preview=true']}>
        <DashboardView />
      </MemoryRouter>
    );

    // Should render fail-closed staff operational dashboard notice
    expect(await screen.findByText(/Staff Operational Dashboard • Internal Only/i)).toBeDefined();
    expect(screen.getByText(/strictly restricted to staff members and is never exposed in client preview/i)).toBeDefined();

    // Ensure none of the 7 sections or charts are rendered in preview
    expect(screen.queryByText('Operations Progress & Resolution Trends')).toBeNull();
    expect(screen.queryByText('Quality Assurance & First-Pass Approval Rate')).toBeNull();
    expect(screen.queryByText('Client Operational Workload Distribution')).toBeNull();
    expect(screen.queryByText('Cross-Client Operations Kanban')).toBeNull();
    expect(screen.queryByText('Company Approvals Queue')).toBeNull();
    expect(screen.queryByText('Live Active Timers')).toBeNull();
  });

  it('strictly fails closed when accessed by a client role user', async () => {
    currentTestProfile = mockClientProfile;

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardView />
      </MemoryRouter>
    );

    // Should render fail-closed notice
    expect(await screen.findByText(/Staff Operational Dashboard • Internal Only/i)).toBeDefined();

    // Internal telemetry sections must be completely absent
    expect(screen.queryByText('Operations Progress & Resolution Trends')).toBeNull();
    expect(screen.queryByText('Quality Assurance & First-Pass Approval Rate')).toBeNull();
    expect(screen.queryByText('Client Operational Workload Distribution')).toBeNull();
    expect(screen.queryByText('Cross-Client Operations Kanban')).toBeNull();
  });

  it('verifies ClientWorkspaceView in preview mode contains ZERO charts and NO cross-client sections', async () => {
    const mockClientRecord: ClientRecord = {
      id: 'client-1',
      companyName: 'Finfix Pro',
      clientName: 'Finfix Pro Client',
      status: 'Active',
      activePlanWeeks: 4,
      currentWeekNumber: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    render(
      <MemoryRouter initialEntries={['/clients/client-1?preview=true']}>
        <ClientWorkspaceView
          client={mockClientRecord}
          currentUserProfile={mockStaffProfile}
          eligibleManagers={[]}
          onClientUpdated={vi.fn()}
          isClientView={true}
        />
      </MemoryRouter>
    );

    // Verify none of the 7 staff dashboard sections exist in client workspace preview
    expect(screen.queryByText('Operations Progress & Resolution Trends')).toBeNull();
    expect(screen.queryByText('Quality Assurance & First-Pass Approval Rate')).toBeNull();
    expect(screen.queryByText('Client Operational Workload Distribution')).toBeNull();
    expect(screen.queryByText('Cross-Client Operations Kanban')).toBeNull();
    expect(screen.queryByText('Company Approvals Queue')).toBeNull();
    expect(screen.queryByText('Live Active Timers')).toBeNull();
    expect(screen.queryByText('Submitted Daily Operations Reports')).toBeNull();
  });
});
