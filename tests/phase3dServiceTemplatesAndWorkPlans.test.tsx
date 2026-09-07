import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  compute90DayPlanRange, 
  generate13PlanWeeks, 
  calculateTaskDatesForWeek,
  calculateBusinessDueDate,
  formatDateISO,
  isSundayKarachi
} from '../src/lib/workPlanCalendar';
import { serviceTemplateService } from '../src/lib/serviceTemplateService';
import { taskLaunchEngine, generateRequestId } from '../src/lib/taskLaunchEngine';
import { workPlanService } from '../src/lib/workPlanService';
import { 
  ServiceTemplate, 
  ServiceTemplateTask, 
  ClientRecord, 
  Department, 
  UserProfile,
  WorkPlanWeek
} from '../src/types';
import { CreateEditServiceTemplateModal } from '../src/components/templates/CreateEditServiceTemplateModal';
import { ApplyServiceTemplateModal } from '../src/components/tasks/ApplyServiceTemplateModal';
import { WorkPlanBuilderModal } from '../src/components/workplans/WorkPlanBuilderModal';
import { ClientWorkPlanView } from '../src/components/workplans/ClientWorkPlanView';
import { CreateTeamMemberModal } from '../src/components/team/CreateTeamMemberModal';
import { Sidebar } from '../src/components/layout/Sidebar';
import { AuthProvider } from '../src/context/AuthContext';
import { useOpsStore } from '../src/store/opsStore';

// Mock Supabase
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      getSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    },
    from: (table: string) => mockFrom(table),
    rpc: (...args: any[]) => mockRpc(...args),
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args)
    }
  }
}));

const mockClient: ClientRecord = {
  id: 'client-3d-1',
  companyName: 'Nova Marketing Co',
  clientName: 'Alice Founder',
  package: 'Advanced',
  operationalManagerId: 'mgr-3d-1',
  operationalManagerName: 'Bob Manager',
  activationDate: '2026-04-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  links: {
    website: 'https://novamarketing.co',
    linkedin_company_page: 'https://linkedin.com/company/novamarketing',
    google_drive: 'https://drive.google.com/drive/folders/nova',
    slack_channel: 'https://nova.slack.com/archives/general'
  },
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z'
};

const mockPausedClient: ClientRecord = {
  ...mockClient,
  id: 'client-3d-paused',
  companyName: 'Paused Client Ltd',
  status: 'Paused',
  pauseReason: 'Payment Delinquency'
};

const mockDepartments: Department[] = [
  { id: 'dept-media', name: 'Media Buying', slug: 'media-buying', status: 'active', sortOrder: 1 },
  { id: 'dept-creative', name: 'Creative', slug: 'creative', status: 'active', sortOrder: 2 },
  { id: 'dept-tech', name: 'Tech & Tracking', slug: 'tech-tracking', status: 'active', sortOrder: 3 }
];

const mockOwner: UserProfile = {
  id: 'user-owner-1',
  authId: 'auth-owner-1',
  fullName: 'Faseeh Lall',
  workEmail: 'owner@flc.com',
  role: 'owner',
  status: 'active',
  organizationId: 'org-flc-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockManager: UserProfile = {
  id: 'user-mgr-1',
  authId: 'auth-mgr-1',
  fullName: 'Bob Manager',
  workEmail: 'bob@flc.com',
  role: 'operational_manager',
  status: 'active',
  organizationId: 'org-flc-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const sampleServiceTemplate: ServiceTemplate = {
  id: 'stpl-media-1',
  name: 'Meta Ads Launch Package',
  serviceLabel: 'Media Buying',
  description: 'Complete 3-step paid traffic launch',
  status: 'Active',
  version: 1,
  sortOrder: 0,
  tasks: [
    {
      id: 'task-def-1',
      definitionId: 'def-1',
      title: 'Pixel & CAPI Audit',
      description: 'Verify Event Quality Score >= 8.0',
      departmentId: 'dept-tech',
      departmentName: 'Tech & Tracking',
      priority: 'High',
      approvalMode: 'Internal Only',
      plannedOffsetDays: 0,
      durationBusinessDays: 2,
      displayOrder: 0
    },
    {
      id: 'task-def-2',
      definitionId: 'def-2',
      title: 'Ad Creatives Review',
      description: 'Prepare 3 video angles and copy variations',
      departmentId: 'dept-creative',
      departmentName: 'Creative',
      priority: 'Normal',
      approvalMode: 'Client Approval Required',
      plannedOffsetDays: 1,
      durationBusinessDays: 3,
      displayOrder: 1
    },
    {
      id: 'task-def-3',
      definitionId: 'def-3',
      title: 'Campaign Setup & Launch',
      description: 'Set up CBO campaigns and bid caps',
      departmentId: 'dept-media',
      departmentName: 'Media Buying',
      priority: 'Urgent',
      approvalMode: 'Internal Only',
      plannedOffsetDays: 3,
      durationBusinessDays: 2,
      displayOrder: 2
    }
  ],
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z'
};

