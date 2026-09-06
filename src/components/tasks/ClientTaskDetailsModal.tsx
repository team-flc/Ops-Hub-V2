import React, { useState, useRef } from 'react';
import {
  X, Calendar, Clock, AlertCircle,
  Archive, Edit3, AlertTriangle, Loader2
} from 'lucide-react';
import {
  ClientTask,
  ClientRecord,
  ClientTaskStatus,
  Department,
  UserProfile
} from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';
import { useTaskFeed } from './useTaskFeed';
import { TaskConversationFeed } from './TaskConversationFeed';
import { TaskMessageComposer } from './TaskMessageComposer';
import { TaskReviewActions } from './TaskReviewActions';

interface ClientTaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ClientTask | null;
  client?: ClientRecord | null;
  clientStatus?: string;
  currentUser?: UserProfile | null;
  currentUserProfile?: UserProfile | null;
  isClientPortal?: boolean;
  departments?: Department[];
  eligibleAssignees?: UserProfile[];
  onTaskUpdated?: (updated: ClientTask) => void;
  onOpenEditModal?: (task: ClientTask) => void;
}

export const ClientTaskDetailsModal: React.FC<ClientTaskDetailsModalProps> = ({
  isOpen,
  onClose,
  task,
  client,
  clientStatus = 'Active',
  currentUser,
  currentUserProfile,
  isClientPortal = false,
  eligibleAssignees = [],
  onTaskUpdated = () => {},
  onOpenEditModal = () => {}
}) => {
  const activeUser = currentUserProfile || currentUser || null;
  const effectiveClientStatus = client?.status || clientStatus || 'Active';

  // Custom hook managing conversation feed state, composite pagination, and single Realtime subscription
  const {
    feed,
    events,
    isLoadingFeed,
    hasMoreFeed,
    loadOlderFeed,
    refreshFeed
  } = useTaskFeed({
    taskId: task?.id,
    activeUser,
    isOpen
  });

  // Status transition & reason modal state
  const [showReasonModal, setShowReasonModal] = useState<{
    targetStatus: ClientTaskStatus;
    actionLabel: string;
    isReopen?: boolean;
    isChangesRequested?: boolean;
    isOwnerOverride?: boolean;
  } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Archive modal state
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);

  // Reassign state
  const [isReassigning, setIsReassigning] = useState(false);

  // Auto-scroll ref
  const feedEndRef = useRef<HTMLDivElement>(null);

  const isOwnerOrManager = activeUser?.role === 'owner' || activeUser?.role === 'operational_manager';
  const isClient = activeUser?.role === 'client' || isClientPortal;
  const isAssignedMember = task?.assigneeId === activeUser?.id;
  const isTaskArchived = Boolean(task?.archivedAt);
  const isClientPaused = effectiveClientStatus === 'Paused';
  const isClientArchived = effectiveClientStatus === 'Archived';

  if (!isOpen || !task) return null;

  // Status transition execution
  const handleStatusChange = async (
    targetStatus: ClientTaskStatus,
    reason?: string,
    options?: { isOverride?: boolean; overrideReason?: string }
  ) => {
    setStatusError(null);
    setIsUpdatingStatus(true);
    try {
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('act_' + Date.now());
      const res = await taskManagementService.updateStatus(
        task.id,
        targetStatus,
        reason,
        task.status,
        {
          idempotencyKey,
          isOverride: options?.isOverride,
          overrideReason: options?.overrideReason
        }
      );

      if (res.error) {
        setStatusError(res.error);
        return;
      }

      if (res.task) {
        onTaskUpdated(res.task);
      }
      refreshFeed();
      setShowReasonModal(null);
      setReasonText('');
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to update task status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Submit reason from reason modal
  const handleConfirmReasonModal = () => {
    if (!showReasonModal) return;
    setReasonError(null);

    const trimmed = reasonText.trim();
    if (!trimmed) {
      if (showReasonModal.isReopen) {
        setReasonError('Reason for reopening is required.');
      } else if (showReasonModal.isChangesRequested) {
        setReasonError('Reason for change request is required.');
      } else if (showReasonModal.isOwnerOverride) {
        setReasonError('Reason for owner override is required.');
      } else {
        setReasonError('A mandatory reason is required for this action.');
      }
      return;
    }

    handleStatusChange(
      showReasonModal.targetStatus,
      trimmed,
      showReasonModal.isOwnerOverride ? { isOverride: true, overrideReason: trimmed } : undefined
    );
  };

  // Confirm archive task
  const handleArchiveTask = async () => {
    if (!archiveReason.trim()) {
      setStatusError('A mandatory reason is required to archive a task.');
      return;
    }

    setIsArchiving(true);
    try {
      const res = await taskManagementService.archiveTask(task.id, archiveReason.trim());
      if (res.error) {
        setStatusError(res.error);
        return;
      }
      onTaskUpdated({
        ...task,
        archivedAt: new Date().toISOString(),
        archiveReason: archiveReason.trim()
      });
      setShowArchiveConfirm(false);
      onClose();
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to archive task.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Reassign task
  const handleReassign = async (newAssigneeId: string) => {
    setIsReassigning(true);
    try {
      const res = await taskManagementService.assignTask(task.id, newAssigneeId || null);
      if (res.error) {
        setStatusError(res.error);
        return;
      }
      const updatedAssignee = eligibleAssignees.find((u) => u.id === newAssigneeId);
      onTaskUpdated({
        ...task,
        assigneeId: newAssigneeId || undefined,
        assigneeName: updatedAssignee?.fullName,
        status: newAssigneeId && task.status === 'Draft' ? 'Assigned' : task.status
      });
      refreshFeed();
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to reassign task.');
    } finally {
      setIsReassigning(false);
    }
  };

  const formatDatetime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-full sm:max-w-2xl bg-white dark:bg-dark-card h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-dark-border">
        {/* DRAWER HEADER */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-dark-border flex items-start justify-between gap-4 flex-shrink-0 bg-gray-50/50 dark:bg-dark-card/50">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-100 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                Week {task.weekNumber}
              </span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                {client?.companyName || 'Client'}
              </span>

              {/* Approval Mode Badge */}
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                task.approvalMode === 'Client Approval Required'
                  ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                  : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-dark-100 dark:text-gray-400 dark:border-dark-border'
              }`}>
                {task.approvalMode || 'Internal Only'}
              </span>

              {/* Priority Badge */}
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                task.priority === 'Urgent'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                  : task.priority === 'High'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
              }`}>
                {task.priority} Priority
              </span>

              {/* Status Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                task.status === 'Completed'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : task.status === 'Client Review'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : task.status === 'Team Review'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
                  : task.status === 'Blocked'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                  : task.status === 'In Progress'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-dark-100 dark:text-gray-300'
              }`}>
                {task.status}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug">
              {task.title}
            </h2>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isOwnerOrManager && !isTaskArchived && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditModal(task);
                  }}
                  className="p-2 text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-xl transition-colors cursor-pointer"
                  title="Edit Task Fields"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  className="p-2 text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                  title="Archive Task"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* DRAWER SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
          {statusError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          {/* Blocked Alert */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-gray-50/80 dark:bg-dark-200/50 border border-gray-200/60 dark:border-dark-border/60">
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
                    className="px-2 py-1 rounded-lg bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-800 dark:text-gray-200 outline-none"
                  >
                    <option value="">Unassigned (Draft)</option>
                    {eligibleAssignees
                      .filter((u) => u.role === 'owner' || u.role === 'operational_manager' || (u.departmentIds && u.departmentIds.includes(task.departmentId)))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.role})
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

          {/* Read-Only Legacy Context (task.details) */}
          {task.details && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Task Instructions & SOP Deliverables
              </span>
              <div className="p-3.5 rounded-xl bg-gray-50/60 dark:bg-dark-100/50 border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {task.details}
              </div>
            </div>
          )}

          {/* WORKFLOW STATUS MANAGEMENT BAR (Extracted Component) */}
          <TaskReviewActions
            task={task}
            activeUser={activeUser}
            isClient={isClient}
            isOwnerOrManager={isOwnerOrManager}
            isAssignedMember={isAssignedMember}
            isClientPaused={isClientPaused}
            isTaskArchived={isTaskArchived}
            isUpdatingStatus={isUpdatingStatus}
            onStatusChange={handleStatusChange}
            onRequestReasonModal={(params) => {
              setReasonError(null);
              setReasonText('');
              setShowReasonModal(params);
            }}
          />

          {/* CHRONOLOGICAL TASK CONVERSATION FEED (Extracted Component) */}
          <TaskConversationFeed
            feed={feed}
            events={events}
            isLoadingFeed={isLoadingFeed}
            hasMoreFeed={hasMoreFeed}
            onLoadOlderFeed={loadOlderFeed}
            isClient={isClient}
            formatDatetime={formatDatetime}
            feedEndRef={feedEndRef}
          />
        </div>

        {/* COMPOSER AT BOTTOM OF DRAWER (Extracted Component) */}
        <TaskMessageComposer
          taskId={task.id}
          clientId={task.clientId}
          isClient={isClient}
          isOwnerOrManager={isOwnerOrManager}
          isTaskArchived={isTaskArchived}
          isClientArchived={isClientArchived}
          isClientPaused={isClientPaused}
          onMessageSent={refreshFeed}
        />

        {/* MANDATORY REASON MODAL (For Blocked, Changes Requested, Reopen, Owner Override) */}
        {showReasonModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl p-5 max-w-md w-full space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-brand-500" />
                  <span>{showReasonModal.actionLabel}</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {showReasonModal.isOwnerOverride
                    ? 'Owner override requires a mandatory justification recorded in immutable audit logs.'
                    : showReasonModal.isReopen
                    ? 'Reopening a completed task requires an explicit explanation recorded in the audit trail.'
                    : showReasonModal.isChangesRequested
                    ? 'Please detail the revisions or amendments required on this deliverable.'
                    : 'A non-empty reason is mandatory to record this transition.'}
                </p>
              </div>

              {reasonError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {reasonError}
                </div>
              )}

              <textarea
                rows={3}
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder={
                  showReasonModal.isReopen
                    ? 'Explain why this completed task must be reopened...'
                    : showReasonModal.isChangesRequested
                    ? 'Explain what changes are required...'
                    : showReasonModal.isOwnerOverride
                    ? 'Explain why this task is being approved via Owner override...'
                    : 'Enter reason...'
                }
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReasonModal(null);
                    setReasonText('');
                    setReasonError(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={handleConfirmReasonModal}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdatingStatus && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{
                    showReasonModal.isReopen
                      ? 'Confirm Reopen'
                      : showReasonModal.isChangesRequested
                      ? 'Confirm Change Request'
                      : showReasonModal.isOwnerOverride
                      ? 'Confirm Owner Override'
                      : 'Confirm Action'
                  }</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM ARCHIVE MODAL */}
        {showArchiveConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl p-5 max-w-md w-full space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  <span>Archive Task Confirmation</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Archiving permanently freezes the task. The conversation feed and all fields will become strictly read-only.
                </p>
              </div>

              <textarea
                rows={3}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Mandatory reason for archiving this task..."
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowArchiveConfirm(false);
                    setArchiveReason('');
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isArchiving || !archiveReason.trim()}
                  onClick={handleArchiveTask}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isArchiving && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Confirm Archive</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
