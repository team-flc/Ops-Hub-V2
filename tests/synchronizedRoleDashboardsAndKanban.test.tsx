import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PersonalCrossClientKanban } from '../src/components/dashboard/PersonalCrossClientKanban';
import { RoleOwnerDashboard } from '../src/components/dashboard/RoleOwnerDashboard';
import { RoleManagerDashboard } from '../src/components/dashboard/RoleManagerDashboard';
import { RoleTeamMemberDashboard } from '../src/components/dashboard/RoleTeamMemberDashboard';
import { DailyWorkReportModal } from '../src/components/dashboard/DailyWorkReportModal';
import { ClientTask, ClientRecord, UserProfile, WorkShift, EmployeeAttendance, EmployeeWorkReport } from '../src/types';
import { employeeOperationsService } from '../src/lib/employeeOperationsService';

vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    startWork: vi.fn().mockResolvedValue({ error: null }),
    startTimer: vi.fn().mockResolvedValue({ error: null }),
    stopTimer: vi.fn().mockResolvedValue({ error: null }),
    updateKanbanStatus: vi.fn().mockResolvedValue({ error: null }),
    reopenTask: vi.fn().mockResolvedValue({ error: null }),
    fetchTodayWorkedTasks: vi.fn().mockResolvedValue([
      {
        taskId: 't-1',
        taskTitle: 'Design Landing Page Header',
        clientName: 'Acme Corp',
        clientId: 'c-1',
        status: 'In Progress',
        durationMinutes: 45
      }
    ])
  }
}));

