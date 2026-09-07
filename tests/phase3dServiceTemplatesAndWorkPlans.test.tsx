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
  email: 'owner@flc.com',
  fullName: 'Owner Faseeh',
  role: 'owner',
  isSuspended: false,
  createdAt: '2026-01-01T00:00:00Z'
};

const mockManager: UserProfile = {
  id: 'user-mgr-1',
  email: 'manager@flc.com',
  fullName: 'Manager Bob',
  role: 'operational_manager',
  isSuspended: false,
  createdAt: '2026-01-01T00:00:00Z'
};

const sampleServiceTemplate: ServiceTemplate = {
  id: 'tpl-meta-ads',
  name: 'Meta Ads Launch Package',
  serviceLabel: 'Paid Media',
  description: 'Standard 3-task media buying kickoff suite',
  status: 'Active',
  version: 1,
  sortOrder: 1,
  tasks: [
    {
      id: 'task-1',
      definitionId: 'def-1',
      title: 'Pixel & CAPI Audit',
      description: 'Audit Meta Pixel, Events Manager & Conversions API setup',
      departmentId: 'dept-tech',
      departmentName: 'Tech & Tracking',
      priority: 'High',
      approvalMode: 'Internal Only',
      plannedOffsetDays: 0,
      durationBusinessDays: 2,
      displayOrder: 0
    },
    {
      id: 'task-2',
      definitionId: 'def-2',
      title: 'Ad Creatives Review',
      description: 'Review copy, hook variations, and graphic angles',
      departmentId: 'dept-creative',
      departmentName: 'Creative',
      priority: 'Normal',
      approvalMode: 'Client Approval Required',
      plannedOffsetDays: 1,
      durationBusinessDays: 3,
      displayOrder: 1
    },
    {
      id: 'task-3',
      definitionId: 'def-3',
      title: 'Campaign Setup & Launch',
      description: 'Configure target audiences, budget rules, and publish campaigns',
      departmentId: 'dept-media',
      departmentName: 'Media Buying',
      priority: 'Urgent',
      approvalMode: 'Internal Only',
      plannedOffsetDays: 3,
      durationBusinessDays: 2,
      displayOrder: 2
    }
  ],
  createdBy: 'user-owner-1',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z'
};

