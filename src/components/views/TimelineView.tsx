import React from 'react';
import { useOpsStore } from '../../store/opsStore';
import { PriorityBadge } from '../common/PriorityBadge';
import { AvatarGroup } from '../common/AvatarGroup';
import { Clock, Calendar, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../utils/helpers';

export const TimelineView: React.FC = () => {
  const tasks = useOpsStore((state) => state.tasks);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeListId = useOpsStore((state) => state.activeListId);
  const filter = useOpsStore((state) => state.filter);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);

  const filteredTasks = tasks.filter((task) => {
    if (activeSpaceId && task.spaceId !== activeSpaceId) return false;
    if (activeListId && task.listId !== activeListId) return false;
    if (filter.priorityFilter !== 'all' && task.priority !== filter.priorityFilter) return false;
    if (filter.statusFilter !== 'all' && task.status !== filter.statusFilter) return false;
    if (filter.assigneeFilter !== 'all' && !task.assigneeIds.includes(filter.assigneeFilter)) return false;
    return true;
  });

  // Generate 14-day timeline window (3 days before today to 10 days after)
  const today = new Date();
  const timelineDays: { date: Date; dateStr: string; label: string; isToday: boolean; isWeekend: boolean }[] = [];

  for (let i = -3; i <= 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    timelineDays.push({
      date: d,
      dateStr,
      label: d.toLocaleDateString('en-US', { weekday: 'narrow', month: 'numeric', day: 'numeric' }),
      isToday: i === 0,
      isWeekend
    });
  }

  const startDateStr = timelineDays[0].dateStr;
  const endDateStr = timelineDays[timelineDays.length - 1].dateStr;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-brand-500" />
          <span>Operations Timeline & Gantt Schedule</span>
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Visual project schedule showing duration, active sprints, and task progress
        </p>
      </div>

      {/* Gantt Container */}
      <div className="border border-gray-200 dark:border-dark-border rounded-2xl bg-white dark:bg-dark-300 overflow-x-auto shadow-sm">
        <div className="min-w-[900px]">
          {/* Header row with Days */}
          <div className="grid grid-cols-12 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-200 text-xs font-bold text-gray-600 dark:text-gray-400 py-3">
            <div className="col-span-4 px-4 uppercase tracking-wider text-[11px]">
              Task & Assignee
            </div>
            <div className="col-span-8 grid grid-cols-14 text-center divide-x divide-gray-200 dark:divide-dark-border/40">
              {timelineDays.map((td) => (
                <div
                  key={td.dateStr}
                  className={`py-0.5 text-[10px] ${
                    td.isToday
                      ? 'bg-brand-500 text-white font-extrabold rounded-md shadow-sm'
                      : td.isWeekend
                      ? 'bg-gray-100/60 dark:bg-dark-400/40 text-gray-400'
                      : ''
                  }`}
                >
                  <div>{td.label.split(',')[0]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {filteredTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400 italic">
                No active tasks found in this timeline range.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const subtasksDone = task.subtasks.filter((s) => s.completed).length;
                const progress =
                  task.subtasks.length > 0
                    ? Math.round((subtasksDone / task.subtasks.length) * 100)
                    : task.status === 'completed'
                    ? 100
                    : 40;

                // Calculate horizontal position in the 14-day grid
                const taskStart = task.startDate || task.createdAt.split('T')[0];
                const taskDue = task.dueDate || taskStart;

                let startIndex = timelineDays.findIndex((td) => td.dateStr === taskStart);
                let endIndex = timelineDays.findIndex((td) => td.dateStr === taskDue);

                if (startIndex === -1) startIndex = taskStart < startDateStr ? 0 : 13;
                if (endIndex === -1) endIndex = taskDue > endDateStr ? 13 : 0;
                if (endIndex < startIndex) endIndex = startIndex;

                const colSpan = Math.max(1, endIndex - startIndex + 1);
                const leftOffsetPercent = (startIndex / 14) * 100;
                const widthPercent = (colSpan / 14) * 100;

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="grid grid-cols-12 items-center hover:bg-gray-50/70 dark:hover:bg-dark-200/50 cursor-pointer transition-colors py-3"
                  >
                    {/* Left details */}
                    <div className="col-span-4 px-4 flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400">{task.taskNumber}</span>
                          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                          <span>{formatDate(task.dueDate)}</span>
                          <span>•</span>
                          <span>{task.estimatedHours || 0}h est</span>
                        </div>
                      </div>
                      <AvatarGroup userIds={task.assigneeIds} max={1} size="xs" />
                    </div>

                    {/* Timeline Bar Track */}
                    <div className="col-span-8 px-2 relative h-8 flex items-center">
                      {/* Visual Bar */}
                      <div
                        className="absolute h-6 rounded-lg shadow-sm border flex items-center px-2 text-[10px] font-semibold text-white overflow-hidden transition-all duration-300"
                        style={{
                          left: `${leftOffsetPercent}%`,
                          width: `${Math.max(6, widthPercent)}%`,
                          backgroundColor:
                            task.priority === 'urgent'
                              ? '#ef4444'
                              : task.priority === 'high'
                              ? '#f59e0b'
                              : '#6366f1',
                          borderColor: 'rgba(255,255,255,0.2)'
                        }}
                      >
                        {/* Progress fill */}
                        <div
                          className="absolute inset-y-0 left-0 bg-black/20"
                          style={{ width: `${progress}%` }}
                        />
                        <span className="relative z-10 truncate text-white drop-shadow">
                          {progress}% {task.title}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
