import React from 'react';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import {
  Clock, CheckCircle2, FileText, AlertCircle, Play,
  Briefcase, ArrowUpRight, TrendingUp, ShieldCheck
} from 'lucide-react';
import { ClientTask, UserProfile, EmployeeRecord, WorkShift, EmployeeAttendance, EmployeeWorkReport } from '../../types';

interface RoleTeamMemberDashboardProps {
  tasks: ClientTask[];
  employeeRecord: EmployeeRecord | null;
  shift: WorkShift | null;
  todayAttendance: EmployeeAttendance | null;
  todayReport: EmployeeWorkReport | null;
  currentUserProfile: UserProfile | null;
  onOpenReportModal: () => void;
  onRefreshData: () => void;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const RoleTeamMemberDashboard: React.FC<RoleTeamMemberDashboardProps> = ({
  tasks,
  employeeRecord,
  shift,
  todayAttendance,
  todayReport,
  currentUserProfile,
  onOpenReportModal,
  onRefreshData
}) => {
  const navigate = useSafeNavigate();

  // My Tasks Metrics
  const myTasks = tasks.filter((t) => t.assigneeId === currentUserProfile?.id);
  const myCompleted = myTasks.filter((t) => t.status === 'Completed' || t.status === 'Done').length;
  const myInProgress = myTasks.filter((t) => t.status === 'In Progress').length;
  const myApproval = myTasks.filter((t) => ['Team Review', 'Client Review', 'Approval'].includes(t.status)).length;
  const myOverdue = myTasks.filter((t) => t.isOverdue && t.status !== 'Completed' && t.status !== 'Done').length;

  const totalLoggedSeconds = myTasks.reduce((acc, t) => acc + (t.timeSpentSeconds || 0), 0);
  const completionRate = myTasks.length > 0 ? Math.round((myCompleted / myTasks.length) * 100) : 100;

  // Active Timer Task
  const activeTimerTask = myTasks.find((t) => Boolean(t.timerStartedAt));

  // Attendance Status
  const isCheckedIn = Boolean(todayAttendance && todayAttendance.checkInTime);
  const isCheckedOut = Boolean(todayAttendance && todayAttendance.checkOutTime);

  return (
    <div className="space-y-6 select-none">
      {/* 3 Quick Cards: Attendance/Shift, Daily Report Status, Active Work Timer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Shift & Attendance Quick Status */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100">
                  Shift & Attendance
                </span>
                <p className="text-[10px] text-gray-400">
                  {shift?.name || 'Standard Shift'} ({shift?.startTime?.slice(0, 5) || '11:00'} – {shift?.endTime?.slice(0, 5) || '20:00'} PKT)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Today's Status:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                  isCheckedOut
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    : isCheckedIn
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}
              >
                {isCheckedOut ? 'Shift Completed' : isCheckedIn ? 'Checked In' : 'Not Checked In'}
              </span>
            </div>

            {isCheckedIn && (
              <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                <span>Clock In Time:</span>
                <span>{todayAttendance?.checkInTime ? new Date(todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/employee/dashboard')}
            className="w-full py-2 rounded-xl bg-gray-50 dark:bg-dark-200 hover:bg-gray-100 dark:hover:bg-dark-100 text-gray-700 dark:text-gray-300 font-bold text-xs transition-colors border border-gray-200 dark:border-dark-border cursor-pointer flex items-center justify-center gap-1"
          >
            <span>Open Attendance Portal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Today's Daily Work Report Status */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100">
                  Daily Work Report
                </span>
                <p className="text-[10px] text-gray-400">Shift deliverable summary</p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                todayReport?.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : todayReport?.status === 'submitted'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}
            >
              {todayReport?.status === 'approved'
                ? 'Approved'
                : todayReport?.status === 'submitted'
                ? 'Submitted'
                : 'Pending Submission'}
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {todayReport ? todayReport.summary : 'Submit your daily task rollup before checkout.'}
          </p>

          <button
            type="button"
            onClick={onOpenReportModal}
            className="w-full py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{todayReport ? 'Edit Daily Report' : 'Submit Daily Report'}</span>
          </button>
        </div>

        {/* Card 3: Active Task Work & Performance */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100">
                  Performance & Time
                </span>
                <p className="text-[10px] text-gray-400">Resolution & logged time</p>
              </div>
            </div>
            <span className="text-xs font-black text-emerald-500">{completionRate}% Done</span>
          </div>

          {activeTimerTask ? (
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="truncate">Active Timer Running</span>
              </div>
              <div className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate mt-0.5">
                {activeTimerTask.title}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              <span className="font-bold text-gray-800 dark:text-gray-200">{formatDuration(totalLoggedSeconds)}</span> logged across {myTasks.length} assigned tasks.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
            <div className="p-1.5 rounded-xl bg-gray-50 dark:bg-dark-200 text-gray-700 dark:text-gray-300">
              <span>{myInProgress} In Flight</span>
            </div>
            <div className="p-1.5 rounded-xl bg-gray-50 dark:bg-dark-200 text-purple-600 dark:text-purple-400">
              <span>{myApproval} Review</span>
            </div>
            <div className="p-1.5 rounded-xl bg-gray-50 dark:bg-dark-200 text-emerald-600 dark:text-emerald-400">
              <span>{myCompleted} Done</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
