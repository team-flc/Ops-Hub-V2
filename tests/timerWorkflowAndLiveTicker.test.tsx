/**
 * tests/timerWorkflowAndLiveTicker.test.tsx
 *
 * Tests for:
 * - Automatic task timer (Start = Pending→In Progress + timer start simultaneously)
 * - Pause / Resume timer with separate paused_seconds tracking
 * - Mandatory evidence validation in TaskApprovalModal
 * - LiveActivityTicker portal component (mount fetch + Realtime)
 * - Permission guards and client isolation
 */

import React from 'react';
import {
  describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const {
  mockSupabaseFrom,
  mockRemoveChannel,
  mockStartWork,
  mockPauseTimer,
  mockResumeTimer,
  mockSubmitForApproval,
  mockFetchActiveAnnouncements
} = vi.hoisted(() => {
  const buildChannelChain = () => {
    const chain: any = {
      on: vi.fn(() => chain),
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() }))
    };
    return chain;
  };

  return {
    mockSupabaseFrom: vi.fn(),
    mockRemoveChannel: vi.fn(),
    mockStartWork: vi.fn(),
    mockPauseTimer: vi.fn(),
    mockResumeTimer: vi.fn(),
    mockSubmitForApproval: vi.fn(),
    mockFetchActiveAnnouncements: vi.fn()
  };
});

vi.mock('../src/lib/supabase', () => {
  const buildChannelChain = () => {
    const chain: any = {
      on: vi.fn(() => chain),
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() }))
    };
    return chain;
  };

  return {
    isSupabaseConfigured: true,
    supabase: {
      from: mockSupabaseFrom,
      channel: vi.fn(() => buildChannelChain()),
      removeChannel: mockRemoveChannel
    }
  };
});

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    userProfile: {
      id: 'user-tm-1',
      role: 'team_member',
      fullName: 'Ahmed Khan',
      status: 'active'
    },
    session: { user: { id: 'user-tm-1' } }
  })
}));

vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    startWork: mockStartWork,
    pauseTimer: mockPauseTimer,
    resumeTimer: mockResumeTimer,
    submitForApproval: mockSubmitForApproval,
    fetchActiveAnnouncements: mockFetchActiveAnnouncements,
    fetchClientWeeks: vi.fn().mockResolvedValue({ data: [], error: null }),
    fetchClientTasks: vi.fn().mockResolvedValue({ data: [], error: null }),
    updateKanbanStatus: vi.fn().mockResolvedValue({ error: null })
  },
  validateHttpsLink: (url: string) => {
    if (!url || !url.startsWith('https://')) {
      return { valid: false, error: 'URL must start with https://' };
    }
    return { valid: true, sanitized: url };
  }
}));

// --- Test Data Factories ---

function makeTask(overrides = {}) {
  return {
    id: 'task-1',
    clientId: 'client-abc',
    title: 'Profile Audit',
    status: 'Pending',
    priority: 'High',
    assigneeId: 'user-tm-1',
    assigneeName: 'Ahmed Khan',
    departmentName: 'Operations',
    timeSpentSeconds: 0,
    pausedSeconds: 0,
    timerStartedAt: null,
    evidenceUrl: null,
    completionNotes: null,
    feedback: null,
    weekId: 'week-1',
    weekNumber: 1,
    ...overrides
  };
}

function makeManagerProfile() {
  return {
    id: 'user-mgr-1',
    role: 'operational_manager',
    fullName: 'Sara Manager',
    status: 'active'
  };
}

// --- Import components AFTER mocks ---
import { ClientKanbanCard } from '../src/components/tasks/ClientKanbanCard';
import { TaskApprovalModal } from '../src/components/tasks/TaskApprovalModal';
import { LiveActivityTicker } from '../src/components/portal/LiveActivityTicker';

