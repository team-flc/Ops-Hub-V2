import React, { useState } from 'react';
import {
  Clock, PlayCircle, ShieldCheck, CheckCheck, Plus, AlertTriangle
} from 'lucide-react';
import { ClientRecord, ClientTask, ClientTaskStatus, UserProfile } from '../../types';
import { ClientKanbanCard } from './ClientKanbanCard';
import { TaskApprovalModal } from './TaskApprovalModal';
import { TaskFeedbackModal } from './TaskFeedbackModal';

interface ClientKanbanBoardProps {
  client: ClientRecord;
  tasks: ClientTask[];
  currentUserProfile?: UserProfile | null;
  onSelectTask: (task: ClientTask) => void;
  onOpenEditModal: (task: ClientTask) => void;
  onOpenCreateTask: () => void;
  onStatusChange: (task: ClientTask, targetStatus: ClientTaskStatus, options?: any) => Promise<void>;
  onToggleTimer: (task: ClientTask) => Promise<void>;
  onShowToast: (msg: string) => void;
}

type KanbanColumnId = 'Pending' | 'In Progress' | 'Approval' | 'Done';

interface ColumnConfig {
  id: KanbanColumnId;
  label: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
  statuses: ClientTaskStatus[];
}

export const ClientKanbanBoard: React.FC<ClientKanbanBoardProps> = ({
  client,
  tasks,
  currentUserProfile,
  onSelectTask,
  onOpenEditModal,
  onOpenCreateTask,
  onStatusChange,
  onToggleTimer,
  onShowToast
}) => {
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnId | null>(null);
  const [approvalModalTask, setApprovalModalTask] = useState<ClientTask | null>(null);
  const [feedbackModalTask, setFeedbackModalTask] = useState<ClientTask | null>(null);

  const isOwnerOrManager =
    currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';

  const columns: ColumnConfig[] = [
    {
      id: 'Pending',
      label: 'Pending',
      icon: Clock,
      badgeBg: 'bg-slate-100 dark:bg-dark-100 text-slate-700 dark:text-slate-300',
      badgeText: 'text-slate-700 dark:text-slate-300',
      borderAccent: 'border-slate-200 dark:border-dark-border',
      statuses: ['Pending', 'Draft', 'Assigned', 'Blocked']
    },
    {
      id: 'In Progress',
      label: 'In Progress',
      icon: PlayCircle,
      badgeBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
      badgeText: 'text-blue-700 dark:text-blue-300',
      borderAccent: 'border-blue-200 dark:border-blue-900/40',
      statuses: ['In Progress']
    },
    {
      id: 'Approval',
      label: 'Approval',
      icon: ShieldCheck,
      badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
      badgeText: 'text-purple-700 dark:text-purple-300',
      borderAccent: 'border-purple-200 dark:border-purple-900/40',
      statuses: ['Approval', 'Team Review', 'Client Review']
    },
    {
      id: 'Done',
      label: 'Done',
      icon: CheckCheck,
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      borderAccent: 'border-emerald-200 dark:border-emerald-900/40',
      statuses: ['Done', 'Completed']
    }
  ];

  const getTasksForColumn = (col: ColumnConfig) => {
    return tasks.filter((t) => col.statuses.includes(t.status));
  };

  const handleDragOver = (e: React.DragEvent, colId: KanbanColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (colId: KanbanColumnId) => {
    if (dragOverColumn === colId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: KanbanColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);

    const rawData = e.dataTransfer.getData('text/plain');
    if (!rawData) return;

    try {
      const { taskId, currentStatus } = JSON.parse(rawData);
      const droppedTask = tasks.find((t) => t.id === taskId);
      if (!droppedTask) return;

      // Check if moving to same logical column
      const currentTarget = columns.find((c) => c.statuses.includes(droppedTask.status))?.id;
      if (currentTarget === targetColumn) return;

      // Permission check for moving to Done
      if (targetColumn === 'Done') {
        if (!isOwnerOrManager) {
          onShowToast('Forbidden: Only Owner or Operational Manager can approve tasks to Done.');
          return;
        }
        await onStatusChange(droppedTask, 'Done');
        return;
      }

      // If moving to Approval, prompt approval modal to capture evidence/notes and stop timer
      if (targetColumn === 'Approval') {
        setApprovalModalTask(droppedTask);
        return;
      }

      // If management moves task from Approval back to In Progress, prompt feedback modal
      if (targetColumn === 'In Progress' && (droppedTask.status === 'Approval' || droppedTask.status === 'Team Review' || droppedTask.status === 'Client Review')) {
        if (isOwnerOrManager) {
          setFeedbackModalTask(droppedTask);
          return;
        }
      }

      // Standard transition
      await onStatusChange(droppedTask, targetColumn as ClientTaskStatus);
    } catch {
      // Invalid drag data
    }
  };

  return (
    <div className="space-y-4">
      {/* 4 Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const colTasks = getTasksForColumn(col);
          const isDragOver = dragOverColumn === col.id;
          const IconComponent = col.icon;

          return (
            <div
              key={col.id}
              data-testid={`kanban-column-${col.id.toLowerCase().replace(/\s+/g, '-')}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => handleDragLeave(col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col bg-gray-50/70 dark:bg-dark-300/40 rounded-2xl border transition-all min-h-[360px] ${
                isDragOver
                  ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-500/5'
                  : 'border-gray-200 dark:border-dark-border'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${col.badgeBg}`}>
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                    {col.label}
                  </h3>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Task Cards List */}
              <div className="p-2.5 space-y-2.5 flex-1">
                {colTasks.length > 0 ? (
                  colTasks.map((task) => (
                    <ClientKanbanCard
                      key={task.id}
                      task={task}
                      currentUserProfile={currentUserProfile}
                      onSelectTask={onSelectTask}
                      onOpenEditModal={onOpenEditModal}
                      onStatusChange={onStatusChange}
                      onToggleTimer={onToggleTimer}
                      onRequestApproval={(t) => setApprovalModalTask(t)}
                      onRequestFeedback={(t) => setFeedbackModalTask(t)}
                    />
                  ))
                ) : (
                  <div className="h-40 rounded-xl border border-dashed border-gray-200 dark:border-dark-border flex flex-col items-center justify-center text-center p-4">
                    <p className="text-[11px] text-gray-400 dark:text-gray-400 font-semibold">
                      No tasks in {col.label}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Approval Modal */}
      {approvalModalTask && (
        <TaskApprovalModal
          isOpen={Boolean(approvalModalTask)}
          onClose={() => setApprovalModalTask(null)}
          task={approvalModalTask}
          onSubmit={async ({ evidenceUrl, completionNotes }) => {
            await onStatusChange(approvalModalTask, 'Approval', {
              evidenceUrl,
              completionNotes
            });
            onShowToast(`Task "${approvalModalTask.title}" submitted for approval.`);
          }}
        />
      )}

      {/* Feedback Modal */}
      {feedbackModalTask && (
        <TaskFeedbackModal
          isOpen={Boolean(feedbackModalTask)}
          onClose={() => setFeedbackModalTask(null)}
          task={feedbackModalTask}
          onSubmit={async (feedback) => {
            await onStatusChange(feedbackModalTask, 'In Progress', { feedback });
            onShowToast(`Task "${feedbackModalTask.title}" returned to In Progress with feedback.`);
          }}
        />
      )}
    </div>
  );
};
