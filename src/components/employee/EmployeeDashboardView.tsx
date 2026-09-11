import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Clock, Calendar, DollarSign, Laptop, Award, 
  MessageSquare, ShieldCheck, AlertTriangle, CheckCircle2, 
  ChevronRight, Lock, Plus, FileText, ExternalLink, RefreshCw,
  TrendingUp, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  EmployeeRecord, WorkShift, EmployeeAttendance, 
  CompanyAsset, EmployeeBankDetails, EmployeePayrollRecord, 
  EmployeePerformanceRecord, EmployeeManagementTask,
  EmployeeProfileChangeRequest
} from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
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

  // Modals
  const [isSOPModalOpen, setIsSOPModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isConcernModalOpen, setIsConcernModalOpen] = useState(false);
  const [isProfileChangeModalOpen, setIsProfileChangeModalOpen] = useState(false);

  const loadEmployeeData = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);

    try {
      // Work date in PKT
      const todayDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

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

  // Find user's active shift
  const activeShift = shifts.find(s => s.id === employeeRecord?.shiftId) || shifts[0] || null;

  // Monthly Metrics Calculations
  const presentDays = attendanceHistory.filter(a => a.status === 'present' || a.status === 'late').length;
  const lateDays = attendanceHistory.filter(a => a.status === 'late').length;
  const totalLateDeductions = attendanceHistory.reduce((sum, a) => sum + (a.lateDeduction || 0), 0);
  const unapprovedAbsences = attendanceHistory.filter(a => a.status === 'absent').length;
  const totalAbsenceDeductions = attendanceHistory.reduce((sum, a) => sum + (a.absenceDeduction || 0), 0);

  // Next Salary Payout Countdown (15th of next month for current month cycle)
  const calculateDaysUntil15th = () => {
    const now = new Date();
    // Next payout date is the 15th of next month
    const payoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    const diffMs = payoutDate.getTime() - now.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };
  const daysUntilPayout = calculateDaysUntil15th();

  // Current Accrued Earnings Calculation
  const baseSalary = Number(employeeRecord?.salary || 0);
  const currentDay = new Date().getDate();
  const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const rawAccrued = totalDaysInMonth > 0 ? (baseSalary / totalDaysInMonth) * currentDay : 0;
  const netAccrued = Math.max(0, Math.round(rawAccrued - totalLateDeductions - totalAbsenceDeductions));

  if (isLoading && !employeeRecord) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">Loading Employee Workspace...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Banner & Profile Overview */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-indigo-700 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl font-black shadow-inner">
            {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'E'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {profile?.fullName}
              </h1>
              {employeeRecord?.employeeId && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/20 border border-white/30 text-white">
                  {employeeRecord.employeeId}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 capitalize">
                {employeeRecord?.employmentType ? employeeRecord.employmentType.replace('_', ' ') : 'Full Time'}
              </span>
            </div>
            <p className="text-xs text-indigo-100/90 font-medium">
              {profile?.designationName || 'Team Member'} • {activeShift ? activeShift.name : 'Morning Shift'}
            </p>
          </div>
        </div>

        {/* SOP Status / Action */}
        <div className="flex items-center gap-3">
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
              <span>Review & Acknowledge SOP</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsProfileChangeModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/20"
          >
            Request Profile Update
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
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
          <p className="text-[10px] text-slate-500 dark:text-gray-400">Active working cycle</p>
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
            -PKR {totalLateDeductions.toLocaleString()} total
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
            -PKR {totalAbsenceDeductions.toLocaleString()} salary cut
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
          <p className="text-[10px] text-slate-500 dark:text-gray-400">Disbursed on the 15th</p>
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

      {/* Main Grid: Attendance Clock on Left, Bank & Assets on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Attendance Clock Widget & Recent Punch History */}
        <div className="lg:col-span-2 space-y-6">
          <EmployeeAttendanceControl
            employeeRecord={employeeRecord}
            shift={activeShift}
            todayAttendance={todayAttendance}
            onAttendanceUpdated={loadEmployeeData}
            onOpenSOPModal={() => setIsSOPModalOpen(true)}
          />

          {/* Recent Attendance History Table */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Attendance Log (Past 30 Days)</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">{attendanceHistory.length} records</span>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                  {attendanceHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                        No attendance logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    attendanceHistory.slice(0, 7).map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200 font-mono">
                          {att.workDate}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-gray-400">
                          {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '--'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-gray-400">
                          {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '--'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                            att.status === 'present'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : att.status === 'late'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                          }`}>
                            {att.status} {att.status === 'late' && att.minutesLate ? `(${att.minutesLate}m)` : ''}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Bank Details, Assigned Assets, Performance & Concerns */}
        <div className="space-y-6">
          {/* Bank Account Details Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Salary Bank Account</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(true)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              >
                {bankDetails ? 'Edit Details' : '+ Add Bank'}
              </button>
            </div>

            {bankDetails ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-gray-200">{bankDetails.bankName}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Verified
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500 dark:text-gray-400">
                    <span>Beneficiary Title:</span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200">{bankDetails.accountTitle}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-gray-400">
                    <span>Account Number:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-gray-200">
                      {bankDetails.accountNumber ? `•••• •••• ${bankDetails.accountNumber.slice(-4)}` : '••••••••'}
                    </span>
                  </div>
                  {bankDetails.iban && (
                    <div className="flex justify-between text-slate-500 dark:text-gray-400">
                      <span>IBAN:</span>
                      <span className="font-mono text-[11px] text-slate-700 dark:text-gray-300">
                        {`PK•• •••• •••• •••• ${bankDetails.iban.slice(-4)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-800 text-xs space-y-2">
                <p className="font-medium">No bank account registered. Please add your verified bank details for payroll disbursement.</p>
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors"
                >
                  Configure Bank Details
                </button>
              </div>
            )}
          </div>

          {/* Assigned Company Assets */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-brand-600" />
                <span>Assigned Company Property ({assets.length})</span>
              </h2>
            </div>

            {assets.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-dark-sidebar rounded-2xl border border-slate-100 dark:border-dark-border">
                No company hardware or assets currently assigned to your account.
              </p>
            ) : (
              <div className="space-y-2.5">
                {assets.map((asset) => (
                  <div key={asset.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs text-slate-800 dark:text-gray-200">{asset.assetName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-gray-400 font-mono">
                        Tag: {asset.assetTag} • Condition: <span className="capitalize">{asset.condition}</span>
                      </div>
                    </div>
                    {asset.acknowledgedAt ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Acknowledged
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcknowledgeAsset(asset.id)}
                        className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold transition-all shadow-xs shrink-0"
                      >
                        Acknowledge Receipt
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance Logs & Coaching */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Performance & Coaching Notes</span>
              </h2>
            </div>

            {performanceRecords.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-dark-sidebar rounded-2xl border border-slate-100 dark:border-dark-border">
                No formal performance notes or coaching logs on file.
              </p>
            ) : (
              <div className="space-y-2.5">
                {performanceRecords.slice(0, 4).map((rec) => (
                  <div key={rec.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-gray-200">{rec.title}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 capitalize">
                        {rec.recordType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-gray-400 line-clamp-2">{rec.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Employee Support & Inquiries */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-600" />
                <span>Management Inquiries & Concerns</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsConcernModalOpen(true)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Submit Ticket
              </button>
            </div>

            {concerns.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-dark-sidebar rounded-2xl border border-slate-100 dark:border-dark-border">
                No active concerns or support tickets submitted.
              </p>
            ) : (
              <div className="space-y-2">
                {concerns.slice(0, 3).map((c) => (
                  <div key={c.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-800 dark:text-gray-200">{c.title}</div>
                      <div className="text-[10px] text-slate-400">Created: {new Date(c.createdAt).toLocaleDateString()}</div>
                    </div>
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SOP Modal */}
      {profile && (
        <SOPModal
          isOpen={isSOPModalOpen}
          onClose={() => setIsSOPModalOpen(false)}
          employeeId={profile.id}
          onAcknowledged={loadEmployeeData}
        />
      )}

      {/* Bank Details Modal */}
      {profile && (
        <BankDetailsModal
          isOpen={isBankModalOpen}
          onClose={() => setIsBankModalOpen(false)}
          employeeId={profile.id}
          existingBankDetails={bankDetails}
          onSuccess={loadEmployeeData}
        />
      )}

      {/* Submit Concern Modal */}
      {profile && (
        <SubmitConcernModal
          isOpen={isConcernModalOpen}
          onClose={() => setIsConcernModalOpen(false)}
          employeeId={profile.id}
          onSuccess={loadEmployeeData}
        />
      )}

      {/* Profile Change Request Modal */}
      {profile && (
        <ProfileChangeRequestModal
          isOpen={isProfileChangeModalOpen}
          onClose={() => setIsProfileChangeModalOpen(false)}
          employeeId={profile.id}
          onSuccess={loadEmployeeData}
        />
      )}
    </div>
  );
};
