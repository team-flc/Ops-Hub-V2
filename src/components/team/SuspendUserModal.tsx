import React, { useState, useEffect } from 'react';
import { 
  X, UserX, AlertTriangle, ArrowRight, CheckCircle2, 
  Loader2, ListTodo 
} from 'lucide-react';
import { Task, TeamMemberRecord, UserProfile } from '../../types';
import { teamManagementService } from '../../lib/teamManagementService';

interface SuspendUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: TeamMemberRecord | null;
  activeTeamMembers: TeamMemberRecord[];
  currentUserProfile: UserProfile | null;
}

export const SuspendUserModal: React.FC<SuspendUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  member,
  activeTeamMembers,
  currentUserProfile
}) => {
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [taskReassignments, setTaskReassignments] = useState<Record<string, string>>({});
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const eligibleReplacements = activeTeamMembers.filter(
    (tm) => tm.id !== member?.id && tm.status === 'active'
  );

  useEffect(() => {
    if (member && isOpen) {
      setIsLoadingTasks(true);
      setErrorMessage(null);
      teamManagementService
        .fetchOpenTasksForUser(member.id)
        .then((tasks) => {
          setOpenTasks(tasks);
          setIsLoadingTasks(false);
        })
        .catch(() => {
          setIsLoadingTasks(false);
        });
    }
  }, [member, isOpen]);

  if (!isOpen || !member) return null;

  const handleBulkAssign = (assigneeId: string) => {
    setBulkAssigneeId(assigneeId);
    if (!assigneeId) return;
    const updated: Record<string, string> = {};
    openTasks.forEach((t) => {
      updated[t.id] = assigneeId;
    });
    setTaskReassignments(updated);
  };

  const handleTaskAssign = (taskId: string, assigneeId: string) => {
    setTaskReassignments((prev) => ({
      ...prev,
      [taskId]: assigneeId
    }));
  };

  const allTasksReassigned = openTasks.every((t) => !!taskReassignments[t.id]);

  const handleConfirmSuspension = async () => {
    if (!currentUserProfile) return;
    if (openTasks.length > 0 && !allTasksReassigned) {
      setErrorMessage('Every open task must be reassigned before this account can be suspended.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const reassignmentsArray = openTasks.map((t) => ({
      taskId: t.id,
      newAssigneeId: taskReassignments[t.id]
    }));

    try {
      const result = await teamManagementService.suspendTeamMember(
        member.id,
        reassignmentsArray,
        currentUserProfile.id
      );

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
      } else {
        setIsSubmitting(false);
        onSuccess();
        onClose();
      }
    } catch {
      setErrorMessage('Failed to complete suspension.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-rose-100 dark:border-dark-border flex items-center justify-between bg-rose-50/50 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shadow-sm">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                Offboard & Suspend Team Member
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Safely reassign tasks and revoke workspace login access
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target Profile Card */}
          <div className="p-4 bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-gray-100">{member.fullName}</span>
              <span className="text-xs text-slate-500 block font-mono">{member.workEmail}</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {member.designationName || 'Team Member'}
            </span>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Open Tasks Check */}
          {isLoadingTasks ? (
            <div className="py-8 text-center space-y-2 text-xs text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" />
              <span>Scanning assigned operational tasks...</span>
            </div>
          ) : openTasks.length > 0 ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Action Required:</strong> This team member has <strong>{openTasks.length}</strong> active tasks. Every task must have a replacement assignee before suspension.
                </span>
              </div>

              {/* Bulk Reassignment Control */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl">
                <span className="text-xs font-bold text-slate-700 dark:text-gray-300">
                  Bulk Reassign All Open Tasks:
                </span>
                <select
                  value={bulkAssigneeId}
                  onChange={(e) => handleBulkAssign(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-lg text-slate-900 dark:text-gray-100"
                >
                  <option value="">Select Team Member...</option>
                  {eligibleReplacements.map((r) => (
                    <option key={r.id} value={r.id}>{r.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Tasks List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {openTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <ListTodo className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-gray-200 truncate">{task.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-600">
                        {task.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={taskReassignments[task.id] || ''}
                        onChange={(e) => handleTaskAssign(task.id, e.target.value)}
                        className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-lg text-slate-900 dark:text-gray-100"
                      >
                        <option value="">Reassign to...</option>
                        {eligibleReplacements.map((r) => (
                          <option key={r.id} value={r.id}>{r.fullName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border text-center space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <div className="text-xs font-bold text-slate-800 dark:text-gray-200">
                Zero Open Tasks Assigned
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No active operational deliverables require reassignment. You can safely proceed with suspension.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-dark-sidebar border-t border-slate-100 dark:border-dark-border flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-300 text-xs font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSuspension}
            disabled={isSubmitting || (openTasks.length > 0 && !allTasksReassigned)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Suspending Account...</span>
              </>
            ) : (
              <span>Confirm Suspension</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