// Helper to render a minimal ClientKanbanCard with sensible defaults
function renderKanbanCard(task: any, extraProps: Record<string, any> = {}) {
  const onSelectTask = vi.fn();
  const onOpenEditModal = vi.fn();
  const onStatusChange = vi.fn();
  const onStartWork = vi.fn();
  const onPauseTimer = vi.fn();
  const onResumeTimer = vi.fn();
  const onRequestApproval = vi.fn();
  const onRequestFeedback = vi.fn();

  const result = render(
    <ClientKanbanCard
      task={task}
      currentUserProfile={{
        id: 'user-tm-1',
        role: 'team_member',
        fullName: 'Ahmed Khan',
        status: 'active'
      }}
      onSelectTask={onSelectTask}
      onOpenEditModal={onOpenEditModal}
      onStatusChange={onStatusChange}
      onStartWork={onStartWork}
      onPauseTimer={onPauseTimer}
      onResumeTimer={onResumeTimer}
      onRequestApproval={onRequestApproval}
      onRequestFeedback={onRequestFeedback}
      {...extraProps}
    />
  );

  return {
    ...result,
    onSelectTask,
    onOpenEditModal,
    onStatusChange,
    onStartWork,
    onPauseTimer,
    onResumeTimer,
    onRequestApproval,
    onRequestFeedback
  };
}

// ===========================================================================
// Suite 1: Start = Pending→In Progress + timer simultaneously
// ===========================================================================
describe('ClientKanbanCard — Start button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 1: Pending card shows Start button that calls onStartWork (not a separate timer call)', async () => {
    const task = makeTask({ status: 'Pending' });
    const { onStartWork, onStatusChange } = renderKanbanCard(task);

    const startBtn = screen.getByTestId(`start-task-btn-${task.id}`);
    expect(startBtn).toBeTruthy();

    fireEvent.click(startBtn);

    // onStartWork must be called (unified action)
    expect(onStartWork).toHaveBeenCalledOnce();
    expect(onStartWork).toHaveBeenCalledWith(task);
    // onStatusChange must NOT be called separately (they were previously separate)
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('Test 2: In Progress card does NOT show Start button, shows Pause/Resume toggle instead', () => {
    const task = makeTask({ status: 'In Progress', timerStartedAt: new Date().toISOString() });
    renderKanbanCard(task);

    // No Start button on In Progress card
    const startBtn = screen.queryByTestId(`start-task-btn-${task.id}`);
    expect(startBtn).toBeNull();

    // Pause/Resume button IS present
    const timerToggle = screen.getByTestId(`timer-toggle-btn-${task.id}`);
    expect(timerToggle).toBeTruthy();
  });

  it('Test 3: In Progress card — Pause click calls onPauseTimer', () => {
    const task = makeTask({
      status: 'In Progress',
      timerStartedAt: new Date().toISOString(),
      timeSpentSeconds: 120
    });
    const { onPauseTimer, onResumeTimer } = renderKanbanCard(task);

    const timerToggle = screen.getByTestId(`timer-toggle-btn-${task.id}`);
    fireEvent.click(timerToggle);

    expect(onPauseTimer).toHaveBeenCalledOnce();
    expect(onPauseTimer).toHaveBeenCalledWith(task);
    expect(onResumeTimer).not.toHaveBeenCalled();
  });

  it('Test 4: In Progress card (paused) — Resume click calls onResumeTimer', () => {
    const task = makeTask({
      status: 'In Progress',
      timerStartedAt: null,
      timeSpentSeconds: 120,
      pausedSeconds: 60
    });
    const { onPauseTimer, onResumeTimer } = renderKanbanCard(task);

    const timerToggle = screen.getByTestId(`timer-toggle-btn-${task.id}`);
    fireEvent.click(timerToggle);

    expect(onResumeTimer).toHaveBeenCalledOnce();
    expect(onResumeTimer).toHaveBeenCalledWith(task);
    expect(onPauseTimer).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Suite 2: Approval card — Work Completed display
// ===========================================================================
describe('ClientKanbanCard — Approval state display', () => {
  it('Test 5: Approval card shows "Work Completed" with time and paused time', () => {
    const task = makeTask({
      status: 'Approval',
      timerStartedAt: null,
      timeSpentSeconds: 3720,   // 1h 2m
      pausedSeconds: 300,       // 5m
      evidenceUrl: 'https://drive.google.com/xyz'
    });
    renderKanbanCard(task);

    expect(screen.getByText('Work Completed')).toBeTruthy();
    // Duration should show "1h 2m" or similar
    const container = screen.getByText(/Completed in:/i);
    expect(container).toBeTruthy();
    expect(container.textContent).toContain('1h');
  });

  it('Test 6: Only Owner/Manager sees Approve button on Approval card', () => {
    const task = makeTask({ status: 'Approval' });

    // Render as team member
    renderKanbanCard(task);
    const approveBtn = screen.queryByTestId(`approve-task-btn-${task.id}`);
    expect(approveBtn).toBeNull();

    // Re-render as manager
    const { unmount } = renderKanbanCard(task, {
      currentUserProfile: makeManagerProfile()
    });
    const approveBtnMgr = screen.queryByTestId(`approve-task-btn-${task.id}`);
    expect(approveBtnMgr).toBeTruthy();
    unmount();
  });
});

// ===========================================================================
// Suite 3: TaskApprovalModal — Mandatory evidence validation
// ===========================================================================
describe('TaskApprovalModal — mandatory evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 7: Blocked when both URL and notes are empty', async () => {
    const task = makeTask({ status: 'In Progress', timerStartedAt: null, timeSpentSeconds: 60 });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <TaskApprovalModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        task={task}
      />
    );

    // Both fields empty — click submit
    const submitBtn = screen.getByTestId('submit-approval-confirm-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const errorEl = screen.getByTestId('evidence-required-error');
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent?.toLowerCase()).toContain('at least');
    });

    // onSubmit must NOT have been called
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Test 8: Submission unblocked when only completion notes provided', async () => {
    const task = makeTask({ status: 'In Progress', timerStartedAt: null, timeSpentSeconds: 60 });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <TaskApprovalModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        task={task}
      />
    );

    const notesField = screen.getByTestId('completion-notes-input');
    fireEvent.change(notesField, { target: { value: 'All deliverables completed and reviewed.' } });

    const submitBtn = screen.getByTestId('submit-approval-confirm-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    const callArg = onSubmit.mock.calls[0][0];
    expect(callArg.completionNotes).toBe('All deliverables completed and reviewed.');
    expect(callArg.evidenceUrl).toBeUndefined();
  });

  it('Test 9: Submission unblocked when only evidence URL provided', async () => {
    const task = makeTask({ status: 'In Progress', timerStartedAt: null, timeSpentSeconds: 60 });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <TaskApprovalModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        task={task}
      />
    );

    const urlField = screen.getByTestId('evidence-url-input');
    fireEvent.change(urlField, { target: { value: 'https://drive.google.com/file/xyz' } });

    const submitBtn = screen.getByTestId('submit-approval-confirm-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    const callArg = onSubmit.mock.calls[0][0];
    expect(callArg.evidenceUrl).toBe('https://drive.google.com/file/xyz');
    expect(callArg.completionNotes).toBeUndefined();
  });
});

