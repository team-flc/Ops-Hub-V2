import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  calculateDueDateFromDuration,
  taskTemplateService
} from '../src/lib/taskTemplateService';
import {
  taskManagementService,
  isSunday,
  isSaturday,
  isWeekend,
  rollForwardToNextMonday
} from '../src/lib/taskManagementService';
import {
  TaskTemplate,
  ClientRecord,
  Department,
  UserProfile
} from '../src/types';
import { TaskCreationModeModal } from '../src/components/tasks/TaskCreationModeModal';
import { TaskTemplatePickerModal } from '../src/components/tasks/TaskTemplatePickerModal';
import { CreateClientTaskModal } from '../src/components/tasks/CreateClientTaskModal';
import { TaskTemplatesView } from '../src/components/templates/TaskTemplatesView';
import { TemplatePreviewModal } from '../src/components/templates/TemplatePreviewModal';
import { ArchiveTemplateModal } from '../src/components/templates/ArchiveTemplateModal';

// Mock Supabase
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
      },
      from: (table: string) => mockFrom(table),
      functions: {
        invoke: (...args: any[]) => mockFunctionsInvoke(...args)
      }
    }
  };
});

const mockClient: ClientRecord = {
  id: 'client-test-1',
  companyName: 'Acme Growth Labs',
  clientName: 'Jane Doe',
  package: 'Enterprise',
  operationalManagerId: 'mgr-1',
  operationalManagerName: 'Alex Manager',
  activationDate: '2026-03-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  links: {},
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z'
};

const mockDepartments: Department[] = [
  { id: 'dept-paid-ads', name: 'Paid Ads', slug: 'paid-ads', status: 'active', sortOrder: 1 },
  { id: 'dept-creative', name: 'Creative & Media', slug: 'creative', status: 'active', sortOrder: 2 }
];

const mockOwner: UserProfile = {
  id: 'owner-1',
  fullName: 'Faseeh Owner',
  role: 'owner',
  status: 'active'
};

const mockManager: UserProfile = {
  id: 'mgr-1',
  fullName: 'Alex Manager',
  role: 'operational_manager',
  status: 'active'
};

const mockTeamMember: UserProfile = {
  id: 'tm-1',
  fullName: 'Sam Specialist',
  role: 'team_member',
  status: 'active',
  departmentIds: ['dept-paid-ads']
};

const mockClientUser: UserProfile = {
  id: 'client-user-1',
  fullName: 'Jane Client',
  role: 'client',
  status: 'active',
  organizationId: 'client-test-1'
};

const mockMediaBuyingTemplate: TaskTemplate = {
  id: 'tpl-1',
  name: 'Media Buying Campaign Setup & Launch',
  description: 'Standard operating procedure for full funnel ad campaign creation and launch verification.',
  departmentId: 'dept-paid-ads',
  departmentName: 'Paid Ads',
  defaultTaskTitle: 'Meta & Google Ads Campaign Setup and Tracking Audit',
  taskDetails: `## SOP Checklist
- [ ] 1. Confirm client access to Meta Business Manager and Google Ads
- [ ] 2. Verify Meta Pixel, Conversions API (CAPI), and GA4 event tracking
- [ ] 3. Audit conversion events (Lead, Purchase, Schedule) in Events Manager
- [ ] 4. Upload approved ad copy and creative variants into asset library
- [ ] 5. Configure target audiences, exclusions, and campaign budget optimization (CBO)
- [ ] 6. Submit draft campaigns for internal peer QA review
- [ ] 7. Request formal client sign-off before campaign activation
- [ ] 8. Verify billing threshold and payment method confirmation
- [ ] 9. Enable campaigns and verify active ad delivery within 4 hours`,
  defaultPriority: 'Normal',
  defaultApprovalMode: 'Client Approval Required',
  suggestedDurationDays: 5,
  status: 'Active',
  sortOrder: 0,
  version: 1,
  createdBy: 'owner-1',
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z'
};

const mockArchivedTemplate: TaskTemplate = {
  id: 'tpl-archived',
  name: 'Deprecated Campaign Flow',
  description: 'Legacy campaign flow replaced by Q4 framework.',
  departmentId: 'dept-paid-ads',
  departmentName: 'Paid Ads',
  defaultTaskTitle: 'Legacy Campaign Setup',
  taskDetails: 'Old checklist',
  defaultPriority: 'Low',
  defaultApprovalMode: 'Internal Only',
  suggestedDurationDays: 3,
  status: 'Archived',
  sortOrder: 1,
  version: 2,
  archiveReason: 'Replaced by Media Buying 2026 framework',
  archivedAt: '2026-09-08T10:00:00Z',
  archivedBy: 'owner-1',
  createdBy: 'owner-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-09-08T10:00:00Z'
};

