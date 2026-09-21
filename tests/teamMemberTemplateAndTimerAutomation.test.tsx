import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ServiceTemplatesView } from '../src/components/templates/ServiceTemplatesView';
import { TaskTemplatesView } from '../src/components/templates/TaskTemplatesView';
import { PersonalCrossClientKanban, PersonalKanbanCard } from '../src/components/dashboard/PersonalCrossClientKanban';
import { ClientKanbanBoard } from '../src/components/tasks/ClientKanbanBoard';
import { ClientTask, ClientRecord, UserProfile, ServiceTemplate, TaskTemplate, Department } from '../src/types';
import { serviceTemplateService } from '../src/lib/serviceTemplateService';
import { taskTemplateService } from '../src/lib/taskTemplateService';
import { taskManagementService } from '../src/lib/taskManagementService';

vi.mock('../src/lib/serviceTemplateService', () => ({
  serviceTemplateService: {
    fetchTemplates: vi.fn(),
    duplicateTemplate: vi.fn().mockResolvedValue({ success: true, data: { id: 'st-copy' } }),
    archiveTemplate: vi.fn().mockResolvedValue({ success: true }),
    restoreTemplate: vi.fn().mockResolvedValue({ success: true })
  }
}));

vi.mock('../src/lib/taskTemplateService', () => ({
  taskTemplateService: {
    fetchTemplates: vi.fn(),
    duplicateTemplate: vi.fn().mockResolvedValue({ error: null, data: { id: 'tt-copy', name: 'Task Template (Copy)' } }),
    archiveTemplate: vi.fn().mockResolvedValue({ error: null, data: { id: 'tt-1', status: 'Archived' } }),
    restoreTemplate: vi.fn().mockResolvedValue({ error: null, data: { id: 'tt-1', status: 'Active' } })
  }
}));

vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    fetchDepartments: vi.fn().mockResolvedValue([
      { id: 'dept-1', name: 'Social Media', slug: 'social-media' },
      { id: 'dept-2', name: 'Paid Ads', slug: 'paid-ads' }
    ]),
    startWork: vi.fn().mockResolvedValue({ error: null }),
    startTimer: vi.fn().mockResolvedValue({ error: null }),
    stopTimer: vi.fn().mockResolvedValue({ error: null }),
    pauseTimer: vi.fn().mockResolvedValue({ error: null, elapsedSecs: 120 }),
    resumeTimer: vi.fn().mockResolvedValue({ error: null }),
    updateKanbanStatus: vi.fn().mockResolvedValue({ error: null }),
    reopenTask: vi.fn().mockResolvedValue({ error: null }),
    fetchTodayWorkedTasks: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../src/lib/safeRouterHooks', () => ({
  useSafeNavigate: () => vi.fn()
}));

