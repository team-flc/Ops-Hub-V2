import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User, Clock, Calendar, DollarSign, Laptop, Award,
  MessageSquare, ShieldCheck, AlertTriangle, CheckCircle2,
  ChevronRight, Lock, Plus, FileText, ExternalLink, RefreshCw,
  TrendingUp, AlertCircle, Eye, X, Building2, Briefcase,
  BarChart3, PieChart, Activity, Download, Check, HelpCircle,
  Sparkles, FileCheck, Landmark, ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  EmployeeRecord, WorkShift, EmployeeAttendance,
  CompanyAsset, EmployeeBankDetails, EmployeePayrollRecord,
  EmployeePerformanceRecord, EmployeeManagementTask,
  EmployeeProfileChangeRequest, ROLE_DISPLAY_NAMES
} from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import {
  getPKTTodayDateString, getDaysInPKTMonth, getPKTDateTimeParts,
  calculatePKTSalaryCountdown, calculateDaysWithCompany, formatPKTTime,
  formatPKTDate, getPKTCurrentMonthString
} from '../../lib/pktDateUtils';
import { EmployeeAttendanceControl } from './EmployeeAttendanceControl';
import { SOPModal } from './SOPModal';
import { BankDetailsModal } from './BankDetailsModal';
import { SubmitConcernModal } from './SubmitConcernModal';
import { ProfileChangeRequestModal } from './ProfileChangeRequestModal';