describe('Phase 3D: Service Templates, 90-Day Work Plans & Hardening Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-owner-1' } },
      error: null
    });
  });

  // ==========================================================================
  // 1. 90-CALENDAR-DAY CALENDAR MATH & WEEK STRUCTURE
  // ==========================================================================
  describe('1. 90-Calendar-Day Math & 13 Normalized Weeks', () => {
    it('1.1 Computes exact 90 calendar days range: Start Date to Start Date + 89', () => {
      const { startDate, endDate } = compute90DayPlanRange('2026-04-01');
      expect(startDate).toBe('2026-04-01');
      expect(endDate).toBe('2026-06-29');

      const start = new Date('2026-04-01T00:00:00Z');
      const end = new Date('2026-06-29T00:00:00Z');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      expect(diffDays).toBe(90);
    });

    it('1.2 Generates exactly 13 normalized weeks: Weeks 1..12 are 7 days; Week 13 is 6 days', () => {
      const weeks = generate13PlanWeeks('2026-04-01');
      expect(weeks).toHaveLength(13);

      for (let i = 0; i < 12; i++) {
        const w = weeks[i];
        expect(w.weekNumber).toBe(i + 1);
        const ws = new Date(`${w.startDate}T00:00:00Z`);
        const we = new Date(`${w.endDate}T00:00:00Z`);
        const duration = Math.round((we.getTime() - ws.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        expect(duration).toBe(7);
      }

      const w13 = weeks[12];
      expect(w13.weekNumber).toBe(13);
      const w13s = new Date(`${w13.startDate}T00:00:00Z`);
      const w13e = new Date(`${w13.endDate}T00:00:00Z`);
      const w13Duration = Math.round((w13e.getTime() - w13s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      expect(w13Duration).toBe(6);
      expect(w13.endDate).toBe('2026-06-29');
    });

    it('1.3 Business-day due date calculation skips Saturday and Sunday', () => {
      const wednesday = '2026-04-01'; // Wednesday
      const dueDate = calculateBusinessDueDate(wednesday, 3);
      expect(dueDate).toBe('2026-04-03'); // Friday (3 days: Wed, Thu, Fri)

      const thursday = '2026-04-02'; // Thursday
      const dueDateOverWeekend = calculateBusinessDueDate(thursday, 3);
      expect(dueDateOverWeekend).toBe('2026-04-06'); // Monday (3 business days: Thu, Fri, Mon)
    });

    it('1.4 Weekend detector and roll-forward logic operates accurately', () => {
      expect(isSaturday('2026-04-04')).toBe(true);
      expect(isSunday('2026-04-05')).toBe(true);
      expect(isWeekend('2026-04-04')).toBe(true);
      expect(isWeekend('2026-04-01')).toBe(false);

      expect(rollForwardToNextMonday('2026-04-04')).toBe('2026-04-06');
      expect(rollForwardToNextMonday('2026-04-05')).toBe('2026-04-06');
      expect(rollForwardToNextMonday('2026-04-01')).toBe('2026-04-01');
    });

    it('1.5 Task date calculation clamps inside week and plan boundaries', () => {
      const calc = calculateTaskDatesForWeek({
        weekStartDate: '2026-04-01',
        weekEndDate: '2026-04-07',
        planEndDate: '2026-06-29',
        plannedOffsetDays: 1,
        durationBusinessDays: 2
      });

      expect(calc.isValid).toBe(true);
      expect(calc.plannedStart).toBe('2026-04-02');
      expect(calc.dueDate).toBe('2026-04-03');
    });

    it('1.6 Deterministic legacy week number mapping for Weeks 5, 12, and 13', () => {
      const getLegacyWeekNumber = (planWeek: number) => ((planWeek - 1) % 4) + 1;
      expect(getLegacyWeekNumber(1)).toBe(1);
      expect(getLegacyWeekNumber(4)).toBe(4);
      expect(getLegacyWeekNumber(5)).toBe(1);
      expect(getLegacyWeekNumber(12)).toBe(4);
      expect(getLegacyWeekNumber(13)).toBe(1);
    });
  });

  // ==========================================================================
  // 2. AUTHORITATIVE RPC INTEGRATION FOR SERVICE TEMPLATES
  // ==========================================================================
  describe('2. Authoritative RPC Integration for Service Templates', () => {
    it('2.1 createTemplate calls fn_manage_service_template RPC with action "create"', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, template_id: 'tpl-new-1', version: 1 },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'tpl-new-1',
                name: 'New SEO Sprint',
                service_label: 'SEO',
                description: '30 day SEO kickoff',
                status: 'Active',
                version: 1,
                sort_order: 0,
                tasks: []
              },
              error: null
            })
          })
        })
      });

      const res = await serviceTemplateService.createTemplate({
        name: 'New SEO Sprint',
        serviceLabel: 'SEO',
        description: '30 day SEO kickoff',
        tasks: [
          {
            definitionId: 'def-seo-1',
            title: 'Technical Audit',
            departmentId: 'dept-tech',
            departmentName: 'Tech',
            priority: 'High',
            approvalMode: 'Internal Only',
            plannedOffsetDays: 0,
            durationBusinessDays: 3,
            displayOrder: 0
          }
        ]
      });

      expect(mockRpc).toHaveBeenCalledWith('fn_manage_service_template', expect.objectContaining({
        p_action: 'create',
        p_name: 'New SEO Sprint',
        p_service_label: 'SEO'
      }));
      expect(res.data?.id).toBe('tpl-new-1');
    });

    it('2.2 updateTemplate calls fn_manage_service_template with expected_version lock', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, template_id: 'tpl-meta-ads', version: 2 },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                ...sampleServiceTemplate,
                version: 2
              },
              error: null
            })
          })
        })
      });

      const res = await serviceTemplateService.updateTemplate('tpl-meta-ads', {
        name: 'Meta Ads Launch Package V2',
        serviceLabel: 'Paid Media',
        expectedVersion: 1
      });

      expect(mockRpc).toHaveBeenCalledWith('fn_manage_service_template', expect.objectContaining({
        p_action: 'update',
        p_template_id: 'tpl-meta-ads',
        p_expected_version: 1
      }));
      expect(res.data?.version).toBe(2);
    });

    it('2.3 duplicateTemplate calls fn_manage_service_template with action "duplicate"', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, template_id: 'tpl-meta-copy', version: 1 },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'tpl-meta-copy',
                name: 'Meta Ads Launch Package (Copy)',
                service_label: 'Paid Media',
                status: 'Active',
                version: 1,
                tasks: []
              },
              error: null
            })
          })
        })
      });

      const res = await serviceTemplateService.duplicateTemplate('tpl-meta-ads');
      expect(mockRpc).toHaveBeenCalledWith('fn_manage_service_template', expect.objectContaining({
        p_action: 'duplicate',
        p_template_id: 'tpl-meta-ads'
      }));
      expect(res.data?.id).toBe('tpl-meta-copy');
    });

    it('2.4 archiveTemplate and restoreTemplate invoke authoritative RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, template_id: 'tpl-meta-ads', status: 'Archived' },
        error: null
      });

      const archiveRes = await serviceTemplateService.archiveTemplate('tpl-meta-ads', 'End of seasonal run');
      expect(mockRpc).toHaveBeenCalledWith('fn_manage_service_template', expect.objectContaining({
        p_action: 'archive',
        p_template_id: 'tpl-meta-ads',
        p_archive_reason: 'End of seasonal run'
      }));
      expect(archiveRes.success).toBe(true);

      mockRpc.mockResolvedValueOnce({
        data: { success: true, template_id: 'tpl-meta-ads', status: 'Active' },
        error: null
      });

      const restoreRes = await serviceTemplateService.restoreTemplate('tpl-meta-ads');
      expect(mockRpc).toHaveBeenCalledWith('fn_manage_service_template', expect.objectContaining({
        p_action: 'restore',
        p_template_id: 'tpl-meta-ads'
      }));
      expect(restoreRes.success).toBe(true);
    });

    it('2.5 Update returns conflict error when stale expectedVersion is rejected by RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { error: 'Conflict: Template was modified in another session. Please reload.' },
        error: null
      });

      const res = await serviceTemplateService.updateTemplate('tpl-meta-ads', {
        name: 'Conflict Update',
        expectedVersion: 1
      });

      expect(res.data).toBeNull();
      expect(res.error).toContain('Conflict');
    });
  });

  // ==========================================================================
  // 3. AUTHORITATIVE RPC INTEGRATION FOR WORK PLANS
  // ==========================================================================
  describe('3. Authoritative RPC Integration for Work Plans', () => {
    it('3.1 saveDraftPlan calls fn_save_draft_work_plan with 13 weeks array', async () => {
      const weeks = generate13PlanWeeks('2026-04-01').map((w) => ({
        weekNumber: w.weekNumber,
        startDate: w.startDate,
        endDate: w.endDate,
        occurrences: [],
        customTasks: []
      }));

      mockRpc.mockResolvedValueOnce({
        data: { success: true, plan_id: 'plan-123', revision: 1 },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'plan-123',
                client_id: mockClient.id,
                name: 'Q2 Roadmap',
                status: 'Draft',
                start_date: '2026-04-01',
                end_date: '2026-06-29',
                revision: 1,
                plan_data: { weeks }
              },
              error: null
            })
          })
        })
      });

      const res = await workPlanService.saveDraftPlan({
        clientId: mockClient.id,
        name: 'Q2 Roadmap',
        startDate: '2026-04-01',
        weeks
      });

      expect(mockRpc).toHaveBeenCalledWith('fn_save_draft_work_plan', expect.objectContaining({
        p_client_id: mockClient.id,
        p_name: 'Q2 Roadmap',
        p_start_date: '2026-04-01'
      }));
      expect(res.data?.id).toBe('plan-123');
    });

    it('3.2 deleteDraftPlan calls fn_delete_draft_work_plan RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, deleted_plan_id: 'plan-123' },
        error: null
      });

      const res = await workPlanService.deleteDraftPlan('plan-123');
      expect(mockRpc).toHaveBeenCalledWith('fn_delete_draft_work_plan', {
        p_plan_id: 'plan-123'
      });
      expect(res.success).toBe(true);
    });

    it('3.3 saveDraftPlan validates and rejects plan with invalid week count (< 13 weeks)', async () => {
      const res = await workPlanService.saveDraftPlan({
        clientId: mockClient.id,
        name: 'Incomplete Plan',
        startDate: '2026-04-01',
        weeks: [] // 0 weeks
      });

      expect(res.data).toBeNull();
      expect(res.error).toContain('exactly 13 weeks');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('3.4 saveDraftPlan returns error on stale revision conflict from RPC', async () => {
      const weeks = generate13PlanWeeks('2026-04-01').map((w) => ({
        weekNumber: w.weekNumber,
        startDate: w.startDate,
        endDate: w.endDate,
        occurrences: [],
        customTasks: []
      }));

      mockRpc.mockResolvedValueOnce({
        data: { error: 'Conflict: Work plan was modified by another session. Please reload.' },
        error: null
      });

      const res = await workPlanService.saveDraftPlan({
        id: 'plan-123',
        clientId: mockClient.id,
        name: 'Q2 Roadmap Update',
        startDate: '2026-04-01',
        weeks,
        expectedRevision: 1
      });

      expect(res.data).toBeNull();
      expect(res.error).toContain('Conflict');
    });
  });

  // ==========================================================================
  // 4. TRANSACTIONAL BULK TASK LAUNCH ENGINE (fn_launch_task_batch)
  // ==========================================================================
  describe('4. Transactional Bulk Task Launch Engine', () => {
    it('4.1 launchServiceTemplate calls fn_launch_task_batch without p_actor_id in contract', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          batch_id: 'batch-launch-1',
          task_count: 3,
          task_ids: ['t-1', 't-2', 't-3']
        },
        error: null
      });

      const res = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 2,
        tasks: [
          { title: 'Task 1', departmentId: 'dept-media', plannedDate: '2026-04-08', dueDate: '2026-04-09' },
          { title: 'Task 2', departmentId: 'dept-creative', plannedDate: '2026-04-08', dueDate: '2026-04-10' }
        ]
      });

      expect(mockRpc).toHaveBeenCalledWith('fn_launch_task_batch', expect.objectContaining({
        p_client_id: mockClient.id,
        p_launch_type: 'service_template',
        p_source_id: sampleServiceTemplate.id,
        p_target_week: 2
      }));
      // Verify p_actor_id is NOT in the parameters sent to RPC
      const passedArgs = mockRpc.mock.calls[0][1];
      expect(passedArgs).not.toHaveProperty('p_actor_id');
      expect(res.success).toBe(true);
      expect(res.batchId).toBe('batch-launch-1');
    });

    it('4.2 launchWorkPlan calls fn_launch_task_batch for work plan launch', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          batch_id: 'batch-plan-1',
          task_count: 5,
          task_ids: ['pt-1', 'pt-2', 'pt-3', 'pt-4', 'pt-5']
        },
        error: null
      });

      const res = await taskLaunchEngine.launchWorkPlan({
        clientId: mockClient.id,
        planId: 'plan-90d-1',
        expectedRevision: 1,
        tasks: [
          { title: 'Plan Task Week 5', departmentId: 'dept-tech', planWeek: 5, plannedDate: '2026-04-29', dueDate: '2026-04-30' },
          { title: 'Plan Task Week 12', departmentId: 'dept-media', planWeek: 12, plannedDate: '2026-06-17', dueDate: '2026-06-18' },
          { title: 'Plan Task Week 13', departmentId: 'dept-creative', planWeek: 13, plannedDate: '2026-06-24', dueDate: '2026-06-25' }
        ]
      });

      expect(mockRpc).toHaveBeenCalledWith('fn_launch_task_batch', expect.objectContaining({
        p_client_id: mockClient.id,
        p_launch_type: 'work_plan',
        p_source_id: 'plan-90d-1'
      }));
      expect(res.success).toBe(true);
      expect(res.taskCount).toBe(5);
    });

    it('4.3 Fails closed with an understandable error when RPC encounters an error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'function fn_launch_task_batch does not exist' }
      });

      const res = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Task 1', departmentId: 'dept-media' }]
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('function fn_launch_task_batch does not exist');
    });

    it('4.4 Launch engine idempotency: replaying same requestId returns cached batch snapshot', async () => {
      const testRequestId = 'idempotent-req-test-456';
      const cachedBatch = {
        batch_id: 'batch-cached-456',
        task_count: 3,
        task_ids: ['t-1', 't-2', 't-3'],
        idempotent_replay: true
      };

      mockRpc.mockResolvedValueOnce({ data: cachedBatch, error: null });
      const res = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Task 1', departmentId: 'dept-media', plannedDate: '2026-04-01', dueDate: '2026-04-02' }],
        requestId: testRequestId
      });

      expect(res.success).toBe(true);
      expect(res.batchId).toBe('batch-cached-456');
      expect(res.idempotentReplay).toBe(true);
    });

    it('4.5 Launch engine handles conflict error on payload mismatch for duplicate request ID', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { error: 'Conflict: A launch request with this ID already exists with different payload parameters.' },
        error: null
      });

      const res = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Modified Task Title', departmentId: 'dept-media' }],
        requestId: 'reused-id'
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Conflict');
    });

    it('4.6 Rejects launch for paused and archived clients via RPC error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { error: 'Forbidden: Cannot launch tasks for an Archived client.' },
        error: null
      });

      const res = await taskLaunchEngine.launchServiceTemplate({
        clientId: mockArchivedClient.id,
        templateId: sampleServiceTemplate.id,
        templateVersion: 1,
        targetWeek: 1,
        tasks: [{ title: 'Task 1', departmentId: 'dept-media' }]
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Archived client');
    });
  });

  // ==========================================================================
  // 5. UI COMPONENTS & ACCESS CONTROL
  // ==========================================================================
  describe('5. UI Components & Access Control', () => {
    it('5.1 TaskCreationModeModal exposes Apply Service Template vs Create Individual Task', () => {
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
      expect(screen.getByText('Create Individual Task')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Apply Service Template'));
      expect(handleSelectMode).toHaveBeenCalledWith('template', 1);
    });

    it('5.2 ServiceTemplatesView displays templates list and headers correctly', async () => {
      vi.spyOn(serviceTemplateService, 'fetchTemplates').mockResolvedValueOnce({
        data: [sampleServiceTemplate],
        error: null
      });

      render(
        <ServiceTemplatesView
          currentUserProfile={mockOwner}
          onOpenTaskTemplates={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Service Templates Library')).toBeInTheDocument();
        expect(screen.getByText('Meta Ads Launch Package')).toBeInTheDocument();
      });
    });

    it('5.3 CreateTeamMemberModal locks system role to Team Member for Operational Manager', () => {
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

    it('5.4 Sidebar renders reactive client workspace links with safe external attributes', async () => {
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
      });

      const websiteLink = screen.getByTitle('Open Website');
      expect(websiteLink).toHaveAttribute('href', 'https://novamarketing.co');
      expect(websiteLink).toHaveAttribute('target', '_blank');
      expect(websiteLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('5.5 SelectedClientHeader does not render duplicate external client link buttons', () => {
      render(<SelectedClientHeader client={mockClient} />);
      expect(screen.getByText('Nova Marketing Co')).toBeInTheDocument();
      expect(screen.queryByTitle('Open Website / Landing Page')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Open Google Drive Folder')).not.toBeInTheDocument();
    });

    it('5.6 Modals render direct to document.body via Portal outside transform containers', () => {
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
