import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, Clock, DollarSign, Laptop, Award, MessageSquare, 
  Calculator, AlertTriangle, CheckCircle2, Search, Filter, 
  Plus, Eye, Edit3, UserCheck, ChevronRight, RefreshCw, 
  ExternalLink, FileText, Check, X, ShieldAlert, ArrowUpRight,
  TrendingDown, TrendingUp, Settings, Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import { 
  TeamMemberRecord, UserProfile, EmployeeRecord, WorkShift, 
  EmployeeAttendance, CompanyAsset, EmployeePayrollRecord, 
  EmployeePerformanceRecord, EmployeeManagementTask, EmployeeFinalSettlement,
  Department, Designation, ROLE_DISPLAY_NAMES
} from '../../types';
import { teamManagementService } from '../../lib/teamManagementService';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { getPKTTodayDateString, getPKTCurrentMonthString, getPKTDateTimeParts } from '../../lib/pktDateUtils';
import { AssignAssetModal } from './AssignAssetModal';
import { LogIncidentModal } from './LogIncidentModal';
import { PayrollAdjustmentModal } from './PayrollAdjustmentModal';
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal';
import { FinalSettlementModal } from './FinalSettlementModal';
import { EditTeamMemberModal } from '../team/EditTeamMemberModal';

export const EmployeeManagementDashboardView: React.FC = () => {
  const { profile: currentUserProfile } = useAuth();
  const navigate = useSafeNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'attendance' | 'directory' | 'payroll' | 'assets' | 'performance' | 'concerns' | 'settlement'>('attendance');

  // Core Data
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [employeeRecords, setEmployeeRecords] = useState<EmployeeRecord[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [todayAttendanceList, setTodayAttendanceList] = useState<EmployeeAttendance[]>([]);
  const [missingCheckIns, setMissingCheckIns] = useState<Array<{ employee: UserProfile | TeamMemberRecord; shift: WorkShift; minutesLate: number }>>([]);
  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<EmployeePayrollRecord[]>([]);
  const [performanceRecords, setPerformanceRecords] = useState<EmployeePerformanceRecord[]>([]);
  const [concerns, setConcerns] = useState<EmployeeManagementTask[]>([]);
  const [settlements, setSettlements] = useState<EmployeeFinalSettlement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [eligibleManagers, setEligibleManagers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Month Selectors (authoritative PKT month string)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getPKTCurrentMonthString());

  // Modals State
  const [isAssignAssetModalOpen, setIsAssignAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CompanyAsset | null>(null);
  const [isLogIncidentModalOpen, setIsLogIncidentModalOpen] = useState(false);
  const [selectedIncidentEmployeeId, setSelectedIncidentEmployeeId] = useState<string | undefined>(undefined);
  const [selectedPayrollRecord, setSelectedPayrollRecord] = useState<EmployeePayrollRecord | null>(null);
  const [selectedAttendanceCorrection, setSelectedAttendanceCorrection] = useState<EmployeeAttendance | null>(null);
  const [settlementTargetEmployee, setSettlementTargetEmployee] = useState<TeamMemberRecord | null>(null);
  const [settlementTargetEmployeeRecord, setSettlementTargetEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [editingMemberForSetup, setEditingMemberForSetup] = useState<TeamMemberRecord | null>(null);

  // Evidence Preview Lightbox
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!currentUserProfile) return;
    setIsLoading(true);

    try {
      // Authoritative Work Date in PKT format (YYYY-MM-DD)
      const todayDate = getPKTTodayDateString();

      const [
        members,
        empRecs,
        allShifts,
        allAssets,
        payrolls,
        perfs,
        tasks,
        allSettlements,
        depts,
        desigs,
        managers
      ] = await Promise.all([
        teamManagementService.fetchTeamMembers(currentUserProfile.role, currentUserProfile.id),
        employeeOperationsService.fetchAllEmployeeRecords(),
        employeeOperationsService.fetchWorkShifts(),
        employeeOperationsService.fetchAllAssets(),
        employeeOperationsService.fetchMonthlyPayrollSummary(selectedMonth),
        employeeOperationsService.fetchPerformanceRecords(),
        employeeOperationsService.fetchManagementTasks('employee_concern'),
        employeeOperationsService.fetchFinalSettlements(),
        teamManagementService.fetchDepartments(),
        teamManagementService.fetchDesignations(),
        teamManagementService.fetchEligibleManagers()
      ]);

      setTeamMembers(members);
      setEmployeeRecords(empRecs);
      setShifts(allShifts);
      setAssets(allAssets);
      setPayrollRecords(payrolls);
      setPerformanceRecords(perfs);
      setConcerns(tasks);
      setSettlements(allSettlements);
      setDepartments(depts);
      setDesignations(desigs);
      setEligibleManagers(managers);

      // Fetch genuine today's attendance in a single batch query
      const todayAttendance = await employeeOperationsService.fetchAllTodayAttendance(todayDate);
      setTodayAttendanceList(todayAttendance);

      // Build employee record map to isolate configured vs setup-pending staff
      const empRecMap = new Map<string, EmployeeRecord>();
      empRecs.forEach(r => empRecMap.set(r.id, r));

      // Configured active staff ONLY are tracked for live attendance & missing check-in audits
      const configuredActiveStaff = members.filter(
        m => m.status === 'active' && Boolean(empRecMap.get(m.id)?.setupCompletedAt)
      );

      const checkedInMemberIds = new Set(todayAttendance.filter(a => a.checkInTime).map(a => a.employeeId));
      const missingList: Array<{ employee: UserProfile | TeamMemberRecord; shift: WorkShift; minutesLate: number }> = [];

      // Check missing check-ins only for configured active staff with assigned shifts
      for (const m of configuredActiveStaff) {
        if (!checkedInMemberIds.has(m.id)) {
          const empRec = empRecMap.get(m.id);
          const shift = empRec?.shift || allShifts.find(s => s.id === empRec?.shiftId) || allShifts[0];
          if (shift) {
            const [startH, startM] = (shift.startTime || '11:00:00').split(':').map(Number);
            const pktParts = getPKTDateTimeParts();
            const nowMinutes = pktParts.hour * 60 + pktParts.minute;
            const scheduledMinutes = startH * 60 + startM;
            const diffMinutes = nowMinutes - scheduledMinutes;

            if (diffMinutes >= 60) {
              missingList.push({
                employee: m,
                shift,
                minutesLate: diffMinutes
              });
            }
          }
        }
      }

      setMissingCheckIns(missingList);
    } catch (err) {
      console.error('Failed to load management dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserProfile, selectedMonth]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Generate Monthly Payroll Cycle
  const handleGeneratePayroll = async () => {
    if (!currentUserProfile) return;
    setIsLoading(true);
    try {
      await employeeOperationsService.generateMonthlyPayroll(selectedMonth, currentUserProfile.id);
      loadAllData();
    } catch (err) {
      console.error('Failed to generate payroll:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Settlement for Member
  const handleOpenSettlement = async (member: TeamMemberRecord) => {
    const rec = await employeeOperationsService.fetchEmployeeRecord(member.id);
    setSettlementTargetEmployee(member);
    setSettlementTargetEmployeeRecord(rec);
  };

  // Update Concern Status
  const handleToggleConcernStatus = async (taskId: string, currentStatus: string) => {
    if (!currentUserProfile) return;
    const nextStatus = currentStatus === 'pending' ? 'in_progress' : currentStatus === 'in_progress' ? 'completed' : 'pending';
    await employeeOperationsService.updateManagementTaskStatus(taskId, nextStatus as any, currentUserProfile.id);
    loadAllData();
  };

  // Companion Record Lookup Map
  const empRecordMap = useMemo(() => {
    const map = new Map<string, EmployeeRecord>();
    employeeRecords.forEach(r => map.set(r.id, r));
    return map;
  }, [employeeRecords]);

  // Partition Active Staff into Configured vs Setup Pending
  const { configuredActiveStaff, setupPendingStaff } = useMemo(() => {
    const configured: TeamMemberRecord[] = [];
    const pending: TeamMemberRecord[] = [];
    teamMembers.forEach(m => {
      if (m.status === 'active') {
        const rec = empRecordMap.get(m.id);
        if (rec?.setupCompletedAt) {
          configured.push(m);
        } else {
          pending.push(m);
        }
      }
    });
    return { configuredActiveStaff: configured, setupPendingStaff: pending };
  }, [teamMembers, empRecordMap]);

  // Governed Stats
  const activeStaffCount = configuredActiveStaff.length;
  const setupPendingCount = setupPendingStaff.length;
  const checkedInTodayCount = todayAttendanceList.filter(a => a.checkInTime && configuredActiveStaff.some(cs => cs.id === a.employeeId)).length;
  const lateTodayCount = todayAttendanceList.filter(a => a.status === 'late' && a.checkInTime && configuredActiveStaff.some(cs => cs.id === a.employeeId)).length;
  const onTimeTodayCount = Math.max(0, checkedInTodayCount - lateTodayCount);
  const pendingCheckInCount = Math.max(0, activeStaffCount - checkedInTodayCount);
  const pendingPayrollCount = payrollRecords.filter(p => p.status === 'draft' || p.status === 'approved' || p.status === 'under_review').length;
  const openConcernsCount = concerns.filter(c => c.status !== 'completed').length;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Operations Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-gray-100 tracking-tight">
              Employee Operations & HR Governance
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Attendance tracking, authoritative payroll, asset control & employee dossiers (Asia/Karachi PKT)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadAllData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
            title="Refresh All Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 60-Minute Missing Check-Ins Alert Banner (Configured Staff Only) */}
      {missingCheckIns.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-600 animate-bounce" />
              <span>60-Minute Missing Check-In Escalation ({missingCheckIns.length} Configured Staff Member(s))</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900 font-extrabold">
              Action Required
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {missingCheckIns.map(({ employee, shift, minutesLate }) => (
              <div key={employee.id} className="p-3 rounded-2xl bg-white dark:bg-dark-card border border-rose-200 dark:border-rose-900/40 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-gray-100">
                    {'fullName' in employee ? employee.fullName : (employee as any).full_name}
                  </div>
                  <div className="text-[11px] text-rose-600 font-medium">
                    {minutesLate}m past {shift.startTime.slice(0, 5)} PKT ({shift.name})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAttendanceCorrection({
                      id: '',
                      employeeId: employee.id,
                      workDate: getPKTTodayDateString(),
                      scheduledCheckIn: shift.startTime,
                      scheduledCheckOut: shift.endTime,
                      minutesLate: 0,
                      status: 'absent',
                      absenceDeduction: 0,
                      lateDeduction: 0,
                      createdAt: '',
                      updatedAt: ''
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 transition-colors shadow-xs"
                >
                  Mark Absent
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Configured Staff</span>
          <div className="text-xl font-black text-slate-900 dark:text-gray-100 font-mono">{activeStaffCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Checked In</span>
          <div className="text-xl font-black text-emerald-600 font-mono">{checkedInTodayCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Late Today</span>
          <div className="text-xl font-black text-amber-600 font-mono">{lateTodayCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Missing (&gt;60m)</span>
          <div className="text-xl font-black text-rose-600 font-mono">{missingCheckIns.length}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Pending Payroll</span>
          <div className="text-xl font-black text-indigo-600 font-mono">{pendingPayrollCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Setup Pending</span>
          <div className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono">{setupPendingCount}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Live Attendance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'directory'
              ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Employee Directory</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'payroll'
              ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Payroll (1st–End)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'assets'
              ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>Company Assets ({assets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'performance'
              ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Performance & Incidents</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('concerns')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'concerns'
              ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Employee Concerns ({openConcernsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settlement')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settlement'
              ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Final Settlements</span>
        </button>
      </div>

      {/* TAB 1: LIVE ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Visual Distribution Summary Bar */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                Today's Attendance Composition (Configured Staff: {activeStaffCount})
              </span>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  On-Time: {onTimeTodayCount}
                </span>
                <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  Late (+500 PKR): {lateTodayCount}
                </span>
                <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  Pending Check-In: {pendingCheckInCount}
                </span>
              </div>
            </div>

            {/* Distribution Bar */}
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-dark-100 overflow-hidden flex">
              {activeStaffCount > 0 ? (
                <>
                  <div
                    style={{ width: `${(onTimeTodayCount / activeStaffCount) * 100}%` }}
                    className="h-full bg-emerald-500 transition-all"
                    title={`On-Time: ${onTimeTodayCount}`}
                  />
                  <div
                    style={{ width: `${(lateTodayCount / activeStaffCount) * 100}%` }}
                    className="h-full bg-amber-500 transition-all"
                    title={`Late: ${lateTodayCount}`}
                  />
                  <div
                    style={{ width: `${(pendingCheckInCount / activeStaffCount) * 100}%` }}
                    className="h-full bg-slate-300 dark:bg-dark-border transition-all"
                    title={`Pending: ${pendingCheckInCount}`}
                  />
                </>
              ) : (
                <div className="h-full w-full bg-slate-200 dark:bg-dark-border" />
              )}
            </div>
          </div>

          {/* Section 1: Genuine Checked-In Staff */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Checked-In Staff Today ({checkedInTodayCount})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Verified desktop screen capture check-in records (PKT)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttendanceCorrection({
                  id: '',
                  employeeId: '',
                  workDate: getPKTTodayDateString(),
                  scheduledCheckIn: '11:00:00',
                  scheduledCheckOut: '20:00:00',
                  minutesLate: 0,
                  status: 'on_time',
                  lateDeduction: 0,
                  absenceDeduction: 0,
                  createdAt: '',
                  updatedAt: ''
                })}
                className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-brand-600 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Manual Attendance Log
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-3">Employee</th>
                    <th className="py-3 px-3">Check In</th>
                    <th className="py-3 px-3">Check Out</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Evidence</th>
                    <th className="py-3 px-3">Deduction</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                  {todayAttendanceList.filter(a => a.checkInTime).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No check-ins recorded for today yet. Staff will appear here once they clock in with entire-screen workstation proof.
                      </td>
                    </tr>
                  ) : (
                    todayAttendanceList.filter(a => a.checkInTime).map((att) => {
                      const member = teamMembers.find(m => m.id === att.employeeId);
                      const name = member?.fullName || 'Staff Member';
                      return (
                        <tr key={att.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-gray-100">{name}</div>
                            <div className="text-[10px] text-slate-400">{member?.workEmail}</div>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '--'}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '--'}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                              att.status === 'on_time' || att.status === 'present'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                : att.status === 'late'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                            }`}>
                              {att.status} {att.status === 'late' && att.minutesLate ? `(+${att.minutesLate}m)` : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {(att.screenCaptureUrl || att.checkInScreenshotPath) ? (
                              <button
                                type="button"
                                onClick={() => setPreviewEvidenceUrl(att.screenCaptureUrl || att.checkInScreenshotPath || null)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-card hover:bg-slate-200 text-brand-600 text-[11px] font-semibold flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> View Frame
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No Capture</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {att.lateDeduction || att.absenceDeduction ? (
                              <span className="text-rose-600 font-bold">
                                -PKR {((att.lateDeduction || 0) + (att.absenceDeduction || 0)).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">PKR 0</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedAttendanceCorrection(att)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
                              title="Adjust / Excuse Attendance"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Pending Check-In Staff (Configured Staff Only) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Pending Check-In Staff ({pendingCheckInCount})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Configured active team members who have not yet logged attendance today
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Governed Role</th>
                    <th className="py-2.5 px-3">Scheduled Shift</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-dark-border">
                  {configuredActiveStaff.filter(m => !todayAttendanceList.some(a => a.employeeId === m.id && a.checkInTime)).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                        All configured active staff members have checked in for today.
                      </td>
                    </tr>
                  ) : (
                    configuredActiveStaff
                      .filter(m => !todayAttendanceList.some(a => a.employeeId === m.id && a.checkInTime))
                      .map((member) => {
                        const isLateEscalated = missingCheckIns.some(mc => mc.employee.id === member.id);
                        const empRec = empRecordMap.get(member.id);
                        const shift = empRec?.shift || shifts.find(s => s.id === empRec?.shiftId) || shifts[0];
                        const roleTitle = ROLE_DISPLAY_NAMES[member.role] || member.role.replace('_', ' ');

                        return (
                          <tr key={member.id} className="hover:bg-white/60 dark:hover:bg-dark-card transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-gray-100">{member.fullName}</div>
                              <div className="text-[10px] text-slate-400">{member.workEmail}</div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-gray-400 font-medium">
                              {roleTitle} {member.designationName ? `• ${member.designationName}` : ''}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-gray-400 font-mono">
                              {shift ? `${shift.name} (${shift.startTime.slice(0, 5)} - ${shift.endTime.slice(0, 5)} PKT)` : '11:00 AM – 08:00 PM PKT'}
                            </td>
                            <td className="py-2.5 px-3">
                              {isLateEscalated ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                                  Missing (&gt;60m)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-dark-border dark:text-gray-300">
                                  Pending Check-In
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedAttendanceCorrection({
                                  id: '',
                                  employeeId: member.id,
                                  workDate: getPKTTodayDateString(),
                                  scheduledCheckIn: shift?.startTime || '11:00:00',
                                  scheduledCheckOut: shift?.endTime || '20:00:00',
                                  minutesLate: 0,
                                  status: 'on_time',
                                  lateDeduction: 0,
                                  absenceDeduction: 0,
                                  createdAt: '',
                                  updatedAt: ''
                                })}
                                className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-dark-card hover:bg-slate-300 dark:hover:bg-dark-100 text-slate-800 dark:text-gray-200 font-bold text-[11px] transition-colors"
                              >
                                Log Attendance
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Dedicated Employee Setup Required Section (Neutral Isolation) */}
          {setupPendingStaff.length > 0 && (
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-amber-600" />
                    <span>Employee Setup Required ({setupPendingStaff.length} Staff Member(s))</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    The following active team members require operational onboarding (work shift assignment, baseline compensation, and shift schedule) before automated attendance audit tracking and monthly payroll generation begin.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">System Role</th>
                      <th className="py-2.5 px-3">Onboarding State</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-dark-border">
                    {setupPendingStaff.map((member) => (
                      <tr key={member.id} className="hover:bg-white/60 dark:hover:bg-dark-card transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-gray-100">{member.fullName}</div>
                          <div className="text-[10px] text-slate-400">{member.workEmail}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-gray-400 font-medium">
                          {ROLE_DISPLAY_NAMES[member.role] || member.role.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-dark-border dark:text-gray-300">
                            Setup Pending — Shift Unconfigured
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingMemberForSetup(member)}
                            className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] transition-colors shadow-xs"
                          >
                            Configure Setup
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EMPLOYEE DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              <span>Staff Dossiers & Compensation Directory</span>
            </h2>
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name/email..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Role / Designation</th>
                  <th className="py-3 px-3">Assigned Shift</th>
                  <th className="py-3 px-3">Setup State</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                {teamMembers.filter(m => !searchQuery || m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || m.workEmail.toLowerCase().includes(searchQuery.toLowerCase())).map((member) => {
                  const empRec = empRecordMap.get(member.id);
                  const isSetup = Boolean(empRec?.setupCompletedAt);
                  const shift = empRec?.shift || shifts.find(s => s.id === empRec?.shiftId);
                  const roleName = ROLE_DISPLAY_NAMES[member.role] || member.role.replace('_', ' ');

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-gray-100">{member.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{member.workEmail}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-gray-300">
                        <span className="font-semibold">{roleName}</span>
                        {member.designationName ? <span className="text-slate-400 block text-[10px]">{member.designationName}</span> : null}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-gray-400">
                        {shift ? `${shift.name} (${shift.startTime.slice(0, 5)} - ${shift.endTime.slice(0, 5)} PKT)` : isSetup ? 'Configured Shift' : 'Unconfigured'}
                      </td>
                      <td className="py-3 px-3">
                        {isSetup ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-dark-border dark:text-gray-300">
                            Setup Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                          member.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/operations/employees/${member.id}`)}
                            className="px-2.5 py-1 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Dossier
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMemberForSetup(member)}
                            className="p-1 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
                            title="Edit / Configure Employee"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSettlement(member)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Final Settlement"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYROLL (1ST TO END OF MONTH) */}
      {activeTab === 'payroll' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Monthly Payroll Cycles & Disbursements</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Cycle: 1st – End of Month • Disbursed on the 15th of following month (Asia/Karachi PKT)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono"
              />
              <button
                type="button"
                onClick={handleGeneratePayroll}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Calculate & Generate Payroll
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Base Salary</th>
                  <th className="py-3 px-3">Late Cuts</th>
                  <th className="py-3 px-3">Absence Cuts</th>
                  <th className="py-3 px-3">Bonuses / Adj.</th>
                  <th className="py-3 px-3">Net Payable</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                {payrollRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No payroll records generated for {selectedMonth}. Click "Calculate & Generate Payroll" above.
                    </td>
                  </tr>
                ) : (
                  payrollRecords.map((pay) => {
                    const member = teamMembers.find(m => m.id === pay.employeeId);
                    const name = member?.fullName || 'Staff Member';
                    const baseSal = pay.baseSalary ?? pay.grossSalary ?? 0;
                    const lateDed = pay.lateDeductions ?? pay.lateDeductionsTotal ?? 0;
                    const absDed = pay.unapprovedAbsenceDeductions ?? pay.absenceDeductionsTotal ?? 0;
                    const bonusAllow = (pay.bonuses || 0) + (pay.allowances || 0) + (pay.manualAdjustmentsTotal || 0);

                    return (
                      <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-gray-100">{name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{pay.payrollPeriod || pay.payrollMonth}</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-800 dark:text-gray-200">
                          PKR {baseSal.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-rose-600">
                          {lateDed ? `-PKR ${lateDed.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-3 px-3 font-mono text-rose-600">
                          {absDed ? `-PKR ${absDed.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600">
                          {bonusAllow ? `+PKR ${bonusAllow.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-gray-100">
                          PKR {pay.netPayable.toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                            pay.status === 'paid' || pay.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pay.status === 'approved' || pay.status === 'Approved'
                              ? 'bg-blue-100 text-blue-800'
                              : pay.status === 'under_review' || pay.status === 'Under Review'
                              ? 'bg-indigo-100 text-indigo-800'
                              : pay.status === 'concern_raised' || pay.status === 'Concern Raised'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {pay.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPayrollRecord(pay)}
                            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-card text-slate-700 dark:text-gray-300 text-xs font-semibold"
                          >
                            Adjust / Pay
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ASSETS GOVERNANCE */}
      {activeTab === 'assets' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-brand-600" />
              <span>Company Hardware & Equipment Governance</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingAsset(null);
                setIsAssignAssetModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Register New Asset
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-3">Asset Tag</th>
                  <th className="py-3 px-3">Equipment Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Assigned Custodian</th>
                  <th className="py-3 px-3">Condition</th>
                  <th className="py-3 px-3">Replacement Value</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No assets registered yet.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const custodian = teamMembers.find(m => m.id === (asset.assignedTo || asset.employeeId));
                    return (
                      <tr key={asset.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-gray-200">{asset.assetTag || asset.itemName}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-gray-100">{asset.assetName || asset.itemName}</td>
                        <td className="py-3 px-3 capitalize text-slate-600 dark:text-gray-400">{asset.category || 'Equipment'}</td>
                        <td className="py-3 px-3">
                          {custodian ? (
                            <span className="font-semibold text-slate-800 dark:text-gray-200">{custodian.fullName}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned (Pool)</span>
                          )}
                        </td>
                        <td className="py-3 px-3 capitalize">{asset.condition || 'Good'}</td>
                        <td className="py-3 px-3 font-mono font-semibold">
                          PKR {(asset.replacementValue ?? asset.price ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                            asset.status === 'assigned'
                              ? 'bg-blue-100 text-blue-800'
                              : asset.status === 'acknowledged'
                              ? 'bg-emerald-100 text-emerald-800'
                              : asset.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700'
                              : asset.status === 'under_review'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {asset.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAsset(asset);
                              setIsAssignAssetModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PERFORMANCE & INCIDENTS */}
      {activeTab === 'performance' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Performance Logs, Coaching & Formal Warnings</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setSelectedIncidentEmployeeId(undefined);
                setIsLogIncidentModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Log Incident / Coaching
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {performanceRecords.length === 0 ? (
              <p className="text-xs text-slate-400 italic col-span-2 text-center py-8">
                No performance records logged yet.
              </p>
            ) : (
              performanceRecords.map((p) => {
                const member = teamMembers.find(m => m.id === p.employeeId);
                return (
                  <div key={p.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-gray-100">{member?.fullName || 'Staff Member'}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 capitalize">
                        {p.recordType}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-gray-200">{p.title}</div>
                    <p className="text-[11px] text-slate-600 dark:text-gray-400">{p.description}</p>
                    {p.actionPlan && (
                      <div className="p-2 rounded-xl bg-white dark:bg-dark-card border border-slate-200 text-[10px] text-slate-700">
                        <strong>Action Plan:</strong> {p.actionPlan}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 6: EMPLOYEE CONCERNS */}
      {activeTab === 'concerns' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-600" />
            <span>Employee Inquiries & Concern Resolution</span>
          </h2>

          <div className="space-y-3">
            {concerns.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">
                No active employee concerns on file.
              </p>
            ) : (
              concerns.map((c) => {
                const member = teamMembers.find(m => m.id === c.employeeId);
                return (
                  <div key={c.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-gray-100">{c.title}</span>
                        <span className="text-[10px] text-slate-400">from {member?.fullName || 'Staff'}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-gray-400">{c.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleConcernStatus(c.id, c.status)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase transition-colors shrink-0 ${
                        c.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Status: {c.status.replace('_', ' ')} (Click to toggle)
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 7: FINAL SETTLEMENTS */}
      {activeTab === 'settlement' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-brand-600" />
            <span>Offboarding & Final Settlement Archives</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Separation Reason</th>
                  <th className="py-3 px-3">Last Working Date</th>
                  <th className="py-3 px-3">Net Final Payable</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No final settlement records archived yet.
                    </td>
                  </tr>
                ) : (
                  settlements.map((s) => {
                    const member = teamMembers.find(m => m.id === s.employeeId);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-gray-100">{member?.fullName || s.employeeId}</td>
                        <td className="py-3 px-3 capitalize">{(s.separationReason || 'resignation').replace('_', ' ')}</td>
                        <td className="py-3 px-3 font-mono">{s.lastWorkingDate}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-gray-100">
                          PKR {(s.netFinalPayable ?? s.finalPayableAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 capitalize font-bold text-emerald-600">{s.status}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {currentUserProfile && (
        <>
          <AssignAssetModal
            isOpen={isAssignAssetModalOpen}
            onClose={() => {
              setIsAssignAssetModalOpen(false);
              setEditingAsset(null);
            }}
            staffList={teamMembers}
            callerId={currentUserProfile.id}
            existingAsset={editingAsset}
            onSuccess={loadAllData}
          />

          <LogIncidentModal
            isOpen={isLogIncidentModalOpen}
            onClose={() => {
              setIsLogIncidentModalOpen(false);
              setSelectedIncidentEmployeeId(undefined);
            }}
            staffList={teamMembers}
            defaultEmployeeId={selectedIncidentEmployeeId}
            callerId={currentUserProfile.id}
            onSuccess={loadAllData}
          />

          <PayrollAdjustmentModal
            isOpen={!!selectedPayrollRecord}
            onClose={() => setSelectedPayrollRecord(null)}
            payrollRecord={selectedPayrollRecord}
            employeeName={teamMembers.find(m => m.id === selectedPayrollRecord?.employeeId)?.fullName || 'Staff Member'}
            callerId={currentUserProfile.id}
            onSuccess={loadAllData}
          />

          <AttendanceCorrectionModal
            isOpen={!!selectedAttendanceCorrection}
            onClose={() => setSelectedAttendanceCorrection(null)}
            attendance={selectedAttendanceCorrection?.id ? selectedAttendanceCorrection : null}
            employeeId={selectedAttendanceCorrection?.employeeId || ''}
            callerId={currentUserProfile.id}
            onSuccess={loadAllData}
          />

          <FinalSettlementModal
            isOpen={!!settlementTargetEmployee}
            onClose={() => {
              setSettlementTargetEmployee(null);
              setSettlementTargetEmployeeRecord(null);
            }}
            employee={settlementTargetEmployee}
            employeeRecord={settlementTargetEmployeeRecord}
            assignedAssets={assets.filter(a => a.assignedTo === settlementTargetEmployee?.id || a.employeeId === settlementTargetEmployee?.id)}
            callerId={currentUserProfile.id}
            onSuccess={loadAllData}
          />

          {editingMemberForSetup && (
            <EditTeamMemberModal
              isOpen={!!editingMemberForSetup}
              onClose={() => setEditingMemberForSetup(null)}
              onSuccess={() => {
                setEditingMemberForSetup(null);
                loadAllData();
              }}
              member={editingMemberForSetup}
              currentUserProfile={currentUserProfile}
              departments={departments}
              designations={designations}
              eligibleManagers={eligibleManagers}
            />
          )}
        </>
      )}

      {/* Screen Evidence Preview Modal */}
      {previewEvidenceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="p-4 flex items-center justify-between border-b border-slate-800 text-white">
              <span className="text-xs font-bold font-mono">Workstation Evidence Capture Frame</span>
              <button
                type="button"
                onClick={() => setPreviewEvidenceUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center">
              <img src={previewEvidenceUrl} alt="Evidence" className="max-h-[70vh] rounded-xl object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
