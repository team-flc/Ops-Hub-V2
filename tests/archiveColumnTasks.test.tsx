import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ClientTask,
  ClientRecord,
  UserProfile,
  UserRole
} from '../src/types';
import { ClientKanbanBoard } from '../src/components/tasks/ClientKanbanBoard';
import { ArchiveColumnTasksModal } from '../src/components/tasks/ArchiveColumnTasksModal';
import { ClientWorkspaceView } from '../src/components/clients/ClientWorkspaceView';
import { taskManagementService } from '../src/lib/taskManagementService';
import { archiveService } from '../src/lib/archiveService';

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: () => mockGetSession(),
        signOut: vi.fn()
      },
      from: (table: string) => mockFrom(table),
      functions: {
        invoke: (...args: any[]) => mockFunctionsInvoke(...args)
      }
    }
  };
});

let mockCurrentUser: { id: string; role: UserRole; fullName: string } = {
  id: 'mgr-1',
  role: 'operational_manager',
  fullName: 'John Manager'
};

vi.mock('../src/context/AuthContext', () => {
  return {
    useAuth: () => ({
      user: { id: mockCurrentUser.id, email: `${mockCurrentUser.id}@opshub.local` },
      profile: {
        id: mockCurrentUser.id,
        role: mockCurrentUser.role,
        fullName: mockCurrentUser.fullName,
        status: 'active'
      },
      hasRole: (role: string) => mockCurrentUser.role === role,
      isOwner: () => mockCurrentUser.role === 'owner',
      isOperationalManager: () => mockCurrentUser.role === 'operational_manager',
      isTeamMember: () => mockCurrentUser.role === 'team_member',
      isClient: () => mockCurrentUser.role === 'client',
      loading: false
    })
  };
});

const mockClient: ClientRecord = {
  id: 'client-1',
  companyName: 'Apex Brands',
  clientName: 'Alice Smith',
  package: 'Advanced',
  operationalManagerId: 'mgr-1',
  operationalManagerName: 'John Manager',
  activationDate: '2026-01-15',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  links: {},
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z'
};

const mockUsers: UserProfile[] = [
  { id: 'owner-1', fullName: 'Owner User', role: 'owner', status: 'active' },
  { id: 'mgr-1', fullName: 'John Manager', role: 'operational_manager', status: 'active' },
  { id: 'tm-1', fullName: 'Team Member 1', role: 'team_member', status: 'active' }
];

const sampleTasks: ClientTask[] = [
  {
    id: 'task-p1',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'Pending Task 1',
    departmentId: 'dept-1',
    assigneeId: 'tm-1',
    priority: 'Normal',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'Pending',
    sortOrder: 0,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'task-p2',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'Pending Task 2',
    departmentId: 'dept-1',
    assigneeId: 'tm-1',
    priority: 'High',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'Pending',
    sortOrder: 1,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'task-ip1',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'In Progress Task 1',
    departmentId: 'dept-1',
    assigneeId: 'tm-1',
    priority: 'Urgent',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'In Progress',
    sortOrder: 2,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'task-ap1',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'Approval Task 1',
    departmentId: 'dept-2',
    assigneeId: 'tm-1',
    priority: 'Normal',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'Approval',
    sortOrder: 3,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'task-dn1',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'Done Task 1',
    departmentId: 'dept-1',
    assigneeId: 'tm-1',
    priority: 'Low',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'Done',
    sortOrder: 4,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  }
];