export const EmployeeDashboardView: React.FC = () => {
  const { profile } = useAuth();

  // Data States
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<EmployeeAttendance | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<EmployeeAttendance[]>([]);
  const [bankDetails, setBankDetails] = useState<EmployeeBankDetails | null>(null);
  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [payrolls, setPayrolls] = useState<EmployeePayrollRecord[]>([]);
  const [performanceRecords, setPerformanceRecords] = useState<EmployeePerformanceRecord[]>([]);
  const [concerns, setConcerns] = useState<EmployeeManagementTask[]>([]);
  const [changeRequests, setChangeRequests] = useState<EmployeeProfileChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'payroll' | 'bank' | 'performance' | 'assets' | 'scope' | 'concerns'>('overview');

  // Modals & Lightbox
  const [isSOPModalOpen, setIsSOPModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isConcernModalOpen, setIsConcernModalOpen] = useState(false);
  const [isProfileChangeModalOpen, setIsProfileChangeModalOpen] = useState(false);
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<{ url: string; title: string; date: string } | null>(null);

  const loadEmployeeData = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);

    try {
      // Work date in PKT
      const todayDate = getPKTTodayDateString();

      const [
        rec,
        allShifts,
        todayAtt,
        history,
        bank,
        myAssets,
        myPayrolls,
        perf,
        myConcerns,
        requests
      ] = await Promise.all([
        employeeOperationsService.fetchEmployeeRecord(profile.id),
        employeeOperationsService.fetchWorkShifts(),
        employeeOperationsService.fetchTodayAttendance(profile.id, todayDate),
        employeeOperationsService.fetchAttendanceHistory(profile.id, 30),
        employeeOperationsService.fetchBankDetails(profile.id),
        employeeOperationsService.fetchEmployeeAssets(profile.id),
        employeeOperationsService.fetchPayrollHistory(profile.id),
        employeeOperationsService.fetchPerformanceRecords(profile.id),
        employeeOperationsService.fetchManagementTasks('employee_concern', profile.id),
        employeeOperationsService.fetchProfileChangeRequests(profile.id)
      ]);

      setEmployeeRecord(rec);
      setShifts(allShifts);
      setTodayAttendance(todayAtt);
      setAttendanceHistory(history);
      setBankDetails(bank);
      setAssets(myAssets);
      setPayrolls(myPayrolls);
      setPerformanceRecords(perf);
      setConcerns(myConcerns);
      setChangeRequests(requests);
    } catch (err) {
      console.error('Failed to load employee dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadEmployeeData();
  }, [loadEmployeeData]);

  // Asset Receipt Acknowledgement
  const handleAcknowledgeAsset = async (assetId: string) => {
    if (!profile) return;
    try {
      await employeeOperationsService.acknowledgeAssetReceipt(assetId, profile.id);
      loadEmployeeData();
    } catch (err) {
      console.error('Failed to acknowledge asset receipt:', err);
    }
  };

  // Setup pending status
  const isSetupPending = !employeeRecord || !employeeRecord.setupCompletedAt;

  // Find user's active shift
  const activeShift = shifts.find(s => s.id === employeeRecord?.shiftId) || (isSetupPending ? null : shifts[0] || null);

  // Days with company
  const startDateStr = profile?.startDate || '';
  const daysWithCompany = calculateDaysWithCompany(startDateStr);

  // Monthly Metrics Calculations (Exempt / zeroed if setup is pending)
  const presentDays = isSetupPending ? 0 : attendanceHistory.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'on_time').length;
  const lateDays = isSetupPending ? 0 : attendanceHistory.filter(a => a.status === 'late').length;
  const totalLateDeductions = isSetupPending ? 0 : attendanceHistory.reduce((sum, a) => sum + (a.lateDeduction || 0), 0);
  const unapprovedAbsences = isSetupPending ? 0 : attendanceHistory.filter(a => a.status === 'absent').length;
  const totalAbsenceDeductions = isSetupPending ? 0 : attendanceHistory.reduce((sum, a) => sum + (a.absenceDeduction || 0), 0);

  // Next Salary Payout Countdown (15th payout date in PKT)
  const { daysRemaining: daysUntilPayout, nextSalaryDate } = calculatePKTSalaryCountdown();

  // Current Accrued Earnings Calculation in PKT
  const baseSalary = isSetupPending ? 0 : Number(employeeRecord?.salary || 0);
  const { day: currentDay } = getPKTDateTimeParts();
  const totalDaysInMonth = getDaysInPKTMonth();
  const rawAccrued = (!isSetupPending && totalDaysInMonth > 0) ? (baseSalary / totalDaysInMonth) * currentDay : 0;
  const netAccrued = isSetupPending ? 0 : Math.max(0, Math.round(rawAccrued - totalLateDeductions - totalAbsenceDeductions));

  // Graph 1: Weekly Attendance Trend Data (Mon to Sat for current week)
  const weeklyAttendanceData = useMemo(() => {
    const todayPKT = getPKTTodayDateString();
    const { year, month, day, dayOfWeek } = getPKTDateTimeParts();

    // DayOfWeek in PKT: 0=Sun, 1=Mon, ..., 6=Sat
    // Calculate Monday date of current week
    const currentDayIndex = dayOfWeek === 0 ? 7 : dayOfWeek; // Mon=1, Sun=7
    const daysFromMonday = currentDayIndex - 1;

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return daysOfWeek.map((label, idx) => {
      const offset = idx - daysFromMonday;
      const d = new Date(Date.UTC(year, month - 1, day + offset));
      const dateStr = d.toISOString().slice(0, 10);
      const isPastOrToday = dateStr <= todayPKT;
      const isToday = dateStr === todayPKT;

      const record = attendanceHistory.find(a => a.workDate === dateStr);
      let status: 'present' | 'late' | 'absent' | 'off' | 'future' = 'future';
      let hours = 0;

      if (record) {
        status = (record.status === 'on_time' || record.status === 'present') ? 'present' : (record.status === 'late' ? 'late' : 'absent');
        hours = record.totalHours || 0;
      } else if (isPastOrToday) {
        status = isToday ? (todayAttendance ? ((todayAttendance.status === 'on_time' || todayAttendance.status === 'present') ? 'present' : (todayAttendance.status === 'late' ? 'late' : 'absent')) : 'off') : 'absent';
        hours = todayAttendance?.totalHours || 0;
      }

      return {
        label,
        dateStr,
        isToday,
        isPastOrToday,
        status,
        hours
      };
    });
  }, [attendanceHistory, todayAttendance]);

  // Graph 2: Monthly Composition Data
  const monthlyComposition = useMemo(() => {
    const totalWorkingDays = 26; // Mon-Sat working schedule
    const onTimeDays = Math.max(0, presentDays - lateDays);
    const absent = unapprovedAbsences;
    const remainingDays = Math.max(0, totalWorkingDays - (onTimeDays + lateDays + absent));

    return {
      onTimeDays,
      lateDays,
      absent,
      remainingDays,
      totalWorkingDays
    };
  }, [presentDays, lateDays, unapprovedAbsences]);

  // Graph 3: Punctuality Trend (Last 10 attendance records)
  const punctualityTrend = useMemo(() => {
    return attendanceHistory.slice(0, 10).reverse().map(att => ({
      date: att.workDate.slice(5),
      minutesLate: att.minutesLate || 0,
      status: att.status,
      isLate: att.status === 'late'
    }));
  }, [attendanceHistory]);

  // Graph 4: Last 6 Payroll Periods
  const last6Payrolls = useMemo(() => {
    if (payrolls.length > 0) {
      return payrolls.slice(0, 6).reverse().map(p => ({
        period: p.payrollMonth || p.payrollPeriod,
        gross: p.baseSalary ?? p.grossSalary ?? 0,
        deductions: (p.lateDeductions ?? p.lateDeductionsTotal ?? 0) + (p.unapprovedAbsenceDeductions ?? p.absenceDeductionsTotal ?? 0),
        net: p.netPayable
      }));
    }
    // Placeholder demonstration if no payroll history exists yet
    const currentMonth = getPKTCurrentMonthString();
    return [
      { period: currentMonth, gross: baseSalary, deductions: totalLateDeductions + totalAbsenceDeductions, net: netAccrued }
    ];
  }, [payrolls, baseSalary, totalLateDeductions, totalAbsenceDeductions, netAccrued]);

  if (isLoading && !employeeRecord && !profile) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">Loading Employee Workspace...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* 1. Summary Header Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-indigo-700 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-inner">
            {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'E'}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                {profile?.fullName}
              </h1>
              {employeeRecord?.employeeId && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/20 border border-white/30 text-white">
                  {employeeRecord.employeeId}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
                isSetupPending
                  ? 'bg-amber-400/20 text-amber-200 border-amber-400/40'
                  : 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30'
              }`}>
                {isSetupPending ? 'Setup Pending' : (employeeRecord?.employmentType ? employeeRecord.employmentType.replace('_', ' ') : 'Active')}
              </span>
            </div>
            <p className="text-xs text-indigo-100/90 font-medium flex items-center gap-2 flex-wrap">
              <span>{profile?.designationName || (profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'Team Member')}</span>
              <span>•</span>
              <span className={isSetupPending ? 'text-amber-200 font-semibold' : ''}>
                {isSetupPending
                  ? 'Setup Pending — Shift Unconfigured'
                  : (activeShift ? `${activeShift.name} (${activeShift.startTime.slice(0, 5)} - ${activeShift.endTime.slice(0, 5)} PKT) • Monday – Saturday` : 'Shift Unconfigured')}
              </span>
            </p>
            <div className="text-[11px] text-indigo-200/80 flex items-center gap-3 flex-wrap pt-0.5">
              <span>Joined: {startDateStr ? formatPKTDate(startDateStr) : 'N/A'}</span>
              <span>•</span>
              <span>{daysWithCompany} days with company</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {isSetupPending ? 'Setup Locked' : (todayAttendance?.checkInTime ? (todayAttendance.checkOutTime ? 'Shift Completed' : 'Checked In') : 'Not Clocked In')}
              </span>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3 z-10 flex-wrap">
          {employeeRecord?.sopAcknowledged ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>SOP Acknowledged (v{employeeRecord.sopVersion || '1.0'})</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSOPModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold transition-all shadow-lg flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-slate-900" />
              <span>Review SOP</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsProfileChangeModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/20"
          >
            Update Request
          </button>
        </div>
      </div>

      {/* Setup Pending Security Banner */}
      {isSetupPending && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3.5 text-amber-800 dark:text-amber-200">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1 text-xs">
            <h3 className="font-bold text-sm text-amber-900 dark:text-amber-100">
              Employee Setup Pending — Shift & Governance Unconfigured
            </h3>
            <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
              Your profile is registered, but management (Owner or Operational Manager) has not yet finalized your designated shift, work schedule, and base monthly salary parameters. Screen recording, punch controls, and attendance deduction calculations are paused until configuration is complete.
            </p>
          </div>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Present Days */}
        <div className="p-4 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Present (Month)</span>
            <Calendar className="w-4 h-4 text-brand-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-gray-100 font-mono">
            {presentDays} <span className="text-xs font-semibold text-slate-400">days</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-gray-400">Monday – Saturday cycle</p>
        </div>

        {/* Late Check-Ins */}
        <div className="p-4 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Late Arrivals</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 font-mono">
            {lateDays} <span className="text-xs font-semibold text-slate-400">days</span>
          </div>
          <p className="text-[10px] text-rose-500 font-semibold font-mono">
            -PKR {totalLateDeductions.toLocaleString()} (PKR 500/late)
          </p>
        </div>

        {/* Unapproved Absences */}
        <div className="p-4 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Absences</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 font-mono">
            {unapprovedAbsences} <span className="text-xs font-semibold text-slate-400">days</span>
          </div>
          <p className="text-[10px] text-rose-500 font-semibold font-mono">
            -PKR {totalAbsenceDeductions.toLocaleString()} (1-day rate cut)
          </p>
        </div>

        {/* Next Salary Payout Countdown */}
        <div className="p-4 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Next Payout</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
            {daysUntilPayout} <span className="text-xs font-semibold text-slate-400">days</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-gray-400">Disbursed 15th PKT</p>
        </div>

        {/* Accrued Earnings This Month */}
        <div className="p-4 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Accrued Earned</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            PKR {netAccrued.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-gray-400">
            Base: PKR {baseSalary.toLocaleString()}
          </p>
        </div>
      </div>

      {/* 3. Four Responsive Visualizations / Graphs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Graph 1: Weekly Attendance Trend (Mon-Sat) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-gray-100">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              <span>Weekly Trend (Mon-Sat)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">This Week</span>
          </div>

          <div className="h-32 flex items-end justify-between gap-1.5 pt-4">
            {weeklyAttendanceData.map((d) => {
              const heightPct = d.hours > 0 ? Math.min(100, Math.round((d.hours / 9) * 100)) : (d.status === 'present' || d.status === 'late' ? 85 : 15);
              let barColor = 'bg-slate-100 dark:bg-dark-sidebar';
              if (d.status === 'present') barColor = 'bg-emerald-500';
              else if (d.status === 'late') barColor = 'bg-amber-500';
              else if (d.status === 'absent') barColor = 'bg-rose-500';
              else if (d.isToday) barColor = 'bg-brand-500';

              return (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                  <div
                    className={`w-full rounded-lg transition-all duration-300 ${barColor}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className={`text-[10px] font-bold ${d.isToday ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
                    {d.label}
                  </span>
                  {/* Tooltip */}
                  <div className="absolute -top-8 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    {d.hours > 0 ? `${d.hours}h` : d.status}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> On-time</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Late</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Absent</span>
          </div>
        </div>

        {/* Graph 2: Monthly Attendance Composition */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-gray-100">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>Monthly Composition</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">26 Work Days</span>
          </div>

          <div className="space-y-2 pt-1">
            <div className="h-4 rounded-full bg-slate-100 dark:bg-dark-sidebar flex overflow-hidden">
              <div
                style={{ width: `${(monthlyComposition.onTimeDays / 26) * 100}%` }}
                className="bg-emerald-500 h-full"
                title={`On-time: ${monthlyComposition.onTimeDays}d`}
              />
              <div
                style={{ width: `${(monthlyComposition.lateDays / 26) * 100}%` }}
                className="bg-amber-500 h-full"
                title={`Late: ${monthlyComposition.lateDays}d`}
              />
              <div
                style={{ width: `${(monthlyComposition.absent / 26) * 100}%` }}
                className="bg-rose-500 h-full"
                title={`Absent: ${monthlyComposition.absent}d`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5">
              <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                <span className="text-slate-400 block text-[10px]">On-Time</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{monthlyComposition.onTimeDays} Days</span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                <span className="text-slate-400 block text-[10px]">Late</span>
                <span className="font-bold text-amber-700 dark:text-amber-300">{monthlyComposition.lateDays} Days</span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                <span className="text-slate-400 block text-[10px]">Absences</span>
                <span className="font-bold text-rose-700 dark:text-rose-300">{monthlyComposition.absent} Days</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border">
                <span className="text-slate-400 block text-[10px]">Upcoming</span>
                <span className="font-bold text-slate-700 dark:text-gray-300">{monthlyComposition.remainingDays} Days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Graph 3: Punctuality / Late Trend */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-gray-100">
              <Activity className="w-4 h-4 text-amber-600" />
              <span>Punctuality Trend</span>
            </div>
            <span className="text-[10px] text-slate-400">10-Day Trace</span>
          </div>

          <div className="h-32 flex items-end justify-between gap-1 pt-4">
            {punctualityTrend.length === 0 ? (
              <div className="w-full text-center text-slate-400 text-xs py-8 italic">No records yet</div>
            ) : (
              punctualityTrend.map((pt, i) => {
                const maxLate = 60;
                const heightPct = pt.minutesLate > 0 ? Math.min(100, Math.max(20, Math.round((pt.minutesLate / maxLate) * 100))) : 8;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    <div
                      className={`w-full rounded-md transition-all duration-300 ${pt.isLate ? 'bg-amber-500' : 'bg-emerald-400'}`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] font-mono text-slate-400 truncate w-full text-center">{pt.date}</span>
                    <div className="absolute -top-7 bg-slate-900 text-white text-[9px] py-0.5 px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 whitespace-nowrap">
                      {pt.minutesLate > 0 ? `+${pt.minutesLate}m late` : 'On time'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-gray-400 text-center pt-1">
            Flat PKR 500 per late arrival from 1 min onward.
          </p>
        </div>

        {/* Graph 4: Last 6 Payroll Periods */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-gray-100">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              <span>Payroll History</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Disbursal 15th</span>
          </div>

          <div className="h-32 flex items-end justify-between gap-2 pt-4">
            {last6Payrolls.map((p, i) => {
              const maxVal = Math.max(100000, baseSalary || 50000);
              const grossPct = Math.min(100, Math.round((p.gross / maxVal) * 90));
              const netPct = Math.min(100, Math.round((p.net / maxVal) * 90));

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                  <div className="flex items-end gap-0.5 w-full justify-center h-full">
                    <div
                      className="w-1/2 bg-indigo-200 dark:bg-indigo-900/50 rounded-t-sm"
                      style={{ height: `${grossPct}%` }}
                      title={`Gross: PKR ${p.gross.toLocaleString()}`}
                    />
                    <div
                      className="w-1/2 bg-indigo-600 dark:bg-indigo-400 rounded-t-sm"
                      style={{ height: `${netPct}%` }}
                      title={`Net: PKR ${p.net.toLocaleString()}`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 truncate w-full text-center">
                    {p.period ? p.period.slice(5) : '--'}
                  </span>
                  <div className="absolute -top-7 bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 whitespace-nowrap">
                    Net: PKR {p.net.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-200 dark:bg-indigo-900/50 rounded-xs" /> Gross</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-xs" /> Net Disbursed</span>
          </div>
        </div>
      </div>

      {/* 4. Employee 360 Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'overview' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>1. Attendance & Clock</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'payroll' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>2. Salary & Deductions</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bank')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'bank' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>3. Bank Account</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'performance' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>4. Performance & Incidents ({performanceRecords.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'assets' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>5. Assigned Assets ({assets.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scope')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'scope' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>6. Job Scope & SOP</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('concerns')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'concerns' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>7. Support & Concerns ({concerns.length})</span>
        </button>
      </div>

      {/* 5. TAB CONTENTS */}

      {/* TAB 1: ATTENDANCE & CLOCK */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <EmployeeAttendanceControl
              employeeRecord={employeeRecord}
              shift={activeShift}
              todayAttendance={todayAttendance}
              onAttendanceUpdated={loadEmployeeData}
              onOpenSOPModal={() => setIsSOPModalOpen(true)}
            />

            {/* Attendance Log Table */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-600" />
                  <span>Attendance History (Past 30 Days)</span>
                </h2>
                <span className="text-xs text-slate-400 font-mono">{attendanceHistory.length} entries</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Check In</th>
                      <th className="py-2.5 px-3">Check Out</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Hours</th>
                      <th className="py-2.5 px-3">Deductions</th>
                      <th className="py-2.5 px-3 text-right">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                    {attendanceHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                          No attendance logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      attendanceHistory.slice(0, 15).map((att) => (
                        <tr key={att.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200 font-mono">
                            {att.workDate}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-gray-400">
                            {att.checkInTime ? formatPKTTime(att.checkInTime) : '--'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-gray-400">
                            {att.checkOutTime ? formatPKTTime(att.checkOutTime) : '--'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                              att.status === 'present'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                : att.status === 'late'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                            }`}>
                              {att.status} {att.status === 'late' && att.minutesLate ? `(+${att.minutesLate}m)` : ''}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-gray-300">
                            {att.totalHours ? `${att.totalHours}h` : '--'}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {att.lateDeduction || att.absenceDeduction ? (
                              <span className="text-rose-600 font-semibold">
                                -PKR {((att.lateDeduction || 0) + (att.absenceDeduction || 0)).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {att.checkInScreenshotPath || att.screenCaptureUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewEvidenceUrl({
                                  url: att.screenCaptureUrl || att.checkInScreenshotPath!,
                                  title: `Punch Evidence — ${att.workDate}`,
                                  date: att.checkInTime ? formatPKTTime(att.checkInTime) : att.workDate
                                })}
                                className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-semibold hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-gray-600 text-[10px]">None</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Shift Rules & Live Schedule */}
          <div className="space-y-6">
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Working Shift & Schedule</span>
              </h2>

              {isSetupPending ? (
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs space-y-2">
                  <p className="font-semibold">Setup Pending</p>
                  <p>Shift has not yet been assigned by management. Check back once setup is marked complete.</p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-1.5">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-500">Assigned Shift:</span>
                      <span className="text-slate-900 dark:text-gray-100">{activeShift?.name || 'Default Shift'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Working Hours:</span>
                      <span className="font-mono font-bold text-brand-600">
                        {activeShift ? `${activeShift.startTime.slice(0, 5)} - ${activeShift.endTime.slice(0, 5)} PKT` : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Working Days:</span>
                      <span className="font-semibold text-slate-800 dark:text-gray-200">Monday – Saturday</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200 space-y-1 text-[11px]">
                    <div className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Company Attendance Rules:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-gray-300">
                      <li>Punctuality: Flat PKR 500 per late arrival from 1 min past start time (no monthly cap).</li>
                      <li>Absence: 1 calendar day salary cut (Base Salary / Days in Month).</li>
                      <li>Evidence: High-resolution desktop screen capture required at clock-in/out.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALARY & DEDUCTIONS */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Base Salary Breakdown */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Base Compensation</span>
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Monthly Base Salary:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-gray-100">PKR {baseSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Daily Salary Rate (PKT):</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-gray-300">
                    PKR {totalDaysInMonth > 0 ? Math.round(baseSalary / totalDaysInMonth).toLocaleString() : 0} / day
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payroll Cycle:</span>
                  <span className="font-medium text-slate-800 dark:text-gray-200">1st to End of Month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Disbursal Date:</span>
                  <span className="font-bold text-emerald-600">15th of Subsequent Month</span>
                </div>
              </div>
            </div>

            {/* Current Accrued Details */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>Current Cycle Accrual</span>
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Accrued ({currentDay} days):</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-gray-200">PKR {Math.round(rawAccrued).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Late Deductions:</span>
                  <span className="font-mono font-semibold">-PKR {totalLateDeductions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Absence Deductions:</span>
                  <span className="font-mono font-semibold">-PKR {totalAbsenceDeductions.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-dark-border flex justify-between font-bold">
                  <span>Estimated Net Accrued:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">PKR {netAccrued.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Settlement / Notice Policy */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                <span>Settlement & Notice Governance</span>
              </h2>
              <div className="text-[11px] text-slate-600 dark:text-gray-300 space-y-1.5 leading-relaxed">
                <p>• <strong>15th Disbursal Policy:</strong> Salary for the preceding 1st-end calendar month is disbursed on the 15th.</p>
                <p>• <strong>Offboarding Disbursal:</strong> In the event of resignation or offboarding, all earned days and held salary remain payable in full alongside any accrued bonuses.</p>
                <p>• <strong>No Arbitrary Cuts:</strong> Notice periods are served professionally; deductions occur only for unworked days or documented property damage.</p>
              </div>
            </div>
          </div>

          {/* Historical Payroll Table */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-brand-600" />
              <span>Disbursed Payroll History & Payment Receipts</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Cycle Period</th>
                    <th className="py-2.5 px-3">Base Salary</th>
                    <th className="py-2.5 px-3">Late Cuts</th>
                    <th className="py-2.5 px-3">Absence Cuts</th>
                    <th className="py-2.5 px-3">Bonuses</th>
                    <th className="py-2.5 px-3">Net Disbursed</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Receipt / Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                  {payrolls.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 italic">
                        No disbursed payroll records found. First cycle dispatches on the 15th.
                      </td>
                    </tr>
                  ) : (
                    payrolls.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                        <td className="py-2.5 px-3 font-semibold font-mono">{p.payrollMonth || p.payrollPeriod}</td>
                        <td className="py-2.5 px-3 font-mono">PKR {(p.baseSalary ?? p.grossSalary ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono text-rose-600">-PKR {(p.lateDeductions ?? p.lateDeductionsTotal ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono text-rose-600">-PKR {(p.unapprovedAbsenceDeductions ?? p.absenceDeductionsTotal ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-600">+PKR {(p.bonuses || 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-gray-100">PKR {p.netPayable.toLocaleString()}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {p.paymentProofUrl ? (
                            <a
                              href={p.paymentProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Proof
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Disbursed Direct</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BANK ACCOUNT */}
      {activeTab === 'bank' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">Official Salary Bank Account</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Used for monthly 15th payroll direct bank transfers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                {bankDetails ? 'Update Details' : '+ Add Bank Account'}
              </button>
            </div>

            {bankDetails ? (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-border">
                  <span className="text-sm font-bold text-slate-900 dark:text-gray-100">{bankDetails.bankName}</span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified for Disbursals
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Beneficiary Account Title:</span>
                    <span className="font-semibold text-slate-900 dark:text-gray-100">{bankDetails.accountTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Number:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-gray-100">
                      {bankDetails.accountNumber ? `•••• •••• ${bankDetails.accountNumber.slice(-4)}` : '••••••••'}
                    </span>
                  </div>
                  {bankDetails.iban && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">IBAN:</span>
                      <span className="font-mono text-slate-800 dark:text-gray-200">{bankDetails.iban}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-800 text-xs space-y-3">
                <p className="font-semibold text-sm">No Bank Account on File</p>
                <p className="leading-relaxed">Please register your active Pakistani bank account to ensure on-time automated salary disbursement on the 15th.</p>
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors"
                >
                  Configure Bank Details Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PERFORMANCE & INCIDENTS */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Performance Logs, Coaching & Recognitions</span>
            </h2>

            {performanceRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic text-xs bg-slate-50 dark:bg-dark-sidebar rounded-2xl border border-slate-100 dark:border-dark-border">
                No formal performance reviews, coaching logs, or incident notes on record.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {performanceRecords.map((rec) => (
                  <div key={rec.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-gray-100">{rec.title}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                        rec.recordType === 'achievement' ? 'bg-emerald-100 text-emerald-800' :
                        rec.recordType === 'coaching' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {rec.recordType}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-gray-400 leading-relaxed">{rec.description}</p>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-dark-border">
                      Logged on: {new Date(rec.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ASSIGNED ASSETS */}
      {activeTab === 'assets' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-brand-600" />
              <span>Assigned Company Assets & Hardware ({assets.length})</span>
            </h2>
          </div>

          {assets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic text-xs bg-slate-50 dark:bg-dark-sidebar rounded-2xl border border-slate-100 dark:border-dark-border">
              No company hardware or assets currently assigned to your custody.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map((asset) => (
                <div key={asset.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-gray-100 text-sm">{asset.itemName || asset.assetName || 'Hardware Asset'}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 capitalize">
                      {asset.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-500 font-mono text-[11px]">
                    <div>Tag: <span className="font-bold text-slate-700 dark:text-gray-300">{asset.assetTag || 'N/A'}</span></div>
                    <div>SN: <span className="text-slate-700 dark:text-gray-300">{asset.serialNumber || 'N/A'}</span></div>
                    <div>Issued: <span className="text-slate-700 dark:text-gray-300">{asset.issueDate ? formatPKTDate(asset.issueDate) : 'N/A'}</span></div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-dark-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Replacement Value</span>
                      <span className="font-bold font-mono text-slate-900 dark:text-gray-100">
                        PKR {(asset.replacementValue || 0).toLocaleString()}
                      </span>
                    </div>

                    {asset.acknowledgedAt ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Acknowledged
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcknowledgeAsset(asset.id)}
                        className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold transition-all shadow-xs"
                      >
                        Acknowledge Receipt
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: JOB SCOPE & SOP */}
      {activeTab === 'scope' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-brand-600" />
              <span>Job Scope & Key Responsibilities</span>
            </h2>

            {employeeRecord?.jobDescription ? (
              <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-dark-sidebar p-4 rounded-2xl border border-slate-200 dark:border-dark-border">
                {employeeRecord.jobDescription}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No formal job scope text attached yet.</p>
            )}
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Governance & Standard Operating Procedures (SOP)</span>
            </h2>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-gray-200">Company Operations SOP v1.0</span>
                {employeeRecord?.sopAcknowledged ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Acknowledged
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Pending Review
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-[11px]">
                Governs punctuality, screen evidence requirements, communication channels, and offboarding workflows.
              </p>
              <button
                type="button"
                onClick={() => setIsSOPModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-colors"
              >
                Review Full SOP Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SUPPORT & CONCERNS */}
      {activeTab === 'concerns' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              <span>Employee Inquiries & Support Tickets ({concerns.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsConcernModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Submit New Ticket
            </button>
          </div>

          {concerns.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic text-xs bg-slate-50 dark:bg-dark-sidebar rounded-2xl border border-slate-100 dark:border-dark-border">
              No support tickets or inquiries submitted. Click &quot;Submit New Ticket&quot; to report an issue to management.
            </div>
          ) : (
            <div className="space-y-3">
              {concerns.map((c) => (
                <div key={c.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-gray-100">{c.title}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                      c.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-gray-400 leading-relaxed">{c.description}</p>
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-dark-border flex justify-between">
                    <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                    <span>Priority: <strong className="capitalize">{c.priority}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Screen Evidence Lightbox Modal */}
      {previewEvidenceUrl && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-dark-300 rounded-3xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100">{previewEvidenceUrl.title}</h3>
                <p className="text-xs text-slate-500 font-mono">Timestamp (PKT): {previewEvidenceUrl.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEvidenceUrl(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-dark-sidebar transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center max-h-[70vh]">
              <img
                src={previewEvidenceUrl.url}
                alt="Punch Verification Screenshot"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {profile && (
        <>
          <SOPModal
            isOpen={isSOPModalOpen}
            onClose={() => setIsSOPModalOpen(false)}
            employeeId={profile.id}
            onAcknowledged={loadEmployeeData}
          />

          <BankDetailsModal
            isOpen={isBankModalOpen}
            onClose={() => setIsBankModalOpen(false)}
            employeeId={profile.id}
            existingBankDetails={bankDetails}
            onSuccess={loadEmployeeData}
          />

          <SubmitConcernModal
            isOpen={isConcernModalOpen}
            onClose={() => setIsConcernModalOpen(false)}
            employeeId={profile.id}
            onSuccess={loadEmployeeData}
          />

          <ProfileChangeRequestModal
            isOpen={isProfileChangeModalOpen}
            onClose={() => setIsProfileChangeModalOpen(false)}
            employeeId={profile.id}
            onSuccess={loadEmployeeData}
          />
        </>
      )}
    </div>
  );
};