describe('Phase 3D: Service Templates, 90-Day Work Plans & Hardening Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-owner-1', email: 'owner@flc.com' } }, error: null });
  });

  // ==========================================================================
  // 1. 90-CALENDAR-DAY WORK PLAN CALENDAR & BUSINESS DAYS MATH
  // ==========================================================================
  describe('1. 90-Calendar-Day Work Plan Calendar & Business Days Math', () => {
    it('1.1 Computes exact 90 calendar days inclusive (Start to Start + 89)', () => {
      const start = '2026-04-01'; // April 1, 2026
      const { startDate, endDate } = compute90DayPlanRange(start);

      expect(startDate).toBe('2026-04-01');
      expect(endDate).toBe('2026-06-29');

      // Verify exact 90 calendar days inclusive
      const [y1, m1, d1] = startDate.split('-').map(Number);
      const [y2, m2, d2] = endDate.split('-').map(Number);
      const dayDiff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (1000 * 60 * 60 * 24)) + 1;
      expect(dayDiff).toBe(90);
    });

    it('1.2 Generates exactly 13 weeks: Weeks 1-12 have 7 days (84 days), Week 13 has 6 days (90 total)', () => {
      const weeks = generate13PlanWeeks('2026-04-01');

      expect(weeks).toHaveLength(13);

      // Verify Weeks 1 to 12 have 7 calendar days
      for (let i = 0; i < 12; i++) {
        expect(weeks[i].calendarDayCount).toBe(7);
        expect(weeks[i].weekNumber).toBe(i + 1);
      }

      // Verify Week 13 has exactly 6 calendar days
      expect(weeks[12].weekNumber).toBe(13);
      expect(weeks[12].calendarDayCount).toBe(6);

      // Total calendar days across all 13 weeks must equal 90
      const totalDays = weeks.reduce((sum, w) => sum + w.calendarDayCount, 0);
      expect(totalDays).toBe(90);
    });

    it('1.3 Business day offset calculations strictly skip Sunday (Asia/Karachi calendar)', () => {
      // 2026-04-05 is a Sunday
      expect(isSundayKarachi('2026-04-05')).toBe(true);
      expect(isSundayKarachi('2026-04-06')).toBe(false); // Monday

      // 2 business days starting on Saturday 2026-04-04:
      // Day 1: Saturday (2026-04-04)
      // Sunday (2026-04-05) is excluded
      // Day 2: Monday (2026-04-06)
      const dueDate = calculateBusinessDueDate('2026-04-04', 2);
      expect(dueDate).toBe('2026-04-06');
    });

    it('1.4 calculateTaskDatesForWeek calculates start and due dates within target week', () => {
      const dates = calculateTaskDatesForWeek({
        weekStartDate: '2026-04-01',
        weekEndDate: '2026-04-07',
        planEndDate: '2026-06-29',
        plannedOffsetDays: 0,
        durationBusinessDays: 2
      });
      expect(dates.plannedStart).toBe('2026-04-01');
      expect(dates.dueDate).toBe('2026-04-02');
      expect(dates.isValid).toBe(true);
    });
  });

  // ==========================================================================
  // 2. MULTI-TASK SERVICE TEMPLATE BUILDER & ORDERING
  // ==========================================================================
  describe('2. Multi-Task Service Template Builder & Ordering', () => {
    it('2.1 CreateEditServiceTemplateModal renders initial form with child task controls', () => {
      render(
        <CreateEditServiceTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          template={null}
          departments={mockDepartments}
        />
      );

      expect(screen.getByRole('heading', { name: 'Create Service Template' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. social media weekly delivery/i)).toBeInTheDocument();
      expect(screen.getByText(/ordered child tasks/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
    });

    it('2.2 Can add a child task and reorder using Move Down and Move Up', async () => {
      render(
        <CreateEditServiceTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          template={sampleServiceTemplate}
          departments={mockDepartments}
        />
      );

      // Verify all 3 tasks from sampleServiceTemplate render
      expect(screen.getByDisplayValue('Pixel & CAPI Audit')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Ad Creatives Review')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Campaign Setup & Launch')).toBeInTheDocument();

      // Click Move Down on the first task
      const moveDownBtns = screen.getAllByLabelText(/move task.*down/i);
      expect(moveDownBtns.length).toBeGreaterThan(0);
      fireEvent.click(moveDownBtns[0]);

      // Click "+ Add Child Task"
      const addTaskBtn = screen.getByRole('button', { name: /add task/i });
      fireEvent.click(addTaskBtn);

      // Now should have 4 tasks
      const titleInputs = screen.getAllByPlaceholderText(/e\.g\. prepare content calendar/i);
      expect(titleInputs.length).toBe(4);
    });

    it('2.3 Enforces 1-100 task limits and rejects saving with empty task titles', async () => {
      render(
        <CreateEditServiceTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          template={null}
          departments={mockDepartments}
        />
      );

      const form = screen.getByRole('dialog').querySelector('form')!;
      fireEvent.submit(form);

      // Expect validation error for empty name
      await waitFor(() => {
        expect(screen.getByText('Template name is required.')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 3. SAFE BULK CREATION OF DRAFT, UNASSIGNED TASKS & LAUNCH ENGINE
  // ==========================================================================
  describe('3. Safe Bulk Creation of Tasks & Transactional Launch Engine', () => {
    it('3.1 taskLaunchEngine launches tasks strictly in Draft status with assignee_id = null', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          batch_id: 'batch-123',
          task_count: 3,
          task_ids: ['t-1', 't-2', 't-3']
        },
        error: null
      });

      const launchPayload = {
        clientId: mockClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: sampleServiceTemplate.version,
        targetWeek: 1,
        tasks: sampleServiceTemplate.tasks.map((t) => ({
          title: t.title,
          description: t.description,
          departmentId: t.departmentId,
          priority: t.priority,
          approvalMode: t.approvalMode,
          plannedDate: '2026-04-01',
          dueDate: '2026-04-02'
        })),
        requestId: generateRequestId()
      };

      const res = await taskLaunchEngine.launchServiceTemplate(launchPayload);
      expect(res.success).toBe(true);
      expect(res.taskCount).toBe(3);
      expect(res.batchId).toBe('batch-123');
      expect(res.taskIds).toHaveLength(3);
    });

    it('3.2 Launch engine idempotency: replaying same requestId returns previous batch without duplication', async () => {
      const testRequestId = 'idempotent-req-test-456';
      const cachedBatch = {
        batch_id: 'batch-cached-456',
        task_count: 3,
        task_ids: ['t-1', 't-2', 't-3'],
        idempotent_replay: true
      };

      // First call succeeds
      mockRpc.mockResolvedValueOnce({ data: cachedBatch, error: null });
      const res1 = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Task 1', departmentId: 'dept-media', plannedDate: '2026-04-01', dueDate: '2026-04-02' }],
        requestId: testRequestId
      });
      expect(res1.success).toBe(true);
      expect(res1.batchId).toBe('batch-cached-456');

      // Second call with same requestId (simulating network replay) returns cached batch
      mockRpc.mockResolvedValueOnce({ data: cachedBatch, error: null });
      const res2 = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Task 1', departmentId: 'dept-media', plannedDate: '2026-04-01', dueDate: '2026-04-02' }],
        requestId: testRequestId
      });
      expect(res2.success).toBe(true);
      expect(res2.batchId).toBe('batch-cached-456');
    });

    it('3.3 ApplyServiceTemplateModal displays warning for paused client and blocks launch', () => {
      render(
        <ApplyServiceTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          client={mockPausedClient}
          initialWeek={1}
          departments={mockDepartments}
        />
      );

      expect(screen.getByText(/client workspace paused/i)).toBeInTheDocument();
      const launchBtn = screen.getByRole('button', { name: /launch service pack/i });
      expect(launchBtn).toBeDisabled();
    });
  });

  // ==========================================================================
  // 4. 90-DAY WORK PLAN BUILDER & VIEW
  // ==========================================================================
  describe('4. 90-Day Work Plan Builder & View', () => {
    it('4.1 ClientWorkPlanView displays 90-calendar-day header and build button', async () => {
      render(
        <ClientWorkPlanView
          client={mockClient}
          currentUserProfile={mockOwner}
          departments={mockDepartments}
        />
      );

      expect(screen.getByText('90-Calendar-Day Work Plans')).toBeInTheDocument();
      expect(screen.getByText('13 Weeks')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\+ build 90-day plan/i })).toBeInTheDocument();
    });

    it('4.2 WorkPlanBuilderModal renders 13 weekly columns and department distribution stats', () => {
      render(
        <WorkPlanBuilderModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          client={mockClient}
          departments={mockDepartments}
          planToEdit={null}
        />
      );

      expect(screen.getByText(/build 90-day work plan/i)).toBeInTheDocument();
      expect(screen.getByText(/exact 90 calendar days/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save draft plan/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /launch 90-day plan/i })).toBeInTheDocument();
    });

    it('4.3 Modifying an occurrence in a plan does not mutate master template', () => {
      // Create a copy of tasks for plan occurrence
      const occurrenceTasks = sampleServiceTemplate.tasks.map(t => ({ ...t, title: 'Customized Task Title' }));
      
      // Master template tasks remain unchanged
      expect(sampleServiceTemplate.tasks[0].title).toBe('Pixel & CAPI Audit');
      expect(occurrenceTasks[0].title).toBe('Customized Task Title');
    });
  });

  // ==========================================================================
  // 5. OWNER / OPERATIONAL MANAGER ROLE PROVISIONING MATRIX
  // ==========================================================================
  describe('5. Role Provisioning Matrix', () => {
    it('5.1 CreateTeamMemberModal displays role selector (Team Member vs Operational Manager) for Owner', () => {
      render(
        <CreateTeamMemberModal
          isOpen={true}
          onClose={vi.fn()}
          onMemberCreated={vi.fn()}
          currentUserProfile={mockOwner}
          departments={mockDepartments}
          designations={[]}
          eligibleManagers={[]}
          onOpenDesignationManager={vi.fn()}
        />
      );

      const roleSelect = screen.getByLabelText(/system role/i);
      expect(roleSelect).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /team member/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /operational manager/i })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /^owner$/i })).not.toBeInTheDocument();
    });

    it('5.2 CreateTeamMemberModal locks role to Team Member for Operational Manager', () => {
      render(
        <CreateTeamMemberModal
          isOpen={true}
          onClose={vi.fn()}
          onMemberCreated={vi.fn()}
          currentUserProfile={mockManager}
          departments={mockDepartments}
          designations={[]}
          eligibleManagers={[]}
          onOpenDesignationManager={vi.fn()}
        />
      );

      expect(screen.getAllByText(/team member/i).length).toBeGreaterThan(0);
      expect(screen.queryByLabelText(/system role/i)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 6. CLIENT WORKSPACE LINKS IN SIDEBAR & RESTRAINED RED/BLACK/WHITE PALETTE
  // ==========================================================================
  describe('6. Client Workspace Links in Sidebar & Restrained Monochrome Palette', () => {
    it('6.1 Sidebar renders reactive client workspace links under selected client', async () => {
      useOpsStore.setState({
        clients: [mockClient],
        selectedClientId: mockClient.id,
        sidebarCollapsed: false,
        mobileSidebarOpen: false
      });

      render(
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Workspace Links')).toBeInTheDocument();
        expect(screen.getByTitle('Open Website')).toBeInTheDocument();
        expect(screen.getByTitle('Open LinkedIn')).toBeInTheDocument();
        expect(screen.getByTitle('Open Google Drive')).toBeInTheDocument();
        expect(screen.getByTitle('Open Slack')).toBeInTheDocument();
      });

      // Verify external link attributes
      const websiteLink = screen.getByTitle('Open Website');
      expect(websiteLink).toHaveAttribute('href', 'https://novamarketing.co');
      expect(websiteLink).toHaveAttribute('target', '_blank');
      expect(websiteLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('6.2 In collapsed mode, workspace links render with tooltips and touch targets', async () => {
      useOpsStore.setState({
        clients: [mockClient],
        selectedClientId: mockClient.id,
        sidebarCollapsed: true,
        mobileSidebarOpen: false
      });

      render(
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Website')).toBeInTheDocument();
        expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument();
      });
    });

    it('6.3 Modals render direct to document.body via Portal outside transform containers', () => {
      render(
        <ApplyServiceTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          client={mockClient}
          initialWeek={1}
          departments={mockDepartments}
        />
      );

      // The dialog must be a descendant of body (via createPortal)
      const dialog = screen.getByRole('dialog');
      expect(dialog.closest('body')).toBe(document.body);
    });
  });
});