describe('Archive All Column Action Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 'mgr-1',
      role: 'operational_manager',
      fullName: 'John Manager'
    };
    mockGetUser.mockResolvedValue({ data: { user: { id: 'mgr-1' } }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } }, error: null });
  });

  describe('1. Service Layer Batch Archiving', () => {
    it('1.1 taskManagementService.archiveMultipleTasks validates non-empty reason', async () => {
      const res = await taskManagementService.archiveMultipleTasks(['t1', 't2'], '   ');
      expect(res.successfulIds).toEqual([]);
      expect(res.failedIds).toEqual(['t1', 't2']);
      expect(res.errors[0]).toMatch(/reason is mandatory/i);
    });

    it('1.2 taskManagementService.archiveMultipleTasks handles empty task list', async () => {
      const res = await taskManagementService.archiveMultipleTasks([], 'Reason');
      expect(res.successfulIds).toEqual([]);
      expect(res.failedIds).toEqual([]);
      expect(res.errors).toEqual([]);
    });

    it('1.3 taskManagementService.archiveMultipleTasks batch executes archive for multiple tasks', async () => {
      const archiveSpy = vi.spyOn(taskManagementService, 'archiveTask').mockResolvedValue({ error: null });

      const res = await taskManagementService.archiveMultipleTasks(['t1', 't2', 't3'], 'Project pivot');
      expect(archiveSpy).toHaveBeenCalledTimes(3);
      expect(archiveSpy).toHaveBeenCalledWith('t1', 'Project pivot');
      expect(archiveSpy).toHaveBeenCalledWith('t2', 'Project pivot');
      expect(archiveSpy).toHaveBeenCalledWith('t3', 'Project pivot');
      expect(res.successfulIds).toEqual(['t1', 't2', 't3']);
      expect(res.failedIds).toEqual([]);
      expect(res.errors).toEqual([]);

      archiveSpy.mockRestore();
    });

    it('1.4 archiveService.archiveMultipleTasks batch executes archive for multiple tasks', async () => {
      const archiveSpy = vi.spyOn(archiveService, 'archiveTask').mockResolvedValue({ success: true, error: null });

      const res = await archiveService.archiveMultipleTasks(['t1', 't2'], 'Scope completed');
      expect(archiveSpy).toHaveBeenCalledTimes(2);
      expect(res.successfulIds).toEqual(['t1', 't2']);
      expect(res.failedIds).toEqual([]);

      archiveSpy.mockRestore();
    });
  });

  describe('2. Kanban Board Column Header Buttons & Permissions', () => {
    it('2.1 renders Archive All button in all 4 column headers (Pending, In Progress, Approval, Done)', () => {
      render(
        <ClientKanbanBoard
          client={mockClient}
          tasks={sampleTasks}
          currentUserProfile={mockUsers[1]}
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onOpenCreateTask={vi.fn()}
          onStatusChange={vi.fn()}
          onStartWork={vi.fn()}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      const pendingBtn = screen.getByTestId('archive-all-pending-btn');
      const inProgressBtn = screen.getByTestId('archive-all-in-progress-btn');
      const approvalBtn = screen.getByTestId('archive-all-approval-btn');
      const doneBtn = screen.getByTestId('archive-all-done-btn');

      expect(pendingBtn).toBeInTheDocument();
      expect(inProgressBtn).toBeInTheDocument();
      expect(approvalBtn).toBeInTheDocument();
      expect(doneBtn).toBeInTheDocument();

      // Since all columns have at least 1 task, buttons are enabled
      expect(pendingBtn).not.toBeDisabled();
      expect(inProgressBtn).not.toBeDisabled();
      expect(approvalBtn).not.toBeDisabled();
      expect(doneBtn).not.toBeDisabled();
    });

    it('2.2 disables Archive All button when a column has 0 tasks', () => {
      // Only 1 pending task, other columns empty
      const onlyPendingTask: ClientTask[] = [sampleTasks[0]];

      render(
        <ClientKanbanBoard
          client={mockClient}
          tasks={onlyPendingTask}
          currentUserProfile={mockUsers[1]}
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onOpenCreateTask={vi.fn()}
          onStatusChange={vi.fn()}
          onStartWork={vi.fn()}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      const pendingBtn = screen.getByTestId('archive-all-pending-btn');
      const inProgressBtn = screen.getByTestId('archive-all-in-progress-btn');
      const approvalBtn = screen.getByTestId('archive-all-approval-btn');
      const doneBtn = screen.getByTestId('archive-all-done-btn');

      expect(pendingBtn).not.toBeDisabled();
      expect(inProgressBtn).toBeDisabled();
      expect(approvalBtn).toBeDisabled();
      expect(doneBtn).toBeDisabled();
    });

    it('2.3 hides Archive All buttons for Team Members (non-managers)', () => {
      render(
        <ClientKanbanBoard
          client={mockClient}
          tasks={sampleTasks}
          currentUserProfile={mockUsers[2]} // team_member
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onOpenCreateTask={vi.fn()}
          onStatusChange={vi.fn()}
          onStartWork={vi.fn()}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.queryByTestId('archive-all-pending-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-all-in-progress-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-all-approval-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-all-done-btn')).not.toBeInTheDocument();
    });
  });

  describe('3. ArchiveColumnTasksModal Confirmation & Scope Display', () => {
    it('3.1 renders modal with client name, week label, column name, and task count', () => {
      const pendingTasks = sampleTasks.filter((t) => t.status === 'Pending');

      render(
        <ArchiveColumnTasksModal
          isOpen={true}
          onClose={vi.fn()}
          client={mockClient}
          weekNumber={1}
          weekName="Social Media Optimization"
          columnName="Pending"
          tasks={pendingTasks}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByTestId('archive-column-modal')).toBeInTheDocument();
      expect(screen.getByText('Archive All Pending Tasks')).toBeInTheDocument();
      expect(screen.getByText('Apex Brands')).toBeInTheDocument();
      expect(screen.getByText('Week 1: Social Media Optimization')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('2 tasks')).toBeInTheDocument();
    });

    it('3.2 disables confirm button until non-empty reason is typed', async () => {
      const pendingTasks = sampleTasks.filter((t) => t.status === 'Pending');

      render(
        <ArchiveColumnTasksModal
          isOpen={true}
          onClose={vi.fn()}
          client={mockClient}
          weekNumber={1}
          weekName="Social Media Optimization"
          columnName="Pending"
          tasks={pendingTasks}
          onSuccess={vi.fn()}
        />
      );

      const confirmBtn = screen.getByTestId('confirm-archive-btn');
      const input = screen.getByTestId('archive-reason-input');

      // Initially disabled
      expect(confirmBtn).toBeDisabled();

      // Enter whitespace only
      await act(async () => {
        fireEvent.change(input, { target: { value: '   ' } });
      });
      expect(confirmBtn).toBeDisabled();

      // Enter valid reason
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Archiving outdated pending tasks' } });
      });
      expect(confirmBtn).not.toBeDisabled();
    });

    it('3.3 confirms archive and invokes onSuccess with archived task IDs', async () => {
      const pendingTasks = sampleTasks.filter((t) => t.status === 'Pending');
      const onSuccessMock = vi.fn();
      const onCloseMock = vi.fn();

      const archiveSpy = vi.spyOn(taskManagementService, 'archiveMultipleTasks').mockResolvedValue({
        successfulIds: ['task-p1', 'task-p2'],
        failedIds: [],
        errors: []
      });

      render(
        <ArchiveColumnTasksModal
          isOpen={true}
          onClose={onCloseMock}
          client={mockClient}
          weekNumber={1}
          weekName="Social Media Optimization"
          columnName="Pending"
          tasks={pendingTasks}
          onSuccess={onSuccessMock}
        />
      );

      const input = screen.getByTestId('archive-reason-input');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Replacing with new template tasks' } });
      });

      const confirmBtn = screen.getByTestId('confirm-archive-btn');
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(archiveSpy).toHaveBeenCalledWith(
        ['task-p1', 'task-p2'],
        'Replacing with new template tasks'
      );
      expect(onSuccessMock).toHaveBeenCalledWith(['task-p1', 'task-p2']);
      expect(onCloseMock).toHaveBeenCalled();

      archiveSpy.mockRestore();
    });
  });

  describe('4. Full End-to-End Kanban Flow & Reactive State Updates', () => {
    it('4.1 clicking column Archive All opens modal and updates board reactively on success', async () => {
      const archiveSpy = vi.spyOn(taskManagementService, 'archiveMultipleTasks').mockResolvedValue({
        successfulIds: ['task-p1', 'task-p2'],
        failedIds: [],
        errors: []
      });

      const onTasksArchivedMock = vi.fn();
      const onShowToastMock = vi.fn();

      const { rerender } = render(
        <ClientKanbanBoard
          client={mockClient}
          tasks={sampleTasks}
          weekNumber={1}
          weekName="Social Media Optimization"
          currentUserProfile={mockUsers[1]}
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onOpenCreateTask={vi.fn()}
          onStatusChange={vi.fn()}
          onStartWork={vi.fn()}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onTasksArchived={onTasksArchivedMock}
          onShowToast={onShowToastMock}
        />
      );

      // Verify tasks on board
      expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      expect(screen.getByText('Pending Task 2')).toBeInTheDocument();

      // Click Archive All on Pending column
      const pendingArchiveBtn = screen.getByTestId('archive-all-pending-btn');
      await act(async () => {
        fireEvent.click(pendingArchiveBtn);
      });

      // Modal is open
      expect(screen.getByTestId('archive-column-modal')).toBeInTheDocument();
      expect(screen.getByText('Archive All Pending Tasks')).toBeInTheDocument();

      // Enter reason and submit
      const input = screen.getByTestId('archive-reason-input');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Clearing pending tasks for week 1' } });
      });

      const confirmBtn = screen.getByTestId('confirm-archive-btn');
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(onTasksArchivedMock).toHaveBeenCalledWith(['task-p1', 'task-p2']);
      expect(onShowToastMock).toHaveBeenCalledWith('Successfully archived 2 tasks from Pending.');

      // Rerender with filtered tasks (mimicking parent state update)
      const remainingTasks = sampleTasks.filter((t) => t.status !== 'Pending');
      rerender(
        <ClientKanbanBoard
          client={mockClient}
          tasks={remainingTasks}
          weekNumber={1}
          weekName="Social Media Optimization"
          currentUserProfile={mockUsers[1]}
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onOpenCreateTask={vi.fn()}
          onStatusChange={vi.fn()}
          onStartWork={vi.fn()}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onTasksArchived={onTasksArchivedMock}
          onShowToast={onShowToastMock}
        />
      );

      // Pending tasks are gone from board, other column tasks remain
      expect(screen.queryByText('Pending Task 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending Task 2')).not.toBeInTheDocument();
      expect(screen.getByText('In Progress Task 1')).toBeInTheDocument();
      expect(screen.getByText('Approval Task 1')).toBeInTheDocument();
      expect(screen.getByText('Done Task 1')).toBeInTheDocument();

      // Pending archive button is now disabled because 0 tasks remain in Pending
      expect(screen.getByTestId('archive-all-pending-btn')).toBeDisabled();

      archiveSpy.mockRestore();
    });
  });
});
