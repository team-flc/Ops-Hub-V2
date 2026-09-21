import React, { useState, useMemo } from 'react';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import {
  Clock, Play, Pause, Send, CheckCircle2, RotateCcw,
  AlertTriangle, Check, ExternalLink, Search,
  Briefcase, ArrowUpRight, ShieldCheck, Eye
} from 'lucide-react';
import { ClientTask, ClientTaskStatus, UserProfile, ClientRecord } from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';
import { useSignedUrl } from '../../lib/storageService';
import { isTaskDueToday } from '../../lib/pktDateUtils';

interface PersonalCrossClientKanbanProps {
  tasks: ClientTask[];
  clients: ClientRecord[];
  currentUserProfile: UserProfile | null;
  onRefreshTasks: () => void;
  onSelectTask?: (task: ClientTask) => void;
}

const AssigneeAvatar: React.FC<{ avatarPath?: string | null; name?: string | null }> = ({ avatarPath, name }) => {
  const [imageError, setImageError] = useState(false);
  const displayUrl = useSignedUrl('profile-avatars', avatarPath);

  if (displayUrl && !imageError) {
    return (
      <img
        src={displayUrl}
        alt={name || 'User'}
        onError={() => setImageError(true)}
        className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-dark-border"
      />
    );
  }

  return (
    <div className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-[9px] flex-shrink-0 border border-brand-500/20">
      {name ? name[0].toUpperCase() : 'U'}
    </div>
  );
};

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

type KanbanColumnKey = 'pending' | 'in_progress' | 'approval' | 'done';

interface KanbanColumnConfig {
  key: KanbanColumnKey;
  title: string;
  statuses: ClientTaskStatus[];
  color: string;
  badgeBg: string;
  headerBorder: string;
}

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    key: 'pending',
    title: 'Pending / Queued',
    statuses: ['Assigned', 'Draft', 'Blocked'],
    color: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    headerBorder: 'border-t-slate-400'
  },
  {
    key: 'in_progress',
    title: 'In Progress',
    statuses: ['In Progress'],
    color: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    headerBorder: 'border-t-blue-500'
  },
  {
    key: 'approval',
    title: 'Awaiting Approval',
    statuses: ['Team Review', 'Client Review'],
    color: 'text-purple-700 dark:text-purple-300',
    badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    headerBorder: 'border-t-purple-500'
  },
  {
    key: 'done',
    title: 'Completed',
    statuses: ['Completed'],
    color: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    headerBorder: 'border-t-emerald-500'
  }
];

interface PersonalKanbanCardProps {
  task: ClientTask;
  currentUserProfile: UserProfile | null;
  isOwnerOrManager: boolean;
  actionLoadingTaskId: string | null;
  onSelectTask?: (task: ClientTask) => void;
  onStartWork: (task: ClientTask) => void;
  onPauseTimer: (task: ClientTask) => void;
  onResumeTimer: (task: ClientTask) => void;
  onOpenDeliverableModal: (task: ClientTask) => void;
  onApproveDeliverable: (task: ClientTask) => void;
  onReopenTask: (task: ClientTask) => void;
}

