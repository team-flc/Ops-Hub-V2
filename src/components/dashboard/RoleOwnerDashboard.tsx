import React, { useState } from 'react';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import {
  ShieldCheck, CheckCircle2, Clock, Activity, ArrowUpRight,
  Send, ExternalLink, Check, RotateCcw
} from 'lucide-react';
import { ClientTask, ClientRecord, UserProfile, EmployeeWorkReport } from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { useSignedUrl } from '../../lib/storageService';

interface RoleOwnerDashboardProps {
  tasks: ClientTask[];
  clients: ClientRecord[];
  teamMembers: UserProfile[];
  dailyReports: EmployeeWorkReport[];
  currentUserProfile: UserProfile | null;
  onRefreshData: () => void;
  onOpenCreateTaskModal?: () => void;
}

const MemberAvatar: React.FC<{ avatarPath?: string | null; name?: string | null }> = ({ avatarPath, name }) => {
  const [imageError, setImageError] = useState(false);
  const displayUrl = useSignedUrl('profile-avatars', avatarPath);

  if (displayUrl && !imageError) {
    return (
      <img
        src={displayUrl}
        alt={name || 'User'}
        onError={() => setImageError(true)}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-dark-border"
      />
    );
  }

  return (
    <div className="w-7 h-7 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-brand-500/20">
      {name ? name[0].toUpperCase() : 'U'}
    </div>
  );
};

export const RoleOwnerDashboard: React.FC<RoleOwnerDashboardProps> = ({
  tasks,
  clients,
  teamMembers = [],
  dailyReports,
  currentUserProfile,
  onRefreshData,
  onOpenCreateTaskModal
}) => {
  const navigate = useSafeNavigate();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Pending Approvals Queue
  const pendingApprovals = tasks.filter((t) => ['Team Review', 'Client Review'].includes(t.status));

  // Active Timers
  const activeTimerTasks = tasks.filter((t) => Boolean(t.timerStartedAt));

  // Pending Daily Reports to Acknowledge
  const unreviewedReports = dailyReports.filter((r) => r.status === 'submitted');

  const handleApproveTask = async (task: ClientTask) => {
    if (!currentUserProfile) return;
    setActionLoadingId(task.id);
    await taskManagementService.updateKanbanStatus(task.id, 'Completed');
    setActionLoadingId(null);
    onRefreshData();
  };

  const handleReopenTask = async (task: ClientTask) => {
    if (!currentUserProfile) return;
    setActionLoadingId(task.id);
    await taskManagementService.reopenTask(
      task.id,
      'Changes requested by Owner',
      task.status
    );
    setActionLoadingId(null);
    onRefreshData();
  };

  const handleAcknowledgeReport = async (reportId: string) => {
    if (!currentUserProfile) return;
    setActionLoadingId(reportId);
    await employeeOperationsService.reviewWorkReport(reportId, 'approved', currentUserProfile.id, 'Approved by Owner');
    setActionLoadingId(null);
    onRefreshData();
  };

  return (
    <div className="space-y-6 select-none">
      {/* 2-Column Section: Pending Approvals & Live Timers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box 1: Pending Approvals Queue */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                  Company Approvals Queue
                </h3>
                <p className="text-[11px] text-gray-400">Deliverables awaiting executive sign-off</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              {pendingApprovals.length} Pending
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs italic">
              All client deliverables are up to date. Zero pending approvals.
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {pendingApprovals.map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 truncate flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold text-brand-600 dark:text-brand-400 truncate">
                        {task.clientName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {task.status}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                      {task.title}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <span>By: {task.assigneeName || 'Staff Member'}</span>
                      {task.evidenceUrl && (
                        <>
                          <span>•</span>
                          <a
                            href={task.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-500 font-bold hover:underline flex items-center gap-0.5"
                          >
                            <span>View Deliverable</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      disabled={actionLoadingId === task.id}
                      onClick={() => handleApproveTask(task)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === task.id}
                      onClick={() => handleReopenTask(task)}
                      className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Request Revisions"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Box 2: Active Timers & Live Workstation Ticker */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                  Live Active Timers
                </h3>
                <p className="text-[11px] text-gray-400">Team members currently logging active work</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>{activeTimerTasks.length} Live</span>
            </span>
          </div>

          {activeTimerTasks.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs italic">
              No active timers currently running across teams.
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {activeTimerTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 truncate">
                    <MemberAvatar avatarPath={task.assigneeAvatar} name={task.assigneeName} />
                    <div className="truncate">
                      <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                        {task.assigneeName || 'Staff Member'}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate mt-0.5">
                        {task.title} ({task.clientName})
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${task.clientId}`)}
                    className="p-2 rounded-xl bg-white dark:bg-dark-card border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 transition-colors shadow-xs shrink-0 cursor-pointer"
                    title="Open Workspace"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Work Reports Review Section */}
      {unreviewedReports.length > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-200">
                Submitted Daily Operations Reports
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
              {unreviewedReports.length} Awaiting Review
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unreviewedReports.map((report) => {
              const emp = teamMembers.find((m) => m.id === report.employeeId);
              return (
                <div
                  key={report.id}
                  className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-amber-200/70 dark:border-amber-900/40 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 dark:text-gray-100">
                      {emp?.fullName || 'Staff Member'}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 font-bold">{report.period}</span>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 line-clamp-2">
                    {report.summary}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-dark-border">
                    <span className="text-[10px] text-gray-400">
                      {report.tasksSummary?.length || 0} tasks summarized
                    </span>
                    <button
                      type="button"
                      disabled={actionLoadingId === report.id}
                      onClick={() => handleAcknowledgeReport(report.id)}
                      className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
