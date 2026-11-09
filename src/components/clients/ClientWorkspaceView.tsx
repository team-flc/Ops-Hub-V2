import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Info, Plus, Sparkles, Loader2, Layers, AlertTriangle, ShieldCheck, LayoutDashboard, FileText } from 'lucide-react';
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
import { sanitizeClientDeliverableTitle, isInternalOnlyTask, getInternalTaskReason, filterAndSanitizeClientDeliverables } from '../../lib/permissions';
import { FinfixClientPortalView } from '../portal/FinfixClientPortalView';
import { ClientMonthlyReportsView } from '../portal/ClientMonthlyReportsView';
export { filterAndSanitizeClientDeliverables };

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
  isClientView?: boolean;
}

type MainTab = 'setup' | 'workplans' | 'details' | 'reports';
type WeekTab = 'week1' | 'week2' | 'week3' | 'week4';

function isFinancialOrInternalTitle(title: string = ''): boolean {
  const t = title.toLowerCase();
  if (
    /pkr\s*\d+|invoice|payment|billing|fee|\$\d+|salary|payroll|profit|margin|internal chat|gmail notes/i.test(t)
  ) {
    return true;
  }
  if (
    t.includes('zain se') ||
    t.includes('login/hosting') ||
    t.includes('approve karo') ||
    t.includes('asset bank ke baad')
  ) {
    return true;
  }
  return false;
}

function sanitizeEvidenceUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const u = url.toLowerCase();
  if (
    u.includes('drive.google.com') ||
    u.includes('docs.google.com/spreadsheets') ||
    u.includes('slack.com') ||
    u.includes('chat.whatsapp.com') ||
    u.includes('wa.me') ||
    u.includes('gohighlevel.com') ||
    u.includes('leadconnectorhq.com') ||
    /id=[a-zA-Z0-9_-]{15,}/.test(url) ||
    /\/d\/[a-zA-Z0-9_-]{15,}/.test(url) ||
    /\/folders\/[a-zA-Z0-9_-]{15,}/.test(url)
  ) {
    return undefined;
  }
  return url;
}