export const PersonalKanbanCard: React.FC<PersonalKanbanCardProps> = ({
  task,
  currentUserProfile,
  isOwnerOrManager,
  actionLoadingTaskId,
  onSelectTask,
  onStartWork,
  onPauseTimer,
  onResumeTimer,
  onOpenDeliverableModal,
  onApproveDeliverable,
  onReopenTask
}) => {
  const navigate = useSafeNavigate();
  const isTimerRunning = Boolean(task.timerStartedAt);
  const isAssignedToMe = task.assigneeId === currentUserProfile?.id;
  const canControlTimer = isAssignedToMe || isOwnerOrManager || !task.assigneeId;

  // Live seconds ticker when timer is running
  const [liveSeconds, setLiveSeconds] = useState(task.timeSpentSeconds || 0);

  React.useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && task.timerStartedAt) {
      const calculateSeconds = () => {
        const startMs = new Date(task.timerStartedAt!).getTime();
        if (!isNaN(startMs)) {
          const additional = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          setLiveSeconds((task.timeSpentSeconds || 0) + additional);
        }
      };
      calculateSeconds();
      interval = setInterval(calculateSeconds, 1000);
    } else {
      setLiveSeconds(task.timeSpentSeconds || 0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, task.timerStartedAt, task.timeSpentSeconds]);

  const isPending = ['Pending', 'Draft', 'Assigned', 'Blocked'].includes(task.status);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, currentStatus: task.status }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`p-3.5 rounded-2xl bg-white dark:bg-dark-card border transition-all duration-150 shadow-xs hover:shadow-md space-y-2.5 ${
        isTimerRunning
          ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20'
          : task.isOverdue && task.status !== 'Completed'
          ? 'border-rose-300 dark:border-rose-900 bg-rose-50/20'
          : 'border-gray-200 dark:border-dark-border'
      }`}
    >
      {/* Top: Client Badge + Priority */}
      <div className="flex items-center justify-between gap-1 text-[10px]">
        <span
          onClick={() => {
            navigate(`/clients/${task.clientId}`);
          }}
          className="font-extrabold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer truncate max-w-[140px]"
          title={`Open ${task.clientName || 'Client'}`}
        >
          <Briefcase className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{task.clientName || 'Client'}</span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {task.weekNumber && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-100 text-gray-500 font-bold">
              W{task.weekNumber}
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 rounded font-black ${
              task.priority === 'Urgent'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                : task.priority === 'High'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
            }`}
          >
            {task.priority}
          </span>
        </div>
      </div>

      {/* Title */}
      <h4
        onClick={() => onSelectTask?.(task)}
        className="text-xs font-bold text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer line-clamp-2 leading-snug"
      >
        {task.title}
      </h4>

      {/* Assignee & Due Date */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100 dark:border-dark-border/50">
        <div className="flex items-center gap-1.5 truncate">
          <AssigneeAvatar avatarPath={task.assigneeAvatar} name={task.assigneeName} />
          <span className="truncate text-gray-700 dark:text-gray-300 font-medium">
            {task.assigneeName || 'Unassigned'}
          </span>
        </div>

        {task.dueDate && (
          <span
            className={`shrink-0 font-mono text-[10px] font-bold ${
              task.isOverdue && task.status !== 'Completed'
                ? 'text-rose-600 dark:text-rose-400 flex items-center gap-0.5'
                : 'text-gray-400'
            }`}
          >
            {task.isOverdue && task.status !== 'Completed' && <AlertTriangle className="w-2.5 h-2.5" />}
            {task.dueDate}
          </span>
        )}
      </div>

      {/* Duration & Live Timer State Indicator */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
        <span className={`flex items-center gap-1 ${isTimerRunning ? 'text-emerald-600 dark:text-emerald-400 font-bold animate-pulse' : ''}`}>
          <Clock className="w-3 h-3" />
          <span>{formatDuration(isTimerRunning ? liveSeconds : (task.timeSpentSeconds || 0))}</span>
        </span>

        {task.evidenceUrl && (
          <a
            href={task.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-500 hover:underline flex items-center gap-0.5 font-sans font-bold"
            title="View Deliverable Link"
          >
            <span>Deliverable</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      {/* Card Operational Actions */}
      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-gray-100 dark:border-dark-border/50">
        {/* Timer Controls */}
        {canControlTimer && task.status !== 'Completed' && (
          <div className="flex items-center gap-1">
            {isTimerRunning ? (
              <button
                type="button"
                disabled={actionLoadingTaskId === task.id}
                onClick={() => onPauseTimer(task)}
                data-testid={`pause-timer-btn-${task.id}`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-white font-bold text-[10px] hover:bg-amber-600 transition-colors shadow-xs cursor-pointer"
                title="Pause Timer"
              >
                <Pause className="w-2.5 h-2.5" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={actionLoadingTaskId === task.id}
                onClick={() => {
                  if (isPending || task.status !== 'In Progress') {
                    onStartWork(task);
                  } else {
                    onResumeTimer(task);
                  }
                }}
                data-testid={`start-work-btn-${task.id}`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500 text-white font-bold text-[10px] hover:bg-emerald-600 transition-colors shadow-xs cursor-pointer"
                title={isPending ? 'Start Work & Timer' : 'Resume Timer'}
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>{isPending ? 'Start' : (task.timeSpentSeconds ? 'Resume' : 'Start')}</span>
              </button>
            )}

            {/* Submit Deliverable */}
            {task.status !== 'Team Review' && task.status !== 'Client Review' && (
              <button
                type="button"
                onClick={() => onOpenDeliverableModal(task)}
                className="p-1 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
                title="Submit for Approval"
              >
                <Send className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Approval Actions for Managers & Owners */}
        {isOwnerOrManager && (task.status === 'Team Review' || task.status === 'Client Review') && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={actionLoadingTaskId === task.id}
              onClick={() => onApproveDeliverable(task)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500 text-white font-bold text-[10px] hover:bg-emerald-600 transition-colors cursor-pointer"
              title="Approve Task"
            >
              <Check className="w-2.5 h-2.5" />
              <span>Approve</span>
            </button>
            <button
              type="button"
              disabled={actionLoadingTaskId === task.id}
              onClick={() => onReopenTask(task)}
              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Request Changes / Reopen"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Open Workspace Action */}
        <button
          type="button"
          onClick={() => navigate(`/clients/${task.clientId}`)}
          className="ml-auto p-1 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
          title="Open in Client Workspace"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const PersonalCrossClientKanban: React.FC<PersonalCrossClientKanbanProps> = ({
  tasks,
  clients,
  currentUserProfile,
  onRefreshTasks,
  onSelectTask
}) => {
  const navigate = useSafeNavigate();
  const isOwner = currentUserProfile?.role === 'owner';
  const isManager = currentUserProfile?.role === 'operational_manager';
  const isOwnerOrManager = isOwner || isManager;

  // View Scope Tab
  const [viewScope, setViewScope] = useState<'my_tasks' | 'team_tasks' | 'all_tasks'>('my_tasks');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<'all' | 'today' | 'this_week' | 'overdue'>('all');
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);

  // Submit Deliverable Modal state
  const [deliverableModalTask, setDeliverableModalTask] = useState<ClientTask | null>(null);
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [deliverableNotes, setDeliverableNotes] = useState('');
  const [isSubmittingDeliverable, setIsSubmittingDeliverable] = useState(false);

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Scope Filter
      if (viewScope === 'my_tasks') {
        if (task.assigneeId !== currentUserProfile?.id) return false;
      }

      // Client Filter
      if (selectedClientId !== 'all' && task.clientId !== selectedClientId) {
        return false;
      }

      // Priority Filter
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
        return false;
      }

      // Timeline Filter
      if (selectedTimeFilter === 'overdue') {
        if (!task.isOverdue || task.status === 'Completed' || task.status === 'Done') return false;
      } else if (selectedTimeFilter === 'today') {
        if (!isTaskDueToday(task.dueDate)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesClient = (task.clientName || '').toLowerCase().includes(q) || (task.clientCompanyName || '').toLowerCase().includes(q);
        const matchesAssignee = (task.assigneeName || '').toLowerCase().includes(q);
        const matchesDept = (task.departmentName || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesClient && !matchesAssignee && !matchesDept) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, viewScope, currentUserProfile?.id, selectedClientId, selectedPriority, selectedTimeFilter, searchQuery]);

  // Tasks grouped by column
  const columnTasks = useMemo(() => {
    const map: Record<KanbanColumnKey, ClientTask[]> = {
      pending: [],
      in_progress: [],
      approval: [],
      done: []
    };

    filteredTasks.forEach((task) => {
      if (KANBAN_COLUMNS[0].statuses.includes(task.status)) {
        map.pending.push(task);
      } else if (KANBAN_COLUMNS[1].statuses.includes(task.status)) {
        map.in_progress.push(task);
      } else if (KANBAN_COLUMNS[2].statuses.includes(task.status)) {
        map.approval.push(task);
      } else if (KANBAN_COLUMNS[3].statuses.includes(task.status)) {
        map.done.push(task);
      } else {
        map.pending.push(task);
      }
    });

    return map;
  }, [filteredTasks]);

  // Timer & Status Actions
  const handleStartWork = async (task: ClientTask) => {
    if (!currentUserProfile) return;
    setActionLoadingTaskId(task.id);
    await taskManagementService.startWork(
      task.id,
      task.clientId,
      task.assigneeName || currentUserProfile.fullName,
      task.title
    );
    setActionLoadingTaskId(null);
    onRefreshTasks();
  };

  const handlePauseTimer = async (task: ClientTask) => {
    if (!currentUserProfile) return;
    setActionLoadingTaskId(task.id);
    await taskManagementService.stopTimer(task.id, task.timerStartedAt, task.timeSpentSeconds);
    setActionLoadingTaskId(null);
    onRefreshTasks();
  };

  const handleResumeTimer = async (task: ClientTask) => {
    if (!currentUserProfile) return;
    setActionLoadingTaskId(task.id);
    await taskManagementService.startTimer(task.id);
    setActionLoadingTaskId(null);
    onRefreshTasks();
  };

  const handleOpenDeliverableModal = (task: ClientTask) => {
    setDeliverableModalTask(task);
    setDeliverableUrl(task.evidenceUrl || '');
    setDeliverableNotes(task.completionNotes || '');
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverableModalTask || !currentUserProfile) return;

    setIsSubmittingDeliverable(true);
    await taskManagementService.updateKanbanStatus(deliverableModalTask.id, 'Team Review', {
      evidenceUrl: deliverableUrl.trim() || undefined,
      completionNotes: deliverableNotes.trim() || undefined,
      timerStartedAt: deliverableModalTask.timerStartedAt,
      timeSpentSeconds: deliverableModalTask.timeSpentSeconds
    });
    setIsSubmittingDeliverable(false);
    setDeliverableModalTask(null);
    onRefreshTasks();
  };

  const handleApproveDeliverable = async (task: ClientTask) => {
    if (!currentUserProfile) return;
    setActionLoadingTaskId(task.id);
    await taskManagementService.updateKanbanStatus(task.id, 'Completed');
    setActionLoadingTaskId(null);
    onRefreshTasks();
  };

  const handleReopenTask = async (task: ClientTask) => {
    if (!currentUserProfile) return;
    setActionLoadingTaskId(task.id);
    await taskManagementService.reopenTask(
      task.id,
      'Reopened from personal Kanban board',
      task.status
    );
    setActionLoadingTaskId(null);
    onRefreshTasks();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: KanbanColumnKey) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('text/plain');
    if (!dataStr || !currentUserProfile) return;

    try {
      const { taskId, currentStatus } = JSON.parse(dataStr);
      if (!taskId) return;

      let newStatus: ClientTaskStatus = 'Assigned';
      if (targetColumn === 'pending') newStatus = 'Assigned';
      else if (targetColumn === 'in_progress') newStatus = 'In Progress';
      else if (targetColumn === 'approval') newStatus = 'Team Review';
      else if (targetColumn === 'done') newStatus = 'Completed';

      if (currentStatus === newStatus) return;

      const droppedTask = tasks.find((t) => t.id === taskId);

      // Drag to In Progress starts work and timer automatically
      if (targetColumn === 'in_progress' && droppedTask) {
        await handleStartWork(droppedTask);
        return;
      }

      setActionLoadingTaskId(taskId);
      await taskManagementService.updateKanbanStatus(taskId, newStatus);
      setActionLoadingTaskId(null);
      onRefreshTasks();
    } catch {
      // Ignored
    }
  };

  return (
    <div className="bg-white dark:bg-dark-300 rounded-3xl border border-gray-200 dark:border-dark-border p-5 sm:p-6 shadow-sm space-y-5 select-none">
      {/* Kanban Header & Toggles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-500" />
              <span>Cross-Client Operations Kanban</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-500/10 text-brand-600 dark:text-brand-400">
              {filteredTasks.length} Tasks
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Personal and synchronized operational workflow across all accessible client workspaces.
          </p>
        </div>

        {/* Scope Toggles for Manager & Owner */}
        {isOwnerOrManager && (
          <div className="flex items-center bg-gray-100 dark:bg-dark-200 p-1 rounded-2xl self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewScope('my_tasks')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                viewScope === 'my_tasks'
                  ? 'bg-white dark:bg-dark-card text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              My Tasks
            </button>
            <button
              type="button"
              onClick={() => setViewScope('team_tasks')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                viewScope === 'team_tasks'
                  ? 'bg-white dark:bg-dark-card text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {isOwner ? 'Team Overview' : 'Direct Reports'}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setViewScope('all_tasks')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  viewScope === 'all_tasks'
                    ? 'bg-white dark:bg-dark-card text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                All Company Tasks
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, clients, assignees..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          />
        </div>

        {/* Client Filter */}
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 font-medium outline-none cursor-pointer"
        >
          <option value="all">All Accessible Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName || c.clientName}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 font-medium outline-none cursor-pointer"
        >
          <option value="all">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Normal">Normal</option>
          <option value="Low">Low</option>
        </select>

        {/* Timeline Filter */}
        <div className="flex items-center bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => setSelectedTimeFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              selectedTimeFilter === 'all'
                ? 'bg-white dark:bg-dark-200 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSelectedTimeFilter('today')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              selectedTimeFilter === 'today'
                ? 'bg-white dark:bg-dark-200 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Due Today
          </button>
          <button
            type="button"
            onClick={() => setSelectedTimeFilter('overdue')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              selectedTimeFilter === 'overdue'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-gray-400 hover:text-rose-500'
            }`}
          >
            Overdue
          </button>
        </div>
      </div>

      {/* 4 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = columnTasks[col.key] || [];

          return (
            <div
              key={col.key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              className="flex flex-col bg-gray-50/70 dark:bg-dark-200/50 rounded-2xl border border-gray-200/70 dark:border-dark-border/70 p-3.5 min-h-[380px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200/50 dark:border-dark-border/50">
                <span className={`text-xs font-extrabold uppercase tracking-wider ${col.color}`}>
                  {col.title}
                </span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                  {colTasks.length}
                </span>
              </div>

              {/* Task Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[560px] pr-1">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center text-gray-400 text-xs italic border-2 border-dashed border-gray-200 dark:border-dark-border rounded-xl">
                    <span>No tasks in {col.title}</span>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <PersonalKanbanCard
                      key={task.id}
                      task={task}
                      currentUserProfile={currentUserProfile}
                      isOwnerOrManager={isOwnerOrManager}
                      actionLoadingTaskId={actionLoadingTaskId}
                      onSelectTask={onSelectTask}
                      onStartWork={handleStartWork}
                      onPauseTimer={handlePauseTimer}
                      onResumeTimer={handleResumeTimer}
                      onOpenDeliverableModal={handleOpenDeliverableModal}
                      onApproveDeliverable={handleApproveDeliverable}
                      onReopenTask={handleReopenTask}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit Deliverable Modal */}
      {deliverableModalTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-brand-500" />
                <span>Submit Task Deliverable</span>
              </h3>
              <button
                type="button"
                onClick={() => setDeliverableModalTask(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-300">
              <span className="font-bold text-gray-800 dark:text-gray-200">{deliverableModalTask.title}</span>
              <span className="text-gray-400 block mt-0.5">Client: {deliverableModalTask.clientName}</span>
            </div>

            <form onSubmit={handleSubmitDeliverable} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                  Deliverable Link / URL (Drive, Figma, Loom, Live Link)
                </label>
                <input
                  type="url"
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                  Submission Notes / Summary of Work
                </label>
                <textarea
                  rows={3}
                  value={deliverableNotes}
                  onChange={(e) => setDeliverableNotes(e.target.value)}
                  placeholder="Summarize the completed deliverable for review..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeliverableModalTask(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-dark-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDeliverable}
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all shadow-md shadow-brand-500/25 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDeliverable ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
