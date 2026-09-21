import React, { useState, useEffect, useCallback } from 'react';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import {
  Activity, CheckCircle2, AlertTriangle, Clock, TrendingUp,
  Users, ShieldCheck, Zap, Plus, FileText, ArrowRight,
  Briefcase, Calendar, CheckSquare, Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOpsStore } from '../../store/opsStore';
import {
  ClientTask, ClientRecord, UserProfile, EmployeeRecord,
  WorkShift, EmployeeAttendance, EmployeeWorkReport, Department
} from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { teamManagementService } from '../../lib/teamManagementService';
import { clientManagementService } from '../../lib/clientManagementService';

// Dashboard Components
import { PersonalCrossClientKanban } from '../dashboard/PersonalCrossClientKanban';
import { RoleOwnerDashboard } from '../dashboard/RoleOwnerDashboard';
import { RoleManagerDashboard } from '../dashboard/RoleManagerDashboard';
import { RoleTeamMemberDashboard } from '../dashboard/RoleTeamMemberDashboard';
import { DailyWorkReportModal } from '../dashboard/DailyWorkReportModal';
import { TaskCompletionTrendChart } from '../dashboard/TaskCompletionTrendChart';
import { ClientWorkloadDistributionChart } from '../dashboard/ClientWorkloadDistributionChart';
import { ApprovalTurnaroundChart } from '../dashboard/ApprovalTurnaroundChart';
import { CreateClientTaskModal } from '../tasks/CreateClientTaskModal';

const ClientTaskDetailsModal = React.lazy(() =>
  import('../tasks/ClientTaskDetailsModal').then((m) => ({ default: m.ClientTaskDetailsModal }))
);

const EditClientTaskModal = React.lazy(() =>
  import('../tasks/EditClientTaskModal').then((m) => ({ default: m.EditClientTaskModal }))
);

