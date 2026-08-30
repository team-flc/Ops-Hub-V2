import React, { useState } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { Task } from '../../types';
import { 
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, 
  Flag, CheckCircle2 
} from 'lucide-react';
import { getPriorityBadge } from '../../utils/helpers';

export const CalendarView: React.FC = () => {
  const tasks = useOpsStore((state) => state.tasks);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeListId = useOpsStore((state) => state.activeListId);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);
  const setCreateTaskModalOpen = useOpsStore((state) => state.setCreateTaskModalOpen);

  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and total days in month
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (activeSpaceId && t.spaceId !== activeSpaceId) return false;
    if (activeListId && t.listId !== activeListId) return false;
    return true;
  });

  // Calendar cells generation
  const days: { dayNumber: number; isCurrentMonth: boolean; dateStr: string }[] = [];

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = totalDaysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, d);
    days.push({
      dayNumber: d,
      isCurrentMonth: false,
      dateStr: prevMonthDate.toISOString().split('T')[0]
    });
  }

  // Current month days
  for (let i = 1; i <= totalDaysInMonth; i++) {
    const currDate = new Date(year, month, i);
    days.push({
      dayNumber: i,
      isCurrentMonth: true,
      dateStr: currDate.toISOString().split('T')[0]
    });
  }

  // Next month padding days to complete 35 or 42 grid
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonthDate = new Date(year, month + 1, i);
    days.push({
      dayNumber: i,
      isCurrentMonth: false,
      dateStr: nextMonthDate.toISOString().split('T')[0]
    });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Calendar Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-500">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {monthNames[month]} {year}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Operations schedule, deadlines and SLA milestones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-200 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-200 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCreateTaskModalOpen(true)}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 shadow-md shadow-brand-500/20 transition-all ml-2"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Task</span>
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-dark-border rounded-t-2xl overflow-hidden text-center text-xs font-bold uppercase tracking-wider py-2 bg-gray-100 dark:bg-dark-200 text-gray-500 dark:text-gray-400">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-dark-border rounded-b-2xl overflow-hidden border border-gray-200 dark:border-dark-border shadow-sm">
        {days.map((cell, idx) => {
          const isToday = cell.dateStr === todayStr;
          const tasksOnThisDay = filteredTasks.filter((t) => t.dueDate === cell.dateStr);

          return (
            <div
              key={idx}
              className={`min-h-[120px] p-2 bg-white dark:bg-dark-300 flex flex-col transition-colors ${
                !cell.isCurrentMonth ? 'bg-gray-50/50 dark:bg-dark-400/40 text-gray-400' : ''
              } ${isToday ? 'ring-2 ring-inset ring-brand-500/50 dark:ring-brand-500/60' : ''}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                    isToday
                      ? 'bg-brand-500 text-white shadow-sm'
                      : cell.isCurrentMonth
                      ? 'text-gray-800 dark:text-gray-200'
                      : 'text-gray-400'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {tasksOnThisDay.length > 0 && (
                  <span className="text-[10px] font-bold text-gray-400">
                    {tasksOnThisDay.length} {tasksOnThisDay.length === 1 ? 'task' : 'tasks'}
                  </span>
                )}
              </div>

              {/* Tasks in this day */}
              <div className="flex-1 space-y-1 overflow-y-auto max-h-[100px]">
                {tasksOnThisDay.map((task) => {
                  const badge = getPriorityBadge(task.priority);
                  const isCompleted = task.status === 'completed';

                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium truncate cursor-pointer transition-all border flex items-center gap-1.5 ${
                        isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 line-through opacity-80'
                          : `${badge.bgColor} ${badge.textColor} border-transparent hover:border-brand-500/40`
                      }`}
                      title={task.title}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Flag className="w-2.5 h-2.5 fill-current flex-shrink-0" />
                      )}
                      <span className="truncate">{task.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
