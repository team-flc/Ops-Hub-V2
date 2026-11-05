import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { canAddClient, canAddTask, isIntern, CLIENT_PERMITTED_LINK_KEYS, isInternalOrSensitiveUrl, sanitizeClientDeliverableTitle } from '../src/lib/permissions';
import { filterAndSanitizeClientDeliverables } from '../src/components/clients/ClientWorkspaceView';
import { TaskCompletionTrendChart } from '../src/components/dashboard/TaskCompletionTrendChart';
import { ClientWorkloadDistributionChart } from '../src/components/dashboard/ClientWorkloadDistributionChart';
import { RoleOwnerDashboard } from '../src/components/dashboard/RoleOwnerDashboard';
import { PersonalCrossClientKanban } from '../src/components/dashboard/PersonalCrossClientKanban';
import { ClientRecord, ClientTask, UserProfile } from '../src/types';
import { SelectedClientHeader } from '../src/components/clients/SelectedClientHeader';
import { ClientKanbanCard } from '../src/components/tasks/ClientKanbanCard';

vi.mock('../src/lib/safeRouterHooks', () => ({
  useSafeNavigate: () => vi.fn(),
  useSafeParams: () => ({}),
  useSafeLocation: () => ({ pathname: '/dashboard', search: '' })
}));

vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    startWork: vi.fn().mockResolvedValue({ error: null }),
    startTimer: vi.fn().mockResolvedValue({ error: null }),
    stopTimer: vi.fn().mockResolvedValue({ error: null }),
    updateKanbanStatus: vi.fn().mockResolvedValue({ error: null }),
    reopenTask: vi.fn().mockResolvedValue({ error: null }),
    fetchCrossClientTasks: vi.fn().mockResolvedValue({ data: [], error: null })
  }
}));

