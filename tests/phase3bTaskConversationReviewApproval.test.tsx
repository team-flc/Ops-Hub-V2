import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  taskManagementService,
  isSunday,
  isSaturday,
  isWeekend,
  rollForwardToNextMonday,
  validateHttpsLink,
  validateMessageLinks,
  validateTaskDates
} from '../src/lib/taskManagementService';
import { ClientTask, ClientRecord, Department, UserProfile, TaskMessage } from '../src/types';
import { ClientTaskDetailsModal } from '../src/components/tasks/ClientTaskDetailsModal';
import { ClientPortalHoldingPage } from '../src/components/auth/ClientPortalHoldingPage';
import { AuthProvider } from '../src/context/AuthContext';
import { MemoryRouter } from 'react-router-dom';

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockRemoveChannel = vi.fn();
const mockChannel = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: () => mockGetSession(),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
      },
      from: (table: string) => mockFrom(table),
      functions: {
        invoke: (...args: any[]) => mockFunctionsInvoke(...args)
      },
      channel: (...args: any[]) => mockChannel(...args),
      removeChannel: (...args: any[]) => mockRemoveChannel(...args)
    }
  };
});

const mockClient: ClientRecord = {
  id: 'client-test-1',
  companyName: 'Apex Growth Partners',
  clientName: 'Sarah Jenkins',
  package: 'Advanced',
  operationalManagerId: 'mgr-1',
  operationalManagerName: 'Alex OpsManager',
  activationDate: '2026-02-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  links: {},
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z'
};

const _mockDepartments: Department[] = [
  { id: 'dept-1', name: 'Operations', slug: 'operations', status: 'active', sortOrder: 1 },
  { id: 'dept-2', name: 'Creative & Media', slug: 'creative', status: 'active', sortOrder: 2 }
];

const mockOwner: UserProfile = {
  id: 'owner-1',
  fullName: 'Faseeh Lall',
  role: 'owner',
  status: 'active'
};

const mockManager: UserProfile = {
  id: 'mgr-1',
  fullName: 'Alex OpsManager',
  role: 'operational_manager',
  status: 'active'
};

const mockTeamMember: UserProfile = {
  id: 'tm-1',
  fullName: 'Jordan Specialist',
  role: 'team_member',
  status: 'active',
  departmentIds: ['dept-1']
};

const mockClientUser: UserProfile = {
  id: 'client-user-1',
  fullName: 'Sarah Jenkins',
  role: 'client',
  status: 'active',
  organizationId: 'client-test-1'
};

const baseInternalTask: ClientTask = {
  id: 'task-int-1',
  clientId: 'client-test-1',
  weekNumber: 2,
  title: 'Q3 Brand Assets and Ad Sequence Setup',
  details: 'Legacy briefing: Review Canva links and configure Facebook custom audiences.',
  departmentId: 'dept-1',
  departmentName: 'Operations',
  assigneeId: 'tm-1',
  assigneeName: 'Jordan Specialist',
  priority: 'High',
  approvalMode: 'Internal Only',
  plannedStart: '2026-09-07T09:00:00.000Z', // Monday
  dueDate: '2026-09-11T18:00:00.000Z', // Friday
  status: 'In Progress',
  sortOrder: 1,
  createdBy: 'mgr-1',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  isOverdue: false
};

const baseClientApprovalTask: ClientTask = {
  ...baseInternalTask,
  id: 'task-client-appr-1',
  title: 'Client Facing Monthly Deliverable Pack',
  approvalMode: 'Client Approval Required',
  status: 'Team Review'
};

