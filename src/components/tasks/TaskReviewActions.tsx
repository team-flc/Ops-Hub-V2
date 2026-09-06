import React from 'react';
import { Play, Ban, Send, CheckCircle2, CornerUpLeft, User, ShieldAlert } from 'lucide-react';
import { ClientTask, ClientTaskStatus, UserProfile } from '../../types';

interface TaskReviewActionsProps {
  task: ClientTask;
  activeUser: UserProfile | null;
  isClient: boolean;
  isOwnerOrManager: boolean;
  isAssignedMember: boolean;
  isClientPaused: boolean;
  isTaskArchived: boolean;
  isUpdatingStatus: boolean;
  onStatusChange: (status: ClientTaskStatus, reason?: string) => void;
  onRequestReasonModal: (params: {
    targetStatus: ClientTaskStatus;
    actionLabel: string;
    isReopen?: boolean;
    isChangesRequested?: boolean;
    isOwnerOverride?: boolean;
  }) => void;
}

export const TaskReviewActions: React.FC<TaskReviewActionsProps> = ({
  task,
  activeUser,
  isClient,
  isOwnerOrManager,
  isAssignedMember,
  isClientPaused,
  isTaskArchived,
  isUpdatingStatus,
  onStatusChange,
  onRequestReasonModal
}) => {
  const isOwner = activeUser?.role === 'owner';
  const isManager = activeUser?.role === 'operational_manager';
  const disabled = isUpdatingStatus || isClientPaused || isTaskArchived;

  return (
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
                disabled={disabled}
                onClick={() => onStatusChange('In Progress')}
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
                  disabled={disabled}
                  onClick={() => onRequestReasonModal({ targetStatus: 'Blocked', actionLabel: 'Mark as Blocked' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Mark Blocked</span>
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onStatusChange('Team Review')}
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
                disabled={disabled}
                onClick={() => onStatusChange('In Progress')}
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
                  disabled={disabled}
                  onClick={() => onRequestReasonModal({ targetStatus: 'In Progress', actionLabel: 'Request Changes', isChangesRequested: true })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <CornerUpLeft className="w-3.5 h-3.5" />
                  <span>Request Changes</span>
                </button>

                {task.approvalMode === 'Client Approval Required' ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onStatusChange('Client Review')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to Client Review</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onStatusChange('Completed')}
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
                {/* STRICT SAFEGUARD: Operational Managers CANNOT approve Client Review tasks. Only Owner explicit override or Client approval allowed. */}
                {isOwner && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRequestReasonModal({
                      targetStatus: 'Completed',
                      actionLabel: 'Owner Override: Approve Deliverable',
                      isOwnerOverride: true
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                    title="Owner emergency override (requires mandatory reason)"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Owner Override: Approve</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRequestReasonModal({ targetStatus: 'In Progress', actionLabel: 'Request Changes', isChangesRequested: true })}
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
                disabled={disabled}
                onClick={() => onRequestReasonModal({ targetStatus: 'In Progress', actionLabel: 'Reopen Task', isReopen: true })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                <span>Reopen Task</span>
              </button>
            )}

            {task.status === 'Draft' && task.assigneeId && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onStatusChange('Assigned')}
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
              disabled={disabled}
              onClick={() => onStatusChange('Completed')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve Deliverables</span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onRequestReasonModal({ targetStatus: 'In Progress', actionLabel: 'Request Changes', isChangesRequested: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
              <span>Request Changes</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
