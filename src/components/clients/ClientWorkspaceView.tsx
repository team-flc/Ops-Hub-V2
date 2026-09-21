import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Info, Plus, Sparkles, Loader2, Layers, AlertTriangle } from 'lucide-react';
import { 
  ClientRecord, 
  ClientTask, 
  ClientTaskStatus, 
  Department, 
  UserProfile,
  DEFAULT_WEEK_NAMES
} from '../../types';
import { SelectedClientHeader } from './SelectedClientHeader';
import { ClientDetailsTab } from './ClientDetailsTab';
import { ClientWeekStepper } from './ClientWeekStepper';
import { ClientKanbanBoard } from '../tasks/ClientKanbanBoard';
import { TaskCreationModeModal } from '../tasks/TaskCreationModeModal';
import { CreateClientTaskModal } from '../tasks/CreateClientTaskModal';
import { EditClientTaskModal } from '../tasks/EditClientTaskModal';
import { TaskTemplate } from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';

const TaskTemplatePickerModal = React.lazy(() =>
  import('../tasks/TaskTemplatePickerModal').then((m) => ({ default: m.TaskTemplatePickerModal }))
);
const ApplyServiceTemplateModal = React.lazy(() =>
  import('../tasks/ApplyServiceTemplateModal').then((m) => ({ default: m.ApplyServiceTemplateModal }))
);
const ClientTaskDetailsModal = React.lazy(() =>
  import('../tasks/ClientTaskDetailsModal').then((m) => ({ default: m.ClientTaskDetailsModal }))
);
const ClientWorkPlanView = React.lazy(() =>
  import('../workplans/ClientWorkPlanView').then((m) => ({ default: m.ClientWorkPlanView }))
);

interface ClientWorkspaceViewProps {
  client: ClientRecord;
  currentUserProfile?: UserProfile | null;
  eligibleManagers: UserProfile[];
  onClientUpdated: (updated: ClientRecord) => void;
}

type MainTab = 'setup' | 'workplans' | 'details';
type WeekTab = 'week1' | 'week2' | 'week3' | 'week4';

