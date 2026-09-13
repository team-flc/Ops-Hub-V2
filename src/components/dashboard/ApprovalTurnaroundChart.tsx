import React from 'react';
import { CheckCircle2, RotateCcw, Clock, Award } from 'lucide-react';
import { ClientTask } from '../../types';

interface ApprovalTurnaroundChartProps {
  tasks: ClientTask[];
}

export const ApprovalTurnaroundChart: React.FC<ApprovalTurnaroundChartProps> = ({ tasks }) => {
  const approvalTasks = tasks.filter((t) => Boolean(t.approvalMode));
  const completedApprovals = approvalTasks.filter((t) => t.status === 'Completed');
  const pendingApprovals = tasks.filter((t) => ['Team Review', 'Client Review'].includes(t.status));
  const reopenedTasks = tasks.filter((t) => Boolean(t.reopenedAt));

  // First pass approval rate
  const firstPassApprovals = completedApprovals.filter((t) => !t.reopenedAt).length;
  const firstPassRate = completedApprovals.length > 0
    ? Math.round((firstPassApprovals / completedApprovals.length) * 100)
    : 100;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm space-y-4 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
              Quality Assurance & First-Pass Approval Rate
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Deliverable quality compliance and management turnaround metrics.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1 */}
        <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-purple-600 dark:text-purple-400 tracking-wider">
              First-Pass Approval
            </span>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
            {firstPassRate}%
          </div>
          <span className="text-[10px] text-purple-500/80">Approved without revisions</span>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400 tracking-wider">
              In Review Queue
            </span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700 dark:text-blue-300">
            {pendingApprovals.length}
          </div>
          <span className="text-[10px] text-blue-500/80">Awaiting management sign-off</span>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider">
              Reopened Tasks
            </span>
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
            {reopenedTasks.length}
          </div>
          <span className="text-[10px] text-amber-500/80">Returned for feedback/edits</span>
        </div>
      </div>
    </div>
  );
};
