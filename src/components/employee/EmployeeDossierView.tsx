import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { 
  User, Mail, Phone, Calendar, Clock, DollarSign, 
  Laptop, Award, FileText, ArrowLeft, ShieldCheck, 
  AlertTriangle, CheckCircle2, Edit3, Plus, RefreshCw, 
  Lock, Eye, AlertCircle, Building2, Briefcase
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import { 
  EmployeeFullDossier, TeamMemberRecord, UserProfile, 
  CompanyAsset, EmployeeAttendance, EmployeePayrollRecord 
} from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { teamManagementService } from '../../lib/teamManagementService';
import { AssignAssetModal } from './AssignAssetModal';
import { LogIncidentModal } from './LogIncidentModal';
import { BankDetailsModal } from './BankDetailsModal';
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal';
import { PayrollAdjustmentModal } from './PayrollAdjustmentModal';
import { FinalSettlementModal } from './FinalSettlementModal';

export const EmployeeDossierView: React.FC = () => {
  const { employeeId } = useParams<{ employeeId?: string }>();
  const { profile: currentUserProfile } = useAuth();
  const navigate = useSafeNavigate();

  const [dossier, setDossier] = useState<EmployeeFullDossier | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'performance' | 'payroll' | 'assets' | 'documents'>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAssignAssetModalOpen, setIsAssignAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CompanyAsset | null>(null);
  const [isLogIncidentModalOpen, setIsLogIncidentModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedAttendanceCorrection, setSelectedAttendanceCorrection] = useState<EmployeeAttendance | null>(null);
  const [selectedPayrollRecord, setSelectedPayrollRecord] = useState<EmployeePayrollRecord | null>(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(null);

  const targetId = employeeId || currentUserProfile?.id;

  const loadDossier = useCallback(async () => {
    if (!targetId) return;
    setIsLoading(true);
    try {
      const data = await employeeOperationsService.fetchFullDossier(targetId);
      setDossier(data);
    } catch (err) {
      console.error('Failed to load employee dossier:', err);
    } finally {
      setIsLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    loadDossier();
  }, [loadDossier]);

  if (isLoading && !dossier) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading Employee Dossier...</p>
      </div>
    );
  }

  if (!dossier || !dossier.profile) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Employee Not Found</h2>
        <p className="text-xs text-slate-500">The requested employee record does not exist or has been removed.</p>
        <button
          type="button"
          onClick={() => navigate('/operations/employees')}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold"
        >
          Back to Employee Operations
        </button>
      </div>
    );
  }

  const { profile, bankDetails, assets = [], changeRequests = [] } = dossier;
  const record = dossier.employeeRecord || dossier.record;
  const attendance = dossier.attendanceHistory || dossier.attendance || [];
  const payroll = dossier.payrollRecords || dossier.payroll || [];
  const performance = dossier.performanceRecords || dossier.performance || [];
  const isManager = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';

  // Metrics
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const totalLatePenalties = attendance.reduce((sum, a) => sum + (a.lateDeduction || 0), 0);
  const absenceCount = attendance.filter(a => a.status === 'absent').length;
  const totalAbsenceCuts = attendance.reduce((sum, a) => sum + (a.absenceDeduction || 0), 0);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/operations/employees')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-gray-400 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Operations Directory</span>
        </button>

        {isManager && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSettlementModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 text-xs font-bold hover:bg-rose-100 transition-colors"
            >
              Initiate Offboarding / Settlement
            </button>
          </div>
        )}
      </div>

      {/* Main Dossier Header Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 text-white flex items-center justify-center text-2xl font-black shadow-md shadow-brand-500/25">
            {profile.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-gray-100">
                {profile.fullName}
              </h1>
              {record?.employeeId && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300">
                  {record.employeeId}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                profile.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {profile.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {profile.designationName || 'Team Member'} • {record?.shift?.name || 'Morning Shift'} • {profile.workEmail}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {record?.sopAcknowledged ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>SOP Acknowledged (v{record.sopVersion || '1.0'})</span>
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>SOP Pending</span>
            </span>
          )}
        </div>
      </div>

      {/* 6 Tabs Bar */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          1. Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'attendance' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          2. Attendance ({attendance.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'performance' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          3. Performance & Incidents ({performance.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'payroll' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          4. Payroll & Compensation ({payroll.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'assets' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          5. Assets & Property ({assets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'documents' ? 'bg-white dark:bg-dark-card text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-600 dark:text-gray-400'
          }`}
        >
          6. Documents & Employment
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Employment Details</h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Work Email</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">{profile.workEmail}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phone</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">{profile.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Start Date</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">{profile.startDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Base Monthly Salary</span>
                  <span className="font-bold text-slate-900 dark:text-gray-100 font-mono">
                    PKR {(record?.salary || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {record?.jobDescription && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Job Description & Responsibilities</h2>
                <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {record.jobDescription}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Attendance Summary (All Time)</h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Present Days:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{presentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Late Days:</span>
                  <span className="font-bold text-amber-600">{lateCount} (-PKR {totalLatePenalties.toLocaleString()})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unapproved Absences:</span>
                  <span className="font-bold text-rose-600">{absenceCount} (-PKR {totalAbsenceCuts.toLocaleString()})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Attendance History & Evidence</h2>
            {isManager && (
              <button
                type="button"
                onClick={() => setSelectedAttendanceCorrection({
                  id: '',
                  employeeId: targetId || '',
                  workDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
                  status: 'present',
                  scheduledCheckIn: '',
                  scheduledCheckOut: '',
                  minutesLate: 0,
                  lateDeduction: 0,
                  absenceDeduction: 0,
                  createdAt: '',
                  updatedAt: ''
                })}
                className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adjust / Log Attendance
              </button>
            )}
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
                  <th className="py-2.5 px-3">Evidence</th>
                  <th className="py-2.5 px-3">Deductions</th>
                  {isManager && <th className="py-2.5 px-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400 italic">No attendance records on file.</td>
                  </tr>
                ) : (
                  attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200 font-mono">{att.workDate}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-gray-400">
                        {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-gray-400">
                        {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                          att.status === 'present'
                            ? 'bg-emerald-50 text-emerald-700'
                            : att.status === 'late'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {att.status} {att.status === 'late' && att.minutesLate ? `(${att.minutesLate}m)` : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{att.totalHours ? `${att.totalHours}h` : '--'}</td>
                      <td className="py-2.5 px-3">
                        {att.screenCaptureUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewEvidenceUrl(att.screenCaptureUrl || null)}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-brand-600 text-[10px] font-bold flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View Frame
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {att.lateDeduction || att.absenceDeduction ? (
                          <span className="text-rose-600 font-bold">
                            -PKR {((att.lateDeduction || 0) + (att.absenceDeduction || 0)).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      {isManager && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAttendanceCorrection(att)}
                            className="p-1 text-slate-400 hover:text-brand-600"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PERFORMANCE */}
      {activeTab === 'performance' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Performance Notes & Warnings</h2>
            {isManager && (
              <button
                type="button"
                onClick={() => setIsLogIncidentModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Log Incident / Coaching
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {performance.length === 0 ? (
              <p className="text-xs text-slate-400 italic col-span-2 text-center py-6">No performance notes recorded.</p>
            ) : (
              performance.map((p) => (
                <div key={p.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-gray-100">{p.title}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 capitalize">
                      {p.recordType}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-gray-400">{p.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PAYROLL */}
      {activeTab === 'payroll' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Salary History & Payslips</h2>
            <button
              type="button"
              onClick={() => setIsBankModalOpen(true)}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {bankDetails ? 'Edit Bank Account' : '+ Add Bank Account'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-dark-border text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3">Base Salary</th>
                  <th className="py-2.5 px-3">Late Cuts</th>
                  <th className="py-2.5 px-3">Absence Cuts</th>
                  <th className="py-2.5 px-3">Bonuses</th>
                  <th className="py-2.5 px-3">Net Pay</th>
                  <th className="py-2.5 px-3">Status</th>
                  {isManager && <th className="py-2.5 px-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                {payroll.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400 italic">No payroll records generated yet.</td>
                  </tr>
                ) : (
                  payroll.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-sidebar transition-colors">
                      <td className="py-2.5 px-3 font-semibold font-mono">{pay.payrollMonth || pay.payrollPeriod}</td>
                      <td className="py-2.5 px-3 font-mono">PKR {(pay.baseSalary ?? pay.grossSalary ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-rose-600">-PKR {(pay.lateDeductions ?? pay.lateDeductionsTotal ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-rose-600">-PKR {(pay.unapprovedAbsenceDeductions ?? pay.absenceDeductionsTotal ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-600">+PKR {(pay.bonuses || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">PKR {pay.netPayable.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize bg-emerald-50 text-emerald-700">
                          {pay.status}
                        </span>
                      </td>
                      {isManager && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPayrollRecord(pay)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
                          >
                            Adjust
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ASSETS */}
      {activeTab === 'assets' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Assigned Company Assets</h2>
            {isManager && (
              <button
                type="button"
                onClick={() => {
                  setEditingAsset(null);
                  setIsAssignAssetModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Asset
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assets.length === 0 ? (
              <p className="text-xs text-slate-400 italic col-span-2 text-center py-6">No assets assigned to this member.</p>
            ) : (
              assets.map((asset) => (
                <div key={asset.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-gray-100">{asset.assetName}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 capitalize">
                      {asset.status}
                    </span>
                  </div>
                  <div className="text-slate-500 font-mono">Tag: {asset.assetTag} • SN: {asset.serialNumber || 'N/A'}</div>
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Replacement Value:</span>
                    <span className="font-bold font-mono">PKR {(asset.replacementValue || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: DOCUMENTS & EMPLOYMENT */}
      {activeTab === 'documents' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Profile Change Requests & Audit History</h2>
          <div className="space-y-2 text-xs">
            {changeRequests.length === 0 ? (
              <p className="text-slate-400 italic py-4">No change requests on record.</p>
            ) : (
              changeRequests.map((req) => (
                <div key={req.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border flex justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 capitalize">{req.requestType.replace('_', ' ')}</span>
                    <span className="text-slate-500 block text-[11px]">{req.reason || 'No reason specified'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                    req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : req.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))
            )}
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
            staffList={[profile]}
            callerId={currentUserProfile.id}
            existingAsset={editingAsset}
            onSuccess={loadDossier}
          />

          <LogIncidentModal
            isOpen={isLogIncidentModalOpen}
            onClose={() => setIsLogIncidentModalOpen(false)}
            defaultEmployeeId={targetId || ''}
            callerId={currentUserProfile.id}
            onSuccess={loadDossier}
          />

          <BankDetailsModal
            isOpen={isBankModalOpen}
            onClose={() => setIsBankModalOpen(false)}
            employeeId={targetId || ''}
            existingBankDetails={bankDetails}
            onSuccess={loadDossier}
          />

          <AttendanceCorrectionModal
            isOpen={!!selectedAttendanceCorrection}
            onClose={() => setSelectedAttendanceCorrection(null)}
            attendance={selectedAttendanceCorrection?.id ? selectedAttendanceCorrection : null}
            employeeId={targetId || ''}
            callerId={currentUserProfile.id}
            onSuccess={loadDossier}
          />

          <PayrollAdjustmentModal
            isOpen={!!selectedPayrollRecord}
            onClose={() => setSelectedPayrollRecord(null)}
            payrollRecord={selectedPayrollRecord}
            employeeName={profile.fullName}
            callerId={currentUserProfile.id}
            onSuccess={loadDossier}
          />

          <FinalSettlementModal
            isOpen={isSettlementModalOpen}
            onClose={() => setIsSettlementModalOpen(false)}
            employee={profile}
            employeeRecord={record || null}
            assignedAssets={assets}
            callerId={currentUserProfile.id}
            onSuccess={loadDossier}
          />
        </>
      )}

      {/* Evidence Frame Preview */}
      {previewEvidenceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="p-4 flex items-center justify-between border-b border-slate-800 text-white">
              <span className="text-xs font-bold font-mono">Workstation Evidence Frame</span>
              <button
                type="button"
                onClick={() => setPreviewEvidenceUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ✕
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
