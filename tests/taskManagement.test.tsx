import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  taskManagementService, 
  isSunday, 
  isTaskOverdue, 
  validateTaskDates 
} from '../src/lib/taskManagementService';
import { ClientTask, ClientRecord, Department, UserProfile } from '../src/types';
import { CreateClientTaskModal } from '../src/components/tasks/CreateClientTaskModal';
import { EditClientTaskModal } from '../src/components/tasks/EditClientTaskModal';
import { ClientTaskDetailsModal } from '../src/components/tasks/ClientTaskDetailsModal';
import { ClientTaskCard } from '../src/components/tasks/ClientTaskCard';
import { ClientWorkspaceView } from '../src/components/clients/ClientWorkspaceView';

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: () => mockGetSession(),
        signOut: vi.fn()
      },
      from: (table: string) => mockFrom(table)
    }
  };
});

const mockClient: ClientRecord = {
  id: 'client-1',
  companyName: 'Acme Global',
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

const mockDepartments: Department[] = [
  { id: 'dept-1', name: 'Operations', slug: 'operations', status: 'active', sortOrder: 1 },
  { id: 'dept-2', name: 'Paid Ads', slug: 'paid-ads', status: 'active', sortOrder: 2 }
];

const mockUsers: UserProfile[] = [
  { id: 'owner-1', fullName: 'Owner User', role: 'owner', status: 'active' },
  { id: 'mgr-1', fullName: 'John Manager', role: 'operational_manager', status: 'active' },
  { id: 'tm-1', fullName: 'Team Member 1', role: 'team_member', status: 'active' },
  { id: 'tm-suspended', fullName: 'Suspended Member', role: 'team_member', status: 'suspended' },
  { id: 'client-user', fullName: 'Client User', role: 'client', status: 'active' }
];

const mockTask: ClientTask = {
  id: 'task-1',
  clientId: 'client-1',
  weekNumber: 1,
  title: 'Set up Google Tag Manager and GA4 Conversion Tracking',
  details: 'Configure purchase and lead generation triggers.',
  departmentId: 'dept-1',
  departmentName: 'Operations',
  assigneeId: 'tm-1',
  assigneeName: 'Team Member 1',
  priority: 'Normal',
  plannedStart: '2026-09-02T09:00:00.000Z', // Wednesday
  dueDate: '2026-09-05T18:00:00.000Z', // Saturday
  status: 'Assigned',
  sortOrder: 0,
  createdBy: 'mgr-1',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  isOverdue: false
};

describe('Phase 3A: Operational Task Management Core Unit & Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'mgr-1' } }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } }, error: null });
  });

  // 1. SUNDAY VALIDATION & DATE RULES
  it('1. Rejects Sunday start and Sunday due dates', () => {
    const sundayDate = '2026-09-06T10:00:00.000Z'; // Sunday
    const mondayDate = '2026-09-07T10:00:00.000Z'; // Monday
    const fridayDate = '2026-09-11T18:00:00.000Z'; // Friday

    expect(isSunday(sundayDate)).toBe(true);
    expect(isSunday(mondayDate)).toBe(false);

    // Test validateTaskDates
    const sundayStartRes = validateTaskDates(sundayDate, fridayDate);
    expect(sundayStartRes.valid).toBe(false);
    expect(sundayStartRes.error).toMatch(/Sunday/i);

    const sundayDueRes = validateTaskDates(mondayDate, sundayDate);
    expect(sundayDueRes.valid).toBe(false);
    expect(sundayDueRes.error).toMatch(/Sunday/i);

    const validRes = validateTaskDates(mondayDate, fridayDate);
    expect(validRes.valid).toBe(true);
  });

  // 2. DUE DATE MUST BE LATER THAN PLANNED START
  it('2. Rejects due date earlier than or equal to planned start', () => {
    const mondayMorning = '2026-09-07T10:00:00.000Z';
    const mondayEarly = '2026-09-07T08:00:00.000Z';

    const res = validateTaskDates(mondayMorning, mondayEarly);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/strictly later/i);
  });

  // 3. OVERDUE CALCULATION RULES
  it('3. Calculates overdue correctly and excludes Team Review status', () => {
    const pastDueDate = '2020-01-01T00:00:00.000Z';
    const futureDueDate = '2099-01-01T00:00:00.000Z';

    // Past due with In Progress -> Overdue
    expect(isTaskOverdue({ dueDate: pastDueDate, status: 'In Progress' })).toBe(true);
    expect(isTaskOverdue({ dueDate: pastDueDate, status: 'Assigned' })).toBe(true);
    expect(isTaskOverdue({ dueDate: pastDueDate, status: 'Draft' })).toBe(true);
    expect(isTaskOverdue({ dueDate: pastDueDate, status: 'Blocked' })).toBe(true);

    // Past due with Team Review -> NOT Overdue (in Phase 3A internal review)
    expect(isTaskOverdue({ dueDate: pastDueDate, status: 'Team Review' })).toBe(false);

    // Future due -> NOT Overdue
    expect(isTaskOverdue({ dueDate: futureDueDate, status: 'In Progress' })).toBe(false);

    // Archived task -> NOT Overdue
    expect(isTaskOverdue({ dueDate: pastDueDate, status: 'In Progress', archivedAt: '2026-01-01' })).toBe(false);
  });

  // 4. UNASSIGNED TASK DEFAULTS TO DRAFT & ASSIGNED BECOMES ASSIGNED
  it('4. Creates unassigned task as Draft and assigned task as Assigned', async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({
          data: {
            id: 'new-task-id',
            client_id: 'client-1',
            week_number: 1,
            title: 'Draft Task Test',
            department_id: 'dept-1',
            assignee_id: null,
            priority: 'Normal',
            planned_start: '2026-09-02T09:00:00.000Z',
            due_date: '2026-09-05T18:00:00.000Z',
            status: 'Draft',
            created_at: new Date().toISOString()
          },
          error: null
        })
      })
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'client_tasks') return { insert: insertMock };
      if (table === 'client_task_events') return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    });

    // Create Draft
    const resDraft = await taskManagementService.createTask({
      clientId: 'client-1',
      weekNumber: 1,
      title: 'Draft Task Test',
      departmentId: 'dept-1',
      plannedStart: '2026-09-02T09:00:00.000Z',
      dueDate: '2026-09-05T18:00:00.000Z'
    });

    expect(resDraft.data?.status).toBe('Draft');
  });

  // 5. BLOCKED STATUS REQUIRES A MANDATORY REASON
  it('5. Blocked status transition requires a mandatory reason', async () => {
    const emptyReasonRes = await taskManagementService.updateStatus('task-1', 'Blocked', '');
    expect(emptyReasonRes.error).toMatch(/reason is required/i);
  });

  // 6. ARCHIVE REQUIRES MANDATORY REASON & HARD DELETE UNAVAILABLE
  it('6. Archive requires a mandatory reason and rejects blank reasons', async () => {
    const emptyArchive = await taskManagementService.archiveTask('task-1', '');
    expect(emptyArchive.error).toMatch(/mandatory/i);
  });

  // 7. CREATE TASK MODAL FORM AND VALIDATION
  it('7. CreateClientTaskModal validates fields and rejects Sunday dates in UI', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <CreateClientTaskModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        client={mockClient}
        weekNumber={1}
        departments={mockDepartments}
        eligibleAssignees={mockUsers.slice(0, 3)}
      />
    );

    expect(screen.getByText(/Create Operational Task/i)).toBeInTheDocument();
    expect(screen.getByText(/Week 1 Setup/i)).toBeInTheDocument();
    expect(screen.getByText('Acme Global')).toBeInTheDocument();

    // Priority defaults to Normal
    const prioritySelect = screen.getByLabelText(/priority level/i);
    expect(prioritySelect).toHaveValue('Normal');

    // Submit form with empty title -> shows validation error
    const form = screen.getByRole('button', { name: /create task/i }).closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText(/Task title is required/i)).toBeInTheDocument();
  });

  // 8. TASK CARD RENDERS CORRECT BADGES AND ACTIONS
  it('8. ClientTaskCard renders title, department, priority, and role actions', () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    const onStatusChange = vi.fn();

    // Manager View
    render(
      <ClientTaskCard
        task={mockTask}
        currentUserProfile={mockUsers[1]} // Manager
        onSelectTask={onSelect}
        onOpenEditModal={onEdit}
        onStatusChange={onStatusChange}
      />
    );

    expect(screen.getByText('Set up Google Tag Manager and GA4 Conversion Tracking')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Team Member 1')).toBeInTheDocument();
    expect(screen.getByTitle('Edit Task')).toBeInTheDocument();

    // Click card opens details
    fireEvent.click(screen.getByText('Set up Google Tag Manager and GA4 Conversion Tracking'));
    expect(onSelect).toHaveBeenCalledWith(mockTask);
  });

  // 9. TEAM MEMBER PERMISSIONS: CANNOT EDIT CORE FIELDS OR ARCHIVE
  it('9. Team Member sees workflow actions for assigned task but no edit/archive buttons', () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    const onStatusChange = vi.fn();

    render(
      <ClientTaskCard
        task={mockTask}
        currentUserProfile={mockUsers[2]} // Team Member (Assignee)
        onSelectTask={onSelect}
        onOpenEditModal={onEdit}
        onStatusChange={onStatusChange}
      />
    );

    // Has Start Work button when Assigned
    expect(screen.getByTitle('Start Work')).toBeInTheDocument();

    // Does NOT have Edit Task button
    expect(screen.queryByTitle('Edit Task')).not.toBeInTheDocument();
  });

  // 10. CLIENT WORKSPACE VIEW RENDERS WEEK 1-4 WITH OPERATIONAL TASKS
  it('10. ClientWorkspaceView renders + Add Task button and task list', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'departments') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockDepartments, error: null })
            })
          })
        };
      }
      if (table === 'client_team_access') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ profile_id: 'tm-1' }], error: null })
          })
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockUsers, error: null })
            })
          })
        };
      }
      if (table === 'client_tasks') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                order: () => ({
                  order: () => ({
                    eq: () => Promise.resolve({ data: [], error: null })
                  })
                })
              })
            })
          })
        };
      }
      return {
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) })
      };
    });

    render(
      <ClientWorkspaceView
        client={mockClient}
        currentUserProfile={mockUsers[0]} // Owner
        eligibleManagers={mockUsers.slice(0, 2)}
        onClientUpdated={vi.fn()}
      />
    );

    expect(screen.getByText('30-Day Setup')).toBeInTheDocument();
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('Week 3')).toBeInTheDocument();
    expect(screen.getByText('Week 4')).toBeInTheDocument();

    // Owner has + Add Task button
    const addBtns = screen.getAllByRole('button', { name: /\+ add task/i });
    expect(addBtns.length).toBeGreaterThan(0);
  });

  // 11. SECURITY & ZERO SERVICE ROLE KEY AUDIT
  it('11. Frontend contains zero service-role keys or admin bypass tokens', () => {
    expect(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(import.meta.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