describe('Phase 3C: Task Templates System Comprehensive Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: mockOwner.id } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'departments') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockDepartments, error: null })
            }),
            order: () => Promise.resolve({ data: mockDepartments, error: null })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null })
          }),
          order: () => Promise.resolve({ data: [], error: null })
        })
      };
    });
  });

  // --------------------------------------------------------------------------
  // 1. BUSINESS DAY & DUE DATE CALCULATION
  // --------------------------------------------------------------------------
  describe('1. Business Day Calendar Calculation', () => {
    it('1.1 Strictly skips Saturday and Sunday when calculating due dates', () => {
      // 2026-09-07 is Monday
      const monday = '2026-09-07';
      expect(isSunday(monday)).toBe(false);
      expect(isSaturday(monday)).toBe(false);

      // 5 business days from Monday = Friday (2026-09-11)
      const due5Days = calculateDueDateFromDuration(monday, 5);
      expect(due5Days).toBe('2026-09-11');
      expect(isWeekend(due5Days)).toBe(false);
    });

    it('1.2 Skips the weekend when duration crosses from Friday to Monday', () => {
      // 2026-09-11 is Friday
      const friday = '2026-09-11';
      // 2 business days from Friday: Friday is day 1, Monday 2026-09-14 is day 2
      const due2Days = calculateDueDateFromDuration(friday, 2);
      expect(due2Days).toBe('2026-09-14');
      expect(isWeekend(due2Days)).toBe(false);
    });

    it('1.3 Automatically rolls forward starting date to Monday if start date is on a weekend', () => {
      // 2026-09-12 is Saturday, 2026-09-13 is Sunday
      const saturday = '2026-09-12';
      const sunday = '2026-09-13';

      expect(isSaturday(saturday)).toBe(true);
      expect(isSunday(sunday)).toBe(true);

      // Saturday start with 1 business day rolls to Monday 2026-09-14
      const dueFromSat = calculateDueDateFromDuration(saturday, 1);
      expect(dueFromSat).toBe('2026-09-14');

      // Sunday start with 5 business days: starts Monday 2026-09-14, ends Friday 2026-09-18
      const dueFromSun = calculateDueDateFromDuration(sunday, 5);
      expect(dueFromSun).toBe('2026-09-18');
      expect(isWeekend(dueFromSun)).toBe(false);
    });

    it('1.4 Clamps duration between 1 and 30 business days safely', () => {
      const monday = '2026-09-07';
      // 0 days clamped to 1 day -> same Monday
      expect(calculateDueDateFromDuration(monday, 0)).toBe('2026-09-07');
      // 1 day -> same Monday
      expect(calculateDueDateFromDuration(monday, 1)).toBe('2026-09-07');
    });
  });

  // --------------------------------------------------------------------------
  // 2. TASK CREATION ENTRY FLOW (TaskCreationModeModal)
  // --------------------------------------------------------------------------
  describe('2. Task Creation Entry Flow', () => {
    it('2.1 Renders both Start from Template and Create Blank Task options with Week badge', () => {
      const onSelectMode = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskCreationModeModal
          isOpen={true}
          onClose={onClose}
          onSelectMode={onSelectMode}
          client={mockClient}
          weekNumber={2}
        />
      );

      expect(screen.getByText('Week 2 Setup')).toBeInTheDocument();
      expect(screen.getByText('Create Operational Task')).toBeInTheDocument();
      expect(screen.getByText('Start from Template')).toBeInTheDocument();
      expect(screen.getByText('Create Blank Task')).toBeInTheDocument();
      expect(screen.getByLabelText(/workspace week/i)).toHaveValue('2');
    });

    it('2.2 Clicking Start from Template triggers onSelectMode with template', () => {
      const onSelectMode = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskCreationModeModal
          isOpen={true}
          onClose={onClose}
          onSelectMode={onSelectMode}
          client={mockClient}
          weekNumber={1}
        />
      );

      const templateBtn = screen.getByRole('button', { name: /start from template/i });
      fireEvent.click(templateBtn);

      expect(onSelectMode).toHaveBeenCalledWith('template', 1);
    });

    it('2.3 Clicking Create Blank Task triggers onSelectMode with blank', () => {
      const onSelectMode = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskCreationModeModal
          isOpen={true}
          onClose={onClose}
          onSelectMode={onSelectMode}
          client={mockClient}
          weekNumber={3}
        />
      );

      const blankBtn = screen.getByRole('button', { name: /create blank task/i });
      fireEvent.click(blankBtn);

      expect(onSelectMode).toHaveBeenCalledWith('blank', 3);
    });

    it('2.4 Changing workspace week updates payload on mode selection', () => {
      const onSelectMode = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskCreationModeModal
          isOpen={true}
          onClose={onClose}
          onSelectMode={onSelectMode}
          client={mockClient}
          weekNumber={1}
        />
      );

      const weekSelect = screen.getByLabelText(/workspace week/i);
      fireEvent.change(weekSelect, { target: { value: '4' } });

      const blankBtn = screen.getByRole('button', { name: /create blank task/i });
      fireEvent.click(blankBtn);

      expect(onSelectMode).toHaveBeenCalledWith('blank', 4);
    });
  });

  // --------------------------------------------------------------------------
  // 3. TASK TEMPLATE PICKER (TaskTemplatePickerModal)
  // --------------------------------------------------------------------------
  describe('3. Task Template Picker Modal', () => {
    it('3.1 Fetches and displays active templates with department, SLA, and approval badges', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { templates: [mockMediaBuyingTemplate] },
        error: null
      });

      render(
        <TaskTemplatePickerModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectTemplate={vi.fn()}
          onCreateBlankInstead={vi.fn()}
          client={mockClient}
          weekNumber={1}
          departments={mockDepartments}
        />
      );

      expect(screen.getByText(/loading templates/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Media Buying Campaign Setup & Launch')).toBeInTheDocument();
      });

      expect(screen.getByText(/5d SLA/i)).toBeInTheDocument();
      expect(screen.getByText('Client Approval Required')).toBeInTheDocument();
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /preview sop/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /use template/i })).toBeInTheDocument();
    });

    it('3.2 Filters templates by search query', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          templates: [
            mockMediaBuyingTemplate,
            {
              ...mockMediaBuyingTemplate,
              id: 'tpl-2',
              name: 'SEO Technical Audit',
              defaultTaskTitle: 'Comprehensive Site Crawl and Schema Validation',
              status: 'Active'
            }
          ]
        },
        error: null
      });

      render(
        <TaskTemplatePickerModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectTemplate={vi.fn()}
          onCreateBlankInstead={vi.fn()}
          client={mockClient}
          weekNumber={1}
          departments={mockDepartments}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Media Buying Campaign Setup & Launch')).toBeInTheDocument();
        expect(screen.getByText('SEO Technical Audit')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search templates/i);
      fireEvent.change(searchInput, { target: { value: 'SEO' } });

      expect(screen.queryByText('Media Buying Campaign Setup & Launch')).not.toBeInTheDocument();
      expect(screen.getByText('SEO Technical Audit')).toBeInTheDocument();
    });

    it('3.3 Filters templates by department dropdown', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          templates: [
            mockMediaBuyingTemplate,
            {
              ...mockMediaBuyingTemplate,
              id: 'tpl-creative',
              name: 'Creative Video Asset Pack',
              departmentId: 'dept-creative',
              departmentName: 'Creative & Media',
              status: 'Active'
            }
          ]
        },
        error: null
      });

      render(
        <TaskTemplatePickerModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectTemplate={vi.fn()}
          onCreateBlankInstead={vi.fn()}
          client={mockClient}
          weekNumber={1}
          departments={mockDepartments}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Media Buying Campaign Setup & Launch')).toBeInTheDocument();
        expect(screen.getByText('Creative Video Asset Pack')).toBeInTheDocument();
      });

      const deptSelect = screen.getByLabelText(/filter by department/i);
      fireEvent.change(deptSelect, { target: { value: 'dept-creative' } });

      expect(screen.queryByText('Media Buying Campaign Setup & Launch')).not.toBeInTheDocument();
      expect(screen.getByText('Creative Video Asset Pack')).toBeInTheDocument();
    });

    it('3.4 Displays graceful fallback notice and Create Blank Task button when backend is unavailable', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: null,
        error: 'relation "public.task_templates" does not exist'
      });
      mockFrom.mockReturnValueOnce({
        select: () => ({
          order: () => ({
            order: () => ({
              eq: () => Promise.resolve({ data: null, error: { message: 'relation "task_templates" does not exist' } })
            })
          })
        })
      });

      const onCreateBlank = vi.fn();

      render(
        <TaskTemplatePickerModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectTemplate={vi.fn()}
          onCreateBlankInstead={onCreateBlank}
          client={mockClient}
          weekNumber={1}
          departments={mockDepartments}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Template library is currently synchronizing/i)).toBeInTheDocument();
      });

      const fallbackBtns = screen.getAllByRole('button', { name: /create blank task instead/i });
      fireEvent.click(fallbackBtns[0]);
      expect(onCreateBlank).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 4. CREATING TASK FROM TEMPLATE (CreateClientTaskModal)
  // --------------------------------------------------------------------------
  describe('4. Create Task from Template Prefill & Provenance', () => {
    it('4.1 Prefills fields, calculates business day due date, and shows template provenance badge', async () => {
      render(
        <CreateClientTaskModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          client={mockClient}
          weekNumber={2}
          departments={mockDepartments}
          eligibleAssignees={[mockManager]}
          initialTemplate={mockMediaBuyingTemplate}
        />
      );

      // Title prefilled
      expect(screen.getByDisplayValue(mockMediaBuyingTemplate.defaultTaskTitle)).toBeInTheDocument();
      // Details prefilled
      expect(screen.getByDisplayValue(/Confirm client access to Meta Business Manager/i)).toBeInTheDocument();
      // Approval mode prefilled
      expect(screen.getByLabelText(/approval mode/i)).toHaveValue('Client Approval Required');
      // Provenance banner shown
      expect(screen.getByText(/Template: Media Buying Campaign Setup & Launch/i)).toBeInTheDocument();
      expect(screen.getByText(/v1/i)).toBeInTheDocument();
    });

    it('4.2 Allows user to edit prefilled fields freely before task submission', async () => {
      render(
        <CreateClientTaskModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          client={mockClient}
          weekNumber={1}
          departments={mockDepartments}
          eligibleAssignees={[mockManager]}
          initialTemplate={mockMediaBuyingTemplate}
        />
      );

      const titleInput = screen.getByDisplayValue(mockMediaBuyingTemplate.defaultTaskTitle);
      fireEvent.change(titleInput, { target: { value: 'Custom Client Campaign Setup (Q4)' } });
      expect(screen.getByDisplayValue('Custom Client Campaign Setup (Q4)')).toBeInTheDocument();
    });

    it('4.3 Sends sourceTemplateId and sourceTemplateVersion to createTask on submission', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          task: {
            id: 'task-new-1',
            client_id: mockClient.id,
            week_number: 1,
            title: mockMediaBuyingTemplate.defaultTaskTitle,
            department_id: 'dept-paid-ads',
            priority: 'Normal',
            approval_mode: 'Client Approval Required',
            planned_start: '2026-09-07T09:00:00.000Z',
            due_date: '2026-09-11T18:00:00.000Z',
            status: 'Draft',
            source_template_id: mockMediaBuyingTemplate.id,
            source_template_version: mockMediaBuyingTemplate.version,
            created_at: new Date().toISOString()
          }
        },
        error: null
      });

      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <CreateClientTaskModal
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          client={mockClient}
          weekNumber={1}
          departments={mockDepartments}
          eligibleAssignees={[mockManager]}
          initialTemplate={mockMediaBuyingTemplate}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /create task/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'manage-client-task',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'create',
            source_template_id: 'tpl-1',
            source_template_version: 1
          })
        })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 5. SETTINGS: TASK TEMPLATES LIBRARY (TaskTemplatesView)
  // --------------------------------------------------------------------------
  describe('5. Task Templates Library Governance & RBAC', () => {
    it('5.1 Strict RBAC: Client role sees Access Restricted and cannot view templates', () => {
      render(<TaskTemplatesView currentUserProfile={mockClientUser} />);

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(screen.queryByText('+ Create Template')).not.toBeInTheDocument();
    });

    it('5.2 Strict RBAC: Team Member role sees Access Restricted', () => {
      render(<TaskTemplatesView currentUserProfile={mockTeamMember} />);

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(screen.queryByText('+ Create Template')).not.toBeInTheDocument();
    });

    it('5.3 Owner role sees + Create Template button and action controls', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { templates: [mockMediaBuyingTemplate] },
        error: null
      });

      render(<TaskTemplatesView currentUserProfile={mockOwner} />);

      await waitFor(() => {
        expect(screen.getByText('+ Create Template')).toBeInTheDocument();
        expect(screen.getByText('Media Buying Campaign Setup & Launch')).toBeInTheDocument();
      });

      // Actions present: Preview, Duplicate, Edit, Archive
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
      expect(screen.getByTitle(/duplicate template/i)).toBeInTheDocument();
      expect(screen.getByTitle(/edit template/i)).toBeInTheDocument();
      expect(screen.getByTitle(/archive template/i)).toBeInTheDocument();
    });

    it('5.4 Operational Manager role can view active templates but cannot edit or archive', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { templates: [mockMediaBuyingTemplate] },
        error: null
      });

      render(<TaskTemplatesView currentUserProfile={mockManager} />);

      await waitFor(() => {
        expect(screen.getByText('Media Buying Campaign Setup & Launch')).toBeInTheDocument();
      });

      // Cannot see management actions
      expect(screen.queryByText('+ Create Template')).not.toBeInTheDocument();
      expect(screen.queryByTitle(/duplicate template/i)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/edit template/i)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/archive template/i)).not.toBeInTheDocument();
      // Can still preview SOP
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
    });

    it('5.5 Owner can toggle to Archived tab and view archived templates with archive reasons', async () => {
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { templates: [mockMediaBuyingTemplate, mockArchivedTemplate] },
        error: null
      });

      render(<TaskTemplatesView currentUserProfile={mockOwner} />);

      await waitFor(() => {
        expect(screen.getByText('Active (1)')).toBeInTheDocument();
        expect(screen.getByText('Archived (1)')).toBeInTheDocument();
      });

      // Switch to Archived tab
      const archivedTab = screen.getByRole('button', { name: /archived/i });
      fireEvent.click(archivedTab);

      expect(screen.getByText('Deprecated Campaign Flow')).toBeInTheDocument();
      expect(screen.getByText(/Replaced by Media Buying 2026 framework/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    });

    it('5.6 Duplicate template creates a copy with version 1', async () => {
      const duplicatedTpl: TaskTemplate = {
        ...mockMediaBuyingTemplate,
        id: 'tpl-copy-1',
        name: 'Media Buying Campaign Setup & Launch (Copy)',
        version: 1,
        createdAt: new Date().toISOString()
      };

      mockFunctionsInvoke
        .mockResolvedValueOnce({ data: { templates: [mockMediaBuyingTemplate] }, error: null }) // load
        .mockResolvedValueOnce({ data: { success: true, template: duplicatedTpl }, error: null }); // duplicate

      render(<TaskTemplatesView currentUserProfile={mockOwner} />);

      await waitFor(() => {
        expect(screen.getByText('Media Buying Campaign Setup & Launch')).toBeInTheDocument();
      });

      const duplicateBtn = screen.getByTitle(/duplicate template/i);
      await act(async () => {
        fireEvent.click(duplicateBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Media Buying Campaign Setup & Launch (Copy)')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // 6. ARCHIVE MODAL WITH MANDATORY REASON
  // --------------------------------------------------------------------------
  describe('6. Archive Template Modal', () => {
    it('6.1 Requires mandatory non-empty archive reason before submission', async () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <ArchiveTemplateModal
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          template={mockMediaBuyingTemplate}
        />
      );

      expect(screen.getByText('Archive Template')).toBeInTheDocument();
      expect(screen.getByText(/Existing tasks instantiated from this template will remain completely unaffected/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /confirm archive/i });
      expect(confirmBtn).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/Replaced by 2026 Q4 campaign strategy/i);
      fireEvent.change(textarea, { target: { value: 'Process deprecated in favor of Q4 setup' } });

      expect(confirmBtn).not.toBeDisabled();
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(onConfirm).toHaveBeenCalledWith('Process deprecated in favor of Q4 setup');
      expect(onClose).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 7. READ-ONLY SOP PREVIEW MODAL
  // --------------------------------------------------------------------------
  describe('7. SOP Checklist Preview Modal', () => {
    it('7.1 Renders complete checklist, SLA, approval mode, and default task title in read-only mode', () => {
      render(
        <TemplatePreviewModal
          isOpen={true}
          onClose={vi.fn()}
          template={mockMediaBuyingTemplate}
        />
      );

      expect(screen.getByText('Media Buying Campaign Setup & Launch')).toBeInTheDocument();
      expect(screen.getByText('5 Business Days')).toBeInTheDocument();
      expect(screen.getByText('Client Approval Required')).toBeInTheDocument();
      expect(screen.getByText('Meta & Google Ads Campaign Setup and Tracking Audit')).toBeInTheDocument();
      expect(screen.getByText(/1. Confirm client access to Meta Business Manager/i)).toBeInTheDocument();
      expect(screen.getByText(/9. Enable campaigns and verify active ad delivery/i)).toBeInTheDocument();
    });
  });
});