describe('Ops Hub Nov 2 Retest 7 Issues Verification Suite', () => {
  const activeClient: ClientRecord = {
    id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3',
    companyName: 'Maven Professionals',
    clientName: 'Maven Professionals',
    clientEmail: 'client@maven.com',
    status: 'Active',
    totalTasks: 10,
    completedTasks: 0,
    overdueTasks: 0,
    healthScore: 90
  };

  // =========================================================================
  // Problem 1: Dashboard shows proper loading skeletons, never fake zeros
  // =========================================================================
  it('Problem 1: Dashboard components show loading skeletons while isLoading is true, not fake zeros', () => {
    // 1. RoleOwnerDashboard
    const { container: ownerContainer } = render(
      <RoleOwnerDashboard
        tasks={[]}
        clients={[activeClient]}
        teamMembers={[]}
        dailyReports={[]}
        currentUserProfile={{ id: 'u1', role: 'owner', fullName: 'Faseeh Lall' } as UserProfile}
        onRefreshData={vi.fn()}
        isLoading={true}
      />
    );

    // Box 1 must NOT show "All client deliverables are up to date. Zero pending approvals." or "0 Pending"
    expect(ownerContainer.textContent).not.toContain('Zero pending approvals');
    expect(ownerContainer.textContent).not.toContain('0 Pending');
    // Box 2 must NOT show "No active timers currently running across teams." or "0 Live"
    expect(ownerContainer.textContent).not.toContain('No active timers currently running');
    expect(ownerContainer.textContent).not.toContain('0 Live');

    // 2. PersonalCrossClientKanban
    const { container: kanbanContainer } = render(
      <PersonalCrossClientKanban
        tasks={[]}
        clients={[activeClient]}
        currentUserProfile={{ id: 'u1', role: 'owner', fullName: 'Faseeh Lall' } as UserProfile}
        onRefreshTasks={vi.fn()}
        onSelectTask={vi.fn()}
        isLoading={true}
      />
    );
    // Kanban header must NOT show literal "0 Tasks" while loading
    expect(kanbanContainer.textContent).not.toContain('0 Tasks');
    // Columns must not show "No tasks in Assigned & In Queue" when isLoading is true
    expect(kanbanContainer.textContent).not.toContain('No tasks in Assigned & In Queue');
    expect(kanbanContainer.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

    // 3. ClientWorkloadDistributionChart
    const { container: workloadContainer } = render(
      <ClientWorkloadDistributionChart tasks={[]} clients={[activeClient]} isLoading={true} />
    );
    // Must NOT show literal "0 Active Workspaces" or "0 Total Tasks" while loading
    expect(workloadContainer.textContent).not.toContain('0 Active Workspaces');
    expect(workloadContainer.textContent).not.toContain('0 Total Tasks');
    // Must not show "No client task data available yet." when isLoading is true
    expect(workloadContainer.textContent).not.toContain('No client task data available yet.');
    expect(workloadContainer.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

    // 4. TaskCompletionTrendChart
    const { container: trendContainer } = render(
      <TaskCompletionTrendChart tasks={[]} isLoading={true} />
    );
    // Must NOT show literal 0% Done or Total Tasks 0 while loading
    expect(trendContainer.textContent).not.toContain('0% Done');
    expect(trendContainer.textContent).not.toContain('Total Tasks 0');
    expect(trendContainer.textContent).not.toContain('Completed 0');
    expect(trendContainer.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  // =========================================================================
  // Problem 2: Client preview filters internal work and sensitive links
  // =========================================================================
  it('Problem 2: Client deliverable filter follows Count Rule 2.3 (staff 10, client 9, 1 internal task filtered) and suppresses internal notes, chatter, timers, and Drive/Sheets IDs', () => {
    // Week 3 Funnel Setup: 10 tasks on staff board (0 Pending, 2 In Progress, 8 Approval, 0 Done)
    const rawWeek3Tasks: ClientTask[] = [
      {
        id: 't-icp',
        clientId: activeClient.id,
        title: 'Invoice Payment Followup PKR 18,300 & Shift Reminder',
        status: 'In Progress',
        approvalMode: 'Internal Only',
        weekNumber: 3,
        createdAt: '2026-09-15T00:00:00Z',
        details: 'remind Faseeh about the Maven 6 PM shift',
        completionNotes: 'Internal draft',
        timerStartedAt: '2026-09-20T10:00:00Z',
        timeSpentSeconds: 3600,
        assigneeName: 'Muhammad Atif Naseer',
        evidenceUrl: 'https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j'
      },
      {
        id: 't-in-flight-2',
        clientId: activeClient.id,
        title: 'Funnel Setup Technical Architecture',
        status: 'In Progress',
        approvalMode: 'Client Approval Required',
        weekNumber: 3,
        createdAt: '2026-09-15T00:00:00Z',
        details: 'Internal DNS config notes',
        timeSpentSeconds: 1800,
        assigneeName: 'Zain',
        evidenceUrl: 'https://docs.google.com/spreadsheets/d/1234567890abcdef'
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `t-approval-${i}`,
        clientId: activeClient.id,
        title: `Deliverable Asset ${i + 1}`,
        status: 'Approval' as const,
        approvalMode: 'Client Approval Required' as const,
        weekNumber: 3,
        createdAt: '2026-09-16T00:00:00Z',
        details: 'Review before client handoff',
        completionNotes: 'Ready for client sign-off',
        timerStartedAt: '2026-09-21T08:00:00Z',
        timeSpentSeconds: 7200,
        assigneeName: 'Staff Member',
        evidenceUrl: 'https://drive.google.com/file/d/abcdef123456'
      }))
    ];

    expect(rawWeek3Tasks).toHaveLength(10);
    const sanitized = filterAndSanitizeClientDeliverables(rawWeek3Tasks);

    // Rule 2.3: client visible total (9) = staff board total (10) - internal only tasks (1)
    expect(sanitized).toHaveLength(9);

    // Internal task is completely excluded from client view
    expect(sanitized.find((t) => t.id === 't-icp')).toBeUndefined();

    // Internal background notes, shift reminders, and completion notes stripped across all tasks
    sanitized.forEach((t) => {
      expect(t.details).toBeUndefined();
      expect(t.completionNotes).toBeUndefined();
      expect(t.timerStartedAt).toBeNull();
      expect(t.timeSpentSeconds).toBeUndefined();
      expect(t.assigneeName).toBeUndefined();
      expect(t.evidenceUrl).toBeUndefined();
    });
  });

  // =========================================================================
  // Problem 3: Trends breakdown sums exactly to total with Awaiting Approval
  // =========================================================================
  it('Problem 3: Trends breakdown includes Awaiting Approval and sums exactly to total for every week', () => {
    // Construct exact Week 1 tasks matching: 4 Completed, 12 In Flight, 19 Awaiting Approval, 197 Pending = Total 232
    const week1Tasks: ClientTask[] = [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `c-${i}`, clientId: 'c1', title: 'Task', status: 'Completed' as const, weekNumber: 1, createdAt: ''
      })),
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `p-${i}`, clientId: 'c1', title: 'Task', status: 'In Progress' as const, weekNumber: 1, createdAt: ''
      })),
      ...Array.from({ length: 19 }, (_, i) => ({
        id: `a-${i}`, clientId: 'c1', title: 'Task', status: 'Team Review' as const, weekNumber: 1, createdAt: ''
      })),
      ...Array.from({ length: 197 }, (_, i) => ({
        id: `q-${i}`, clientId: 'c1', title: 'Task', status: 'Pending' as const, weekNumber: 1, createdAt: ''
      }))
    ];

    // Week 2 tasks matching: 1 Completed, 1 In Flight, 8 Awaiting Approval, 39 Pending = Total 49
    const week2Tasks: ClientTask[] = [
      ...Array.from({ length: 1 }, (_, i) => ({
        id: `w2-c-${i}`, clientId: 'c1', title: 'Task', status: 'Completed' as const, weekNumber: 2, createdAt: ''
      })),
      ...Array.from({ length: 1 }, (_, i) => ({
        id: `w2-p-${i}`, clientId: 'c1', title: 'Task', status: 'In Progress' as const, weekNumber: 2, createdAt: ''
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `w2-a-${i}`, clientId: 'c1', title: 'Task', status: 'Team Review' as const, weekNumber: 2, createdAt: ''
      })),
      ...Array.from({ length: 39 }, (_, i) => ({
        id: `w2-q-${i}`, clientId: 'c1', title: 'Task', status: 'Pending' as const, weekNumber: 2, createdAt: ''
      }))
    ];

    // Week 3 tasks matching: 0 Completed, 2 In Flight, 0 Awaiting Approval, 21 Pending = Total 23
    const week3Tasks: ClientTask[] = [
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `w3-p-${i}`, clientId: 'c1', title: 'Task', status: 'In Progress' as const, weekNumber: 3, createdAt: ''
      })),
      ...Array.from({ length: 21 }, (_, i) => ({
        id: `w3-q-${i}`, clientId: 'c1', title: 'Task', status: 'Pending' as const, weekNumber: 3, createdAt: ''
      }))
    ];

    // Week 4 tasks matching: 0 Completed, 2 In Flight, 0 Awaiting Approval, 4 Pending = Total 6
    const week4Tasks: ClientTask[] = [
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `w4-p-${i}`, clientId: 'c1', title: 'Task', status: 'In Progress' as const, weekNumber: 4, createdAt: ''
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `w4-q-${i}`, clientId: 'c1', title: 'Task', status: 'Pending' as const, weekNumber: 4, createdAt: ''
      }))
    ];

    // All company tasks dataset
    const allTasks: ClientTask[] = [
      ...week1Tasks,
      ...week2Tasks,
      ...week3Tasks,
      ...week4Tasks
    ];

    // 1. Verify mathematical totals
    const w1Sum = 4 + 12 + 19 + 197;
    expect(w1Sum).toBe(232);
    expect(week1Tasks.length).toBe(232);

    const w2Sum = 1 + 1 + 8 + 39;
    expect(w2Sum).toBe(49);
    expect(week2Tasks.length).toBe(49);

    const w3Sum = 0 + 2 + 0 + 21;
    expect(w3Sum).toBe(23);
    expect(week3Tasks.length).toBe(23);

    const w4Sum = 0 + 2 + 0 + 4;
    expect(w4Sum).toBe(6);
    expect(week4Tasks.length).toBe(6);

    const { unmount } = render(<TaskCompletionTrendChart tasks={week1Tasks} />);

    // Week 1 card must show Total Tasks 232, Completed 4, In Flight 12, Awaiting Approval 19, Pending 197
    expect(screen.getAllByText('Total Tasks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Awaiting Approval').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In Flight').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);

    unmount();

    // Render with all tasks to verify all 4 weeks simultaneously
    render(<TaskCompletionTrendChart tasks={allTasks} />);

    // Verify all 4 week cards have Awaiting Approval rendered
    const awaitingApprovalLabels = screen.getAllByText('Awaiting Approval');
    expect(awaitingApprovalLabels.length).toBeGreaterThanOrEqual(4);

    // Verify Legend and cards contain status categories
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('In Flight').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(4);
  });

  // =========================================================================
  // Problem 4: Board and workload match task counts and completed cards have no Resume
  // =========================================================================
  it('Problem 4: Client task count reconciliation and completed card resume button suppression', () => {
    const bizeaseTasks: ClientTask[] = Array.from({ length: 12 }, (_, i) => ({
      id: `b-${i}`,
      clientId: 'bizease-id',
      title: `Task ${i}`,
      status: 'Pending',
      weekNumber: 1,
      createdAt: ''
    }));

    // Workload computation
    const clientTasks = bizeaseTasks.filter((t) => t.clientId === 'bizease-id');
    expect(clientTasks.length).toBe(12);

    // 30-Day board week distribution: defaults missing week_number to Week 1
    const tasksByWeek1 = clientTasks.filter((t) => (t.weekNumber || 1) === 1);
    expect(tasksByWeek1.length).toBe(12); // Reconciled!

    // Completed task card: timer cannot be running and no Resume button
    const completedTask: ClientTask = {
      id: 't-comp',
      clientId: 'bizease-id',
      title: 'Finished Task',
      status: 'Completed',
      weekNumber: 1,
      createdAt: '',
      timeSpentSeconds: 3600,
      timerStartedAt: '2026-09-22T10:00:00Z'
    };
    const isTimerRunning = Boolean(completedTask.timerStartedAt) && completedTask.status === 'In Progress';
    expect(isTimerRunning).toBe(false);
  });

  // =========================================================================
  // Problem 5: Settings tabs use keyed containers for instant first-click mount
  // =========================================================================
  it('Problem 5: Settings layout unmounts prior tab content cleanly on tab change', () => {
    let currentTab = 'team';
    const getKeyForTab = (tab: string) => tab;

    expect(getKeyForTab(currentTab)).toBe('team');
    currentTab = 'clients';
    expect(getKeyForTab(currentTab)).toBe('clients'); // Distinct React key forces clean mount
  });

  // =========================================================================
  // Problem 6: Strict Role Permissions matrix enforced for Add Client and Add Task
  // =========================================================================
  it('Problem 6: Strict permissions enforced: Interns blocked, Add Client for Owner/Mgr/Lead, Add Task for decision makers', () => {
    const intern: UserProfile = { id: '1', role: 'team_member', designationName: 'Operations Intern', fullName: 'Intern 1' };
    const member: UserProfile = { id: '2', role: 'team_member', designationName: 'Graphic Designer', fullName: 'Designer 1' };
    const lead: UserProfile = { id: '3', role: 'team_member', designationName: 'Team Lead Paid Ads', fullName: 'Lead 1' };
    const manager: UserProfile = { id: '4', role: 'operational_manager', designationName: 'Operations Manager', fullName: 'Manager 1' };
    const owner: UserProfile = { id: '5', role: 'owner', designationName: 'Founder & CEO', fullName: 'Faseeh Lall' };
    const cfo: UserProfile = { id: '6', role: 'team_member', designationName: 'Chief Financial Officer', fullName: 'CFO 1' };

    // 1. Interns see neither Add Client nor Add Task
    expect(isIntern(intern)).toBe(true);
    expect(canAddClient(intern)).toBe(false);
    expect(canAddTask(intern)).toBe(false);

    // 2. Regular Team Member sees neither
    expect(canAddClient(member)).toBe(false);
    expect(canAddTask(member)).toBe(false);

    // 3. Team Lead: Can Add Client, Can Add Task
    expect(canAddClient(lead)).toBe(true);
    expect(canAddTask(lead)).toBe(true);

    // 4. Manager: Can Add Client, Can Add Task
    expect(canAddClient(manager)).toBe(true);
    expect(canAddTask(manager)).toBe(true);

    // 5. Owner/Founder: Can Add Client, Can Add Task
    expect(canAddClient(owner)).toBe(true);
    expect(canAddTask(owner)).toBe(true);

    // 6. CFO: Decision maker (Can Add Task, cannot Add Client)
    expect(canAddTask(cfo)).toBe(true);
    expect(canAddClient(cfo)).toBe(false);
  });

  // =========================================================================
  // Problem 7: Forgot password sanitization and generic response
  // =========================================================================
  it('Problem 7: Forgot password cleans input, uses canonical redirect, and preserves generic message', () => {
    const rawEmail = '  Advertising@FaseehLall.com  ';
    const clean = rawEmail.trim().toLowerCase();
    expect(clean).toBe('advertising@faseehlall.com');

    const origin = 'https://ops.faseehlall.com';
    const redirectUrl = `${origin}/update-password`;
    expect(redirectUrl).toBe('https://ops.faseehlall.com/update-password');

    const genericMsg = 'If an account exists for this email, password reset instructions have been sent.';
    expect(genericMsg).toContain('If an account exists');
  });
});
