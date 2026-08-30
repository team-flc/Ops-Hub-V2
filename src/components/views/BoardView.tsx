import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useOpsStore } from '../../store/opsStore';
import { PriorityBadge } from '../common/PriorityBadge';
import { AvatarGroup } from '../common/AvatarGroup';
import { Plus, CheckSquare, Calendar, Clock, Play, Square, AlertCircle } from 'lucide-react';
import { formatDate, formatTimeMinutes, isOverdue } from '../../utils/helpers';

export const BoardView: React.FC = () => {
  const tasks = useOpsStore((state) => state.tasks);
  const spaces = useOpsStore((state) => state.spaces);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeListId = useOpsStore((state) => state.activeListId);
  const filter = useOpsStore((state) => state.filter);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);
  const moveTaskStatus = useOpsStore((state) => state.moveTaskStatus);
  const createTask = useOpsStore((state) => state.createTask);
  const activeTimer = useOpsStore((state) => state.activeTimer);
  const startTimer = useOpsStore((state) => state.startTimer);
  const stopTimer = useOpsStore((state) => state.stopTimer);

  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  const currentSpace = spaces.find((s) => s.id === activeSpaceId);
  const statuses = currentSpace?.statuses || [
    { id: 'todo', label: 'To Do', color: '#94a3b8', category: 'todo' },
    { id: 'in_progress', label: 'In Progress', color: '#3b82f6', category: 'inprogress' },
    { id: 'under_review', label: 'Under Review', color: '#8b5cf6', category: 'inprogress' },
    { id: 'blocked', label: 'Blocked / Escalated', color: '#ef4444', category: 'blocked' },
    { id: 'completed', label: 'Completed', color: '#10b981', category: 'done' }
  ];

  // Filtering
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

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }
    moveTaskStatus(draggableId, destination.droppableId);
  };

  const handleQuickAdd = (statusId: string) => {
    if (!newCardTitle.trim()) return;
    const newTask = createTask({
      title: newCardTitle.trim(),
      status: statusId,
      spaceId: activeSpaceId || spaces[0]?.id || 'space-1',
      listId: activeListId || undefined
    });
    setNewCardTitle('');
    setAddingInColumn(null);
    setSelectedTaskId(newTask.id);
  };

  return (
    <div className="p-6 h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {currentSpace ? `${currentSpace.name} Board` : 'Operations Kanban Board'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Drag cards between status columns to update workflow progression
          </p>
        </div>
      </div>

      {/* Kanban Board Columns Container */}
      <div className="flex-1 overflow-x-auto pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 h-full min-w-max items-start">
            {statuses.map((status) => {
              const columnTasks = filteredTasks.filter((t) => t.status === status.id);

              return (
                <div
                  key={status.id}
                  className="w-80 flex-shrink-0 bg-gray-100/70 dark:bg-dark-300 rounded-2xl p-3 flex flex-col max-h-full border border-gray-200/80 dark:border-dark-border"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 px-1 border-b border-gray-200 dark:border-dark-border/60 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                        {status.label}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-dark-200 text-gray-600 dark:text-gray-400 shadow-sm">
                        {columnTasks.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAddingInColumn(status.id)}
                      className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-100 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      title="Add task in this status"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={status.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-3 p-1 rounded-xl transition-colors ${
                          snapshot.isDraggingOver ? 'bg-brand-500/10 dark:bg-brand-500/15' : ''
                        }`}
                      >
                        {/* Quick Add Input Card */}
                        {addingInColumn === status.id && (
                          <div className="p-3 bg-white dark:bg-dark-200 rounded-xl shadow-md border border-brand-500/40 space-y-2 animate-scale-up">
                            <input
                              type="text"
                              autoFocus
                              value={newCardTitle}
                              onChange={(e) => setNewCardTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleQuickAdd(status.id);
                                if (e.key === 'Escape') setAddingInColumn(null);
                              }}
                              placeholder="Task title... (Enter to save)"
                              className="w-full text-xs font-medium bg-transparent border-none text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setAddingInColumn(null)}
                                className="text-[11px] text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickAdd(status.id)}
                                className="px-2.5 py-1 bg-brand-500 text-white rounded-md text-[11px] font-semibold hover:bg-brand-600 shadow"
                              >
                                Add Card
                              </button>
                            </div>
                          </div>
                        )}

                        {columnTasks.map((task, index) => {
                          const isTaskOverdue = isOverdue(task.dueDate, task.status);
                          const isTimerRunning = activeTimer?.taskId === task.id;
                          const subtasksDone = task.subtasks.filter((s) => s.completed).length;
                          const progress =
                            task.subtasks.length > 0
                              ? Math.round((subtasksDone / task.subtasks.length) * 100)
                              : 0;

                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => setSelectedTaskId(task.id)}
                                  className={`p-3.5 bg-white dark:bg-dark-200 rounded-xl border border-gray-200 dark:border-dark-border/80 shadow-sm hover:shadow-md cursor-pointer transition-all ${
                                    dragSnapshot.isDragging
                                      ? 'shadow-2xl ring-2 ring-brand-500 rotate-1 scale-105 z-50'
                                      : ''
                                  }`}
                                >
                                  {/* Card Top: Number & Priority */}
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-[11px] font-bold text-gray-400">
                                      {task.taskNumber}
                                    </span>
                                    <PriorityBadge priority={task.priority} size="sm" />
                                  </div>

                                  {/* Card Title */}
                                  <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-2">
                                    {task.title}
                                  </h4>

                                  {/* Subtasks Progress if any */}
                                  {task.subtasks.length > 0 && (
                                    <div className="space-y-1 mb-2.5">
                                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                                        <span className="flex items-center gap-1">
                                          <CheckSquare className="w-3 h-3" />
                                          <span>
                                            {subtasksDone}/{task.subtasks.length} subtasks
                                          </span>
                                        </span>
                                        <span>{progress}%</span>
                                      </div>
                                      <div className="w-full h-1 bg-gray-100 dark:bg-dark-300 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${
                                            progress === 100 ? 'bg-emerald-500' : 'bg-brand-500'
                                          }`}
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Custom fields / Client badge */}
                                  {task.customFields?.clientName && (
                                    <div className="mb-2">
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                        🏢 {task.customFields.clientName}
                                      </span>
                                    </div>
                                  )}

                                  {/* Card Footer: Due Date & Assignees */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-dark-border/60 text-[11px]">
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                      <Calendar className="w-3 h-3 text-gray-400" />
                                      <span
                                        className={
                                          isTaskOverdue
                                            ? 'text-red-500 font-bold'
                                            : 'text-gray-500 dark:text-gray-400'
                                        }
                                      >
                                        {formatDate(task.dueDate)}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {isTimerRunning && (
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                      )}
                                      <AvatarGroup userIds={task.assigneeIds} max={2} size="xs" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};
