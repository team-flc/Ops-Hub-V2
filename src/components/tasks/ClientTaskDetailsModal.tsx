import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, User, ShieldCheck, AlertCircle, 
  Archive, Edit3, CheckCircle2, AlertTriangle, ArrowRight, 
  History, Loader2, Play, Ban, CornerUpLeft, Send 
} from 'lucide-react';
import { 
  ClientTask, 
  ClientTaskEvent, 
  ClientTaskStatus, 
  Department, 
  UserProfile 
} from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';

interface ClientTaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ClientTask | null;
  currentUserProfile?: UserProfile | null;
  departments: Department[];
  eligibleAssignees: UserProfile[];
  onTaskUpdated: (updated: ClientTask) => void;
  onOpenEditModal: (task: ClientTask) => void;
}

export const ClientTaskDetailsModal: React.FC<ClientTaskDetailsModalProps> = ({
  isOpen,
  onClose,
  task,
  currentUserProfile,
  eligibleAssignees,
  onTaskUpdated,
  onOpenEditModal
}) => {
  const [events, setEvents] = useState<ClientTaskEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Status transition & reason state
  const [showReasonModal, setShowReasonModal] = useState<{
    targetStatus: ClientTaskStatus;
    actionLabel: string;
  } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Archive state
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);

  // Assignee state
  const [isReassigning, setIsReassigning] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      loadEvents(task.id);
      setShowReasonModal(null);
      setReasonText('');
      setShowArchiveConfirm(false);
      setArchiveReason('');
      setStatusError(null);
    }
  }, [isOpen, task?.id]);

  const loadEvents = async (taskId: string) => {
    setIsLoadingEvents(true);
    try {
      const data = await taskManagementService.fetchTaskEvents(taskId);
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  if (!isOpen || !task) return null;

  const isOwnerOrManager = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';
  const isAssignedMember = task.assigneeId === currentUserProfile?.id;

  const handleStatusChange = async (targetStatus: ClientTaskStatus, reason?: string) => {
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const res = await taskManagementService.updateStatus(task.id, targetStatus, reason);
      if (res.error) {
        setStatusError(res.error);
      } else {
        const updatedTask: ClientTask = {
          ...task,
          status: targetStatus,
          blockedReason: targetStatus === 'Blocked' ? (reason || null) : null
        };
        onTaskUpdated(updatedTask);
        loadEvents(task.id);
        setShowReasonModal(null);
        setReasonText('');
      }
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to update task status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveReason.trim()) {
      setStatusError('A reason is mandatory to archive a task.');
      return;
    }

    setIsArchiving(true);
    setStatusError(null);
    try {
      const res = await taskManagementService.archiveTask(task.id, archiveReason.trim());
      if (res.error) {
        setStatusError(res.error);
      } else {
        const updatedTask: ClientTask = {
          ...task,
          archivedAt: new Date().toISOString(),
          archiveReason: archiveReason.trim()
        };
        onTaskUpdated(updatedTask);
        onClose();
      }
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to archive task.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleReassign = async (newAssigneeId: string) => {
    setIsReassigning(true);
    setStatusError(null);
    try {
      const res = await taskManagementService.assignTask(task.id, newAssigneeId || null);
      if (res.error) {
        setStatusError(res.error);
      } else {
        const assignedUser = eligibleAssignees.find((u) => u.id === newAssigneeId);
        const newStatus: ClientTaskStatus = newAssigneeId 
          ? (task.status === 'Draft' ? 'Assigned' : task.status)
          : 'Draft';

        const updatedTask: ClientTask = {
          ...task,
          assigneeId: newAssigneeId || null,
          assigneeName: assignedUser?.fullName || null,
          assigneeRole: assignedUser?.role || null,
          status: newStatus
        };
        onTaskUpdated(updatedTask);
        loadEvents(task.id);
      }
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to reassign task.');
    } finally {
      setIsReassigning(false);
    }
  };

  const formatDatetime = (iso: string) => {
    if (!iso) return 'Not set';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Karachi'
      });
    } catch {
      return iso;
    }
  };

  const getStatusColor = (status: ClientTaskStatus) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-700 dark:bg-dark-100 dark:text-gray-300 border-gray-200 dark:border-dark-border';
      case 'Assigned':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900';
      case 'In Progress':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900';
      case 'Blocked':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900';
      case 'Team Review':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-900';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200';
      case 'High':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200';
      case 'Normal':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200';
      case 'Low':
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-5 border-b border-gray-100 dark:border-dark-border flex items-start justify-between bg-gray-50/50 dark:bg-dark-card/50">
          <div className="space-y-1 pr-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase">
                Week {task.weekNumber}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(task.status)}`}>
                {task.status}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPriorityColor(task.priority)}`}>
                {task.priority} Priority
              </span>
              {task.isOverdue && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                  Overdue
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
              {task.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isOwnerOrManager && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditModal(task);
                  }}
                  className="p-2 text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-xl transition-colors"
                  title="Edit Task Fields"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  className="p-2 text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                  title="Archive Task"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {statusError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          {/* Blocked Warning */}
          {task.status === 'Blocked' && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Task is Currently Blocked</span>
              </div>
              <p className="text-xs pl-6">
                Reason: {task.blockedReason || 'No specific reason provided.'}
              </p>
            </div>
          )}

          {/* Core Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-gray-50/70 dark:bg-dark-200/50 border border-gray-200/60 dark:border-dark-border/60">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Responsible Department
              </span>
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {task.departmentName || 'Department'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Primary Assignee
              </span>
              {isOwnerOrManager ? (
                <div className="flex items-center gap-2">
                  <select
                    value={task.assigneeId || ''}
                    onChange={(e) => handleReassign(e.target.value)}
                    disabled={isReassigning}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-800 dark:text-gray-200 outline-none"
                  >
                    <option value="">Unassigned (Draft)</option>
                    {eligibleAssignees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                  {isReassigning && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />}
                </div>
              ) : (
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {task.assigneeName || 'Unassigned (Draft)'}
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Planned Start (Asia/Karachi)
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>{formatDatetime(task.plannedStart)}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Due Date (Asia/Karachi)
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{formatDatetime(task.dueDate)}</span>
              </div>
            </div>
          </div>

          {/* Task Details */}
          {task.details && (
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                Task Instructions & SOP Deliverables
              </span>
              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {task.details}
              </div>
            </div>
          )}

          {/* Workflow Action Bar */}
          <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20 space-y-3">
            <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider block">
              Workflow Status Management
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {/* Assignee Actions */}
              {isAssignedMember && (
                <>
                  {task.status === 'Assigned' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange('In Progress')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-sm transition-all"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Work (In Progress)</span>
                    </button>
                  )}

                  {task.status === 'In Progress' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => setShowReasonModal({ targetStatus: 'Blocked', actionLabel: 'Mark as Blocked' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold shadow-sm transition-all"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Mark Blocked</span>
                      </button>

                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange('Team Review')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit for Team Review</span>
                      </button>
                    </>
                  )}

                  {task.status === 'Blocked' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange('In Progress')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resume Work (In Progress)</span>
                    </button>
                  )}
                </>
              )}

              {/* Management Actions */}
              {isOwnerOrManager && (
                <>
                  {task.status === 'Team Review' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => setShowReasonModal({ targetStatus: 'In Progress', actionLabel: 'Return to In Progress' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition-all"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                      <span>Return for Changes</span>
                    </button>
                  )}

                  {task.status === 'Draft' && task.assigneeId && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange('Assigned')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Set Status to Assigned</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Audit History Timeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                <span>Immutable Task Audit History</span>
              </span>
              {isLoadingEvents && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            </div>

            <div className="space-y-2 border-l-2 border-gray-100 dark:border-dark-border pl-4 ml-2">
              {events.length === 0 && !isLoadingEvents && (
                <p className="text-gray-400 text-xs italic">No previous events recorded.</p>
              )}

              {events.map((evt) => (
                <div key={evt.id} className="relative space-y-0.5">
                  <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-brand-500" />
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span className="font-bold text-gray-700 dark:text-gray-300">{evt.actorName}</span>
                    <span>{formatDatetime(evt.createdAt)}</span>
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 capitalize">
                    {evt.eventType.replace(/_/g, ' ')}
                  </div>
                  {evt.notes && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {evt.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reason Modal Overlay (for Blocked or Review Return) */}
        {showReasonModal && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl max-w-md w-full space-y-4 shadow-2xl border border-gray-200 dark:border-dark-border">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {showReasonModal.actionLabel}
              </h3>
              <p className="text-xs text-gray-500">
                Please provide a mandatory reason for this workflow transition:
              </p>
              <textarea
                rows={3}
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Enter mandatory reason..."
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReasonModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!reasonText.trim() || isUpdatingStatus}
                  onClick={() => handleStatusChange(showReasonModal.targetStatus, reasonText.trim())}
                  className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isUpdatingStatus ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Archive Confirmation Overlay */}
        {showArchiveConfirm && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl max-w-md w-full space-y-4 shadow-2xl border border-gray-200 dark:border-dark-border">
              <div className="flex items-center gap-2 text-rose-600">
                <Archive className="w-5 h-5" />
                <h3 className="text-sm font-bold">Archive Task</h3>
              </div>
              <p className="text-xs text-gray-500">
                Archived tasks disappear from the active week view while preserving audit history. Hard delete is strictly disabled.
              </p>
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1 text-xs">
                  Archive Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Scope changed by client request, deliverable obsolete..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!archiveReason.trim() || isArchiving}
                  onClick={handleArchive}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isArchiving ? 'Archiving...' : 'Archive Task'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
