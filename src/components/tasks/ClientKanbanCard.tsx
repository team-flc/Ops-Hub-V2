import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Play, Pause, ExternalLink, Send, CheckCircle2, RotateCcw,
  Edit3, AlertTriangle, MessageSquare, Check, User
} from 'lucide-react';
import { ClientTask, ClientTaskStatus, UserProfile } from '../../types';

interface ClientKanbanCardProps {
  task: ClientTask;
  currentUserProfile?: UserProfile | null;
  onSelectTask: (task: ClientTask) => void;
  onOpenEditModal: (task: ClientTask) => void;
  onStatusChange: (task: ClientTask, targetStatus: ClientTaskStatus, options?: any) => void;
  onToggleTimer: (task: ClientTask) => void;
  onRequestApproval: (task: ClientTask) => void;
  onRequestFeedback: (task: ClientTask) => void;
  isDragging?: boolean;
}

export const ClientKanbanCard: React.FC<ClientKanbanCardProps> = ({
  task,
  currentUserProfile,
  onSelectTask,
  onOpenEditModal,
  onStatusChange,
  onToggleTimer,
  onRequestApproval,
  onRequestFeedback,
  isDragging
}) => {
  const isOwnerOrManager =
    currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';
  const isAssignedMember = task.assigneeId === currentUserProfile?.id;
  const isTimerRunning = Boolean(task.timerStartedAt);

  // Live seconds ticker when timer is running
  const [liveSeconds, setLiveSeconds] = useState(task.timeSpentSeconds || 0);

  useEffect(() => {
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

  const formatTimerDisplay = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Karachi'
      });
    } catch {
      return '';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900';
      case 'High':
        return 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900';
      case 'Normal':
        return 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900';
      case 'Low':
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-dark-border';
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, currentStatus: task.status }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelectTask(task)}
      data-testid={`kanban-card-${task.id}`}
      className={`group relative bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-3.5 shadow-xs hover:shadow-md hover:border-brand-500/50 transition-all cursor-pointer flex flex-col justify-between gap-2.5 select-none ${
        isDragging ? 'opacity-40 scale-95 border-dashed border-brand-500' : ''
      }`}
    >
      {/* Top Meta: Department & Priority Badges */}
      <div className="flex items-center justify-between gap-1.5">
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
          {isOwnerOrManager && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditModal(task);
              }}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Edit Task"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Task Title & Details Snippet */}
      <div>
        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2 break-words leading-snug">
          {task.title}
        </h4>
        {task.details && (
          <p className="text-[11px] text-gray-400 dark:text-gray-400 mt-1 line-clamp-2 break-words">
            {task.details}
          </p>
        )}
      </div>

      {/* Feedback Banner if returned with feedback */}
      {task.feedback && task.status === 'In Progress' && (
        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="min-w-0">
            <span className="font-bold">Feedback: </span>
            <span className="line-clamp-2">{task.feedback}</span>
          </div>
        </div>
      )}

      {/* Evidence & Timer Meta Bar */}
      <div className="flex items-center justify-between gap-2 text-[10px] pt-1">
        {/* Timer Display & Quick Start/Pause */}
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1 ${
              isTimerRunning
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse'
                : liveSeconds > 0
                ? 'bg-gray-100 dark:bg-dark-100 text-gray-700 dark:text-gray-300'
                : 'text-gray-400'
            }`}
            title={isTimerRunning ? 'Timer active' : 'Time recorded'}
          >
            <Clock className="w-3 h-3" />
            <span>{formatTimerDisplay(liveSeconds)}</span>
          </span>

          {(isAssignedMember || isOwnerOrManager) && (task.status === 'In Progress' || task.status === 'Pending') && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTimer(task);
              }}
              data-testid={`timer-btn-${task.id}`}
              className={`p-1 rounded-md transition-colors cursor-pointer flex items-center justify-center ${
                isTimerRunning
                  ? 'bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white'
                  : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'
              }`}
              title={isTimerRunning ? 'Pause Timer' : 'Start Timer'}
            >
              {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Evidence Link */}
        {task.evidenceUrl && (
          <a
            href={task.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            data-testid={`evidence-link-${task.id}`}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40 hover:underline"
            title={task.evidenceUrl}
          >
            <ExternalLink className="w-3 h-3" />
            <span className="font-bold">Evidence</span>
          </a>
        )}
      </div>

      {/* Bottom Row: Assignee, Due Date & Accessible Actions */}
      <div className="pt-2 border-t border-gray-100 dark:border-dark-border flex items-center justify-between gap-2 text-[11px]">
        {/* Assignee & Due Date */}
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            {task.assigneeAvatar ? (
              <img
                src={task.assigneeAvatar}
                alt={task.assigneeName || 'User'}
                className="w-4 h-4 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-[8px] flex-shrink-0">
                {task.assigneeName ? task.assigneeName[0].toUpperCase() : <User className="w-2.5 h-2.5" />}
              </div>
            )}
            <span className="truncate font-semibold text-gray-700 dark:text-gray-300 text-[10px]">
              {task.assigneeName || 'Unassigned'}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 text-[10px]">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span>{formatDate(task.dueDate) || 'Unscheduled'}</span>
          </div>
        </div>

        {/* Accessible Kanban Status Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Pending -> In Progress */}
          {(task.status === 'Pending' || task.status === 'Draft' || task.status === 'Assigned') && (isAssignedMember || isOwnerOrManager) && (
            <button
              type="button"
              onClick={() => onStatusChange(task, 'In Progress')}
              data-testid={`start-task-btn-${task.id}`}
              className="px-2 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Start Work (Move to In Progress)"
            >
              <Play className="w-2.5 h-2.5" />
              <span>Start</span>
            </button>
          )}

          {/* In Progress -> Approval */}
          {task.status === 'In Progress' && (isAssignedMember || isOwnerOrManager) && (
            <button
              type="button"
              onClick={() => onRequestApproval(task)}
              data-testid={`submit-approval-btn-${task.id}`}
              className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Submit for Approval"
            >
              <Send className="w-2.5 h-2.5" />
              <span>Submit</span>
            </button>
          )}

          {/* Approval Actions */}
          {(task.status === 'Approval' || task.status === 'Team Review' || task.status === 'Client Review') && (
            isOwnerOrManager ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onRequestFeedback(task)}
                  data-testid={`reject-task-btn-${task.id}`}
                  className="p-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-colors cursor-pointer"
                  title="Return to In Progress with Feedback"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange(task, 'Done')}
                  data-testid={`approve-task-btn-${task.id}`}
                  className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  title="Approve to Done"
                >
                  <Check className="w-3 h-3" />
                  <span>Approve</span>
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-900/30">
                In Review
              </span>
            )
          )}

          {/* Done status indicator */}
          {(task.status === 'Done' || task.status === 'Completed') && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/30">
              <CheckCircle2 className="w-3 h-3" />
              <span>Done</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
