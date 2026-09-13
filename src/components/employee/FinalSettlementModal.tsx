import React, { useState, useEffect } from 'react';
import { 
  Calculator, CheckCircle2, AlertCircle, X, DollarSign, 
  Laptop, Calendar, UserCheck, ArrowRight, ArrowLeft, ShieldCheck, 
  AlertTriangle, FileText, Info
} from 'lucide-react';
import { CompanyAsset, EmployeeRecord, TeamMemberRecord, UserProfile, NoticePeriodStatus, GoodStandingStatus } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { getPKTTodayDateString } from '../../lib/pktDateUtils';

interface FinalSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: TeamMemberRecord | UserProfile | null;
  employeeRecord: EmployeeRecord | null;
  assignedAssets?: CompanyAsset[];
  callerId: string;
  onSuccess: () => void;
}

export const FinalSettlementModal: React.FC<FinalSettlementModalProps> = ({
  isOpen,
  onClose,
  employee,
  employeeRecord,
  assignedAssets = [],
  callerId,
  onSuccess
}) => {
  // Step State: 'input' or 'review'
  const [step, setStep] = useState<'input' | 'review'>('input');

  const [separationReason, setSeparationReason] = useState<'resignation' | 'termination' | 'end_of_contract' | 'mutual_agreement' | 'other'>('resignation');
  const [lastWorkingDate, setLastWorkingDate] = useState(getPKTTodayDateString());
  const [noticePeriodStatus, setNoticePeriodStatus] = useState<NoticePeriodStatus>('served');
  const [goodStandingStatus, setGoodStandingStatus] = useState<GoodStandingStatus>('good_standing');

  // Financial fields
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [pendingPreviousSalary, setPendingPreviousSalary] = useState<number>(0);
  const [currentMonthAccruedSalary, setCurrentMonthAccruedSalary] = useState<number>(0);
  const [heldPendingAmount, setHeldPendingAmount] = useState<number>(0);
  const [lateDeductions, setLateDeductions] = useState<number>(0);
  const [unapprovedAbsenceDeductions, setUnapprovedAbsenceDeductions] = useState<number>(0);
  const [assetRecoveryDeductions, setAssetRecoveryDeductions] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [severanceBonus, setSeveranceBonus] = useState<number>(0);
  const [deductionReasonNotes, setDeductionReasonNotes] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize and estimate financial amounts
  useEffect(() => {
    if (employeeRecord && isOpen) {
      const salary = Number(employeeRecord.salary || 0);
      setBaseSalary(salary);

      // Estimate current accrued salary based on day of month in PKT
      const today = new Date(lastWorkingDate);
      const dayOfMonth = today.getDate();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const totalDaysInMonth = new Date(year, month, 0).getDate();

      const accrued = Math.round((salary / totalDaysInMonth) * dayOfMonth);
      setCurrentMonthAccruedSalary(accrued);

      // Unreturned asset recovery deduction
      const unreturnedAssets = assignedAssets.filter(a => a.status === 'assigned' || a.status === 'damaged' || a.status === 'lost');
      const unreturnedVal = unreturnedAssets.reduce((sum, a) => sum + (a.replacementValue ?? a.price ?? 0), 0);
      setAssetRecoveryDeductions(unreturnedVal);

      // Held earned salary starts at 0 without unapproved percentage penalties
      setHeldPendingAmount(0);
    }
    setStep('input');
    setErrorMessage(null);
  }, [employeeRecord, lastWorkingDate, assignedAssets, isOpen, noticePeriodStatus, goodStandingStatus]);

  if (!isOpen || !employee) return null;

  // 8-Component Formula: Held pending salary is EARNED compensation (+) added to total gross earnings
  const totalAdditions = pendingPreviousSalary + currentMonthAccruedSalary + heldPendingAmount + severanceBonus;
  const totalDeductions = lateDeductions + unapprovedAbsenceDeductions + assetRecoveryDeductions + otherDeductions;
  const netFinalPayable = Math.max(0, totalAdditions - totalDeductions);

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastWorkingDate) {
      setErrorMessage('Please select a valid Last Working Date.');
      return;
    }
    setErrorMessage(null);
    setStep('review');
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.calculateFinalSettlement({
        employeeId: employee.id,
        separationReason,
        lastWorkingDate,
        noticePeriodStatus,
        goodStandingStatus,
        pendingPreviousSalary,
        currentMonthAccruedSalary,
        heldPendingAmount,
        lateDeductions,
        unapprovedAbsenceDeductions,
        assetRecoveryDeductions,
        otherDeductions,
        severanceBonus,
        netFinalPayable,
        deductionReasonNotes: deductionReasonNotes.trim() || undefined,
        notes: notes.trim() || undefined
      }, callerId);

      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
      } else {
        setIsSubmitting(false);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process final settlement.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center border border-brand-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <span>Final Settlement & Offboarding</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-300 uppercase tracking-wider">
                  Step {step === 'input' ? '1/2: Calculate' : '2/2: Authorize'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {employee.fullName} ({employee.workEmail}) • Base: PKR {baseSalary.toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: INPUT CALCULATION FORM */}
        {step === 'input' && (
          <form onSubmit={handleProceedToReview} className="p-6 overflow-y-auto flex-1 space-y-6">
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Separation & Notice Governance */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                <span>1. Separation & Notice Governance</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                    Separation Reason
                  </label>
                  <select
                    value={separationReason}
                    onChange={(e) => setSeparationReason(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
                  >
                    <option value="resignation">Resignation</option>
                    <option value="termination">Termination</option>
                    <option value="end_of_contract">End of Contract</option>
                    <option value="mutual_agreement">Mutual Agreement</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                    Last Working Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={lastWorkingDate}
                    onChange={(e) => setLastWorkingDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                    Notice Period Status
                  </label>
                  <select
                    value={noticePeriodStatus}
                    onChange={(e) => setNoticePeriodStatus(e.target.value as NoticePeriodStatus)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="served">Served in Full (Clear)</option>
                    <option value="waived">Waived by Company</option>
                    <option value="short_served">Short-Served (Hold 50%)</option>
                    <option value="not_served">Not Served (Withhold Salary)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                    Good Standing Status
                  </label>
                  <select
                    value={goodStandingStatus}
                    onChange={(e) => setGoodStandingStatus(e.target.value as GoodStandingStatus)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="good_standing">Good Standing (Standard Release)</option>
                    <option value="disputed">Disputed / Audit Pending</option>
                    <option value="terminated_for_cause">Terminated for Cause</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Asset Clearance Notice */}
            {assignedAssets.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <Laptop className="w-4 h-4 text-amber-600" />
                  <span>Assigned Company Property ({assignedAssets.length} item(s)):</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300 pl-1">
                  {assignedAssets.map((a) => (
                    <li key={a.id}>
                      {a.assetName || a.itemName} ({a.assetTag || a.itemName}) - Replacement Value: PKR {(a.replacementValue ?? a.price ?? 0).toLocaleString()} [{a.status}]
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 2. Financial Breakdown Grid */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300 flex items-center justify-between">
                <span>2. Settlement Financial Components (PKR)</span>
                <span className="text-[10px] font-mono text-slate-400">8-Component Formula</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                    Pending Previous Unpaid Salary (+)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pendingPreviousSalary}
                    onChange={(e) => setPendingPreviousSalary(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                    Current Month Accrued Salary (+)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentMonthAccruedSalary}
                    onChange={(e) => setCurrentMonthAccruedSalary(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                    Severance / Gratuity / Bonus Additions (+)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={severanceBonus}
                    onChange={(e) => setSeveranceBonus(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    Late Arrivals Deduction (PKR 500/day) (-)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lateDeductions}
                    onChange={(e) => setLateDeductions(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    Unapproved Absence Deduction (-)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={unapprovedAbsenceDeductions}
                    onChange={(e) => setUnapprovedAbsenceDeductions(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    Asset Recovery / Unreturned Property (-)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={assetRecoveryDeductions}
                    onChange={(e) => setAssetRecoveryDeductions(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Held Pending Earned Salary (+)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={heldPendingAmount}
                    onChange={(e) => setHeldPendingAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-emerald-700 dark:text-emerald-300 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                    Other Deductions / Adjustments (-)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={otherDeductions}
                    onChange={(e) => setOtherDeductions(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              {/* Total Net Payable Banner */}
              <div className="p-4 rounded-xl bg-brand-600 text-white flex items-center justify-between shadow-md">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-200 block">
                    Estimated Net Final Payable
                  </span>
                  <span className="text-xl font-black font-mono">
                    PKR {netFinalPayable.toLocaleString()}
                  </span>
                </div>
                <DollarSign className="w-8 h-8 text-brand-300 opacity-70" />
              </div>
            </div>

            {/* Notes & Deduction Reasons */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Deduction Reason Notes (Audit Justification)
                </label>
                <input
                  type="text"
                  value={deductionReasonNotes}
                  onChange={(e) => setDeductionReasonNotes(e.target.value)}
                  placeholder="e.g. Asset tag LAP-001 lost, 2 unapproved absences in August..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Clearance Notes & Handover Remarks
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Email account revoked, credentials disabled, knowledge transfer complete..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-dark-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-2"
              >
                <span>Proceed to Review Summary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: AUTHORITATIVE REVIEW SUMMARY SCREEN */}
        {step === 'review' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Overview Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-gray-100">Separation Governance</span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                    {separationReason.replace('_', ' ')}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    goodStandingStatus === 'good_standing' 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}>
                    {goodStandingStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Last Working Day</span>
                  <div className="font-mono font-bold text-slate-800 dark:text-gray-200">{lastWorkingDate}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Notice Status</span>
                  <div className="font-bold text-slate-800 dark:text-gray-200 capitalize">{noticePeriodStatus.replace('_', ' ')}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Base Reference</span>
                  <div className="font-mono font-bold text-slate-800 dark:text-gray-200">PKR {baseSalary.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Assets Status</span>
                  <div className="font-bold text-slate-800 dark:text-gray-200">{assignedAssets.length === 0 ? 'No Assets' : `${assignedAssets.length} Registered`}</div>
                </div>
              </div>
            </div>

            {/* 8-Component Breakdown Table */}
            <div className="border border-slate-200 dark:border-dark-border rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-dark-sidebar border-b border-slate-200 dark:border-dark-border text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Settlement Component</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200">1. Pending Previous Period Unpaid Salary</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">+ Addition</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-emerald-600">PKR {pendingPreviousSalary.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200">2. Current Month Accrued Salary</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">+ Addition</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-emerald-600">PKR {currentMonthAccruedSalary.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200">3. Held Pending Earned Salary</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">+ Addition</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-emerald-600">PKR {heldPendingAmount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200">4. Severance / Gratuity / Bonus Additions</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">+ Addition</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-emerald-600">PKR {severanceBonus.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200">5. Late Arrivals Penalty (PKR 500/day)</td>
                    <td className="py-2.5 px-3 text-rose-600 font-bold">- Deduction</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-rose-600">-PKR {lateDeductions.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200">6. Unapproved Absence Salary Cuts</td>
                    <td className="py-2.5 px-3 text-rose-600 font-bold">- Deduction</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-rose-600">-PKR {unapprovedAbsenceDeductions.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200">7. Asset Recovery / Damaged Property</td>
                    <td className="py-2.5 px-3 text-rose-600 font-bold">- Deduction</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-rose-600">-PKR {assetRecoveryDeductions.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-gray-200">8. Other Adjustments / Deductions</td>
                    <td className="py-2.5 px-3 text-rose-600 font-bold">- Deduction</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-rose-600">-PKR {otherDeductions.toLocaleString()}</td>
                  </tr>
                  <tr className="bg-brand-50/50 dark:bg-brand-950/20 font-black">
                    <td className="py-3.5 px-3 text-slate-900 dark:text-gray-100 text-sm">TOTAL NET FINAL PAYABLE</td>
                    <td className="py-3.5 px-3 text-brand-700 dark:text-brand-300 uppercase text-[10px]">Authoritative</td>
                    <td className="py-3.5 px-3 font-mono text-base text-right text-brand-700 dark:text-brand-300">PKR {netFinalPayable.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Remarks Display */}
            {(deductionReasonNotes || notes) && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border text-xs space-y-1.5">
                {deductionReasonNotes && (
                  <div>
                    <span className="font-bold text-slate-700 dark:text-gray-300">Audit Deductions Justification: </span>
                    <span className="text-slate-600 dark:text-gray-400">{deductionReasonNotes}</span>
                  </div>
                )}
                {notes && (
                  <div>
                    <span className="font-bold text-slate-700 dark:text-gray-300">Clearance / Handover Remarks: </span>
                    <span className="text-slate-600 dark:text-gray-400">{notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-dark-border">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Edit</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span>Authorizing Settlement...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize & Archive Settlement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
