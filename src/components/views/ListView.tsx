import React, { useState } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { Task, StatusConfig, Priority } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { AvatarGroup } from '../common/AvatarGroup';
import { 
  ChevronDown, ChevronRight, Plus, CheckSquare, Calendar, 
  Clock, Tag, Play, Square, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { formatDate, formatTimeMinutes, formatSecondsToDigital, isOverdue } from '../../utils/helpers';

export const ListView: React.FC = () => {
  const tasks = useOpsStore((state) => state.tasks);
  const spaces = useOpsStore((state) => state.spaces);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeListId = useOpsStore((state) => state.activeListId);
  const filter = useOpsStore((state) => state.filter);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);
  const updateTask = useOpsStore((state) => state.updateTask);
  const createTask = useOpsStore((state) => state.createTask);
  const activeTimer = useOpsStore((state) => state.activeTimer);
  const startTimer = useOpsStore((state) => state.startTimer);
  const stopTimer = useOpsStore((state) => state.stopTimer);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [quickAddGroup, setQuickAddGroup] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Filter tasks based on active selection & search/filter bar
  const filteredTasks = tasks.filter((task) => {
    if (activeSpaceId && task.spaceId !== activeSpaceId) return false;
    if (activeListId && task.listId !== activeListId) return false;
    if (filter.priorityFilter !== 'all' && task.priority !== filter.priorityFilter) return false;
    if (filter.statusFilter !== 'all' && task.status !== filter.statusFilter) return false;
    if (filter.assigneeFilter !== 'all' && !task.assigneeIds.includes(filter.assigneeFilter)) return false;
    if (filter.slaFilter !== 'all' && task.customFields?.slaStatus !== filter.slaFilter) return false;
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchNumber = task.taskNumber.toLowerCase().includes(q);
      const matchDesc = task.description.toLowerCase().includes(q);
      const matchTag = task.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchNumber && !matchDesc && !matchTag) return false;
    }
    return true;
  });

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleQuickAdd = (groupKey: string, statusValue?: string, priorityValue?: Priority) => {
    if (!quickAddTitle.trim()) return;
    const newTask = createTask({
      title: quickAddTitle.trim(),
      status: statusValue || 'todo',
      priority: priorityValue || 'normal',
      spaceId: activeSpaceId || spaces[0]?.id || 'space-1',
      listId: activeListId || undefined
    });
    setQuickAddTitle('');
    setQuickAddGroup(null);
    setSelectedTaskId(newTask.id);
  };

  // Grouping logic
  const currentSpace = spaces.find((s) => s.id === activeSpaceId);
  const statuses = currentSpace?.statuses || [
    { id: 'todo', label: 'To Do', color: '#94a3b8', category: 'todo' },
    { id: 'in_progress', label: 'In Progress', color: '#3b82f6', category: 'inprogress' },
    { id: 'under_review', label: 'Under Review', color: '#8b5cf6', category: 'inprogress' },
    { id: 'blocked', label: 'Blocked / Escalated', color: '#ef4444', category: 'blocked' },
    { id: 'completed', label: 'Completed', color: '#10b981', category: 'done' }
  ];

  // Group by status by default
  const groups: { id: string; title: string; color: string; count: number; tasks: Task[]; statusId?: string; priority?: Priority }[] = [];

  if (filter.groupBy === 'priority') {
    const priorities: { id: Priority; label: string; color: string }[] = [
      { id: 'urgent', label: 'Urgent Priority', color: '#ef4444' },
      { id: 'high', label: 'High Priority', color: '#f59e0b' },
      { id: 'normal', label: 'Normal Priority', color: '#3b82f6' },
      { id: 'low', label: 'Low Priority', color: '#94a3b8' }
    ];
    priorities.forEach((p) => {
      const gTasks = filteredTasks.filter((t) => t.priority === p.id);
      groups.push({
        id: p.id,
        title: p.label,
        color: p.color,
        count: gTasks.length,
        tasks: gTasks,
        priority: p.id
      });
    });
  } else {
    // Group by status (Default ClickUp style)
    statuses.forEach((st) => {
      const gTasks = filteredTasks.filter((t) => t.status === st.id);
      groups.push({
        id: st.id,
        title: st.label,
        color: st.color,
        count: gTasks.length,
        tasks: gTasks,
        statusId: st.id
      });
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* List Header Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-dark-border">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>{currentSpace ? currentSpace.name : 'All Operations Tasks'}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
              {filteredTasks.length} Tasks
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Grouped by {filter.groupBy === 'priority' ? 'Priority Level' : 'Workflow Status'} • ClickUp-style interactive list
          </p>
        </div>
      </div>

      {/* Task Groups */}
      <div className="space-y-6">
        {groups.map((group) => {
          const isCollapsed = collapsedGroups[group.id];
          return (
            <div key={group.id} className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-300 shadow-sm overflow-hidden">
              {/* Group Header Bar */}
              <div
                onClick={() => toggleGroupCollapse(group.id)}
                className="flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-dark-200/60 hover:bg-gray-100 dark:hover:bg-dark-200 cursor-pointer select-none transition-colors border-b border-gray-100 dark:border-dark-border"
              >
                <div className="flex items-center gap-2.5">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                    {group.title}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-dark-100 text-gray-600 dark:text-gray-400">
                    {group.count}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickAddGroup(group.id);
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 p-1 rounded-lg hover:bg-brand-500/10 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>

              {/* Task Rows List */}
              {!isCollapsed && (
                <div className="divide-y divide-gray-100 dark:divide-dark-border">
                  {/* Table Column Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50/30 dark:bg-dark-300">
                    <div className="col-span-5 sm:col-span-5">Task Name</div>
                    <div className="col-span-2 sm:col-span-2">Assignee</div>
                    <div className="col-span-2 sm:col-span-2">Due Date</div>
                    <div className="col-span-2 sm:col-span-2">Priority</div>
                    <div className="col-span-1 sm:col-span-1 text-right">Actions</div>
                  </div>

                  {group.tasks.length === 0 && quickAddGroup !== group.id && (
                    <div className="px-4 py-6 text-center text-xs text-gray-400 italic">
                      No tasks in this group. Click "+ Add Task" to create one.
                    </div>
                  )}

                  {group.tasks.map((task) => {
                    const taskSpace = spaces.find((s) => s.id === task.spaceId);
                    const isTaskOverdue = isOverdue(task.dueDate, task.status);
                    const isTimerRunning = activeTimer?.taskId === task.id;
                    const subtasksDone = task.subtasks.filter((s) => s.completed).length;

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="group grid grid-cols-12 gap-2 items-center px-4 py-3 hover:bg-gray-50/80 dark:hover:bg-dark-200/50 cursor-pointer transition-colors"
                      >
                        {/* Task Title & Meta */}
                        <div className="col-span-5 sm:col-span-5 flex items-center gap-2.5 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={task.status === 'completed'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              updateTask(task.id, {
                                status: e.target.checked ? 'completed' : 'todo'
                              });
                            }}
                            className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-gray-300 dark:border-dark-border cursor-pointer flex-shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0">
                                {task.taskNumber}
                              </span>
                              <span
                                className={`text-sm font-medium truncate ${
                                  task.status === 'completed'
                                    ? 'line-through text-gray-400 dark:text-gray-500'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>

                            {/* Badges / Subtask counter / Tags */}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {task.subtasks.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                  <CheckSquare className="w-3 h-3" />
                                  <span>
                                    {subtasksDone}/{task.subtasks.length}
                                  </span>
                                </span>
                              )}

                              {task.customFields?.clientName && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  {task.customFields.clientName}
                                </span>
                              )}

                              {task.tags.slice(0, 2).map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.2 rounded"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Assignee */}
                        <div className="col-span-2 sm:col-span-2">
                          <AvatarGroup userIds={task.assigneeIds} max={2} size="sm" />
                        </div>

                        {/* Due Date */}
                        <div className="col-span-2 sm:col-span-2 flex items-center gap-1 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span
                            className={
                              isTaskOverdue
                                ? 'text-red-500 font-bold'
                                : 'text-gray-600 dark:text-gray-400'
                            }
                          >
                            {formatDate(task.dueDate)}
                          </span>
                        </div>

                        {/* Priority */}
                        <div className="col-span-2 sm:col-span-2" onClick={(e) => e.stopPropagation()}>
                          <PriorityBadge
                            priority={task.priority}
                            onChange={(newPriority) => updateTask(task.id, { priority: newPriority })}
                            size="sm"
                          />
                        </div>

                        {/* Actions / Timer */}
                        <div
                          className="col-span-1 sm:col-span-1 flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isTimerRunning ? (
                            <button
                              type="button"
                              onClick={stopTimer}
                              title="Stop Stopwatch"
                              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg animate-pulse"
                            >
                              <Square className="w-4 h-4 fill-current" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startTimer(task.id)}
                              title="Start Stopwatch"
                              className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Inline Quick Add Input Row */}
                  {quickAddGroup === group.id && (
                    <div className="px-4 py-3 bg-brand-500/5 dark:bg-brand-500/10 flex items-center gap-3">
                      <Plus className="w-4 h-4 text-brand-500" />
                      <input
                        type="text"
                        autoFocus
                        value={quickAddTitle}
                        onChange={(e) => setQuickAddTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickAdd(group.id, group.statusId, group.priority);
                          if (e.key === 'Escape') setQuickAddGroup(null);
                        }}
                        placeholder="What needs to be done? Press Enter to save, Esc to cancel..."
                        className="flex-1 bg-transparent border-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(group.id, group.statusId, group.priority)}
                        className="px-3 py-1 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 shadow"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickAddGroup(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
