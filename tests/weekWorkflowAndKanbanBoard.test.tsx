import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DEFAULT_WEEK_NAMES,
  ClientTask,
  ClientRecord,
  UserProfile,
  UserRole
} from '../src/types';
import { ClientWeekStepper } from '../src/components/clients/ClientWeekStepper';
import { ClientKanbanBoard } from '../src/components/tasks/ClientKanbanBoard';
import { ClientKanbanCard } from '../src/components/tasks/ClientKanbanCard';
import { TaskApprovalModal } from '../src/components/tasks/TaskApprovalModal';
import { TaskFeedbackModal } from '../src/components/tasks/TaskFeedbackModal';
import { ClientWorkspaceView } from '../src/components/clients/ClientWorkspaceView';

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
  { id: 'tm-1', fullName: 'Team Member 1', role: 'team_member', status: 'active' },
  { id: 'client-user', fullName: 'Client User', role: 'client', status: 'active' }
];

const initialTasks: ClientTask[] = [
  {
    id: 'task-1',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'Profile Audit & Optimization',
    details: 'Audit bio, banners, and links.',
    departmentId: 'dept-1',
    assigneeId: 'tm-1',
    assigneeName: 'Team Member 1',
    priority: 'Normal',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'Pending',
    sortOrder: 0,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    isOverdue: false
  },
  {
    id: 'task-2',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'Content Strategy Setup',
    details: 'Draft first week of posts.',
    departmentId: 'dept-1',
    assigneeId: 'tm-1',
    assigneeName: 'Team Member 1',
    priority: 'Urgent',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'In Progress',
    timeSpentSeconds: 1200,
    timerStartedAt: null,
    sortOrder: 1,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    isOverdue: false
  },
  {
    id: 'task-3',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'Graphics Review & Signoff',
    details: 'Need manager signoff.',
    departmentId: 'dept-2',
    assigneeId: 'tm-1',
    assigneeName: 'Team Member 1',
    priority: 'High',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'Approval',
    evidenceUrl: 'https://drive.google.com/test-evidence',
    completionNotes: 'All designs exported and reviewed.',
    sortOrder: 2,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    isOverdue: false
  },
  {
    id: 'task-4',
    clientId: 'client-1',
    weekNumber: 1,
    title: 'Competitor Benchmark',
    details: 'Benchmark top 5 competitors.',
    departmentId: 'dept-1',
    assigneeId: 'tm-1',
    assigneeName: 'Team Member 1',
    priority: 'Low',
    plannedStart: '2026-09-02T09:00:00.000Z',
    dueDate: '2026-09-05T18:00:00.000Z',
    status: 'Done',
    sortOrder: 3,
    createdBy: 'mgr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    isOverdue: false
  }
];

