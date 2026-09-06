import React, { useState, useEffect, useRef } from 'react';
import {
  X, Calendar, Clock, User, ShieldCheck, AlertCircle,
  Archive, Edit3, CheckCircle2, AlertTriangle, ArrowRight,
  History, Loader2, Play, Ban, CornerUpLeft, Send, Link as LinkIcon,
  ExternalLink, MessageSquare, Plus, Trash2, Shield, Lock
} from 'lucide-react';
import {
  ClientTask,
  ClientRecord,
  ClientTaskEvent,
  ClientTaskStatus,
  Department,
  UserProfile,
  TaskMessage,
  TaskMessageVisibility,
  TaskExternalLink,
  TaskApprovalMode
} from '../../types';
import { taskManagementService, validateHttpsLink, validateMessageLinks } from '../../lib/taskManagementService';

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
  departments = [],
  eligibleAssignees = [],
  onTaskUpdated = () => {},
  onOpenEditModal = () => {}
}) => {
  const activeUser = currentUserProfile || currentUser || null;
  const effectiveClientStatus = client?.status || clientStatus || 'Active';
  // Feed state
  const [feed, setFeed] = useState<Array<{ type: 'message' | 'event'; data: TaskMessage | ClientTaskEvent; timestamp: string }>>([]);
  const [events, setEvents] = useState<ClientTaskEvent[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Composer state
  const [messageContent, setMessageContent] = useState('');
  const [messageVisibility, setMessageVisibility] = useState<TaskMessageVisibility>('internal_note');
  const [links, setLinks] = useState<TaskExternalLink[]>([]);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Status transition & reason modal state
  const [showReasonModal, setShowReasonModal] = useState<{
    targetStatus: ClientTaskStatus;
    actionLabel: string;
    isReopen?: boolean;
    isChangesRequested?: boolean;
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

  // Load feed and setup Realtime subscription
  useEffect(() => {
    if (isOpen && task) {
      loadInitialFeed(task.id);
      taskManagementService.markTaskRead(task.id, activeUser?.id);
      setShowReasonModal(null);
      setReasonText('');
      setShowArchiveConfirm(false);
      setArchiveReason('');
      setStatusError(null);
      setMessageContent('');
      setLinks([]);
      setLinkUrlInput('');
      setLinkTitleInput('');
      setLinkError(null);
      setComposerError(null);

      // Default message visibility: clients can only post shared_with_client
      if (isClient) {
        setMessageVisibility('shared_with_client');
      } else {
        setMessageVisibility('internal_note');
      }

      // Setup Realtime subscription - unsubscribes cleanly on close / task switch
      const unsubscribe = taskManagementService.subscribeToTaskFeed(task.id, () => {
        loadInitialFeed(task.id);
        taskManagementService.markTaskRead(task.id, currentUserProfile?.id);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, task?.id, isClient]);

  const loadInitialFeed = async (taskId: string) => {
    setIsLoadingFeed(true);
    try {
      const feedRes = await taskManagementService.fetchTaskFeed(taskId, undefined, 30);
      setFeed(feedRes.combinedFeed);
      setEvents(feedRes.events);
      setHasMoreFeed(feedRes.hasMore);
      setNextCursor(feedRes.nextCursor);
    } catch {
      setFeed([]);
      setEvents([]);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const loadOlderFeed = async () => {
    if (!task || !nextCursor || isLoadingFeed) return;
    setIsLoadingFeed(true);
    try {
      const feedRes = await taskManagementService.fetchTaskFeed(task.id, nextCursor, 30);
      setFeed((prev) => {
        const combined = [...feedRes.combinedFeed, ...prev];
        combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return combined;
      });
      setHasMoreFeed(feedRes.hasMore);
      setNextCursor(feedRes.nextCursor);
    } catch {
      // Keep existing feed
    } finally {
      setIsLoadingFeed(false);
    }
  };

  if (!isOpen || !task) return null;

  // Add external link to composer
  const handleAddLink = () => {
    setLinkError(null);
    if (!linkUrlInput.trim()) {
      setLinkError('Please enter a URL.');
      return;
    }
    if (links.length >= 5) {
      setLinkError('Maximum of 5 external links per item.');
      return;
    }

    const validation = validateHttpsLink(linkUrlInput.trim());
    if (!validation.valid) {
      setLinkError(validation.error || 'Invalid HTTPS URL.');
      return;
    }

    setLinks((prev) => [
      ...prev,
      {
        url: validation.sanitized!,
        title: linkTitleInput.trim() || undefined
      }
    ]);
    setLinkUrlInput('');
    setLinkTitleInput('');
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  // Post message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposerError(null);

    const trimmed = messageContent.trim();
    if (!trimmed) return;

    if (trimmed.length > 5000) {
      setComposerError('Message exceeds maximum limit of 5,000 characters.');
      return;
    }

    if (isTaskArchived || isClientArchived) {
      setComposerError('This task is archived. Conversations are read-only.');
      return;
    }

    if (isClientPaused) {
      if (!isOwnerOrManager) {
        setComposerError('Client is paused. Operational conversation is paused.');
        return;
      }
      if (messageVisibility !== 'internal_note') {
        setComposerError('Only internal administrative notes are allowed for paused clients.');
        return;
      }
    }

    setIsSendingMessage(true);
    try {
      const res = await taskManagementService.createTaskMessage({
        taskId: task.id,
        clientId: task.clientId,
        visibility: isClient ? 'shared_with_client' : messageVisibility,
        content: trimmed,
        links
      });

      if (res.error || !res.data) {
        setComposerError(res.error || 'Failed to post message.');
      } else {
        setMessageContent('');
        setLinks([]);
        setLinkUrlInput('');
        setLinkTitleInput('');
        await loadInitialFeed(task.id);
        setTimeout(() => {
          feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err: any) {
      setComposerError(err?.message || 'Error posting message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Status transitions
  const handleStatusChange = async (targetStatus: ClientTaskStatus, reason?: string) => {
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const res = await taskManagementService.updateStatus(task.id, targetStatus, reason, task.status);
      if (res.error) {
        setStatusError(res.error);
      } else {
        const updatedTask: ClientTask = {
          ...task,
          status: targetStatus,
          blockedReason: targetStatus === 'Blocked' ? (reason || null) : null,
          completedAt: targetStatus === 'Completed' ? new Date().toISOString() : (targetStatus === 'In Progress' && task.status === 'Completed' ? null : task.completedAt),
          completedBy: targetStatus === 'Completed' ? activeUser?.id : (targetStatus === 'In Progress' && task.status === 'Completed' ? null : task.completedBy),
          reopenedAt: task.status === 'Completed' && targetStatus === 'In Progress' ? new Date().toISOString() : task.reopenedAt,
          reopenedBy: task.status === 'Completed' && targetStatus === 'In Progress' ? activeUser?.id : task.reopenedBy,
          reopenReason: task.status === 'Completed' && targetStatus === 'In Progress' ? reason : task.reopenReason
        };
        onTaskUpdated(updatedTask);
        await loadInitialFeed(task.id);
        setShowReasonModal(null);
        setReasonText('');
        setReasonError(null);
      }
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to update task status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Archive Task
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

  // Reassign Task
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
        await loadInitialFeed(task.id);
      }
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to reassign task.');
    } finally {
      setIsReassigning(false);
    }
  };

  const formatDatetime = (iso?: string | null) => {
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

  const getStatusBadgeColor = (status: ClientTaskStatus) => {
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
      case 'Client Review':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 flex justify-end">
      {/* Right-Side Drawer (Mobile: full-screen; Desktop: 540px / max-w-2xl) */}
      <div
        className="bg-white dark:bg-dark-card border-l border-gray-200 dark:border-dark-border w-full sm:w-[540px] md:max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DRAWER TOP HEADER */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-start justify-between bg-gray-50/70 dark:bg-dark-card/70 flex-shrink-0">
          <div className="space-y-1.5 pr-3 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase">
                Week {task.weekNumber}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeColor(task.status)}`}>
                {task.status}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPriorityColor(task.priority)}`}>
                {task.priority} Priority
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-dark-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border">
                {task.approvalMode || 'Internal Only'}
              </span>
              {task.isOverdue && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                  Overdue
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug break-words">
              {task.title}
            </h2>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
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

          {/* WORKFLOW STATUS MANAGEMENT BAR */}
          <div className="p-3.5 rounded-2xl bg-brand-500/5 border border-brand-500/20 space-y-2.5">
            <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider block">
              Workflow Status Management
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {/* Assignee / Team Member Actions */}
              {isAssignedMember && !isClient && (
                <>
                  {task.status === 'Assigned' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                      onClick={() => handleStatusChange('In Progress')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Work (In Progress)</span>
                    </button>
                  )}

                  {task.status === 'In Progress' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                        onClick={() => setShowReasonModal({ targetStatus: 'Blocked', actionLabel: 'Mark as Blocked' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Mark Blocked</span>
                      </button>

                      <button
                        type="button"
                        disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                        onClick={() => handleStatusChange('Team Review')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit for Team Review</span>
                      </button>
                    </>
                  )}

                  {task.status === 'Blocked' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                      onClick={() => handleStatusChange('In Progress')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resume Work (In Progress)</span>
                    </button>
                  )}
                </>
              )}

              {/* Management Actions (Owner & Manager) */}
              {isOwnerOrManager && (
                <>
                  {task.status === 'Team Review' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                        onClick={() => setShowReasonModal({ targetStatus: 'In Progress', actionLabel: 'Request Changes', isChangesRequested: true })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                        <span>Request Changes</span>
                      </button>

                      {task.approvalMode === 'Client Approval Required' ? (
                        <button
                          type="button"
                          disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                          onClick={() => handleStatusChange('Client Review')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send to Client Review</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                          onClick={() => handleStatusChange('Completed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Mark Completed</span>
                        </button>
                      )}
                    </>
                  )}

                  {task.status === 'Client Review' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                        onClick={() => handleStatusChange('Completed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Deliverable</span>
                      </button>

                      <button
                        type="button"
                        disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                        onClick={() => setShowReasonModal({ targetStatus: 'In Progress', actionLabel: 'Request Changes', isChangesRequested: true })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                        <span>Request Changes</span>
                      </button>
                    </>
                  )}

                  {task.status === 'Completed' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                      onClick={() => setShowReasonModal({ targetStatus: 'In Progress', actionLabel: 'Reopen Task', isReopen: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                      <span>Reopen Task</span>
                    </button>
                  )}

                  {task.status === 'Draft' && task.assigneeId && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                      onClick={() => handleStatusChange('Assigned')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Set Status to Assigned</span>
                    </button>
                  )}
                </>
              )}

              {/* Client Workflow Actions (Client Review state only) */}
              {isClient && task.status === 'Client Review' && (
                <>
                  <button
                    type="button"
                    disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                    onClick={() => handleStatusChange('Completed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Deliverables</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingStatus || isClientPaused || isTaskArchived}
                    onClick={() => setShowReasonModal({ targetStatus: 'In Progress', actionLabel: 'Request Changes', isChangesRequested: true })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    <CornerUpLeft className="w-3.5 h-3.5" />
                    <span>Request Changes</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* CHRONOLOGICAL TASK CONVERSATION FEED */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
                <span>Task Conversation Feed</span>
              </span>

              {hasMoreFeed && (
                <button
                  type="button"
                  onClick={loadOlderFeed}
                  disabled={isLoadingFeed}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-700 disabled:opacity-50"
                >
                  {isLoadingFeed ? 'Loading older...' : 'Load older messages'}
                </button>
              )}
            </div>

            {/* Feed List */}
            <div className="space-y-3">
              {feed.length === 0 && !isLoadingFeed && (
                <div className="text-center py-6 border border-dashed border-gray-200 dark:border-dark-border rounded-xl text-gray-400 text-xs">
                  No conversation messages or events recorded yet.
                </div>
              )}

              {feed.map((item, idx) => {
                if (item.type === 'message') {
                  const msg = item.data as TaskMessage;
                  const isInternal = msg.visibility === 'internal_note';

                  // Safeguard: Never render internal notes to clients
                  if (isClient && isInternal) return null;

                  return (
                    <div
                      key={msg.id || idx}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isInternal
                          ? 'bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40'
                          : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {msg.authorName || 'User'}
                          </span>
                          <span className="text-[10px] text-gray-400 capitalize">
                            ({msg.authorRole?.replace(/_/g, ' ') || 'staff'})
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                            isInternal
                              ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300'
                          }`}>
                            {isInternal ? 'Internal Note' : 'Shared with Client'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {formatDatetime(msg.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>

                      {/* Links */}
                      {msg.links && msg.links.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-dark-border space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                            Attached Links ({msg.links.length}/5):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.links.map((link, lIdx) => (
                              <a
                                key={lIdx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-dark-100 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/40 text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border transition-colors max-w-xs truncate"
                              >
                                <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{link.title || link.url}</span>
                                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Lifecycle / Audit Event
                const evt = item.data as ClientTaskEvent;
                return (
                  <div key={evt.id || idx} className="flex items-start gap-2 text-[11px] py-1 text-gray-500 dark:text-gray-400 pl-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-700 dark:text-gray-300 capitalize">
                          {evt.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatDatetime(evt.createdAt)}</span>
                      </div>
                      {evt.notes && (
                        <p className="text-[10px] text-gray-500 italic mt-0.5">{evt.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={feedEndRef} />
            </div>
          </div>

          {/* AUDIT HISTORY SECTION (Preserved for compatibility and full compliance) */}
          <div className="pt-3 border-t border-gray-100 dark:border-dark-border">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5" />
              <span>Immutable Task Audit History</span>
            </span>
            <div className="space-y-1.5 border-l-2 border-gray-100 dark:border-dark-border pl-3 ml-1.5">
              {events.length === 0 && !isLoadingFeed && (
                <p className="text-gray-400 text-xs italic">No previous events recorded.</p>
              )}
              {events.slice(0, 5).map((evt) => (
                <div key={evt.id} className="text-[10px] text-gray-500">
                  <span className="font-bold text-gray-700 dark:text-gray-300">{evt.actorName}:</span>{' '}
                  <span className="capitalize">{evt.eventType.replace(/_/g, ' ')}</span>{' '}
                  <span className="text-gray-400">({formatDatetime(evt.createdAt)})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COMPOSER AT BOTTOM OF DRAWER */}
        <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50/90 dark:bg-dark-card/90 flex-shrink-0 space-y-2.5">
          {composerError && (
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {composerError}
            </div>
          )}

          {isTaskArchived || isClientArchived ? (
            <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-dark-100 text-center text-gray-500 text-xs font-medium">
              This task was archived. Conversation feed is strictly read-only.
            </div>
          ) : isClientPaused && !isOwnerOrManager ? (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-center text-amber-700 dark:text-amber-300 text-xs font-medium">
              Client is paused. Feed is read-only for Team Members and clients.
            </div>
          ) : (
            <>
              {isClientPaused && isOwnerOrManager && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-medium text-center">
                  Client is paused. Only Internal administrative notes may be posted.
                </div>
              )}
              <form onSubmit={handleSendMessage} className="space-y-2.5">
                {/* Visibility and character counter */}
                <div className="flex items-center justify-between">
                {!isClient ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMessageVisibility('internal_note')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        messageVisibility === 'internal_note'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-dark-100 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      Internal Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageVisibility('shared_with_client')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        messageVisibility === 'shared_with_client'
                          ? 'bg-brand-500 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-dark-100 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      Shared with Client
                    </button>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-800 text-[10px] font-bold border border-cyan-300">
                    Shared with Team
                  </span>
                )}

                <span className={`text-[10px] font-semibold ${
                  messageContent.length > 4500 ? 'text-rose-500 font-bold' : 'text-gray-400'
                }`}>
                  {messageContent.length} / 5,000
                </span>
              </div>

              {/* Textarea */}
              <textarea
                rows={2}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder={isClient ? 'Type a message or response for your operations team...' : (messageVisibility === 'internal_note' ? 'Write an internal note or staff comment...' : 'Add message visible to client...')}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none resize-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />

              {/* Links chips */}
              {links.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {links.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-dark-100 text-[11px] font-medium border border-gray-200 dark:border-dark-border">
                      <LinkIcon className="w-3 h-3 text-brand-500" />
                      <span className="max-w-[160px] truncate">{link.title || link.url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(idx)}
                        className="text-gray-400 hover:text-rose-500 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* External HTTPS Link Adder */}
              {links.length < 5 && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    value={linkUrlInput}
                    onChange={(e) => setLinkUrlInput(e.target.value)}
                    placeholder="Attach HTTPS link (Google Drive, Figma, Canva...)"
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-[11px] text-gray-800 dark:text-gray-200 outline-none"
                  />
                  <input
                    type="text"
                    value={linkTitleInput}
                    onChange={(e) => setLinkTitleInput(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-28 px-2 py-1 rounded-lg bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-[11px] text-gray-800 dark:text-gray-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-dark-100 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold border border-gray-200 dark:border-dark-border flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Link</span>
                  </button>
                </div>
              )}

              {linkError && (
                <p className="text-[11px] text-rose-500 font-semibold">{linkError}</p>
              )}

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!messageContent.trim() || isSendingMessage || messageContent.length > 5000}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50 text-xs"
                >
                  {isSendingMessage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Post Item</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
        </div>

        {/* REASON MODAL OVERLAY (Blocked, Review Return, Changes Requested, Reopen) */}
        {showReasonModal && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl max-w-md w-full space-y-4 shadow-2xl border border-gray-200 dark:border-dark-border">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {showReasonModal.actionLabel}
              </h3>
              <p className="text-xs text-gray-500">
                Please provide a mandatory reason / feedback for this transition:
              </p>
              <textarea
                rows={3}
                value={reasonText}
                onChange={(e) => {
                  setReasonText(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
                placeholder={
                  showReasonModal.isReopen
                    ? "Explain why this completed task must be reopened..."
                    : showReasonModal.isChangesRequested
                    ? "Explain what changes are required for this deliverable..."
                    : "Enter mandatory reason or required deliverable changes..."
                }
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none resize-none"
              />
              {reasonError && (
                <p className="text-xs text-rose-500 font-semibold">{reasonError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReasonModal(null);
                    setReasonError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => {
                    if (!reasonText.trim()) {
                      setReasonError(
                        showReasonModal.isReopen
                          ? "Reason for reopening is required."
                          : showReasonModal.isChangesRequested
                          ? "Reason for change request is required."
                          : "Reason is required."
                      );
                      return;
                    }
                    handleStatusChange(showReasonModal.targetStatus, reasonText.trim());
                  }}
                  className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isUpdatingStatus
                    ? 'Updating...'
                    : showReasonModal.isReopen
                    ? 'Confirm Reopen'
                    : showReasonModal.isChangesRequested
                    ? 'Confirm Change Request'
                    : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ARCHIVE CONFIRMATION OVERLAY */}
        {showArchiveConfirm && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
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
