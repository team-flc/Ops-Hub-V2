import React, { useState } from 'react';
import { TrendingUp, BarChart3, Calendar, CheckCircle2 } from 'lucide-react';
import { ClientTask } from '../../types';

interface TaskCompletionTrendChartProps {
  tasks: ClientTask[];
}

export const TaskCompletionTrendChart: React.FC<TaskCompletionTrendChartProps> = ({ tasks }) => {
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');

  // Compute Weekly metrics (Weeks 1 to 4)
  const weekData = [1, 2, 3, 4].map((w) => {
    const weekTasks = tasks.filter((t) => t.weekNumber === w);
    const completed = weekTasks.filter((t) => t.status === 'Completed').length;
    const inProgress = weekTasks.filter((t) => t.status === 'In Progress' || t.status === 'Team Review' || t.status === 'Client Review').length;
    const pending = weekTasks.filter((t) => t.status === 'Assigned' || t.status === 'Draft' || t.status === 'Blocked').length;
    const total = weekTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      label: `Week ${w}`,
      total,
      completed,
      inProgress,
      pending,
      rate
    };
  });

  // Compute Monthly Status Breakdown
  const totalTasks = tasks.length;
  const totalCompleted = tasks.filter((t) => t.status === 'Completed').length;
  const totalInProgress = tasks.filter((t) => ['In Progress', 'Team Review', 'Client Review'].includes(t.status)).length;
  const totalPending = tasks.filter((t) => ['Assigned', 'Draft', 'Blocked'].includes(t.status)).length;
  const overallRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  const maxTotal = Math.max(1, ...weekData.map((d) => d.total));

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm space-y-5 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
              Operations Progress & Resolution Trends
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Planned vs Completed deliverables across weekly cycles.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-dark-200 p-0.5 rounded-xl self-start sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => setTimeframe('weekly')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              timeframe === 'weekly'
                ? 'bg-white dark:bg-dark-card text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Weekly Cycle
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('monthly')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              timeframe === 'monthly'
                ? 'bg-white dark:bg-dark-card text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Monthly Rollup
          </button>
        </div>
      </div>

      {timeframe === 'weekly' ? (
        <div className="space-y-4">
          {/* Visual SVG & Bar Distribution */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {weekData.map((d, idx) => {
              const barHeightPct = Math.max(12, Math.round((d.total / maxTotal) * 100));

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-gray-800 dark:text-gray-200">{d.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {d.rate}% Done
                    </span>
                  </div>

                  {/* Vertical Progress Bar */}
                  <div className="w-full h-24 bg-gray-200/60 dark:bg-dark-300 rounded-xl overflow-hidden flex flex-col-reverse relative p-1 gap-1">
                    <div
                      style={{ height: `${(d.completed / Math.max(1, d.total)) * 100}%` }}
                      className="w-full bg-emerald-500 rounded-lg transition-all duration-500"
                      title={`Completed: ${d.completed}`}
                    />
                    <div
                      style={{ height: `${(d.inProgress / Math.max(1, d.total)) * 100}%` }}
                      className="w-full bg-blue-500 rounded-lg transition-all duration-500"
                      title={`In Progress: ${d.inProgress}`}
                    />
                    <div
                      style={{ height: `${(d.pending / Math.max(1, d.total)) * 100}%` }}
                      className="w-full bg-slate-300 dark:bg-slate-600 rounded-lg transition-all duration-500"
                      title={`Pending: ${d.pending}`}
                    />
                  </div>

                  {/* Summary Breakdown */}
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <div className="flex justify-between font-bold text-gray-700 dark:text-gray-300">
                      <span>Total Tasks</span>
                      <span>{d.total}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Completed</span>
                      <span>{d.completed}</span>
                    </div>
                    <div className="flex justify-between text-blue-500">
                      <span>In Flight</span>
                      <span>{d.inProgress}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accessible Legend */}
          <div className="flex items-center justify-center gap-5 text-xs text-gray-500 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Completed Deliverables</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>In Progress / Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>Queued / Backlog</span>
            </div>
          </div>
        </div>
      ) : (
        /* Monthly Rollup View */
        <div className="p-5 rounded-2xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Monthly Operational Resolution</span>
            <span className="text-xl font-black text-emerald-500">{overallRate}% Completed</span>
          </div>

          {/* Horizontal Segmented Bar */}
          <div className="w-full h-4 rounded-full bg-gray-200 dark:bg-dark-300 overflow-hidden flex">
            <div
              style={{ width: `${totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Completed: ${totalCompleted}`}
            />
            <div
              style={{ width: `${totalTasks > 0 ? (totalInProgress / totalTasks) * 100 : 0}%` }}
              className="bg-blue-500 transition-all duration-500"
              title={`In Progress: ${totalInProgress}`}
            />
            <div
              style={{ width: `${totalTasks > 0 ? (totalPending / totalTasks) * 100 : 0}%` }}
              className="bg-slate-400 transition-all duration-500"
              title={`Pending: ${totalPending}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Scope</span>
              <span className="text-base font-black text-gray-900 dark:text-gray-100">{totalTasks}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border">
              <span className="text-[10px] text-emerald-500 uppercase font-bold block">Resolved</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{totalCompleted}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border">
              <span className="text-[10px] text-blue-500 uppercase font-bold block">Active</span>
              <span className="text-base font-black text-blue-600 dark:text-blue-400">{totalInProgress}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