export const ClientWorkspaceView: React.FC<ClientWorkspaceViewProps> = ({
  client,
  currentUserProfile,
  eligibleManagers,
  onClientUpdated,
  isClientView = false
}) => {
  const isPreview = typeof window !== 'undefined' && window.location.search.includes('preview=true');
  const isClient = currentUserProfile?.role === 'client';
  const isEffectiveClientView = Boolean(isClientView || isClient || isPreview);

  const isArchived = client.status === 'Archived';
  const [activeTab, setActiveTab] = useState<MainTab>('setup');
  const [showShieldedBreakdown, setShowShieldedBreakdown] = useState(false);
  const [activeWeek, setActiveWeek] = useState<WeekTab>('week1');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Week Names State
  const [weekNames, setWeekNames] = useState<Record<1 | 2 | 3 | 4, string>>(DEFAULT_WEEK_NAMES);

  // Phase 3A Tasks State
  const [allTasks, setAllTasks] = useState<ClientTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  // Immediately reset week and tasks when selected client changes
  useEffect(() => {
    setActiveWeek('week1');
    setIsLoadingTasks(true);
    setActiveTab('setup');
  }, [client.id, client.status]);

  // Ensure client view NEVER lands on details
  useEffect(() => {
    if (isEffectiveClientView && activeTab === 'details') {
      setActiveTab('setup');
    }
  }, [isEffectiveClientView, activeTab]);

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

  const canAddTask = useMemo(() => {
    if (!currentUserProfile) return false;
    if (isEffectiveClientView || currentUserProfile.role === 'client') return false;
    if (client.status === 'Archived') return false;
    const des = (currentUserProfile.designationName || '').toLowerCase().trim();
    if (des.includes('intern')) return false;
    if (currentUserProfile.role === 'owner' || currentUserProfile.role === 'operational_manager') return true;
    return (
      des.includes('team lead') ||
      des.includes('lead') ||
      des.includes('team manager') ||
      des.includes('manager') ||
      des.includes('founder') ||
      des.includes('owner') ||
      des.includes('cfo') ||
      des.includes('chief financial officer')
    );
  }, [currentUserProfile, isEffectiveClientView, client.status]);

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
      const res = await taskManagementService.fetchCrossClientTasks({
        clientId: client.id,
        isClientView: false
      });
      if (!res.error && res.data) {
        setAllTasks(res.data);
      }
    } catch {
      // Keep current tasks on failure
    } finally {
      setIsLoadingTasks(false);
    }
  }, [client.id, isEffectiveClientView]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const effectiveDepartments = useMemo(() => {
    if (currentUserProfile?.role === 'team_member' && currentUserProfile?.departmentIds && currentUserProfile.departmentIds.length > 0) {
      return departments.filter((d) => currentUserProfile.departmentIds!.includes(d.id));
    }
    return departments;
  }, [departments, currentUserProfile?.role, currentUserProfile?.departmentIds]);

  const visibleTasks = useMemo(() => {
    let result = allTasks;
    if (isEffectiveClientView) {
      result = filterAndSanitizeClientDeliverables(allTasks);
    } else if (currentUserProfile?.role === 'team_member') {
      result = allTasks.filter((t) => {
        // Enforce assigned departments scope for team members
        if (currentUserProfile.departmentIds && currentUserProfile.departmentIds.length > 0) {
          if (!t.departmentId || !currentUserProfile.departmentIds.includes(t.departmentId)) {
            return false;
          }
        }
        return true;
      });
    }
    return result;
  }, [allTasks, isEffectiveClientView, currentUserProfile?.role, currentUserProfile?.id, currentUserProfile?.departmentIds]);

  const tasksByWeek: Record<1 | 2 | 3 | 4, ClientTask[]> = useMemo(() => {
    return {
      1: visibleTasks.filter((t) => Number(t.weekNumber) === 1),
      2: visibleTasks.filter((t) => Number(t.weekNumber) === 2),
      3: visibleTasks.filter((t) => Number(t.weekNumber) === 3),
      4: visibleTasks.filter((t) => Number(t.weekNumber) === 4)
    };
  }, [visibleTasks]);

  const currentWeekTasks = useMemo(() => {
    return tasksByWeek[currentWeekNum] || [];
  }, [tasksByWeek, currentWeekNum]);

  // Reconciliation for Staff side
  const totalStaffTasks = useMemo(() => allTasks.filter((t) => !t.archivedAt).length, [allTasks]);
  const internalTasksList = useMemo(() => allTasks.filter((t) => !t.archivedAt && isInternalOnlyTask(t)), [allTasks]);
  const totalInternalTasks = internalTasksList.length;
  const totalClientVisibleTasks = totalStaffTasks - totalInternalTasks;

  const currentWeekRawTasks = useMemo(() => {
    return allTasks.filter((t) => Number(t.weekNumber) === currentWeekNum && !t.archivedAt);
  }, [allTasks, currentWeekNum]);

  const currentWeekInternalCount = useMemo(() => {
    return currentWeekRawTasks.filter(isInternalOnlyTask).length;
  }, [currentWeekRawTasks]);

  const currentWeekClientVisibleCount = useMemo(() => {
    return currentWeekRawTasks.length - currentWeekInternalCount;
  }, [currentWeekRawTasks, currentWeekInternalCount]);

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
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-gray-50/50 dark:bg-dark-400 select-none">
      {/* Paused Client Warning Banner */}
      {client.status === 'Paused' && (
        <div className="bg-brand-500/10 border-b border-brand-500/20 px-4 sm:px-6 py-3 flex items-center gap-3 text-brand-800 dark:text-brand-300 text-xs font-semibold animate-fade-in shrink-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-brand-600 dark:text-brand-400" />
          <div className="flex-1">
            <span>Workspace Paused: This client organization is currently paused ({client.pauseReason || 'Operational reason'}). Creating new tasks and active work mutations are blocked.</span>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-[calc(100vw-2rem)] animate-bounce">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold shadow-2xl border border-gray-700/30">
            <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-gray-50/50 dark:bg-dark-400">
          {/* 1. Client Header (Identical for Staff & Client, read-only for Client) */}
          <SelectedClientHeader
            client={client}
            currentUserProfile={currentUserProfile}
            isClientView={isEffectiveClientView}
            onClientUpdated={onClientUpdated}
          />

          {/* 2. Staff Workspace Navigation Tabs */}
          <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="tab-setup"
                onClick={() => setActiveTab('setup')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'setup' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>30-Day Setup</span>
              </button>

              <button
                type="button"
                data-testid="tab-workplans"
                onClick={() => setActiveTab('workplans')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'workplans' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>90-Day Work Plans</span>
              </button>

              <button
                type="button"
                data-testid="tab-reports"
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'reports' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Monthly Reports</span>
              </button>

              {!isEffectiveClientView && (
                <button
                  type="button"
                  data-testid="tab-details"
                  onClick={() => setActiveTab('details')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'details' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Client Details</span>
                </button>
              )}
            </div>
          </div>

          {/* 3. Tab Content for Staff */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            {activeTab === 'setup' && (
              <div className="space-y-6">
                {/* Compact Week Stepper */}
                <ClientWeekStepper
                  client={client}
                  activeWeekNum={currentWeekNum}
                  onSelectWeek={(wk) => setActiveWeek(`week${wk}` as WeekTab)}
                  weekNames={weekNames}
                  onRenameWeek={handleRenameWeek}
                  tasksByWeek={tasksByWeek}
                  currentUserProfile={currentUserProfile}
                  isClientView={isEffectiveClientView}
                  isLoading={isLoadingTasks}
                />

                {/* Staff Reconciliation Bar (Hidden for Client) */}
                {!isEffectiveClientView && totalInternalTasks > 0 && (
                  <div
                    data-testid="staff-client-reconciliation"
                    className="px-4 py-3 rounded-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border text-xs text-slate-700 dark:text-slate-300 space-y-2 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>
                          <strong className="font-bold">Client Safe Reconciliation:</strong> {totalClientVisibleTasks} Client Visible Deliverables + {totalInternalTasks} Internal Staff Only = {totalStaffTasks} Total Tasks
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowShieldedBreakdown(!showShieldedBreakdown)}
                        className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>{showShieldedBreakdown ? 'Hide Breakdown ▲' : `View ${totalInternalTasks} Shielded Tasks & Reasons ▼`}</span>
                      </button>
                    </div>
                    {showShieldedBreakdown && (
                      <div className="pt-2 border-t border-slate-200 dark:border-dark-border text-[11px] space-y-1.5">
                        <span className="font-bold text-gray-500 dark:text-gray-400 block uppercase tracking-wider text-[10px]">
                          Shielded from Client Portal (With Classification Reason):
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                          {internalTasksList.map((t) => (
                            <div key={t.id} className="p-2 rounded-lg bg-slate-50 dark:bg-dark-200 border border-slate-200 dark:border-dark-border flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-gray-800 dark:text-gray-200 block truncate">{t.title}</span>
                                <span className="text-[10px] text-gray-400">Week {t.weekNumber || 1} &bull; {t.status}</span>
                              </div>
                              <span className="shrink-0 px-2 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold border border-amber-300/40">
                                {getInternalTaskReason(t) || 'Internal Only'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!showShieldedBreakdown && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        Internal notes, invoices, operational reminders & credentials are automatically shielded from Client Portal
                      </div>
                    )}
                  </div>
                )}

                {/* Week Action Bar & Kanban Board */}
                <div className="flex items-center justify-between">
                  {isLoadingTasks ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Week {currentWeekNum}: {weekNames[currentWeekNum]}
                      </span>
                      <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Week {currentWeekNum}: {weekNames[currentWeekNum]} ({currentWeekTasks.length} {currentWeekTasks.length === 1 ? 'Task' : 'Tasks'}{!isEffectiveClientView && currentWeekInternalCount > 0 ? ` — ${currentWeekClientVisibleCount} Client Visible, ${currentWeekInternalCount} Internal Staff Only` : ''})
                      </span>
                    </div>
                  )}

                  {!isEffectiveClientView && (
                    <div className="flex items-center gap-2">
                      {client.status === 'Paused' ? (
                        <span 
                          className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-dark-200 border border-gray-300 dark:border-dark-border text-gray-500 dark:text-gray-400 text-xs font-bold flex items-center gap-1.5 opacity-80 cursor-not-allowed"
                          title="Task creation is blocked while client organization is paused."
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-brand-500" />
                          <span>Tasks Paused</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-testid="add-task-btn"
                          aria-label="+ Add Task"
                          onClick={handleOpenCreateTaskFlow}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Task</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <ClientKanbanBoard
                  client={client}
                  tasks={currentWeekTasks}
                  weekNumber={currentWeekNum}
                  weekName={weekNames[currentWeekNum]}
                  currentUserProfile={currentUserProfile}
                  isClientView={isEffectiveClientView}
                  onSelectTask={(t) => setSelectedTaskDetails(t)}
                  onOpenEditModal={(t) => setEditingTask(t)}
                  onOpenCreateTask={handleOpenCreateTaskFlow}
                  onStatusChange={handleKanbanStatusChange}
                  onStartWork={handleStartWork}
                  onPauseTimer={handlePauseTimer}
                  onResumeTimer={handleResumeTimer}
                  onTasksArchived={handleTasksArchived}
                  onShowToast={showToast}
                  isLoading={isLoadingTasks}
                />
              </div>
            )}

            {activeTab === 'workplans' && (
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading work plans...</div>}>
                <ClientWorkPlanView
                  client={client}
                  currentUserProfile={currentUserProfile}
                  departments={effectiveDepartments}
                  isClientView={isEffectiveClientView}
                  onSelectWeek={(wk) => {
                    if (wk >= 1 && wk <= 4) {
                      setActiveWeek(`week${wk}` as WeekTab);
                      setActiveTab('setup');
                    }
                  }}
                />
              </React.Suspense>
            )}

            {!isEffectiveClientView && activeTab === 'details' && (
              <ClientDetailsTab
                client={client}
                currentUserProfile={currentUserProfile}
                eligibleManagers={eligibleManagers}
                onClientUpdated={onClientUpdated}
                isClientView={isEffectiveClientView}
              />
            )}

            {activeTab === 'reports' && (
              <div data-testid="staff-reports-view" className="space-y-6">
                <ClientMonthlyReportsView
                  client={client}
                  tasks={isEffectiveClientView ? visibleTasks : allTasks}
                  isStaffView={!isEffectiveClientView}
                />
              </div>
            )}
          </div>
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
            departments={effectiveDepartments}
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
            departments={effectiveDepartments}
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
            departments={effectiveDepartments}
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
            departments={effectiveDepartments}
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
            isClientView={isEffectiveClientView}
            departments={effectiveDepartments}
            eligibleAssignees={eligibleAssignees}
            onTaskUpdated={handleTaskUpdated}
            onOpenEditModal={(t) => setEditingTask(t)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