// ===========================================================================
// Suite 4: LiveActivityTicker
// ===========================================================================
describe('LiveActivityTicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 10: Hidden when no active announcements', async () => {
    mockFetchActiveAnnouncements.mockResolvedValue({ data: [], error: null });

    render(<LiveActivityTicker clientId="client-abc" testId="ticker" />);

    await waitFor(() => {
      expect(mockFetchActiveAnnouncements).toHaveBeenCalledWith('client-abc');
    });

    // Ticker bar should not be in the DOM
    const ticker = screen.queryByTestId('ticker');
    expect(ticker).toBeNull();
  });

  it('Test 11: Renders ticker with announcement message on mount (reload recovery)', async () => {
    mockFetchActiveAnnouncements.mockResolvedValue({
      data: [
        {
          id: 'ann-1',
          clientId: 'client-abc',
          taskId: 'task-1',
          message: 'Ahmed Khan and his team is working on Profile Audit',
          teamMemberId: 'user-tm-1',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      error: null
    });

    render(<LiveActivityTicker clientId="client-abc" testId="ticker" />);

    await waitFor(() => {
      const ticker = screen.queryByTestId('ticker');
      expect(ticker).toBeTruthy();
    });

    const tickerText = screen.getByTestId('ticker-text');
    expect(tickerText.textContent).toContain('Ahmed Khan and his team is working on Profile Audit');
  });

  it('Test 12: Client isolation — fetch called with correct clientId', async () => {
    mockFetchActiveAnnouncements.mockResolvedValue({ data: [], error: null });

    render(<LiveActivityTicker clientId="client-xyz-different" testId="ticker-xyz" />);

    await waitFor(() => {
      expect(mockFetchActiveAnnouncements).toHaveBeenCalledWith('client-xyz-different');
    });

    // Should not be called with any other clientId
    const allCalls = mockFetchActiveAnnouncements.mock.calls;
    expect(allCalls.every((c: any[]) => c[0] === 'client-xyz-different')).toBe(true);
  });

  it('Test 13: Ticker never shows internal fields (evidenceUrl, completionNotes, timer seconds)', async () => {
    mockFetchActiveAnnouncements.mockResolvedValue({
      data: [
        {
          id: 'ann-2',
          clientId: 'client-abc',
          taskId: 'task-2',
          // Message is ONLY the safe announcement text, not internal details
          message: 'Ahmed Khan and his team is working on Landing Page',
          teamMemberId: 'user-tm-1',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      error: null
    });

    render(<LiveActivityTicker clientId="client-abc" testId="ticker-safe" />);

    await waitFor(() => {
      const ticker = screen.queryByTestId('ticker-safe');
      expect(ticker).toBeTruthy();
    });

    const tickerText = screen.getByTestId('ticker-safe-text');
    // Must NOT contain evidence URL patterns, notes, or seconds count
    expect(tickerText.textContent).not.toContain('https://drive');
    expect(tickerText.textContent).not.toContain('3600');
    expect(tickerText.textContent).not.toContain('completion_notes');
    expect(tickerText.textContent).toContain('Ahmed Khan and his team is working on Landing Page');
  });
});

// ===========================================================================
// Suite 5: Permission checks for Done status
// ===========================================================================
describe('ClientKanbanCard — Done permission guard', () => {
  it('Test 14: Approval card — team member does NOT see Approve button', () => {
    const task = makeTask({ status: 'Approval' });
    renderKanbanCard(task, {
      currentUserProfile: { id: 'user-tm-1', role: 'team_member', fullName: 'Ahmed', status: 'active' }
    });

    const approveBtn = screen.queryByTestId(`approve-task-btn-${task.id}`);
    expect(approveBtn).toBeNull();
  });

  it('Test 15: Approval card — manager sees Approve button and can call onStatusChange(Done)', () => {
    const task = makeTask({ status: 'Approval' });
    const { onStatusChange } = renderKanbanCard(task, {
      currentUserProfile: makeManagerProfile()
    });

    const approveBtn = screen.getByTestId(`approve-task-btn-${task.id}`);
    fireEvent.click(approveBtn);

    expect(onStatusChange).toHaveBeenCalledOnce();
    expect(onStatusChange).toHaveBeenCalledWith(task, 'Done');
  });
});

// ===========================================================================
// Suite 6: Submit for Approval button on In Progress card
// ===========================================================================
describe('ClientKanbanCard — Submit for Approval button', () => {
  it('Test 16: In Progress card shows Submit button that opens approval modal', () => {
    const task = makeTask({ status: 'In Progress' });
    const { onRequestApproval } = renderKanbanCard(task);

    const submitBtn = screen.getByTestId(`submit-approval-btn-${task.id}`);
    expect(submitBtn).toBeTruthy();

    fireEvent.click(submitBtn);
    expect(onRequestApproval).toHaveBeenCalledOnce();
    expect(onRequestApproval).toHaveBeenCalledWith(task);
  });

  it('Test 17: No Stop Timer button present on In Progress card', () => {
    const task = makeTask({ status: 'In Progress', timerStartedAt: new Date().toISOString() });
    renderKanbanCard(task);

    // Should have timer-toggle (pause/resume) but NO separate stop-timer button
    const stopBtn = screen.queryByTitle(/stop timer/i);
    expect(stopBtn).toBeNull();
  });
});