export const ClientWorkspaceView: React.FC<ClientWorkspaceViewProps> = ({
  client,
  currentUserProfile,
  eligibleManagers,
  onClientUpdated
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('setup');
  const [activeWeek, setActiveWeek] = useState<WeekTab>('week1');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Week Names State
  const [weekNames, setWeekNames] = useState<Record<1 | 2 | 3 | 4, string>>(DEFAULT_WEEK_NAMES);

  // Phase 3A Tasks State
  const [allTasks, setAllTasks] = useState<ClientTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Departments & Eligible Assignees
  const [departments, setDepartments] = useState<Department[]>([]);
  const [eligibleAssignees, setEligibleAssignees] = useState<UserProfile[]>([]);

  // Modals
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isApplyTemplateOpen, setIsApplyTemplateOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplateForCreation, setSelectedTemplateForCreation] = useState<TaskTemplate | null>(null);
  const [modalWeekNumber, setModalWeekNumber] = useState<1 | 2 | 3 | 4>(1);
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<ClientTask | null>(null);

  const weekTabs: { id: WeekTab; weekNum: 1 | 2 | 3 | 4; label: string }[] = [
    { id: 'week1', weekNum: 1, label: 'Week 1' },
    { id: 'week2', weekNum: 2, label: 'Week 2' },
    { id: 'week3', weekNum: 3, label: 'Week 3' },
    { id: 'week4', weekNum: 4, label: 'Week 4' }
  ];

  const currentWeekNum = (weekTabs.find((w) => w.id === activeWeek)?.weekNum || 1) as 1 | 2 | 3 | 4;

  const handleOpenCreateTaskFlow = () => {
    setModalWeekNumber(currentWeekNum);
    setIsModeModalOpen(true);
  };

  const handleSelectMode = (mode: 'template' | 'blank' | 'service_template', week: 1 | 2 | 3 | 4) => {
    setModalWeekNumber(week);
    setIsModeModalOpen(false);
    if (mode === 'template' || mode === 'service_template') {
      setIsApplyTemplateOpen(true);
    } else {
      setSelectedTemplateForCreation(null);
      setIsCreateModalOpen(true);
    }
  };

  const handleSelectTemplate = (template: TaskTemplate) => {
    setSelectedTemplateForCreation(template);
    setIsTemplatePickerOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleCreateBlankFromPicker = () => {
    setSelectedTemplateForCreation(null);
    setIsTemplatePickerOpen(false);
    setIsCreateModalOpen(true);
  };

  const isOwnerOrManager = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';

  // Load Departments & Eligible Assignees & Week Names on mount
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const [depts, assignees, weeksRes] = await Promise.all([
          taskManagementService.fetchDepartments(),
          taskManagementService.fetchEligibleAssignees(client.id),
          taskManagementService.fetchClientWeeks(client.id)
        ]);
        if (isMounted) {
          setDepartments(depts);
          setEligibleAssignees(assignees);
          if (weeksRes.data) {
            setWeekNames(weeksRes.data);
          }
        }
      } catch (err) {
        console.warn('Failed to load task metadata:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [client.id]);

  // Fetch all tasks for this client to populate week-stepper counts and active week Kanban board
  const loadTasks = useCallback(async () => {
    if (!client.id) return;
    setIsLoadingTasks(true);
    try {
      const res = await taskManagementService.fetchClientTasks(client.id);
      if (!res.error && res.data) {
        setAllTasks(res.data);
      }
    } catch {
      // Keep current tasks on failure
    } finally {
      setIsLoadingTasks(false);
    }
  }, [client.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const tasksByWeek: Record<1 | 2 | 3 | 4, ClientTask[]> = useMemo(() => {
    return {
      1: allTasks.filter((t) => t.weekNumber === 1),
      2: allTasks.filter((t) => t.weekNumber === 2),
      3: allTasks.filter((t) => t.weekNumber === 3),
      4: allTasks.filter((t) => t.weekNumber === 4)
    };
  }, [allTasks]);

  const currentWeekTasks = useMemo(() => {
    return tasksByWeek[currentWeekNum] || [];
  }, [tasksByWeek, currentWeekNum]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRenameWeek = async (weekNum: 1 | 2 | 3 | 4, newName: string) => {
    const res = await taskManagementService.renameClientWeek(client.id, weekNum, newName);
    if (res.error) {
      showToast(`Rename failed: ${res.error}`);
    } else {
      setWeekNames((prev) => ({ ...prev, [weekNum]: newName }));
      showToast(`Week ${weekNum} renamed to "${newName}".`);
    }
  };

  const handleTaskCreated = (newTask: ClientTask) => {
    setAllTasks((prev) => [newTask, ...prev]);
    showToast(`Task "${newTask.title}" created successfully.`);
  };

  const handleTaskUpdated = (updatedTask: ClientTask) => {
    setAllTasks((prev) => {
      if (updatedTask.archivedAt) {
        return prev.filter((t) => t.id !== updatedTask.id);
      }
      return prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
    });

    if (selectedTaskDetails?.id === updatedTask.id) {
      setSelectedTaskDetails((prev) => (updatedTask.archivedAt ? null : (prev ? { ...prev, ...updatedTask } : updatedTask)));
    }
  };

  const handleTasksArchived = (archivedTaskIds: string[]) => {
    setAllTasks((prev) => prev.filter((t) => !archivedTaskIds.includes(t.id)));
    if (selectedTaskDetails && archivedTaskIds.includes(selectedTaskDetails.id)) {
      setSelectedTaskDetails(null);
    }
  };

  const handleStartWork = async (task: ClientTask) => {
    if (!task.assigneeId) {
      showToast('Assign a Team Member before starting this task.');
      return;
    }
    try {
      const assigneeName = task.assigneeName || 'Team Member';
      const res = await taskManagementService.startWork(task.id, task.clientId, assigneeName, task.title);
      if (res.error) {
        showToast(`Failed to start work: ${res.error}`);
      } else {
        const updated: ClientTask = {
          ...task,
          status: 'In Progress',
          timerStartedAt: new Date().toISOString(),
          feedback: null
        };
        handleTaskUpdated(updated);
        showToast(`Started work on "${task.title}". Timer running.`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to start work.');
    }
  };

  const handlePauseTimer = async (task: ClientTask) => {
    if (!task.timerStartedAt) return;
    try {
      const res = await taskManagementService.pauseTimer(
        task.id,
        task.timerStartedAt,
        task.timeSpentSeconds,
        task.pausedSeconds
      );
      if (res.error) {
        showToast(`Failed to pause timer: ${res.error}`);
      } else {
        const updated: ClientTask = {
          ...task,
          timerStartedAt: null,
          timeSpentSeconds: res.elapsedSecs !== undefined ? res.elapsedSecs : task.timeSpentSeconds,
          pausedSeconds: (task.pausedSeconds || 0)
        };
        handleTaskUpdated(updated);
        showToast(`Timer paused for "${task.title}".`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Timer pause failed.');
    }
  };

  const handleResumeTimer = async (task: ClientTask) => {
    try {
      const assigneeName = task.assigneeName || currentUserProfile?.fullName || 'Team';
      const res = await taskManagementService.resumeTimer(task.id, task.clientId, assigneeName, task.title);
      if (res.error) {
        showToast(`Failed to resume timer: ${res.error}`);
      } else {
        const updated: ClientTask = {
          ...task,
          timerStartedAt: new Date().toISOString()
        };
        handleTaskUpdated(updated);
        showToast(`Timer resumed for "${task.title}".`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Timer resume failed.');
    }
  };

  const handleKanbanStatusChange = async (
    task: ClientTask,
    newStatus: ClientTaskStatus,
    options?: {
      reason?: string;
      feedback?: string;
      evidenceUrl?: string;
      completionNotes?: string;
    }
  ) => {
    try {
      // Role permission check: only management can approve to Done
      if (newStatus === 'Done' || newStatus === 'Completed') {
        if (!isOwnerOrManager) {
          showToast('Forbidden: Only Owner or Operational Manager can approve tasks to Done.');
          return;
        }
      }

      // For Approval submissions: use the new submitForApproval path
      if (newStatus === 'Approval') {
        const res = await taskManagementService.submitForApproval(task.id, {
          timerStartedAt: task.timerStartedAt,
          timeSpentSeconds: task.timeSpentSeconds,
          pausedSeconds: task.pausedSeconds,
          evidenceUrl: options?.evidenceUrl,
          completionNotes: options?.completionNotes
        });
        if (res.error) {
          showToast(`Submission failed: ${res.error}`);
        } else {
          const updated: ClientTask = {
            ...task,
            status: 'Approval',
            timerStartedAt: null,
            timeSpentSeconds: res.finalActiveSeconds !== undefined ? res.finalActiveSeconds : task.timeSpentSeconds,
            evidenceUrl: options?.evidenceUrl !== undefined ? options.evidenceUrl : task.evidenceUrl,
            completionNotes: options?.completionNotes !== undefined ? options.completionNotes : task.completionNotes
          };
          handleTaskUpdated(updated);
          showToast(`Task "${task.title}" submitted for approval.`);
        }
        return;
      }

      const res = await taskManagementService.updateKanbanStatus(task.id, newStatus, {
        reason: options?.reason,
        feedback: options?.feedback,
        evidenceUrl: options?.evidenceUrl,
        completionNotes: options?.completionNotes,
        timerStartedAt: task.timerStartedAt,
        timeSpentSeconds: task.timeSpentSeconds,
        currentStatus: task.status
      });

      if (res.error) {
        showToast(`Status update failed: ${res.error}`);
      } else {
        let computedTime = task.timeSpentSeconds || 0;
        if (newStatus === 'Done' && task.timerStartedAt) {
          const startMs = new Date(task.timerStartedAt).getTime();
          if (!isNaN(startMs)) {
            computedTime += Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          }
        }

        const updated: ClientTask = {
          ...task,
          status: newStatus,
          feedback: options?.feedback !== undefined ? options.feedback : task.feedback,
          evidenceUrl: options?.evidenceUrl !== undefined ? options.evidenceUrl : task.evidenceUrl,
          completionNotes: options?.completionNotes !== undefined ? options.completionNotes : task.completionNotes,
          timerStartedAt: newStatus === 'Done' ? null : task.timerStartedAt,
          timeSpentSeconds: computedTime,
          completedAt: (newStatus === 'Done' || newStatus === 'Completed') ? new Date().toISOString() : task.completedAt
        };
        handleTaskUpdated(updated);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to update task status.');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-gray-50/50 dark:bg-dark-400 select-none">
      {/* 1. Selected Client Top Header */}
      <SelectedClientHeader client={client} currentUserProfile={currentUserProfile} />

      {/* Paused Client Warning Banner */}
      {client.status === 'Paused' && (
        <div className="bg-brand-500/10 border-b border-brand-500/20 px-4 sm:px-6 py-3 flex items-center gap-3 text-brand-800 dark:text-brand-300 text-xs font-semibold animate-fade-in">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-brand-600 dark:text-brand-400" />
          <div className="flex-1">
            <span>Workspace Paused: This client organization is currently paused ({client.pauseReason || 'Operational reason'}). Creating new tasks and active work mutations are blocked.</span>
          </div>
        </div>
      )}

      {/* 2. Top-Level Tab Navigation (30-Day Setup, 90-Day Work Plans, and Client Details) */}
      <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-2 px-4 py-3 min-h-[44px] text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'setup'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>30-Day Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workplans')}
            className={`flex items-center gap-2 px-4 py-3 min-h-[44px] text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'workplans'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>90-Day Work Plans</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-4 py-3 min-h-[44px] text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Client Details</span>
          </button>
        </div>
      </div>

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-[calc(100vw-2rem)] animate-bounce">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold shadow-2xl border border-gray-700/30">
            <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 3. Main Tab Content */}
      <div className="flex-1 min-w-0">
        {/* TAB 1: 30-DAY SETUP WORKSPACE */}
        {activeTab === 'setup' && (
          <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-6">
            {/* 1. Polished Compact Week Stepper with Rename controls */}
            <ClientWeekStepper
              client={client}
              activeWeekNum={currentWeekNum}
              onSelectWeek={(wk) => setActiveWeek(`week${wk}` as WeekTab)}
              weekNames={weekNames}
              onRenameWeek={handleRenameWeek}
              tasksByWeek={tasksByWeek}
              currentUserProfile={currentUserProfile}
            />

            {/* 2. Week Action Bar & Kanban Board */}
            <div className="space-y-4">
              {/* Header Action Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Week {currentWeekNum}: {weekNames[currentWeekNum]} ({currentWeekTasks.length} {currentWeekTasks.length === 1 ? 'Task' : 'Tasks'})
                  </span>
                  {isLoadingTasks && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />}
                </div>

                {currentUserProfile?.role !== 'client' && (
                  client.status === 'Paused' ? (
                    <span 
                      className="px-3.5 py-2 min-h-[44px] rounded-xl bg-gray-100 dark:bg-dark-200 border border-gray-300 dark:border-dark-border text-gray-500 dark:text-gray-400 text-xs font-bold flex items-center gap-1.5 opacity-80 cursor-not-allowed"
                      title="Task creation is blocked while client organization is paused."
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-brand-500" />
                      <span>Tasks Paused</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label="+ Add Task"
                      onClick={handleOpenCreateTaskFlow}
                      className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Task</span>
                    </button>
                  )
                )}
              </div>

              {/* Responsive 4-Column Kanban Task Board */}
              <ClientKanbanBoard
                client={client}
                tasks={currentWeekTasks}
                weekNumber={currentWeekNum}
                weekName={weekNames[currentWeekNum]}
                currentUserProfile={currentUserProfile}
                onSelectTask={(t) => setSelectedTaskDetails(t)}
                onOpenEditModal={(t) => setEditingTask(t)}
                onOpenCreateTask={handleOpenCreateTaskFlow}
                onStatusChange={handleKanbanStatusChange}
                onStartWork={handleStartWork}
                onPauseTimer={handlePauseTimer}
                onResumeTimer={handleResumeTimer}
                onTasksArchived={handleTasksArchived}
                onShowToast={showToast}
              />
            </div>
          </div>
        )}

        {/* TAB 2: 90-DAY WORK PLANS (Phase 3D) */}
        {activeTab === 'workplans' && (
          <React.Suspense
            fallback={
              <div className="p-12 flex items-center justify-center text-gray-400 text-xs">
                <span className="animate-pulse">Loading 90-Day Work Plans...</span>
              </div>
            }
          >
            <ClientWorkPlanView
              client={client}
              currentUserProfile={currentUserProfile}
              departments={departments}
              onSelectWeek={(wk) => {
                if (wk >= 1 && wk <= 4) {
                  setActiveWeek(`week${wk}` as WeekTab);
                  setActiveTab('setup');
                }
              }}
            />
          </React.Suspense>
        )}

        {/* TAB 3: CLIENT DETAILS */}
        {activeTab === 'details' && (
          <ClientDetailsTab
            client={client}
            currentUserProfile={currentUserProfile}
            eligibleManagers={eligibleManagers}
            onClientUpdated={onClientUpdated}
          />
        )}
      </div>

      {/* Task Creation Entry Flow Modals */}
      {isModeModalOpen && (
        <React.Suspense fallback={null}>
          <TaskCreationModeModal
            key={`mode-modal-week-${modalWeekNumber}`}
            isOpen={isModeModalOpen}
            onClose={() => setIsModeModalOpen(false)}
            onSelectMode={handleSelectMode}
            client={client}
            weekNumber={modalWeekNumber}
          />
        </React.Suspense>
      )}

      {isTemplatePickerOpen && (
        <React.Suspense fallback={null}>
          <TaskTemplatePickerModal
            key={`template-picker-week-${modalWeekNumber}`}
            isOpen={isTemplatePickerOpen}
            onClose={() => setIsTemplatePickerOpen(false)}
            onSelectTemplate={handleSelectTemplate}
            onCreateBlankInstead={handleCreateBlankFromPicker}
            client={client}
            weekNumber={modalWeekNumber}
            departments={departments}
          />
        </React.Suspense>
      )}

      {/* Apply Multi-Task Service Template Modal (Phase 3D) */}
      {isApplyTemplateOpen && (
        <React.Suspense fallback={null}>
          <ApplyServiceTemplateModal
            isOpen={isApplyTemplateOpen}
            onClose={() => setIsApplyTemplateOpen(false)}
            onSuccess={() => {
              setIsApplyTemplateOpen(false);
              loadTasks();
              showToast('Service template launched into tasks.');
            }}
            client={client}
            initialWeek={modalWeekNumber}
            departments={departments}
          />
        </React.Suspense>
      )}

      {isCreateModalOpen && (
        <React.Suspense fallback={null}>
          <CreateClientTaskModal
            key={`create-modal-week-${modalWeekNumber}-${selectedTemplateForCreation?.id || 'blank'}`}
            isOpen={isCreateModalOpen}
            onClose={() => {
              setIsCreateModalOpen(false);
              setSelectedTemplateForCreation(null);
            }}
            onSuccess={(newTask) => {
              handleTaskCreated(newTask);
              setSelectedTemplateForCreation(null);
            }}
            client={client}
            weekNumber={modalWeekNumber}
            departments={departments}
            eligibleAssignees={eligibleAssignees}
            initialTemplate={selectedTemplateForCreation}
          />
        </React.Suspense>
      )}

      {editingTask && (
        <React.Suspense fallback={null}>
          <EditClientTaskModal
            isOpen={Boolean(editingTask)}
            onClose={() => setEditingTask(null)}
            onSuccess={handleTaskUpdated}
            task={editingTask}
            departments={departments}
          />
        </React.Suspense>
      )}

      {selectedTaskDetails && (
        <React.Suspense fallback={null}>
          <ClientTaskDetailsModal
            isOpen={Boolean(selectedTaskDetails)}
            onClose={() => setSelectedTaskDetails(null)}
            task={selectedTaskDetails}
            client={client}
            currentUserProfile={currentUserProfile}
            departments={departments}
            eligibleAssignees={eligibleAssignees}
            onTaskUpdated={handleTaskUpdated}
            onOpenEditModal={(t) => setEditingTask(t)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
