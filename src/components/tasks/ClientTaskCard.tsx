import React from 'react';
import { 
  Calendar, Clock, User, AlertCircle, AlertTriangle, 
  ArrowRight, Play, Ban, Send, CheckCircle2, MoreVertical, Edit3, Archive 
} from 'lucide-react';
import { 
  ClientTask, 
  ClientTaskStatus, 
  UserProfile 
} from '../../types';

interface ClientTaskCardProps {
  task: ClientTask;
  currentUserProfile?: UserProfile | null;
  onSelectTask: (task: ClientTask) => void;
  onOpenEditModal: (task: ClientTask) => void;
  onStatusChange: (task: ClientTask, status: ClientTaskStatus, reason?: string) => void;
}

export const ClientTaskCard: React.FC<ClientTaskCardProps> = ({
  task,
  currentUserProfile,
  onSelectTask,
  onOpenEditModal,
  onStatusChange
}) => {
  const isOwnerOrManager = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';
  const isAssignedMember = task.assigneeId === currentUserProfile?.id;

  const formatDate = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Karachi'
      });
    } catch {
      return '';
    }
  };

  const getStatusBadge = (status: ClientTaskStatus) => {
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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40';
      case 'High':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40';
      case 'Normal':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40';
      case 'Low':
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-dark-border';
    }
  };

  return (
    <div
      onClick={() => onSelectTask(task)}
      className="group bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-brand-500/40 transition-all cursor-pointer flex flex-col justify-between gap-3 select-none"
    >
      {/* Top Row: Department & Status Badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-100 text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">
            {task.departmentName || 'Operations'}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPriorityBadge(task.priority)}`}>
            {task.priority}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {task.isOverdue && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500 text-white animate-pulse">
              Overdue
            </span>
          )}
          {!task.isAssigneeEligible && task.assigneeId && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1" title="Assignee is suspended or lost client access">
              <AlertTriangle className="w-3 h-3" />
              <span>Reassign</span>
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(task.status)}`}>
            {task.status}
          </span>
        </div>
      </div>

      {/* Title & Details Snippet */}
      <div>
        <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
          {task.title}
        </h4>
        {task.details && (
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
            {task.details}
          </p>
        )}
      </div>

      {/* Bottom Row: Assignee, Dates & Quick Controls */}
      <div className="pt-2 border-t border-gray-100 dark:border-dark-border flex items-center justify-between gap-2 text-[11px]">
        {/* Assignee & Dates */}
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <div className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-[9px] flex-shrink-0">
              {task.assigneeName ? task.assigneeName[0].toUpperCase() : 'D'}
            </div>
            <span className="truncate font-semibold text-gray-700 dark:text-gray-300">
              {task.assigneeName || 'Unassigned (Draft)'}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 text-[10px]">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span>{formatDate(task.dueDate)}</span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {isAssignedMember && task.status === 'Assigned' && (
            <button
              type="button"
              onClick={() => onStatusChange(task, 'In Progress')}
              className="p-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white transition-colors"
              title="Start Work"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          {isAssignedMember && task.status === 'In Progress' && (
            <button
              type="button"
              onClick={() => onStatusChange(task, 'Team Review')}
              className="p-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition-colors"
              title="Submit for Team Review"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}

          {isAssignedMember && task.status === 'Blocked' && (
            <button
              type="button"
              onClick={() => onStatusChange(task, 'In Progress')}
              className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
              title="Resume Work"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}

          {isOwnerOrManager && (
            <button
              type="button"
              onClick={() => onOpenEditModal(task)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
              title="Edit Task"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
