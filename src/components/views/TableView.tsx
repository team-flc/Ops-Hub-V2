import React, { useState } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { Task, Priority } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { AvatarGroup } from '../common/AvatarGroup';
import { 
  Download, ArrowUpDown, Table as TableIcon, 
  Calendar, Clock, DollarSign, ShieldAlert 
} from 'lucide-react';
import { formatDate, formatTimeMinutes, isOverdue } from '../../utils/helpers';
import { exportTasksToCSV } from '../../utils/exportUtils';

type SortField = 'taskNumber' | 'title' | 'dueDate' | 'priority' | 'estimatedHours' | 'timeSpent';

export const TableView: React.FC = () => {
  const tasks = useOpsStore((state) => state.tasks);
  const spaces = useOpsStore((state) => state.spaces);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeListId = useOpsStore((state) => state.activeListId);
  const filter = useOpsStore((state) => state.filter);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);
  const updateTask = useOpsStore((state) => state.updateTask);

  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Filter tasks
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

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'taskNumber') {
      comparison = a.taskNumber.localeCompare(b.taskNumber);
    } else if (sortField === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (sortField === 'dueDate') {
      comparison = (a.dueDate || '').localeCompare(b.dueDate || '');
    } else if (sortField === 'estimatedHours') {
      comparison = (a.estimatedHours || 0) - (b.estimatedHours || 0);
    } else if (sortField === 'timeSpent') {
      const aTime = a.timeLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
      const bTime = b.timeLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
      comparison = aTime - bTime;
    } else if (sortField === 'priority') {
      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
      comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
    }
    return sortAsc ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Table Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-brand-500" />
            <span>Operations Table & Data Grid</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Airtable & ClickUp style spreadsheet view with sorting and CSV export
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportTasksToCSV(filteredTasks, spaces)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-100 shadow-sm transition-colors"
        >
          <Download className="w-4 h-4 text-brand-500" />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Spreadsheet Container */}
      <div className="border border-gray-200 dark:border-dark-border rounded-2xl bg-white dark:bg-dark-300 overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-dark-200 border-b border-gray-200 dark:border-dark-border text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('taskNumber')}>
                <div className="flex items-center gap-1">
                  <span>Task ID</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 min-w-[200px] cursor-pointer" onClick={() => handleSort('title')}>
                <div className="flex items-center gap-1">
                  <span>Title</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('priority')}>
                <div className="flex items-center gap-1">
                  <span>Priority</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4">Assignee</th>
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('dueDate')}>
                <div className="flex items-center gap-1">
                  <span>Due Date</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('estimatedHours')}>
                <div className="flex items-center gap-1">
                  <span>Est. Hours</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('timeSpent')}>
                <div className="flex items-center gap-1">
                  <span>Logged</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4">SLA Risk</th>
              <th className="py-3 px-4">Client</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-xs text-gray-400 italic">
                  No matching tasks found.
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => {
                const space = spaces.find((s) => s.id === task.spaceId);
                const totalLoggedMins = task.timeLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
                const isTaskOverdue = isOverdue(task.dueDate, task.status);

                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="hover:bg-gray-50/80 dark:hover:bg-dark-200/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-gray-400">{task.taskNumber}</td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-xs">{task.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <StatusBadge
                        statusId={task.status}
                        space={space}
                        onChange={(newStatus) => updateTask(task.id, { status: newStatus })}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <PriorityBadge
                        priority={task.priority}
                        onChange={(newPriority: Priority) => updateTask(task.id, { priority: newPriority })}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <AvatarGroup userIds={task.assigneeIds} max={2} size="xs" />
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          isTaskOverdue
                            ? 'text-red-500 font-bold'
                            : 'text-gray-600 dark:text-gray-400'
                        }
                      >
                        {formatDate(task.dueDate)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-300">
                      {task.estimatedHours || 0}h
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-300">
                      {formatTimeMinutes(totalLoggedMins)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                          task.customFields?.slaStatus === 'breached'
                            ? 'bg-red-500/20 text-red-500'
                            : task.customFields?.slaStatus === 'at_risk'
                            ? 'bg-amber-500/20 text-amber-500'
                            : 'bg-emerald-500/20 text-emerald-500'
                        }`}
                      >
                        {task.customFields?.slaStatus ? task.customFields.slaStatus.replace('_', ' ').toUpperCase() : 'OK'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      {task.customFields?.clientName || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