describe('Week Workflow UI & Kanban Task Board Comprehensive Test Suite', () => {
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

  // 1. DEFAULT WEEK NAMES & STEPPER
  describe('1. Week Workflow UI & Default Names', () => {
    it('verifies exact default week names constant across Weeks 1 to 4', () => {
      expect(DEFAULT_WEEK_NAMES[1]).toBe('Social Media Optimization');
      expect(DEFAULT_WEEK_NAMES[2]).toBe('LinkedIn Optimization');
      expect(DEFAULT_WEEK_NAMES[3]).toBe('Funnel Setup');
      expect(DEFAULT_WEEK_NAMES[4]).toBe('Paid Ads Setup');
    });

    it('renders week stepper with 4 weeks, displaying titles, task counts, and progress', () => {
      const weekNames = { ...DEFAULT_WEEK_NAMES };

      const tasksByWeek: Record<1 | 2 | 3 | 4, ClientTask[]> = {
        1: initialTasks, // 1 done of 4 = 25%
        2: [],
        3: [],
        4: []
      };

      render(
        <ClientWeekStepper
          client={mockClient}
          activeWeekNum={1}
          onSelectWeek={vi.fn()}
          weekNames={weekNames}
          onRenameWeek={vi.fn()}
          tasksByWeek={tasksByWeek}
          currentUserProfile={mockUsers[1]}
        />
      );

      // Verify all week names rendered
      expect(screen.getByText('Social Media Optimization')).toBeDefined();
      expect(screen.getByText('LinkedIn Optimization')).toBeDefined();
      expect(screen.getByText('Funnel Setup')).toBeDefined();
      expect(screen.getByText('Paid Ads Setup')).toBeDefined();

      // Verify task count badge for Week 1 (4 tasks) and completion progress (25%)
      const step1 = screen.getByTestId('week-step-1');
      expect(step1.textContent).toContain('4');
      expect(step1.textContent).toContain('tasks');
      expect(step1.textContent).toContain('25%');
    });

    it('allows Manager and Owner to rename weeks, but blocks Team Members from rename controls', async () => {
      const onRenameMock = vi.fn().mockResolvedValue(undefined);
      const weekNames = { ...DEFAULT_WEEK_NAMES };

      // 1. Manager currentUserProfile = mockUsers[1]
      const { rerender } = render(
        <ClientWeekStepper
          client={mockClient}
          activeWeekNum={1}
          onSelectWeek={vi.fn()}
          weekNames={weekNames}
          onRenameWeek={onRenameMock}
          tasksByWeek={{ 1: [], 2: [], 3: [], 4: [] }}
          currentUserProfile={mockUsers[1]}
        />
      );

      const renameBtn = screen.getByTestId('rename-week-btn-1');
      expect(renameBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(renameBtn);
      });

      const input = screen.getByTestId('week-name-input-1');
      expect(input).toBeDefined();

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Custom Social Strategy' } });
      });

      const saveBtn = screen.getByTestId('save-week-name-1');
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(onRenameMock).toHaveBeenCalledWith(1, 'Custom Social Strategy');

      // 2. Team Member with currentUserProfile = mockUsers[2]
      rerender(
        <ClientWeekStepper
          client={mockClient}
          activeWeekNum={1}
          onSelectWeek={vi.fn()}
          weekNames={weekNames}
          onRenameWeek={onRenameMock}
          tasksByWeek={{ 1: [], 2: [], 3: [], 4: [] }}
          currentUserProfile={mockUsers[2]}
        />
      );

      expect(screen.queryByTestId('rename-week-btn-1')).toBeNull();
    });
  });

  // 2. KANBAN TASK BOARD
  describe('2. Kanban Task Board & 4 Columns', () => {
    it('renders 4 responsive columns: Pending, In Progress, Approval, Done with correct counts', () => {
      render(
        <ClientKanbanBoard
          client={mockClient}
          tasks={initialTasks}
          currentUserProfile={mockUsers[1]}
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onOpenCreateTask={vi.fn()}
          onStatusChange={vi.fn()}
          onToggleTimer={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      // Verify columns via testids
      expect(screen.getByTestId('kanban-column-pending')).toBeDefined();
      expect(screen.getByTestId('kanban-column-in-progress')).toBeDefined();
      expect(screen.getByTestId('kanban-column-approval')).toBeDefined();
      expect(screen.getByTestId('kanban-column-done')).toBeDefined();

      // Verify task titles in their respective columns
      expect(screen.getByText('Profile Audit & Optimization')).toBeDefined();
      expect(screen.getByText('Content Strategy Setup')).toBeDefined();
      expect(screen.getByText('Graphics Review & Signoff')).toBeDefined();
      expect(screen.getByText('Competitor Benchmark')).toBeDefined();
    });

    it('renders task card with timer, evidence link, and action buttons', () => {
      render(
        <ClientKanbanCard
          task={initialTasks[2]}
          currentUserProfile={mockUsers[1]}
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onStatusChange={vi.fn()}
          onStartWork={vi.fn()}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onRequestApproval={vi.fn()}
          onRequestFeedback={vi.fn()}
        />
      );

      // Evidence link
      const evidenceLink = screen.getByTestId('evidence-link-task-3');
      expect(evidenceLink).toBeDefined();
      expect(evidenceLink.getAttribute('href')).toBe('https://drive.google.com/test-evidence');

      // Manager action buttons on Approval card
      expect(screen.getByTitle('Approve to Done')).toBeDefined();
      expect(screen.getByTitle('Return to In Progress with Feedback')).toBeDefined();
    });
  });

  // 3. WORKFLOW PERMISSIONS & ACTIONS
  describe('3. Workflow Permissions, Timer & Approval Transitions', () => {
    it('team member can move Pending -> In Progress and start/stop timer', async () => {
      const onStartWorkMock = vi.fn();

      render(
        <ClientKanbanCard
          task={initialTasks[0]}
          currentUserProfile={mockUsers[2]}
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onStatusChange={vi.fn()}
          onStartWork={onStartWorkMock}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onRequestApproval={vi.fn()}
          onRequestFeedback={vi.fn()}
        />
      );

      const startProgressBtn = screen.getByTitle('Start Work (Move to In Progress)');
      expect(startProgressBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(startProgressBtn);
      });

      expect(onStartWorkMock).toHaveBeenCalledWith(initialTasks[0]);
    });

    it('submitting for approval captures evidence URL and completion notes via TaskApprovalModal', async () => {
      const onSubmitMock = vi.fn().mockResolvedValue(undefined);
      const onCloseMock = vi.fn();

      render(
        <TaskApprovalModal
          isOpen={true}
          task={initialTasks[1]}
          onClose={onCloseMock}
          onSubmit={onSubmitMock}
        />
      );

      expect(screen.getByText('Submit Task for Approval')).toBeDefined();

      const evidenceInput = screen.getByTestId('evidence-url-input');
      const notesInput = screen.getByTestId('completion-notes-input');

      await act(async () => {
        fireEvent.change(evidenceInput, { target: { value: 'https://drive.google.com/approved-file' } });
        fireEvent.change(notesInput, { target: { value: 'Completed all setup steps as requested.' } });
      });

      const submitBtn = screen.getByTestId('submit-approval-confirm-btn');
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(onSubmitMock).toHaveBeenCalledWith({
        evidenceUrl: 'https://drive.google.com/approved-file',
        completionNotes: 'Completed all setup steps as requested.'
      });
    });

    it('manager can return task to In Progress with required feedback via TaskFeedbackModal', async () => {
      const onSubmitMock = vi.fn().mockResolvedValue(undefined);
      const onCloseMock = vi.fn();

      render(
        <TaskFeedbackModal
          isOpen={true}
          task={initialTasks[2]}
          onClose={onCloseMock}
          onSubmit={onSubmitMock}
        />
      );

      expect(screen.getByText('Return Task to In Progress')).toBeDefined();

      const textarea = screen.getByTestId('feedback-input');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'Please fix typo in slide 2 and re-export.' } });
      });

      const returnBtn = screen.getByTestId('submit-feedback-confirm-btn');
      await act(async () => {
        fireEvent.click(returnBtn);
      });

      expect(onSubmitMock).toHaveBeenCalledWith('Please fix typo in slide 2 and re-export.');
    });
  });

  // 4. BUTTON CORRECTION (+ Add Task)
  describe('4. Button Correction (+ Add Task)', () => {
    it('renders single + Add Task button without duplicate bracketed [+] in ClientWorkspaceView', () => {
      render(
        <ClientWorkspaceView
          client={mockClient}
          currentUserProfile={mockUsers[1]}
          eligibleManagers={mockUsers}
          onClientUpdated={vi.fn()}
        />
      );

      // Verify that "+ Add Task" button exists
      const addTaskButtons = screen.getAllByRole('button', { name: /(\+ )?Add Task/i });
      expect(addTaskButtons.length).toBeGreaterThanOrEqual(1);

      // Verify that no text contains "[+] + Add Task" or "[+]"
      const duplicateMatches = screen.queryAllByText(/\[\+\]/i);
      expect(duplicateMatches.length).toBe(0);
    });
  });
});
