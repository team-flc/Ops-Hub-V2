import React from 'react';
import { Layers, Briefcase, Clock } from 'lucide-react';
import { ClientTask, ClientRecord } from '../../types';

interface ClientWorkloadDistributionChartProps {
  tasks: ClientTask[];
  clients: ClientRecord[];
}

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const ClientWorkloadDistributionChart: React.FC<ClientWorkloadDistributionChartProps> = ({
  tasks,
  clients
}) => {
  // Aggregate tasks & hours per client
  const clientMetrics = clients.map((c) => {
    const clientTasks = tasks.filter((t) => t.clientId === c.id);
    const completedTasks = clientTasks.filter((t) => t.status === 'Completed').length;
    const inProgressTasks = clientTasks.filter((t) => ['In Progress', 'Team Review', 'Client Review'].includes(t.status)).length;
    const overdueTasks = clientTasks.filter((t) => t.isOverdue && t.status !== 'Completed').length;
    const totalSeconds = clientTasks.reduce((acc, t) => acc + (t.timeSpentSeconds || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);

    return {
      id: c.id,
      name: c.companyName || c.clientName,
      status: c.status,
      totalTasks: clientTasks.length,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      totalMinutes,
      completionRate: clientTasks.length > 0 ? Math.round((completedTasks / clientTasks.length) * 100) : 0
    };
  }).filter((c) => c.totalTasks > 0 || c.status === 'Active');

  const maxTasks = Math.max(1, ...clientMetrics.map((c) => c.totalTasks));

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm space-y-4 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
              Client Operational Workload Distribution
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Deliverable volume, completion rates, and logged work duration per workspace.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-gray-400">
          {clientMetrics.length} Active Workspaces
        </span>
      </div>

      {clientMetrics.length === 0 ? (
        <div className="py-8 text-center text-gray-400 italic text-xs">
          No client task data available yet.
        </div>
      ) : (
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {clientMetrics.map((client) => {
            const barWidth = Math.max(8, Math.round((client.totalTasks / maxTasks) * 100));

            return (
              <div
                key={client.id}
                className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 truncate">
                    <Briefcase className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                    <span className="truncate">{client.name}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono">
                    <span className="text-gray-500 font-medium">
                      {client.completedTasks}/{client.totalTasks} Done ({client.completionRate}%)
                    </span>
                    <span className="text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatMinutesToHours(client.totalMinutes)}
                    </span>
                  </div>
                </div>

                {/* Progress Meter */}
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-dark-300 overflow-hidden flex">
                  <div
                    style={{ width: `${client.completionRate}%` }}
                    className="bg-emerald-500 rounded-full transition-all duration-300"
                    title={`Completed: ${client.completionRate}%`}
                  />
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-0.5">
                  <span className="font-semibold text-blue-500">
                    {client.inProgressTasks} In Flight
                  </span>
                  {client.overdueTasks > 0 && (
                    <>
                      <span>•</span>
                      <span className="font-bold text-rose-500">
                        {client.overdueTasks} Overdue
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