export const DashboardView: React.FC = () => {
  const navigate = useSafeNavigate();
  const { user, profile } = useAuth();
  const clients = useOpsStore((state) => state.clients);
  const setClients = useOpsStore((state) => state.setClients);

  // Core Dashboard State
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [shift, setShift] = useState<WorkShift | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<EmployeeAttendance | null>(null);
  const [todayReport, setTodayReport] = useState<EmployeeWorkReport | null>(null);
  const [dailyReports, setDailyReports] = useState<EmployeeWorkReport[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [eligibleAssignees, setEligibleAssignees] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<ClientTask | null>(null);
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);

  // Live PKT Date / Time Ticker
  const [currentTimePKT, setCurrentTimePKT] = useState('');
  useEffect(() => {
    const updatePKT = () => {
      const now = new Date();
      setCurrentTimePKT(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updatePKT();
    const timer = setInterval(updatePKT, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!profile?.id) return;
    setIsLoading(true);

    try {
      const [
        tasksRes,
        clientsRes,
        membersRes,
        empRec,
        shifts,
        todayAtt,
        todayRep,
        allReports,
        deptRes,
        assigneesRes
      ] = await Promise.all([
        taskManagementService.fetchCrossClientTasks(),
        clientManagementService.fetchClients(),
        teamManagementService.fetchTeamMembers(profile.role, profile.id),
        employeeOperationsService.fetchEmployeeRecord(profile.id),
        employeeOperationsService.fetchWorkShifts(),
        employeeOperationsService.fetchTodayAttendance(profile.id),
        employeeOperationsService.getTodayWorkReport(profile.id),
        employeeOperationsService.fetchWorkReports(undefined, 'daily'),
        taskManagementService.fetchDepartments(),
        taskManagementService.fetchEligibleAssignees(undefined, undefined, profile)
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (membersRes) setTeamMembers(membersRes);
      if (deptRes) setDepartments(deptRes);
      if (assigneesRes) setEligibleAssignees(assigneesRes);
      setEmployeeRecord(empRec);
      setTodayAttendance(todayAtt);
      setTodayReport(todayRep);
      setDailyReports(allReports);

      if (empRec?.shiftId && shifts.length > 0) {
        const matchingShift = shifts.find((s) => s.id === empRec.shiftId) || null;
        setShift(matchingShift);
      }
    } catch (err) {
      console.error('Failed to load dashboard telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile, setClients]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Role Scope
  const isOwner = profile?.role === 'owner';
  const isManager = profile?.role === 'operational_manager';
  const isTeamMember = profile?.role === 'team_member';

  // Direct Reports for Operational Manager
  const reportingMembers = teamMembers.filter((m) => m.reportingManagerId === profile?.id);

  // Top Metrics Calculation
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;
  const awaitingApprovalTasks = tasks.filter((t) => ['Team Review', 'Client Review'].includes(t.status)).length;
  const overdueTasks = tasks.filter((t) => t.isOverdue && t.status !== 'Completed').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const dueTodayTasks = tasks.filter((t) => t.dueDate === todayStr && t.status !== 'Completed').length;

  const resolutionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const healthScore = Math.max(10, Math.min(100, Math.round(100 - (overdueTasks * 5) - (awaitingApprovalTasks * 2) + (resolutionRate * 0.1))));

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const displayName = profile?.fullName || user?.email?.split('@')[0] || 'Team Member';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto select-none animate-in fade-in duration-200">
      {/* 1. Header & Quick Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 dark:bg-dark-300 p-6 rounded-3xl border border-slate-800 dark:border-dark-border shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-400">
            <Zap className="w-4 h-4 fill-current" />
            <span>Operational Headquarters & Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {greeting}, {displayName}
          </h1>
          <p className="text-xs sm:text-sm text-gray-400">
            Pakistan Standard Time: <span className="font-mono font-bold text-gray-200">{currentTimePKT}</span> (PKT / UTC+5)
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          {/* Quick Create Task */}
          <button
            type="button"
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>

          {/* Submit Daily Report */}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/15 backdrop-blur-xs transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Daily Report</span>
          </button>

          {/* Attendance Portal Link */}
          <button
            type="button"
            onClick={() => navigate('/employee/dashboard')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/15 backdrop-blur-xs transition-colors cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            <span>Attendance</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Due Today */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              Tasks Due Today
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900 dark:text-gray-100">
            {dueTodayTasks}
          </div>
          <div className="text-xs text-gray-500">
            <span>Target resolution date today</span>
          </div>
        </div>

        {/* Card 2: In Flight */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              Active In Flight
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
            {inProgressTasks}
          </div>
          <div className="text-xs text-gray-500">
            <span>Actively being worked on</span>
          </div>
        </div>

        {/* Card 3: Awaiting Approval */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              Awaiting Approval
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-600 dark:text-purple-400">
            {awaitingApprovalTasks}
          </div>
          <div className="text-xs text-gray-500">
            <span>Submitted for management review</span>
          </div>
        </div>

        {/* Card 4: Overdue & Health */}
        <div className="p-5 rounded-3xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              {overdueTasks > 0 ? 'Overdue Tasks' : 'Operations Health'}
            </span>
            <div className={`p-2 rounded-xl ${overdueTasks > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              {overdueTasks > 0 ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
          </div>
          <div className={`text-3xl font-black ${overdueTasks > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {overdueTasks > 0 ? overdueTasks : `${healthScore}%`}
          </div>
          <div className="text-xs text-gray-500">
            <span>{overdueTasks > 0 ? 'Passed target deadline' : 'Optimal operational efficiency'}</span>
          </div>
        </div>
      </div>

      {/* 3. Role-Specific Section */}
      {isOwner && (
        <RoleOwnerDashboard
          tasks={tasks}
          clients={clients}
          teamMembers={teamMembers}
          dailyReports={dailyReports}
          currentUserProfile={profile}
          onRefreshData={loadDashboardData}
          onOpenCreateTaskModal={() => setIsCreateTaskModalOpen(true)}
        />
      )}

      {isManager && (
        <RoleManagerDashboard
          tasks={tasks}
          clients={clients}
          reportingMembers={reportingMembers}
          dailyReports={dailyReports}
          currentUserProfile={profile}
          onRefreshData={loadDashboardData}
        />
      )}

      {isTeamMember && (
        <RoleTeamMemberDashboard
          tasks={tasks}
          employeeRecord={employeeRecord}
          shift={shift}
          todayAttendance={todayAttendance}
          todayReport={todayReport}
          currentUserProfile={profile}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          onRefreshData={loadDashboardData}
        />
      )}

      {/* 4. Integrated Cross-Client Personal Operations Kanban */}
      <PersonalCrossClientKanban
        tasks={tasks}
        clients={clients}
        currentUserProfile={profile}
        onRefreshTasks={loadDashboardData}
        onSelectTask={(t) => setSelectedTaskForDetails(t)}
      />

      {/* 5. Reporting & Progress Analytics Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskCompletionTrendChart tasks={tasks} />
        <ApprovalTurnaroundChart tasks={tasks} />
      </div>

      <ClientWorkloadDistributionChart tasks={tasks} clients={clients} />

      {/* Global Modals */}
      <DailyWorkReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        currentUserProfile={profile}
        onSuccess={loadDashboardData}
      />

      {isCreateTaskModalOpen && clients.length > 0 && (
        <CreateClientTaskModal
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          onSuccess={() => {
            setIsCreateTaskModalOpen(false);
            loadDashboardData();
          }}
          client={clients[0]}
          weekNumber={1}
          departments={departments}
          eligibleAssignees={eligibleAssignees}
        />
      )}

      {selectedTaskForDetails && (
        <React.Suspense fallback={null}>
          <ClientTaskDetailsModal
            isOpen={Boolean(selectedTaskForDetails)}
            onClose={() => setSelectedTaskForDetails(null)}
            task={selectedTaskForDetails}
            client={clients.find((c) => c.id === selectedTaskForDetails.clientId) || null}
            currentUserProfile={profile}
            departments={departments}
            eligibleAssignees={eligibleAssignees}
            onOpenEditModal={(t) => setEditingTask(t)}
            onTaskUpdated={() => {
              setSelectedTaskForDetails(null);
              loadDashboardData();
            }}
          />
        </React.Suspense>
      )}

      {editingTask && (
        <React.Suspense fallback={null}>
          <EditClientTaskModal
            isOpen={Boolean(editingTask)}
            onClose={() => setEditingTask(null)}
            onSuccess={() => {
              setEditingTask(null);
              setSelectedTaskForDetails(null);
              loadDashboardData();
            }}
            task={editingTask}
            departments={departments}
          />
        </React.Suspense>
      )}
    </div>
  );
};