vi.mock('../src/lib/employeeOperationsService', () => ({
  employeeOperationsService: {
    getTodayDatePKT: vi.fn().mockReturnValue('2026-09-14'),
    submitWorkReport: vi.fn().mockResolvedValue({ error: null, data: { id: 'rep-1' } }),
    reviewWorkReport: vi.fn().mockResolvedValue({ error: null }),
    getTodayWorkReport: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock('../src/lib/safeRouterHooks', () => ({
  useSafeNavigate: () => vi.fn()
}));

const mockClients: ClientRecord[] = [
  {
    id: 'c-1',
    companyName: 'Acme Corp',
    clientName: 'Acme Corp',
    clientEmail: 'contact@acme.com',
    status: 'Active',
    activePlanWeeks: 4,
    currentWeekNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'c-2',
    companyName: 'Beta Logistics',
    clientName: 'Beta Logistics',
    clientEmail: 'contact@beta.com',
    status: 'Active',
    activePlanWeeks: 4,
    currentWeekNumber: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }
];

const mockOwner: UserProfile = {
  id: 'u-owner',
  fullName: 'Alice Owner',
  workEmail: 'alice@ops.com',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockManager: UserProfile = {
  id: 'u-manager',
  fullName: 'Bob Manager',
  workEmail: 'bob@ops.com',
  role: 'operational_manager',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockMember: UserProfile = {
  id: 'u-member',
  fullName: 'Charlie Teammate',
  workEmail: 'charlie@ops.com',
  role: 'team_member',
  status: 'active',
  reportingManagerId: 'u-manager',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockTasks: ClientTask[] = [
  {
    id: 't-1',
    clientId: 'c-1',
    clientName: 'Acme Corp',
    clientCompanyName: 'Acme Corp',
    weekNumber: 1,
    title: 'Design Landing Page Header',
    details: 'Create high fidelity wireframes',
    departmentId: 'd-design',
    departmentName: 'Design',
    assigneeId: 'u-member',
    assigneeName: 'Charlie Teammate',
    priority: 'High',
    status: 'In Progress',
    approvalMode: 'none',
    timeSpentSeconds: 2700,
    sortOrder: 0,
    createdBy: 'u-owner',
    createdAt: '2026-09-14T00:00:00Z',
    updatedAt: '2026-09-14T00:00:00Z',
    isOverdue: false
  },
  {
    id: 't-2',
    clientId: 'c-2',
    clientName: 'Beta Logistics',
    clientCompanyName: 'Beta Logistics',
    weekNumber: 2,
    title: 'Setup Google Ads Conversion Pixels',
    details: 'Tag manager tags verification',
    departmentId: 'd-marketing',
    departmentName: 'Marketing',
    assigneeId: 'u-member',
    assigneeName: 'Charlie Teammate',
    priority: 'Urgent',
    status: 'Team Review',
    approvalMode: 'Internal Only',
    timeSpentSeconds: 3600,
    evidenceUrl: 'https://loom.com/share/test1234',
    completionNotes: 'All pixels verified',
    sortOrder: 1,
    createdBy: 'u-manager',
    createdAt: '2026-09-14T00:00:00Z',
    updatedAt: '2026-09-14T00:00:00Z',
    isOverdue: false
  },
  {
    id: 't-3',
    clientId: 'c-1',
    clientName: 'Acme Corp',
    clientCompanyName: 'Acme Corp',
    weekNumber: 1,
    title: 'Implement Auth Middleware',
    details: 'Server side token verification',
    departmentId: 'd-dev',
    departmentName: 'Engineering',
    assigneeId: 'u-manager',
    assigneeName: 'Bob Manager',
    priority: 'Medium',
    status: 'Pending',
    approvalMode: 'none',
    timeSpentSeconds: 0,
    sortOrder: 2,
    createdBy: 'u-owner',
    createdAt: '2026-09-14T00:00:00Z',
    updatedAt: '2026-09-14T00:00:00Z',
    isOverdue: true
  }
];

const mockReports: EmployeeWorkReport[] = [
  {
    id: 'rep-1',
    employeeId: 'u-member',
    employeeName: 'Charlie Teammate',
    reportDate: '2026-09-14',
    reportType: 'daily',
    status: 'submitted',
    tasksSummary: [
      {
        taskId: 't-1',
        taskTitle: 'Design Landing Page Header',
        clientName: 'Acme Corp',
        durationMinutes: 45,
        status: 'In Progress'
      }
    ],
    nextPlan: 'Complete responsive testing',
    summary: 'Finished hero layout and icons',
    createdAt: '2026-09-14T17:00:00Z',
    updatedAt: '2026-09-14T17:00:00Z'
  }
];

describe('Synchronized Operations & Dashboards Feature Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. PersonalCrossClientKanban Component', () => {
    it('renders all Kanban columns properly', () => {
      render(
        <PersonalCrossClientKanban
          tasks={mockTasks}
          clients={mockClients}
          currentUserProfile={mockMember}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.getByText('Pending / Queued')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('filters tasks by client accurately', () => {
      render(
        <PersonalCrossClientKanban
          tasks={mockTasks}
          clients={mockClients}
          currentUserProfile={mockMember}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.getByText('Design Landing Page Header')).toBeInTheDocument();

      const clientSelect = screen.getByDisplayValue('All Accessible Clients');
      fireEvent.change(clientSelect, { target: { value: 'c-2' } });

      expect(screen.queryByText('Design Landing Page Header')).not.toBeInTheDocument();
      expect(screen.getByText('Setup Google Ads Conversion Pixels')).toBeInTheDocument();
    });

    it('filters tasks by priority', () => {
      render(
        <PersonalCrossClientKanban
          tasks={mockTasks}
          clients={mockClients}
          currentUserProfile={mockMember}
          onRefreshData={vi.fn()}
        />
      );

      const prioritySelect = screen.getByDisplayValue('All Priorities');
      fireEvent.change(prioritySelect, { target: { value: 'Urgent' } });

      expect(screen.getByText('Setup Google Ads Conversion Pixels')).toBeInTheDocument();
      expect(screen.queryByText('Design Landing Page Header')).not.toBeInTheDocument();
    });

    it('shows role toggle for Manager/Owner to switch between My Tasks and Direct Reports / Team', () => {
      render(
        <PersonalCrossClientKanban
          tasks={mockTasks}
          clients={mockClients}
          currentUserProfile={mockManager}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.getByText('My Tasks')).toBeInTheDocument();
      expect(screen.getByText('Direct Reports')).toBeInTheDocument();
    });
  });

  describe('2. Role-Specific Dashboards', () => {
    it('Owner Dashboard displays company approvals queue, live timers, and reports', () => {
      render(
        <RoleOwnerDashboard
          tasks={mockTasks}
          clients={mockClients}
          teamMembers={[]}
          dailyReports={mockReports}
          currentUserProfile={mockOwner}
          onRefreshData={vi.fn()}
          onOpenCreateTaskModal={vi.fn()}
        />
      );

      expect(screen.getByText('Company Approvals Queue')).toBeInTheDocument();
      expect(screen.getByText('Live Active Timers')).toBeInTheDocument();
      expect(screen.getByText('Submitted Daily Operations Reports')).toBeInTheDocument();
      expect(screen.getByText('Setup Google Ads Conversion Pixels')).toBeInTheDocument();
    });

    it('Operational Manager Dashboard displays direct reports and review queue', () => {
      const reportingMembers: any[] = [
        {
          id: 'u-member',
          fullName: 'Charlie Teammate',
          workEmail: 'charlie@ops.com',
          role: 'team_member',
          status: 'active',
          reportingManagerId: 'u-manager',
          departments: [],
          clientAccessCount: 2,
          clientIds: ['c-1', 'c-2'],
          startDate: '2026-01-01',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ];

      render(
        <RoleManagerDashboard
          tasks={mockTasks}
          clients={mockClients}
          reportingMembers={reportingMembers}
          dailyReports={mockReports}
          currentUserProfile={mockManager}
          onRefreshData={vi.fn()}
          onOpenCreateTaskModal={vi.fn()}
        />
      );

      expect(screen.getByText('Team Approval Queue')).toBeInTheDocument();
      expect(screen.getByText('Reporting Team Workload')).toBeInTheDocument();
      expect(screen.getAllByText('Charlie Teammate').length).toBeGreaterThanOrEqual(1);
    });

    it('Team Member Dashboard displays attendance, shift status, and daily report status', () => {
      const mockShift: WorkShift = {
        id: 'shift-1',
        name: 'Standard Morning PKT',
        startTime: '09:00',
        endTime: '18:00',
        timezone: 'Asia/Karachi',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const mockAttendance: EmployeeAttendance = {
        id: 'att-1',
        employeeId: 'u-member',
        shiftId: 'shift-1',
        date: '2026-09-14',
        checkInTime: '2026-09-14T09:02:00Z',
        checkOutTime: null,
        status: 'on_time',
        effectiveMinutes: 240,
        missingCheckout: false,
        createdAt: '2026-09-14T09:02:00Z',
        updatedAt: '2026-09-14T09:02:00Z'
      };

      render(
        <RoleTeamMemberDashboard
          tasks={mockTasks}
          employeeRecord={null}
          shift={mockShift}
          todayAttendance={mockAttendance}
          todayReport={null}
          currentUserProfile={mockMember}
          onOpenReportModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.getByText('Shift & Attendance')).toBeInTheDocument();
      expect(screen.getByText('Checked In')).toBeInTheDocument();
      expect(screen.getByText('Pending Submission')).toBeInTheDocument();
    });
  });

  describe('3. Daily Work Report Modal & Checkout Integration', () => {
    it('populates worked tasks and submits report successfully', async () => {
      const onSuccess = vi.fn();
      render(
        <DailyWorkReportModal
          isOpen={true}
          onClose={vi.fn()}
          currentUserProfile={mockMember}
          onSuccess={onSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Design Landing Page Header')).toBeInTheDocument();
      });

      const nextPlanInput = screen.getByPlaceholderText(/Finalize statics for/i);
      fireEvent.change(nextPlanInput, { target: { value: 'Complete testing and documentation' } });

      const submitBtn = screen.getByRole('button', { name: /Submit Daily Report/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(employeeOperationsService.submitWorkReport).toHaveBeenCalled();
      });
    });
  });
});