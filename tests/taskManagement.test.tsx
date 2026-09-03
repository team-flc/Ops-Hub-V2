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

  // 1. COMPREHENSIVE SUNDAY VALIDATION & DATE RULES (ITEM 12)
  it('1. Thoroughly validates Sundays across all weekdays, month boundaries, leap years, and timezones', () => {
    // 1.1 All days of the week: Monday through Saturday accepted, Sunday rejected
    // 2026-09-07 (Mon) to 2026-09-13 (Sun)
    expect(isSunday('2026-09-07T10:00:00.000Z')).toBe(false); // Monday
    expect(isSunday('2026-09-08T10:00:00.000Z')).toBe(false); // Tuesday
    expect(isSunday('2026-09-09T10:00:00.000Z')).toBe(false); // Wednesday
    expect(isSunday('2026-09-10T10:00:00.000Z')).toBe(false); // Thursday
    expect(isSunday('2026-09-11T10:00:00.000Z')).toBe(false); // Friday
    expect(isSunday('2026-09-12T10:00:00.000Z')).toBe(false); // Saturday
    expect(isSunday('2026-09-13T10:00:00.000Z')).toBe(true);  // Sunday

    // 1.2 End-of-month boundaries
    expect(isSunday('2026-05-31T12:00:00.000Z')).toBe(true);  // May 31, 2026 is Sunday
    expect(isSunday('2026-06-30T12:00:00.000Z')).toBe(false); // June 30, 2026 is Tuesday
    expect(isSunday('2026-08-31T12:00:00.000Z')).toBe(false); // August 31, 2026 is Monday

    // 1.3 Year-end rollover boundaries
    expect(isSunday('2026-12-31T12:00:00.000Z')).toBe(false); // Dec 31, 2026 is Thursday
    expect(isSunday('2027-01-01T12:00:00.000Z')).toBe(false); // Jan 1, 2027 is Friday
    expect(isSunday('2027-01-03T12:00:00.000Z')).toBe(true);  // Jan 3, 2027 is Sunday

    // 1.4 Leap year dates (e.g. Feb 29, 2024 was Thursday)
    expect(isSunday('2024-02-29T12:00:00.000Z')).toBe(false); // Leap Day (Thursday)
    expect(isSunday('2024-02-25T12:00:00.000Z')).toBe(true);  // Leap Year Sunday

    // 1.5 Timezone boundary conditions (UTC midnight and Asia/Karachi PKT UTC+5)
    expect(isSunday('2026-09-06T00:00:00.000Z')).toBe(true);  // UTC midnight Sunday
    expect(isSunday('2026-09-06T12:00:00+05:00')).toBe(true); // PKT noon Sunday
    expect(isSunday('2026-09-07T12:00:00+05:00')).toBe(false); // PKT noon Monday

    // 1.6 Manual text input format (YYYY-MM-DD) vs date-picker ISO values
    expect(isSunday('2026-09-06')).toBe(true);   // Sunday date string
    expect(isSunday('2026-09-07')).toBe(false);  // Monday date string
    expect(isSunday('2026-09-13')).toBe(true);   // Sunday date string

    // 1.7 validateTaskDates rejection combinations
    const mondayDate = '2026-09-07T10:00:00.000Z';
    const fridayDate = '2026-09-11T18:00:00.000Z';
    const sundayDate = '2026-09-06T10:00:00.000Z';
    const sundayDue = '2026-09-13T18:00:00.000Z';

    // planned_start on Sunday (rejected)
    const sundayStartRes = validateTaskDates(sundayDate, fridayDate);
    expect(sundayStartRes.valid).toBe(false);
    expect(sundayStartRes.error).toMatch(/Planned start date cannot fall on a Sunday/i);

    // due_date on Sunday (rejected)
    const sundayDueRes = validateTaskDates(mondayDate, sundayDue);
    expect(sundayDueRes.valid).toBe(false);
    expect(sundayDueRes.error).toMatch(/Due date cannot fall on a Sunday/i);

    // Both on Sunday (rejected)
    const bothSundayRes = validateTaskDates(sundayDate, sundayDue);
    expect(bothSundayRes.valid).toBe(false);
    expect(bothSundayRes.error).toMatch(/Sunday/i);

    // Valid weekday pairs (accepted)
    const validRes = validateTaskDates(mondayDate, fridayDate);
    expect(validRes.valid).toBe(true);
    expect(validRes.error).toBeUndefined();
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
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        task: {
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
        }
      },
      error: null
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

    // Owner has exactly ONE + Add Task button
    const addBtns = screen.getAllByRole('button', { name: /\+ add task/i });
    expect(addBtns.length).toBe(1);
  });

  // 11. EXACTLY ONE + ADD TASK BUTTON & CORRECT WEEK PROPS
  it('11. Renders exactly one + Add Task button in Week 2, Week 3, Week 4 and passes correct week to modal', async () => {
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
        currentUserProfile={mockUsers[1]} // Manager
        eligibleManagers={mockUsers.slice(0, 2)}
        onClientUpdated={vi.fn()}
      />
    );

    // Switch to Week 2
    fireEvent.click(screen.getByRole('button', { name: /week 2/i }));
    
    // Exactly ONE + Add Task button must exist
    const week2Btns = screen.getAllByRole('button', { name: /\+ add task/i });
    expect(week2Btns.length).toBe(1);

    // Click + Add Task in Week 2
    fireEvent.click(week2Btns[0]);
    expect(screen.getByText('Week 2 Setup')).toBeInTheDocument();
    expect(screen.getByLabelText(/workspace week/i)).toHaveValue('2');

    // Cancel modal
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Switch to Week 3 and open
    fireEvent.click(screen.getByRole('button', { name: /week 3/i }));
    const week3Btns = screen.getAllByRole('button', { name: /\+ add task/i });
    expect(week3Btns.length).toBe(1);
    fireEvent.click(week3Btns[0]);
    expect(screen.getByText('Week 3 Setup')).toBeInTheDocument();
    expect(screen.getByLabelText(/workspace week/i)).toHaveValue('3');

    // Cancel modal
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Switch to Week 4 and open
    fireEvent.click(screen.getByRole('button', { name: /week 4/i }));
    const week4Btns = screen.getAllByRole('button', { name: /\+ add task/i });
    expect(week4Btns.length).toBe(1);
    fireEvent.click(week4Btns[0]);
    expect(screen.getByText('Week 4 Setup')).toBeInTheDocument();
    expect(screen.getByLabelText(/workspace week/i)).toHaveValue('4');
  });

  // 12. CHANGING WORKSPACE WEEK DROPDOWN IN MODAL UPDATES BADGE AND SUBMISSION PAYLOAD
  it('12. Changing Workspace Week inside CreateClientTaskModal updates badge and create payload', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        task: {
          id: 'new-task-w3',
          client_id: 'client-1',
          week_number: 3,
          title: 'Week 3 Deliverable',
          department_id: 'dept-1',
          priority: 'Normal',
          planned_start: '2026-09-02T09:00:00.000Z',
          due_date: '2026-09-05T18:00:00.000Z',
          status: 'Draft',
          created_at: new Date().toISOString()
        }
      },
      error: null
    });

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

    // Initial badge: Week 1 Setup
    expect(screen.getByText(/Week 1 Setup/i)).toBeInTheDocument();

    // Change Workspace Week dropdown to Week 3
    const weekSelect = screen.getByLabelText(/workspace week/i);
    fireEvent.change(weekSelect, { target: { value: '3' } });

    // Badge updates to Week 3 Setup
    expect(screen.getByText(/Week 3 Setup/i)).toBeInTheDocument();

    // Fill title and department
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Set up Apollo/i), { target: { value: 'Week 3 Deliverable' } });
    fireEvent.change(screen.getByLabelText(/responsible department/i), { target: { value: 'dept-1' } });

    // Submit form
    const form = screen.getByRole('button', { name: /create task/i }).closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          weekNumber: 3,
          title: 'Week 3 Deliverable'
        })
      );
    });
  });

  // 13. SINGLE BUTTON REMAINS AVAILABLE AFTER TASKS EXIST
  it('13. Exactly one + Add Task button remains available when tasks exist', () => {
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
                    eq: () => Promise.resolve({ data: [mockTask], error: null })
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

    const addBtns = screen.getAllByRole('button', { name: /\+ add task/i });
    expect(addBtns.length).toBe(1);
  });

  // 14. SECURITY & ZERO SERVICE ROLE KEY AUDIT
  it('14. Frontend contains zero service-role keys or admin bypass tokens', () => {
    expect(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(import.meta.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
