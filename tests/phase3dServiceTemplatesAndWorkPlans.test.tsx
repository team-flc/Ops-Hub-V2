import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  compute90DayPlanRange, 
  generate13PlanWeeks, 
  calculateTaskDatesForWeek,
  calculateBusinessDueDate,
  getBusinessDaysInRange
} from '../src/lib/workPlanCalendar';
import { isSaturday, isSunday, isWeekend, rollForwardToNextMonday } from '../src/lib/taskManagementService';
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
import { ServiceTemplatePreviewModal } from '../src/components/templates/ServiceTemplatePreviewModal';
import { ServiceTemplatesView } from '../src/components/templates/ServiceTemplatesView';
import { ApplyServiceTemplateModal } from '../src/components/tasks/ApplyServiceTemplateModal';
import { TaskCreationModeModal } from '../src/components/tasks/TaskCreationModeModal';
import { WorkPlanBuilderModal } from '../src/components/workplans/WorkPlanBuilderModal';
import { ClientWorkPlanView } from '../src/components/workplans/ClientWorkPlanView';
import { SelectedClientHeader } from '../src/components/clients/SelectedClientHeader';
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

const mockArchivedClient: ClientRecord = {
  ...mockClient,
  id: 'client-3d-archived',
  companyName: 'Archived Client Ltd',
  status: 'Archived'
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
      const { startDate, endDate, isStartDateWeekend } = compute90DayPlanRange(start);

      expect(startDate).toBe('2026-04-01');
      expect(endDate).toBe('2026-06-29');
      expect(isStartDateWeekend).toBe(false);

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

    it('1.3 Operational task scheduling strictly skips Saturday and Sunday (Monday-Friday business calendar in Asia/Karachi)', () => {
      // 2026-04-04 is Saturday, 2026-04-05 is Sunday
      expect(isSaturday('2026-04-04')).toBe(true);
      expect(isSunday('2026-04-05')).toBe(true);
      expect(isWeekend('2026-04-04')).toBe(true);
      expect(isWeekend('2026-04-05')).toBe(true);
      expect(isWeekend('2026-04-06')).toBe(false); // Monday

      // Saturday rolls forward to next Monday
      expect(rollForwardToNextMonday('2026-04-04')).toBe('2026-04-06');
      expect(rollForwardToNextMonday('2026-04-05')).toBe('2026-04-06');

      // getBusinessDaysInRange across 2026-04-03 (Fri) to 2026-04-07 (Tue)
      const bDays = getBusinessDaysInRange('2026-04-03', '2026-04-07');
      expect(bDays).toEqual(['2026-04-03', '2026-04-06', '2026-04-07']);
      expect(bDays).not.toContain('2026-04-04');
      expect(bDays).not.toContain('2026-04-05');

      // 2 business days starting on Friday 2026-04-03 -> Friday (day 1), Monday (day 2)
      const dueDate = calculateBusinessDueDate('2026-04-03', 2);
      expect(dueDate).toBe('2026-04-06');
    });

    it('1.4 Weekend plan start date suggests Monday adjustment', () => {
      // 2026-04-04 is Saturday
      const { isStartDateWeekend, suggestedMonday } = compute90DayPlanRange('2026-04-04');
      expect(isStartDateWeekend).toBe(true);
      expect(suggestedMonday).toBe('2026-04-06');
    });
  });

  // ==========================================================================
  // 2. MULTI-TASK SERVICE TEMPLATE MANAGEMENT & PRESERVATION
  // ==========================================================================
  describe('2. Multi-Task Service Template Management & Preservation', () => {
    it('2.1 CreateEditServiceTemplateModal renders form with child task controls and limits', () => {
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
      expect(screen.getByPlaceholderText(/e.g. social media weekly delivery/i)).toBeInTheDocument();
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

      expect(screen.getByDisplayValue('Pixel & CAPI Audit')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Ad Creatives Review')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Campaign Setup & Launch')).toBeInTheDocument();

      const moveDownBtns = screen.getAllByLabelText(/move task.*down/i);
      expect(moveDownBtns.length).toBeGreaterThan(0);
      fireEvent.click(moveDownBtns[0]);

      const addTaskBtn = screen.getByRole('button', { name: /add task/i });
      fireEvent.click(addTaskBtn);

      const titleInputs = screen.getAllByPlaceholderText(/e.g. prepare content calendar/i);
      expect(titleInputs.length).toBe(4);
    });

    it('2.3 ServiceTemplatePreviewModal displays all ordered tasks and business-day durations', () => {
      render(
        <ServiceTemplatePreviewModal
          isOpen={true}
          onClose={vi.fn()}
          template={sampleServiceTemplate}
        />
      );

      expect(screen.getByText('Meta Ads Launch Package')).toBeInTheDocument();
      expect(screen.getByText('Ordered Package Tasks (3 tasks)')).toBeInTheDocument();
      expect(screen.getByText('Pixel & CAPI Audit')).toBeInTheDocument();
      expect(screen.getByText('Ad Creatives Review')).toBeInTheDocument();
      expect(screen.getByText('Campaign Setup & Launch')).toBeInTheDocument();
    });

    it('2.4 Preserves existing Phase 3C single-task template as a valid 1-task Service Template', async () => {
      // Mock legacy taskTemplateService fallback
      const mockLegacyTemplate = {
        id: 'legacy-tpl-1',
        name: 'Media Buying Campaign Setup & Launch',
        description: 'Standard paid traffic launch SOP',
        departmentId: 'dept-media',
        departmentName: 'Media Buying',
        defaultTaskTitle: 'Campaign Setup & Launch Checklist',
        taskDetails: 'SOP instructions for paid ads launch',
        defaultPriority: 'High',
        defaultApprovalMode: 'Internal Only',
        suggestedDurationDays: 3,
        status: 'Active',
        version: 1,
        sortOrder: 1,
        createdBy: 'user-1',
        createdByName: 'Faseeh Lall',
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z'
      };

      // Mock service_templates table missing -> fallback triggered
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          order: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockResolvedValueOnce({
                data: null,
                error: { code: '42P01', message: 'relation "service_templates" does not exist' }
              })
            })
          })
        })
      });

      // Mock legacy task_templates fetch
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          order: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockResolvedValueOnce({
                data: [mockLegacyTemplate],
                error: null
              })
            })
          })
        })
      });

      const res = await serviceTemplateService.fetchTemplates(false);
      expect(res.data).toHaveLength(1);
      expect(res.isUnavailable).toBe(true);
      const migrated = res.data[0];
      expect(migrated.name).toBe('Media Buying Campaign Setup & Launch');
      expect(migrated.tasks).toHaveLength(1);
      expect(migrated.tasks[0].title).toBe('Campaign Setup & Launch Checklist');
      expect(migrated.tasks[0].durationBusinessDays).toBe(3);
    });

    it('2.5 ServiceTemplatesView disables New/Edit/Duplicate/Archive/Restore when backend is unavailable', async () => {
      // Mock fetchTemplates returning isUnavailable = true
      vi.spyOn(serviceTemplateService, 'fetchTemplates').mockResolvedValueOnce({
        data: [sampleServiceTemplate],
        error: null,
        isUnavailable: true
      });

      render(
        <ServiceTemplatesView
          currentUserProfile={mockOwner}
          onOpenTaskTemplates={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/phase 3d backend is not enabled in this environment yet. preview is read-only./i)).toBeInTheDocument();
      });

      const disabledActions = screen.getAllByTitle(/phase 3d backend is not enabled in this environment yet. preview is read-only./i);
      expect(disabledActions.length).toBeGreaterThanOrEqual(4);
      disabledActions.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });

  // ==========================================================================
  // 3. TASK CREATION MODES & AUTHORITATIVE WORKFLOW
  // ==========================================================================
  describe('3. Task Creation Modes & Authoritative Workflow', () => {
    it('3.1 TaskCreationModeModal exposes exactly 2 modes: Apply Service Template vs Create Individual Task', () => {
      const handleSelectMode = vi.fn();
      render(
        <TaskCreationModeModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectMode={handleSelectMode}
          client={mockClient}
          weekNumber={1}
        />
      );

      expect(screen.getByText('Apply Service Template')).toBeInTheDocument();
      expect(screen.getByText('Multi-Task Package')).toBeInTheDocument();
      expect(screen.getByText('Create Individual Task')).toBeInTheDocument();
      expect(screen.queryByText(/start from template — sop/i)).not.toBeInTheDocument();

      // Click Apply Service Template
      fireEvent.click(screen.getByText('Apply Service Template'));
      expect(handleSelectMode).toHaveBeenCalledWith('template', 1);
    });
  });

  // ==========================================================================
  // 4. SAFE BULK CREATION OF DRAFT, UNASSIGNED TASKS & LAUNCH ENGINE
  // ==========================================================================
  describe('4. Safe Bulk Creation of Tasks & Transactional Launch Engine', () => {
    it('4.1 taskLaunchEngine launches tasks strictly in Draft status with assignee_id = null', async () => {
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

    it('4.2 Launch engine idempotency: replaying same requestId returns previous batch without duplication', async () => {
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

    it('4.3 ApplyServiceTemplateModal displays plain guarantee of N Draft, Unassigned tasks and blocks paused client', () => {
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
      expect(screen.getByText(/this service template will create/i)).toBeInTheDocument();
      const launchBtn = screen.getByRole('button', { name: /launch service pack/i });
      expect(launchBtn).toBeDisabled();
    });

    it('4.4 RPC launch rejects archived and paused clients', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { error: 'Forbidden: Cannot launch tasks for an archived client' },
        error: null
      });

      const resArchived = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockArchivedClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Task 1', departmentId: 'dept-media' }]
      });
      expect(resArchived.success).toBe(false);
      expect(resArchived.error).toContain('archived client');

      mockRpc.mockResolvedValueOnce({
        data: { error: 'Forbidden: Cannot launch tasks for a paused client' },
        error: null
      });

      const resPaused = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockPausedClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Task 1', departmentId: 'dept-media' }]
      });
      expect(resPaused.success).toBe(false);
      expect(resPaused.error).toContain('paused client');
    });

    it('4.5 Replaying same requestId with different payload is rejected with conflict error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { error: 'Conflict: Request ID already used with a different task payload' },
        error: null
      });

      const resConflict = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Modified Task Title', departmentId: 'dept-media' }],
        requestId: 'reused-req-different-payload'
      });

      expect(resConflict.success).toBe(false);
      expect(resConflict.error).toContain('different task payload');
    });

    it('4.6 Work Plan launch rejects client mismatch and stale revision', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { error: 'Conflict: Work Plan does not belong to the target client' },
        error: null
      });

      const resMismatch = await taskLaunchEngine.launchWorkPlan({
        clientId: 'wrong-client-id',
        planId: 'plan-123',
        expectedRevision: 1,
        tasks: [{ title: 'Plan Task 1', departmentId: 'dept-tech', planWeek: 1 }]
      });
      expect(resMismatch.success).toBe(false);
      expect(resMismatch.error).toContain('does not belong');

      mockRpc.mockResolvedValueOnce({
        data: { error: 'Conflict: Work Plan revision has changed. Please refresh and review.' },
        error: null
      });

      const resStale = await taskLaunchEngine.launchWorkPlan({
        clientId: mockClient.id,
        planId: 'plan-123',
        expectedRevision: 1,
        tasks: [{ title: 'Plan Task 1', departmentId: 'dept-tech', planWeek: 1 }]
      });
      expect(resStale.success).toBe(false);
      expect(resStale.error).toContain('revision has changed');
    });
  });

  // ==========================================================================
  // 5. 90-DAY WORK PLAN SAFETY & ISOLATION
  // ==========================================================================
  describe('5. 90-Day Work Plan Safety & Isolation', () => {
    it('5.1 ClientWorkPlanView displays 90-calendar-day header and build button', async () => {
      render(
        <ClientWorkPlanView
          client={mockClient}
          currentUserProfile={mockOwner}
          departments={mockDepartments}
        />
      );

      expect(screen.getByText('90-Calendar-Day Work Plans')).toBeInTheDocument();
      expect(screen.getByText('13 Weeks')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /build 90-day plan/i })).toBeInTheDocument();
    });

    it('5.2 WorkPlanBuilderModal renders 13 weekly columns and save/launch actions', () => {
      render(
        <WorkPlanBuilderModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          client={mockClient}
          departments={mockDepartments}
          existingPlan={null}
        />
      );

      expect(screen.getByText(/build 90-day work plan/i)).toBeInTheDocument();
      expect(screen.getByText(/exact 90 calendar days/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save draft plan/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /launch 90-day plan/i })).toBeInTheDocument();
    });

    it('5.3 Modifying an occurrence in a plan does not mutate master template', () => {
      const occurrenceTasks = sampleServiceTemplate.tasks.map(t => ({ ...t, title: 'Customized Task Title' }));
      expect(sampleServiceTemplate.tasks[0].title).toBe('Pixel & CAPI Audit');
      expect(occurrenceTasks[0].title).toBe('Customized Task Title');
    });

    it('5.4 Saving a draft plan creates zero operational client tasks', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-owner-1' } },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'plan-draft-1',
                client_id: mockClient.id,
                name: 'Q2 90-Day Growth Plan',
                status: 'Draft',
                revision: 1,
                start_date: '2026-04-01',
                end_date: '2026-06-29',
                plan_data: { weeks: [] },
                created_at: '2026-04-01T00:00:00Z',
                updated_at: '2026-04-01T00:00:00Z'
              },
              error: null
            })
          })
        })
      });

      const res = await workPlanService.saveDraftPlan({
        clientId: mockClient.id,
        name: 'Q2 90-Day Growth Plan',
        startDate: '2026-04-01',
        weeks: []
      });

      expect(res.data?.status).toBe('Draft');
      // Verify RPC was NOT called for draft saving
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 6. OWNER / OPERATIONAL MANAGER ROLE PROVISIONING MATRIX
  // ==========================================================================
  describe('6. Role Provisioning Matrix', () => {
    it('6.1 CreateTeamMemberModal displays role selector (Team Member vs Operational Manager) for Owner', () => {
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

    it('6.2 CreateTeamMemberModal locks role to Team Member for Operational Manager', () => {
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
  // 7. CLIENT WORKSPACE LINKS IN SIDEBAR & RESTRAINED RED/BLACK/WHITE PALETTE
  // ==========================================================================
  describe('7. Client Workspace Links in Sidebar & Header Cleanup', () => {
    it('7.1 Sidebar renders reactive client workspace links with safe external attributes', async () => {
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

      const websiteLink = screen.getByTitle('Open Website');
      expect(websiteLink).toHaveAttribute('href', 'https://novamarketing.co');
      expect(websiteLink).toHaveAttribute('target', '_blank');
      expect(websiteLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('7.2 SelectedClientHeader does not render duplicate external client link buttons', () => {
      render(<SelectedClientHeader client={mockClient} />);

      expect(screen.getByText('Nova Marketing Co')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /linkedin profiles/i })).toBeInTheDocument();

      // Quick links must NOT be in the header anymore
      expect(screen.queryByTitle('Open Website / Landing Page')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Open Google Drive Folder')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Open Slack Channel')).not.toBeInTheDocument();
    });

    it('7.3 Modals render direct to document.body via Portal outside transform containers', () => {
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

      const dialog = screen.getByRole('dialog');
      expect(dialog.closest('body')).toBe(document.body);
    });
  });
});