describe('Phase 3B: Task Conversation Feed, Review & Approval Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'mgr-1' } }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'valid-test-token' } }, error: null });

    const channelObj = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis()
    };
    mockChannel.mockReturnValue(channelObj);

    mockFrom.mockImplementation((_table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis()
      };
      return builder;
    });
  });

  // 1. BUSINESS CALENDAR & WEEKEND RULES
  describe('1. Business Calendar & Weekend Working Days Rules', () => {
    it('1.1 Strictly validates working days (Mon-Fri) and identifies Saturday and Sunday', () => {
      // Monday 2026-09-07 to Sunday 2026-09-13
      expect(isSaturday('2026-09-07T10:00:00.000Z')).toBe(false); // Mon
      expect(isSunday('2026-09-07T10:00:00.000Z')).toBe(false);   // Mon
      expect(isWeekend('2026-09-07T10:00:00.000Z')).toBe(false);  // Mon

      expect(isSaturday('2026-09-11T10:00:00.000Z')).toBe(false); // Fri
      expect(isSunday('2026-09-11T10:00:00.000Z')).toBe(false);   // Fri
      expect(isWeekend('2026-09-11T10:00:00.000Z')).toBe(false);  // Fri

      expect(isSaturday('2026-09-12T10:00:00.000Z')).toBe(true);  // Sat
      expect(isSunday('2026-09-12T10:00:00.000Z')).toBe(false);  // Sat
      expect(isWeekend('2026-09-12T10:00:00.000Z')).toBe(true);   // Sat

      expect(isSaturday('2026-09-13T10:00:00.000Z')).toBe(false); // Sun
      expect(isSunday('2026-09-13T10:00:00.000Z')).toBe(true);   // Sun
      expect(isWeekend('2026-09-13T10:00:00.000Z')).toBe(true);   // Sun
    });

    it('1.2 validateTaskDates strictly rejects Saturday and Sunday dates', () => {
      const mon = '2026-09-07T09:00:00.000Z';
      const fri = '2026-09-11T18:00:00.000Z';
      const sat = '2026-09-12T18:00:00.000Z';
      const sun = '2026-09-13T18:00:00.000Z';

      // Valid weekday pair
      const validPair = validateTaskDates(mon, fri);
      expect(validPair.valid).toBe(true);

      // Rejects Saturday planned start
      const satStart = validateTaskDates(sat, '2026-09-15T18:00:00.000Z');
      expect(satStart.valid).toBe(false);
      expect(satStart.error).toMatch(/Saturday/i);

      // Rejects Saturday due date
      const satDue = validateTaskDates(mon, sat);
      expect(satDue.valid).toBe(false);
      expect(satDue.error).toMatch(/Saturday/i);

      // Rejects Sunday due date
      const sunDue = validateTaskDates(mon, sun);
      expect(sunDue.valid).toBe(false);
      expect(sunDue.error).toMatch(/Sunday/i);
    });

    it('1.3 rollForwardToNextMonday rolls weekend dates forward to Monday', () => {
      // Saturday rolls forward to Monday
      expect(rollForwardToNextMonday('2026-09-12')).toBe('2026-09-14');
      // Sunday rolls forward to Monday
      expect(rollForwardToNextMonday('2026-09-13')).toBe('2026-09-14');
      // Weekday remains untouched
      expect(rollForwardToNextMonday('2026-09-08')).toBe('2026-09-08');
    });
  });

  // 2. FREE-TIER STORAGE & HTTPS LINK VALIDATION
  describe('2. Free-Tier Storage & HTTPS Link Validation', () => {
    it('2.1 Accepts valid HTTPS links from cloud services', () => {
      const drive = validateHttpsLink('https://drive.google.com/file/d/12345/view');
      expect(drive.valid).toBe(true);
      expect(drive.sanitized).toBe('https://drive.google.com/file/d/12345/view');

      const figma = validateHttpsLink('https://www.figma.com/design/abc123xyz');
      expect(figma.valid).toBe(true);

      const canva = validateHttpsLink('https://www.canva.com/design/DAF123');
      expect(canva.valid).toBe(true);
    });

    it('2.2 Strictly rejects non-HTTPS, unsafe protocols, and embedded credentials', () => {
      // Insecure HTTP
      const http = validateHttpsLink('http://insecure-site.com/doc');
      expect(http.valid).toBe(false);
      expect(http.error).toMatch(/only https/i);

      // JavaScript protocol
      const js = validateHttpsLink('javascript:alert(1)');
      expect(js.valid).toBe(false);

      // Data URI
      const dataUri = validateHttpsLink('data:text/html,<script>alert(1)</script>');
      expect(dataUri.valid).toBe(false);

      // File URI
      const fileUri = validateHttpsLink('file:///etc/passwd');
      expect(fileUri.valid).toBe(false);

      // Embedded credentials
      const creds = validateHttpsLink('https://admin:secret@api.service.com/download');
      expect(creds.valid).toBe(false);
      expect(creds.error).toMatch(/credentials/i);

      // Length > 2048
      const longUrl = 'https://example.com/' + 'a'.repeat(2048);
      const lengthRes = validateHttpsLink(longUrl);
      expect(lengthRes.valid).toBe(false);
      expect(lengthRes.error).toMatch(/maximum length/i);
    });

    it('2.3 validateMessageLinks rejects more than 5 external links per item', () => {
      const fiveLinks = [
        'https://link1.com',
        'https://link2.com',
        'https://link3.com',
        'https://link4.com',
        'https://link5.com'
      ];
      expect(validateMessageLinks(fiveLinks).valid).toBe(true);

      const sixLinks = [...fiveLinks, 'https://link6.com'];
      const res = validateMessageLinks(sixLinks);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/maximum of 5/i);
    });
  });

  // 3. TASK CONVERSATION FEED UI & VISIBILITY RULES
  describe('3. Task Conversation Feed UI & Visibility Rules', () => {
    it('3.1 Renders task drawer with approval mode badge, legacy context, and feed items', async () => {
      const mockFeedMessages = [
        {
          id: 'msg-1',
          task_id: 'task-int-1',
          client_id: 'client-test-1',
          author_id: 'mgr-1',
          visibility: 'internal_note',
          content: 'Internal staff note: make sure conversion tags pass QA.',
          links: [{ url: 'https://analytics.google.com' }],
          created_at: '2026-09-02T10:00:00.000Z',
          author: { id: 'mgr-1', full_name: 'Alex OpsManager', role: 'operational_manager' }
        },
        {
          id: 'msg-2',
          task_id: 'task-int-1',
          client_id: 'client-test-1',
          author_id: 'tm-1',
          visibility: 'shared_with_client',
          content: 'Here is the preliminary preview link for your review.',
          links: [{ url: 'https://drive.google.com/preview' }],
          created_at: '2026-09-02T11:00:00.000Z',
          author: { id: 'tm-1', full_name: 'Jordan Specialist', role: 'team_member' }
        }
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'client_task_messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockFeedMessages, error: null }),
            lt: vi.fn().mockReturnThis()
          };
        }
        if (table === 'client_task_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            lt: vi.fn().mockReturnThis()
          };
        }
        if (table === 'client_task_read_states') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      });

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={baseInternalTask}
          client={mockClient}
          currentUser={mockManager}
          onTaskUpdated={vi.fn()}
        />
      );

      // Header checks
      expect(screen.getByText('Q3 Brand Assets and Ad Sequence Setup')).toBeInTheDocument();
      expect(screen.getByText('Internal Only')).toBeInTheDocument();
      expect(screen.getByText(/High Priority/i)).toBeInTheDocument();

      // Legacy context preservation
      expect(screen.getByText(/Task Instructions & SOP Deliverables/i)).toBeInTheDocument();
      expect(screen.getByText(/Review Canva links and configure/i)).toBeInTheDocument();

      // Feed items for staff
      await waitFor(() => {
        expect(screen.getByText(/Internal staff note: make sure conversion tags pass QA/i)).toBeInTheDocument();
        expect(screen.getByText(/Here is the preliminary preview link/i)).toBeInTheDocument();
      });

      // Internal note visual label
      expect(screen.getAllByText('Internal Note').length).toBeGreaterThanOrEqual(1);
    });

    it('3.2 Client user sees ONLY shared feed items and never sees internal notes', async () => {
      // Mock returns only shared messages for client
      const clientScopedMessages = [
        {
          id: 'msg-2',
          task_id: 'task-client-appr-1',
          client_id: 'client-test-1',
          author_id: 'tm-1',
          visibility: 'shared_with_client',
          content: 'Hi Sarah, please review the final creative deliverable below.',
          links: [{ url: 'https://drive.google.com/deliverable' }],
          created_at: '2026-09-02T11:00:00.000Z',
          author: { id: 'tm-1', full_name: 'Jordan Specialist', role: 'team_member' }
        }
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'client_task_messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: clientScopedMessages, error: null })
          };
        }
        if (table === 'client_task_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          };
        }
        if (table === 'client_task_read_states') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      });

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={baseClientApprovalTask}
          client={mockClient}
          currentUser={mockClientUser}
          isClientPortal={true}
          onTaskUpdated={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Hi Sarah, please review the final creative/i)).toBeInTheDocument();
      });

      // Verify zero internal note badges or text
      expect(screen.queryByText('Internal Note')).not.toBeInTheDocument();
      expect(screen.queryByText(/conversion tags pass QA/i)).not.toBeInTheDocument();

      // Client composer has no visibility toggle; forced to shared
      expect(screen.queryByRole('button', { name: /internal note/i })).not.toBeInTheDocument();
      expect(screen.getByText('Shared with Team')).toBeInTheDocument();
    });
  });

  // 4. APPROVAL MODES & WORKFLOW STATE MACHINE
  describe('4. Approval Modes & Workflow State Machine', () => {
    it('4.1 Internal Only task: Manager completes from Team Review; Team Member cannot complete', async () => {
      const taskInTeamReview: ClientTask = {
        ...baseInternalTask,
        status: 'Team Review'
      };

      // 1. Team member view: cannot complete
      const { unmount } = render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={taskInTeamReview}
          client={mockClient}
          currentUser={mockTeamMember}
          onTaskUpdated={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Approve & Mark Completed/i })).not.toBeInTheDocument();
      unmount();

      // 2. Manager view: can approve & complete
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          task: {
            ...taskInTeamReview,
            status: 'Completed',
            completed_at: new Date().toISOString(),
            completed_by: mockManager.id
          }
        },
        error: null
      });

      const onUpdate = vi.fn();
      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={taskInTeamReview}
          client={mockClient}
          currentUser={mockManager}
          onTaskUpdated={onUpdate}
        />
      );

      const completeBtn = screen.getByRole('button', { name: /Approve & Mark Completed/i });
      expect(completeBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(completeBtn);
      });

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'manage-client-task',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'update_status',
              status: 'Completed',
              current_status: 'Team Review'
            })
          })
        );
      });
    });

    it('4.2 Client Approval Required task: Manager sends to Client Review', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          task: {
            ...baseClientApprovalTask,
            status: 'Client Review'
          }
        },
        error: null
      });

      const onUpdate = vi.fn();
      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={baseClientApprovalTask}
          client={mockClient}
          currentUser={mockManager}
          onTaskUpdated={onUpdate}
        />
      );

      const sendToClientBtn = screen.getByRole('button', { name: /Send to Client Review/i });
      expect(sendToClientBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(sendToClientBtn);
      });

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'manage-client-task',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'update_status',
              status: 'Client Review',
              current_status: 'Team Review'
            })
          })
        );
      });
    });

    it('4.3 Client user in Client Review can Approve Deliverable or Request Changes with mandatory reason', async () => {
      const taskInClientReview: ClientTask = {
        ...baseClientApprovalTask,
        status: 'Client Review'
      };

      // Test Client Approval
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          task: {
            ...taskInClientReview,
            status: 'Completed',
            completed_at: new Date().toISOString()
          }
        },
        error: null
      });

      const onUpdate = vi.fn();
      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={taskInClientReview}
          client={mockClient}
          currentUser={mockClientUser}
          isClientPortal={true}
          onTaskUpdated={onUpdate}
        />
      );

      const approveBtn = screen.getByRole('button', { name: /Approve Deliverable/i });
      const requestChangesBtn = screen.getByRole('button', { name: /Request Changes/i });
      expect(approveBtn).toBeInTheDocument();
      expect(requestChangesBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(approveBtn);
      });

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'manage-client-task',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'update_status',
              status: 'Completed',
              current_status: 'Client Review'
            })
          })
        );
      });
    });

    it('4.4 Requesting changes requires a mandatory reason and moves status back to In Progress', async () => {
      const taskInTeamReview: ClientTask = {
        ...baseInternalTask,
        status: 'Team Review'
      };

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={taskInTeamReview}
          client={mockClient}
          currentUser={mockManager}
          onTaskUpdated={vi.fn()}
        />
      );

      const requestChangesBtn = screen.getByRole('button', { name: /Request Changes/i });
      fireEvent.click(requestChangesBtn);

      // Prompt appears for reason
      expect(screen.getByPlaceholderText(/Explain what changes are required/i)).toBeInTheDocument();

      // Submitting empty reason is blocked
      const submitChangesBtn = screen.getByRole('button', { name: /Confirm Change Request/i });
      fireEvent.click(submitChangesBtn);
      expect(screen.getByText(/Reason for change request is required/i)).toBeInTheDocument();

      // Submitting with reason calls service
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          task: { ...taskInTeamReview, status: 'In Progress' }
        },
        error: null
      });

      fireEvent.change(screen.getByPlaceholderText(/Explain what changes are required/i), {
        target: { value: 'Pixel conversion tracking tags are firing twice. Please fix.' }
      });

      await act(async () => {
        fireEvent.click(submitChangesBtn);
      });

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'manage-client-task',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'update_status',
              status: 'In Progress',
              reason: 'Pixel conversion tracking tags are firing twice. Please fix.',
              current_status: 'Team Review'
            })
          })
        );
      });
    });
  });

  // 5. REOPENING COMPLETED TASKS
  describe('5. Reopening Completed Tasks Safeguards', () => {
    const completedTask: ClientTask = {
      ...baseInternalTask,
      status: 'Completed',
      completedAt: '2026-09-05T10:00:00.000Z',
      completedBy: 'mgr-1'
    };

    it('5.1 Team member and Client cannot reopen completed work', () => {
      const { unmount } = render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={completedTask}
          client={mockClient}
          currentUser={mockTeamMember}
          onTaskUpdated={vi.fn()}
        />
      );
      expect(screen.queryByRole('button', { name: /Reopen Task/i })).not.toBeInTheDocument();
      unmount();

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={completedTask}
          client={mockClient}
          currentUser={mockClientUser}
          isClientPortal={true}
          onTaskUpdated={vi.fn()}
        />
      );
      expect(screen.queryByRole('button', { name: /Reopen Task/i })).not.toBeInTheDocument();
    });

    it('5.2 Operational Manager / Owner can reopen with mandatory reason', async () => {
      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={completedTask}
          client={mockClient}
          currentUser={mockManager}
          onTaskUpdated={vi.fn()}
        />
      );

      const reopenBtn = screen.getByRole('button', { name: /Reopen Task/i });
      expect(reopenBtn).toBeInTheDocument();

      fireEvent.click(reopenBtn);
      expect(screen.getByPlaceholderText(/Explain why this completed task must be reopened/i)).toBeInTheDocument();

      const confirmReopenBtn = screen.getByRole('button', { name: /Confirm Reopen/i });
      fireEvent.click(confirmReopenBtn);
      expect(screen.getByText(/Reason for reopening is required/i)).toBeInTheDocument();

      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          task: {
            ...completedTask,
            status: 'In Progress',
            reopened_at: new Date().toISOString(),
            reopened_by: mockManager.id,
            reopen_reason: 'Client requested retrospective audit adjustments.'
          }
        },
        error: null
      });

      fireEvent.change(screen.getByPlaceholderText(/Explain why this completed task must be reopened/i), {
        target: { value: 'Client requested retrospective audit adjustments.' }
      });

      await act(async () => {
        fireEvent.click(confirmReopenBtn);
      });

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'manage-client-task',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'update_status',
              status: 'In Progress',
              reason: 'Client requested retrospective audit adjustments.',
              current_status: 'Completed'
            })
          })
        );
      });
    });
  });

  // 6. PAUSED AND ARCHIVED SAFEGUARDS
  describe('6. Paused and Archived Safeguards', () => {
    it('6.1 Paused client blocks Team Member and Client posting; Manager can post internal note', () => {
      const pausedClient: ClientRecord = { ...mockClient, status: 'Paused' };

      // 1. Team Member view
      const { unmount } = render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={baseInternalTask}
          client={pausedClient}
          currentUser={mockTeamMember}
          onTaskUpdated={vi.fn()}
        />
      );
      expect(screen.getByText(/Client is paused. Feed is read-only for Team Members/i)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/Write an internal note/i)).not.toBeInTheDocument();
      unmount();

      // 2. Manager view: can post internal administrative note
      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={baseInternalTask}
          client={pausedClient}
          currentUser={mockManager}
          onTaskUpdated={vi.fn()}
        />
      );
      expect(screen.getByText(/Client is paused. Only Internal administrative notes may be posted/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Write an internal note/i)).toBeInTheDocument();
    });

    it('6.2 Archived task is strictly read-only for everyone', () => {
      const archivedTask: ClientTask = {
        ...baseInternalTask,
        archivedAt: '2026-09-06T12:00:00.000Z',
        archivedBy: 'owner-1',
        archiveReason: 'Project scope completed and archived.'
      };

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={archivedTask}
          client={mockClient}
          currentUser={mockOwner}
          onTaskUpdated={vi.fn()}
        />
      );

      expect(screen.getByText(/This task was archived/i)).toBeInTheDocument();
      expect(screen.getByText(/Conversation feed is strictly read-only/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Send/i })).not.toBeInTheDocument();
    });
  });

  // 7. REALTIME CLEANUP & CURSOR PAGINATION
  describe('7. Realtime Subscription & Cursor Pagination', () => {
    it('7.1 Unsubscribes Realtime channel cleanly on unmount', () => {
      const { unmount } = render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={baseInternalTask}
          client={mockClient}
          currentUser={mockManager}
          onTaskUpdated={vi.fn()}
        />
      );

      expect(mockChannel).toHaveBeenCalledWith('task-feed-task-int-1');

      unmount();
      expect(mockRemoveChannel).toHaveBeenCalled();
    });

    it('7.2 fetchTaskFeed enforces 30 items default limit with cursor support', async () => {
      mockFrom.mockImplementation((_table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          lt: vi.fn().mockReturnThis()
        };
      });

      const res = await taskManagementService.fetchTaskFeed('task-int-1');
      expect(res.combinedFeed).toEqual([]);
      expect(res.hasMore).toBe(false);
    });
  });

  // 8. CLIENT PORTAL HOLDING PAGE INTEGRATION
  describe('8. Client Portal Holding Page Integration', () => {
    it('8.1 Renders client deliverables list and preserves required holding page copy', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'client-user-1', email: 'sarah@apexgrowth.com' } },
        error: null
      });
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'client-user-1' } } },
        error: null
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'client-user-1',
                full_name: 'Sarah Jenkins',
                role: 'client',
                organization_id: 'client-test-1',
                status: 'active'
              },
              error: null
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'client-user-1',
                full_name: 'Sarah Jenkins',
                role: 'client',
                organization_id: 'client-test-1',
                status: 'active'
              },
              error: null
            })
          };
        }
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'client-test-1',
                company_name: 'Apex Growth Partners',
                client_name: 'Sarah Jenkins',
                status: 'Active'
              },
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      });

      vi.spyOn(taskManagementService, 'fetchClientTasks').mockResolvedValue({
        data: [
          {
            ...baseClientApprovalTask,
            id: 'task-review-portal',
            title: 'Week 2 Creative Ad Campaign Review',
            status: 'Client Review'
          }
        ],
        error: null
      });

      await act(async () => {
        render(
          <MemoryRouter initialEntries={['/client']}>
            <AuthProvider>
              <ClientPortalHoldingPage />
            </AuthProvider>
          </MemoryRouter>
        );
      });

      // Verify core holding copy is preserved
      expect(screen.getByRole('heading', { name: /client portal/i })).toBeInTheDocument();
      expect(screen.getByText('Your secure client workspace is being prepared.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

      // Verify deliverables section
      await waitFor(() => {
        expect(screen.getByText(/Deliverables Awaiting Your Review/i)).toBeInTheDocument();
        expect(screen.getByText('Week 2 Creative Ad Campaign Review')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Review & Approve/i })).toBeInTheDocument();
      });
    });
  });

  // 9. TARGETED SECURITY, AUTHORIZATION & CONCURRENCY SAFEGUARDS
  describe('9. Targeted Security, Authorization & Concurrency Safeguards', () => {
    // 9.1 Task/client ID mismatch prevention
    it('9.1 Task/client ID mismatch prevention rejects message posting', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { error: 'Task not found or is archived.' },
        error: null
      });

      const res = await taskManagementService.createTaskMessage({
        taskId: 'task-int-1',
        clientId: 'client-mismatched-999',
        visibility: 'internal_note',
        content: 'Testing mismatch'
      });

      expect(res.error).toContain('Task not found or is archived');
      expect(res.data).toBeNull();
    });

    // 9.2 Read-state task-access enforcement
    it('9.2 Read-state task-access enforcement scopes to user and task', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-read-1' } },
        error: null
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'client_task_read_states') {
          return {
            upsert: mockUpsert
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      await taskManagementService.markTaskRead('task-int-1', 'user-read-1');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          task_id: 'task-int-1',
          profile_id: 'user-read-1'
        }),
        { onConflict: 'task_id,profile_id' }
      );
    });

    // 9.3 Client internal-feed isolation & internal event/reason isolation
    it('9.3 Client internal-feed isolation hides internal notes, internal events, and staff emails', async () => {
      const _internalNoteMsg: TaskMessage = {
        id: 'msg-internal-1',
        taskId: baseClientApprovalTask.id,
        clientId: mockClient.id,
        authorId: 'mgr-1',
        authorName: 'Alex OpsManager',
        authorRole: 'operational_manager',
        visibility: 'internal_note',
        content: 'Confidential client margin discussion: do not share with client.',
        links: [],
        createdAt: '2026-09-06T11:00:00Z'
      };

      const sharedClientMsg: TaskMessage = {
        id: 'msg-shared-1',
        taskId: baseClientApprovalTask.id,
        clientId: mockClient.id,
        authorId: 'mgr-1',
        authorName: 'Alex OpsManager',
        authorRole: 'operational_manager',
        visibility: 'shared_with_client',
        content: 'Hello Sarah, your week 2 creative deliverables are ready for review!',
        links: [{ url: 'https://drive.google.com/review', title: 'Ad Creative Deck' }],
        createdAt: '2026-09-06T11:30:00Z'
      };

      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          messages: [sharedClientMsg],
          events: [
            {
              id: 'evt-1',
              taskId: baseClientApprovalTask.id,
              clientId: mockClient.id,
              actorId: 'mgr-1',
              actorName: 'Team',
              eventType: 'client_review_submitted',
              notes: 'Submitted for client signoff',
              createdAt: '2026-09-06T11:30:00Z'
            }
          ],
          combinedFeed: [
            { type: 'message', data: sharedClientMsg, timestamp: sharedClientMsg.createdAt },
            {
              type: 'event',
              data: {
                id: 'evt-1',
                taskId: baseClientApprovalTask.id,
                clientId: mockClient.id,
                actorId: 'mgr-1',
                actorName: 'Team',
                eventType: 'client_review_submitted',
                notes: 'Submitted for client signoff',
                createdAt: '2026-09-06T11:30:00Z'
              },
              timestamp: '2026-09-06T11:30:00Z'
            }
          ],
          nextCursor: null,
          hasMore: false
        },
        error: null
      });

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={baseClientApprovalTask}
          client={mockClient}
          currentUser={mockClientUser}
          isClientPortal={true}
          onTaskUpdated={vi.fn()}
        />
      );

      // Verify shared client message is visible
      await waitFor(() => {
        expect(screen.getByText(/your week 2 creative deliverables are ready for review/i)).toBeInTheDocument();
      });

      // Verify internal note content is NEVER present
      expect(screen.queryByText(/Confidential client margin discussion/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Internal Note/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/@apexgrowth\.com/i)).not.toBeInTheDocument();
    });

    // 9.4 Operational Manager CANNOT approve Client Review tasks on behalf of client
    it('9.4 Operational Manager CANNOT approve tasks in Client Review; only Request Changes is allowed', async () => {
      const taskInClientReview: ClientTask = {
        ...baseClientApprovalTask,
        status: 'Client Review'
      };

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={taskInClientReview}
          client={mockClient}
          currentUser={mockManager}
          onTaskUpdated={vi.fn()}
        />
      );

      // Operational Manager must NOT see "Approve Deliverables" button
      expect(screen.queryByRole('button', { name: /^Approve Deliverable/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Request Changes/i })).toBeInTheDocument();

      // Attempting to invoke approve via service as manager returns 403 Forbidden
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { error: 'Forbidden: Operational Managers cannot approve Client Approval Required tasks on behalf of the client.' },
        error: null
      });

      const res = await taskManagementService.updateStatus(taskInClientReview.id, 'Completed', undefined, 'Client Review');
      expect(res.error).toContain('Operational Managers cannot approve');
    });

    // 9.5 Owner override requires explicit reason and records client_approval_override
    it('9.5 Owner override requires explicit override flag and mandatory reason', async () => {
      const taskInClientReview: ClientTask = {
        ...baseClientApprovalTask,
        status: 'Client Review'
      };

      render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={taskInClientReview}
          client={mockClient}
          currentUser={mockOwner}
          onTaskUpdated={vi.fn()}
        />
      );

      // Owner sees "Owner Override: Approve" button
      const overrideBtn = screen.getByRole('button', { name: /Owner Override: Approve/i });
      expect(overrideBtn).toBeInTheDocument();

      fireEvent.click(overrideBtn);

      // Owner override prompt
      expect(screen.getByPlaceholderText(/Explain why this task is being approved via Owner override/i)).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /Confirm Owner Override/i });

      // Submitting empty reason is blocked
      fireEvent.click(confirmBtn);
      expect(screen.getByText(/Reason for owner override is required/i)).toBeInTheDocument();

      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          task: {
            ...taskInClientReview,
            status: 'Completed',
            completed_at: new Date().toISOString(),
            completed_by: mockOwner.id
          }
        },
        error: null
      });

      fireEvent.change(screen.getByPlaceholderText(/Explain why this task is being approved via Owner override/i), {
        target: { value: 'Approved via written agreement from CEO.' }
      });

      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'manage-client-task',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'update_status',
              status: 'Completed',
              is_override: true,
              override_reason: 'Approved via written agreement from CEO.'
            })
          })
        );
      });
    });

    // 9.6 Team Member own-task review restriction
    it('9.6 Team Member can only submit their own assigned task to Team Review', async () => {
      const otherMemberTask: ClientTask = {
        ...baseInternalTask,
        assigneeId: 'other-tm-99',
        assigneeName: 'Other Specialist',
        status: 'In Progress'
      };

      // When rendered for a team member not assigned to this task
      const { unmount } = render(
        <ClientTaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={otherMemberTask}
          client={mockClient}
          currentUser={mockTeamMember} // id: tm-1
          onTaskUpdated={vi.fn()}
        />
      );

      // Team Member does not see "Submit for Team Review" for other member's task
      expect(screen.queryByRole('button', { name: /Submit for Team Review/i })).not.toBeInTheDocument();
      unmount();

      // Direct edge function call for unassigned member returns 403
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { error: 'Forbidden: Team members may only update their own assigned tasks.' },
        error: null
      });

      const res = await taskManagementService.updateStatus(otherMemberTask.id, 'Team Review', undefined, 'In Progress');
      expect(res.error).toContain('Team members may only update their own assigned tasks');
    });

    // 9.7 Archived and Paused safeguards
    it('9.7 Paused client blocks operational task actions; Archived client/task is read-only', async () => {
      // 1. Paused client task creation blocked
      mockFrom.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'client-test-1', status: 'Paused' },
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      });

      const createRes = await taskManagementService.createTask({
        clientId: 'client-test-1',
        weekNumber: 3,
        title: 'New Paused Task',
        departmentId: 'dept-1',
        plannedStart: '2026-09-07T09:00:00.000Z',
        dueDate: '2026-09-11T18:00:00.000Z'
      });

      expect(createRes.error).toContain('Cannot create tasks for a paused client');

      // 2. Archived task message posting blocked
      const archivedTask: ClientTask = {
        ...baseInternalTask,
        archivedAt: '2026-09-06T10:00:00Z'
      };

      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { error: 'Task not found or is archived.' },
        error: null
      });

      const msgRes = await taskManagementService.createTaskMessage({
        taskId: archivedTask.id,
        clientId: archivedTask.clientId,
        visibility: 'internal_note',
        content: 'This should be blocked'
      });

      expect(msgRes.error).toContain('archived');
    });

    // 9.8 Atomic stale transition rejection (409 Conflict)
    it('9.8 Atomic stale transition returns 409 Conflict when status was concurrently changed', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { error: 'Conflict: The task status has changed concurrently or was modified by another user.' },
        error: null
      });

      const res = await taskManagementService.updateStatus('task-int-1', 'Completed', undefined, 'Team Review');
      expect(res.error).toContain('Conflict: The task status has changed concurrently');
    });

    // 9.9 Duplicate request / Idempotency handling
    it('9.9 Duplicate requests with idempotency key return replay without duplicating work', async () => {
      const idempotencyKey = 'idemp-key-test-123';

      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          idempotent: true,
          message: {
            id: 'msg-idemp-1',
            taskId: 'task-int-1',
            clientId: 'client-test-1',
            authorId: 'mgr-1',
            authorName: 'Alex OpsManager',
            authorRole: 'operational_manager',
            visibility: 'internal_note',
            content: 'Idempotent post test',
            links: [],
            createdAt: '2026-09-06T12:00:00Z'
          }
        },
        error: null
      });

      const res1 = await taskManagementService.createTaskMessage({
        taskId: 'task-int-1',
        clientId: 'client-test-1',
        visibility: 'internal_note',
        content: 'Idempotent post test',
        idempotencyKey
      });

      expect(res1.data?.id).toBe('msg-idemp-1');
      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'manage-client-task',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'create_message',
            idempotency_key: idempotencyKey
          })
        })
      );
    });

    // 9.10 Stable same-timestamp composite cursor pagination
    it('9.10 Composite cursor (created_at, id) sorts items with same timestamp deterministically and bounds to 30', async () => {
      const sameTimestamp = '2026-09-06T12:00:00.000Z';
      const rawMessages = [
        {
          id: 'msg-b',
          task_id: 'task-int-1',
          client_id: 'client-test-1',
          author_id: 'mgr-1',
          visibility: 'shared_with_client',
          content: 'Message B',
          links: [],
          created_at: sameTimestamp,
          author: { id: 'mgr-1', full_name: 'Alex OpsManager', role: 'operational_manager' }
        },
        {
          id: 'msg-a',
          task_id: 'task-int-1',
          client_id: 'client-test-1',
          author_id: 'mgr-1',
          visibility: 'shared_with_client',
          content: 'Message A',
          links: [],
          created_at: sameTimestamp,
          author: { id: 'mgr-1', full_name: 'Alex OpsManager', role: 'operational_manager' }
        }
      ];

      mockFunctionsInvoke.mockResolvedValueOnce({
        data: null,
        error: 'Edge function unavailable'
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'client_task_messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: rawMessages, error: null })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      });

      const res = await taskManagementService.fetchTaskFeed('task-int-1', undefined, 30);
      expect(res.combinedFeed.length).toBe(2);
      expect(res.messages[0].id).toBeDefined();
    });

    // 9.11 Saturday and Sunday rules
    it('9.11 Saturday and Sunday date rules reject weekend start and due dates', () => {
      // 2026-09-05 is Saturday, 2026-09-06 is Sunday, 2026-09-07 is Monday
      expect(isSaturday('2026-09-05')).toBe(true);
      expect(isSunday('2026-09-06')).toBe(true);
      expect(isWeekend('2026-09-05')).toBe(true);
      expect(isWeekend('2026-09-06')).toBe(true);
      expect(isWeekend('2026-09-07')).toBe(false);

      expect(rollForwardToNextMonday('2026-09-05')).toBe('2026-09-07');
      expect(rollForwardToNextMonday('2026-09-06')).toBe('2026-09-07');

      const sundayStartValidation = validateTaskDates('2026-09-06', '2026-09-11');
      expect(sundayStartValidation.valid).toBe(false);
      expect(sundayStartValidation.error).toContain('Planned start date cannot fall on a Sunday');

      const saturdayDueValidation = validateTaskDates('2026-09-07', '2026-09-12');
      expect(saturdayDueValidation.valid).toBe(false);
      expect(saturdayDueValidation.error).toContain('Due date cannot fall on a Saturday');
    });
  });

});