const mockMemberUser: UserProfile = {
  id: 'usr-member-1',
  fullName: 'Alex Team Member',
  workEmail: 'alex@flc.com',
  role: 'team_member',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockOwnerUser: UserProfile = {
  id: 'usr-owner-1',
  fullName: 'Sarah Owner',
  workEmail: 'sarah@flc.com',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockServiceTemplates: ServiceTemplate[] = [
  {
    id: 'st-own',
    name: 'Social Media Launch (Created by Member)',
    serviceLabel: 'Social Media',
    description: 'Member created template',
    status: 'Active',
    version: 1,
    sortOrder: 1,
    createdBy: 'usr-member-1',
    createdByName: 'Alex Team Member',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    tasks: [
      {
        id: 'stt-1',
        definitionId: 'def-1',
        title: 'Draft Content Strategy',
        departmentId: 'dept-1',
        departmentName: 'Social Media',
        priority: 'Normal',
        approvalMode: 'Internal Only',
        plannedOffsetDays: 0,
        durationBusinessDays: 2,
        displayOrder: 0
      }
    ]
  },
  {
    id: 'st-other',
    name: 'Paid Ads Setup (Created by Owner)',
    serviceLabel: 'Paid Ads',
    description: 'Owner created template',
    status: 'Active',
    version: 1,
    sortOrder: 2,
    createdBy: 'usr-owner-1',
    createdByName: 'Sarah Owner',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    tasks: [
      {
        id: 'stt-2',
        definitionId: 'def-2',
        title: 'Pixel Audit & Conversion Setup',
        departmentId: 'dept-2',
        departmentName: 'Paid Ads',
        priority: 'High',
        approvalMode: 'Client Approval Required',
        plannedOffsetDays: 0,
        durationBusinessDays: 3,
        displayOrder: 0
      }
    ]
  }
];

const mockClients: ClientRecord[] = [
  {
    id: 'cli-1',
    companyName: 'Acme Growth Co',
    clientName: 'John Doe',
    clientEmail: 'john@acme.com',
    status: 'Active',
    activePlanWeeks: 4,
    currentWeekNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }
];

const mockTasks: ClientTask[] = [
  {
    id: 'task-pending-1',
    clientId: 'cli-1',
    clientName: 'Acme Growth Co',
    title: 'Design Hero Banners',
    status: 'Assigned',
    priority: 'High',
    assigneeId: 'usr-member-1',
    assigneeName: 'Alex Team Member',
    dueDate: '2026-09-30',
    timeSpentSeconds: 0,
    timerStartedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'task-inprogress-1',
    clientId: 'cli-1',
    clientName: 'Acme Growth Co',
    title: 'Configure Analytics Funnel',
    status: 'In Progress',
    priority: 'Urgent',
    assigneeId: 'usr-member-1',
    assigneeName: 'Alex Team Member',
    dueDate: '2026-09-28',
    timeSpentSeconds: 120,
    timerStartedAt: new Date(Date.now() - 30000).toISOString(), // 30s running
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  }
];

describe('Team Member Template Permissions & Dashboard Drag/Click Timer Automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (serviceTemplateService.fetchTemplates as any).mockResolvedValue({
      data: mockServiceTemplates,
      error: null
    });
  });

  describe('1. Team Member Service Template Permissions', () => {
    it('1.1 Team member can view Service Templates view and see the Create button', async () => {
      render(<ServiceTemplatesView currentUserProfile={mockMemberUser} />);

      await waitFor(() => {
        expect(screen.getByText('Service Templates Library')).toBeInTheDocument();
      });

      expect(screen.getByText('New Service Template')).toBeInTheDocument();
      expect(screen.getByText('Social Media Launch (Created by Member)')).toBeInTheDocument();
      expect(screen.getByText('Paid Ads Setup (Created by Owner)')).toBeInTheDocument();
    });

    it('1.2 Team member can edit their OWN template, but sees View Only on templates made by others', async () => {
      render(<ServiceTemplatesView currentUserProfile={mockMemberUser} />);

      await waitFor(() => {
        expect(screen.getByText('Social Media Launch (Created by Member)')).toBeInTheDocument();
      });

      // Own template has Edit button
      const ownCard = screen.getByText('Social Media Launch (Created by Member)').closest('.group')!;
      expect(ownCard).not.toBeNull();
      expect(ownCard.querySelector('button[title="Edit Service Template"]')).toBeInTheDocument();

      // Other user template has View Only indicator and NO Edit button
      const otherCard = screen.getByText('Paid Ads Setup (Created by Owner)').closest('.group')!;
      expect(otherCard).not.toBeNull();
      expect(otherCard.querySelector('button[title="Edit Service Template"]')).not.toBeInTheDocument();
      expect(otherCard.textContent).toContain('View Only');
    });

    it('1.3 Owner can edit ALL templates and see Archive button', async () => {
      render(<ServiceTemplatesView currentUserProfile={mockOwnerUser} />);

      await waitFor(() => {
        expect(screen.getByText('Social Media Launch (Created by Member)')).toBeInTheDocument();
      });

      const ownCard = screen.getByText('Social Media Launch (Created by Member)').closest('.group')!;
      const otherCard = screen.getByText('Paid Ads Setup (Created by Owner)').closest('.group')!;

      expect(ownCard).not.toBeNull();
      expect(otherCard).not.toBeNull();
      expect(ownCard.querySelector('button[title="Edit Service Template"]')).toBeInTheDocument();
      expect(otherCard.querySelector('button[title="Edit Service Template"]')).toBeInTheDocument();
      expect(screen.getAllByText('Archive').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Dashboard Drag-to-Start & Click-to-Start Timer Automation', () => {
    it('2.1 Clicking "Start" on a Pending Kanban card starts work and moves task to In Progress', async () => {
      const onRefresh = vi.fn();
      render(
        <PersonalCrossClientKanban
          tasks={mockTasks}
          clients={mockClients}
          currentUserProfile={mockMemberUser}
          onRefreshTasks={onRefresh}
        />
      );

      const startBtn = screen.getByTestId('start-work-btn-task-pending-1');
      expect(startBtn).toBeInTheDocument();
      expect(startBtn.textContent).toContain('Start');

      await act(async () => {
        fireEvent.click(startBtn);
      });

      expect(taskManagementService.startWork).toHaveBeenCalledWith(
        'task-pending-1',
        'cli-1',
        'Alex Team Member',
        'Design Hero Banners'
      );
      expect(onRefresh).toHaveBeenCalled();
    });

    it('2.2 Dragging a task from Pending to In Progress column automatically calls startWork and starts timer', async () => {
      const onRefresh = vi.fn();
      render(
        <PersonalCrossClientKanban
          tasks={mockTasks}
          clients={mockClients}
          currentUserProfile={mockMemberUser}
          onRefreshTasks={onRefresh}
        />
      );

      const inProgressColumn = screen.getByText('In Progress').closest('div')!;

      const dragData = JSON.stringify({ taskId: 'task-pending-1', currentStatus: 'Assigned' });
      await act(async () => {
        fireEvent.drop(inProgressColumn, {
          dataTransfer: {
            getData: () => dragData
          }
        });
      });

      expect(taskManagementService.startWork).toHaveBeenCalledWith(
        'task-pending-1',
        'cli-1',
        'Alex Team Member',
        'Design Hero Banners'
      );
      expect(onRefresh).toHaveBeenCalled();
    });

    it('2.3 PersonalKanbanCard ticks live seconds dynamically when timer is active', async () => {
      vi.useFakeTimers();

      render(
        <PersonalKanbanCard
          task={mockTasks[1]} // timer active with 30s elapsed + 120s prior = 150s (2m 30s)
          currentUserProfile={mockMemberUser}
          isOwnerOrManager={false}
          actionLoadingTaskId={null}
          onStartWork={vi.fn()}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onOpenDeliverableModal={vi.fn()}
          onApproveDeliverable={vi.fn()}
          onReopenTask={vi.fn()}
        />
      );

      expect(screen.getByText('2m 30s')).toBeInTheDocument();

      // Advance by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText('2m 35s')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('3. Workspace ClientKanbanBoard Drag-to-Start', () => {
    it('3.1 Dropping a Pending task onto In Progress triggers onStartWork', async () => {
      const onStartWork = vi.fn();
      const onStatusChange = vi.fn();

      render(
        <ClientKanbanBoard
          client={mockClients[0]}
          tasks={mockTasks}
          currentUserProfile={mockMemberUser}
          onSelectTask={vi.fn()}
          onOpenEditModal={vi.fn()}
          onOpenCreateTask={vi.fn()}
          onStatusChange={onStatusChange}
          onStartWork={onStartWork}
          onPauseTimer={vi.fn()}
          onResumeTimer={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      const inProgressColumn = screen.getByTestId('kanban-column-in-progress');
      const dragData = JSON.stringify({ taskId: 'task-pending-1', currentStatus: 'Assigned' });

      await act(async () => {
        fireEvent.drop(inProgressColumn, {
          dataTransfer: {
            getData: () => dragData
          }
        });
      });

      expect(onStartWork).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-pending-1', title: 'Design Hero Banners' })
      );
    });
  });
});
