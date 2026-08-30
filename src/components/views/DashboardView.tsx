import React from 'react';
import { useOpsStore } from '../../store/opsStore';
import { 
  Activity, CheckCircle2, AlertTriangle, Clock, TrendingUp, 
  Users, ShieldCheck, Zap, ArrowUpRight, CheckSquare, Layers 
} from 'lucide-react';
import { formatTimeMinutes } from '../../utils/helpers';

export const DashboardView: React.FC = () => {
  const tasks = useOpsStore((state) => state.tasks);
  const spaces = useOpsStore((state) => state.spaces);
  const users = useOpsStore((state) => state.users);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);

  // Metrics Calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'under_review').length;
  const todoTasks = tasks.filter((t) => t.status === 'todo').length;
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;

  const urgentTasks = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed').length;
  const slaAlertTasks = tasks.filter(
    (t) => (t.customFields?.slaStatus === 'at_risk' || t.customFields?.slaStatus === 'breached') && t.status !== 'completed'
  );

  const totalLoggedMinutes = tasks.reduce(
    (acc, t) => acc + t.timeLogs.reduce((sub, l) => sub + l.durationMinutes, 0),
    0
  );

  // Operations Health Index (0 - 100%)
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const penalty = (urgentTasks * 5) + (slaAlertTasks.length * 8) + (blockedTasks * 10);
  const healthScore = Math.max(10, Math.min(100, Math.round(100 - penalty + (completionRate * 0.2))));

  // Recent system activity
  const allActivities = tasks
    .flatMap((t) =>
      t.activityLogs.map((a) => ({
        ...a,
        taskTitle: t.title,
        taskId: t.id,
        taskNumber: t.taskNumber
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome & Health Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-brand-900/40 via-dark-300 to-brand-900/20 p-6 rounded-3xl border border-brand-500/20 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-400">
            <Zap className="w-4 h-4 fill-current" />
            <span>Executive Operations Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Ops Hub Intelligence Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Real-time telemetry, shift progress, SLA compliance, and cross-team workload.
          </p>
        </div>

        {/* Health Score Gauge */}
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10">
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Operations Health
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 flex items-center gap-1.5">
              <span>{healthScore}%</span>
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div className="text-right border-l border-white/10 pl-4">
            <div className="text-[11px] text-gray-400">Status</div>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">
              {healthScore >= 80 ? 'Optimal' : healthScore >= 60 ? 'Degraded' : 'Attention Req.'}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active In-Flight */}
        <div className="p-5 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Active In-Flight
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-2">
            {inProgressTasks + todoTasks}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="font-semibold text-blue-500">{inProgressTasks} In Progress</span>
            <span>•</span>
            <span>{todoTasks} Queued</span>
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="p-5 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Completed Tasks
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-2">
            {completedTasks}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{Math.round(completionRate)}% Overall Resolution</span>
          </div>
        </div>

        {/* Card 3: SLA Alerts & Blocked */}
        <div className="p-5 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              SLA Risk / Blocked
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {slaAlertTasks.length + blockedTasks}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="text-rose-500 font-semibold">{slaAlertTasks.length} At Risk</span>
            <span>•</span>
            <span>{blockedTasks} Blocked</span>
          </div>
        </div>

        {/* Card 4: Logged Hours */}
        <div className="p-5 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Logged Work Time
            </span>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-2 font-mono">
            {formatTimeMinutes(totalLoggedMinutes)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-brand-500 font-semibold">
            <span>Stopwatch & manual logs</span>
          </div>
        </div>
      </div>

      {/* Workflow Status Distribution Progress Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-500" />
            <span>Workflow Pipeline Distribution</span>
          </h3>
          <span className="text-xs text-gray-500 font-semibold">{totalTasks} Total Tasks</span>
        </div>

        {/* Segmented Bar */}
        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-dark-200 overflow-hidden flex">
          <div
            style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Completed: ${completedTasks}`}
          />
          <div
            style={{ width: `${totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0}%` }}
            className="bg-blue-500 transition-all duration-500"
            title={`In Progress: ${inProgressTasks}`}
          />
          <div
            style={{ width: `${totalTasks > 0 ? (todoTasks / totalTasks) * 100 : 0}%` }}
            className="bg-slate-400 transition-all duration-500"
            title={`To Do: ${todoTasks}`}
          />
          <div
            style={{ width: `${totalTasks > 0 ? (blockedTasks / totalTasks) * 100 : 0}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`Blocked: ${blockedTasks}`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-gray-600 dark:text-gray-300 font-medium">Completed ({completedTasks})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-gray-600 dark:text-gray-300 font-medium">In Progress ({inProgressTasks})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span className="text-gray-600 dark:text-gray-300 font-medium">Queued ({todoTasks})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-gray-600 dark:text-gray-300 font-medium">Blocked ({blockedTasks})</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Team Workload & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Workload & Capacity */}
        <div className="p-6 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500" />
              <span>Team Operational Workload</span>
            </h3>
            <span className="text-xs text-gray-400">{users.length} Active Staff</span>
          </div>

          <div className="space-y-3">
            {users.map((u) => {
              const userTasks = tasks.filter((t) => t.assigneeIds.includes(u.id));
              const userActiveTasks = userTasks.filter((t) => t.status !== 'completed').length;
              const userLoggedMins = userTasks.reduce(
                (sum, t) =>
                  sum +
                  t.timeLogs.filter((l) => l.userId === u.id).reduce((s, l) => s + l.durationMinutes, 0),
                0
              );
              const maxCapacity = 5;
              const loadPercent = Math.min(100, Math.round((userActiveTasks / maxCapacity) * 100));

              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <span>{u.name}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            u.status === 'online'
                              ? 'bg-emerald-500'
                              : u.status === 'busy'
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                          }`}
                        />
                      </div>
                      <div className="text-[11px] text-gray-500">{u.role}</div>
                    </div>
                  </div>

                  <div className="text-right w-36">
                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {userActiveTasks} active • {formatTimeMinutes(userLoggedMins)}
                    </div>
                    {/* Capacity meter */}
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-dark-400 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full ${
                          loadPercent > 80 ? 'bg-red-500' : loadPercent > 50 ? 'bg-amber-500' : 'bg-brand-500'
                        }`}
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live System Activity Feed */}
        <div className="p-6 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-500" />
              <span>Real-Time Audit Stream</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-500/10 text-brand-500">
              Live Feed
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
            {allActivities.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-8 italic">
                No recent activity logged.
              </div>
            ) : (
              allActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => setSelectedTaskId(act.taskId)}
                  className="p-3 rounded-xl bg-gray-50/80 dark:bg-dark-200/60 hover:bg-gray-100 dark:hover:bg-dark-200 border border-gray-100 dark:border-dark-border/60 cursor-pointer transition-colors flex items-start gap-3"
                >
                  <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-500 mt-0.5 flex-shrink-0">
                    <CheckSquare className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-800 dark:text-gray-200">
                      <span className="font-bold text-brand-600 dark:text-brand-400">{act.userName}</span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">{act.action}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400 truncate">
                      <span className="font-semibold text-gray-500">{act.taskNumber}:</span>
                      <span className="truncate">{act.taskTitle}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
