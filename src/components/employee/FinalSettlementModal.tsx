import React, { useState, useEffect } from 'react';
import { Calculator, CheckCircle2, AlertCircle, X, DollarSign, Laptop, Calendar, UserCheck } from 'lucide-react';
import { CompanyAsset, EmployeeRecord, TeamMemberRecord, UserProfile } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

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
  const [separationReason, setSeparationReason] = useState<'resignation' | 'termination' | 'contract_end' | 'mutual_agreement'>('resignation');
  const [lastWorkingDate, setLastWorkingDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Financial fields
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [pendingPreviousSalary, setPendingPreviousSalary] = useState<number>(0);
  const [currentMonthAccruedSalary, setCurrentMonthAccruedSalary] = useState<number>(0);
  const [lateDeductions, setLateDeductions] = useState<number>(0);
  const [unapprovedAbsenceDeductions, setUnapprovedAbsenceDeductions] = useState<number>(0);
  const [assetRecoveryDeductions, setAssetRecoveryDeductions] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [severanceBonus, setSeveranceBonus] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (employeeRecord) {
      const salary = Number(employeeRecord.salary || 0);
      setBaseSalary(salary);

      // Estimate current accrued salary based on day of month
      const today = new Date(lastWorkingDate);
      const dayOfMonth = today.getDate();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const totalDaysInMonth = new Date(year, month, 0).getDate();

      const accrued = Math.round((salary / totalDaysInMonth) * dayOfMonth);
      setCurrentMonthAccruedSalary(accrued);

      // Estimate unreturned asset deduction
      const unreturnedAssets = assignedAssets.filter(a => a.status === 'assigned');
      const unreturnedVal = unreturnedAssets.reduce((sum, a) => sum + (a.replacementValue ?? a.price ?? 0), 0);
      setAssetRecoveryDeductions(unreturnedVal);
    }
    setErrorMessage(null);
  }, [employeeRecord, lastWorkingDate, assignedAssets, isOpen]);

  if (!isOpen || !employee) return null;

  // Net Final Settlement Payable Formula
  const netFinalPayable = (
    pendingPreviousSalary +
    currentMonthAccruedSalary +
    severanceBonus -
    lateDeductions -
    unapprovedAbsenceDeductions -
    assetRecoveryDeductions -
    otherDeductions
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.calculateFinalSettlement({
        employeeId: employee.id,
        separationReason,
        lastWorkingDate,
        pendingPreviousSalary,
        currentMonthAccruedSalary,
        lateDeductions,
        unapprovedAbsenceDeductions,
        assetRecoveryDeductions,
        otherDeductions,
        severanceBonus,
        netFinalPayable: Math.max(0, netFinalPayable),
        notes: notes.trim() || undefined
      }, callerId);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process final settlement.');
    } finally {
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
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                Final Settlement & Offboarding
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {employee.fullName} ({employee.workEmail})
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Separation Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>1. Separation Details</span>
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

          {/* Financial Breakdown Grid */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
              Settlement Financial Calculation (PKR)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                  Pending Previous Unpaid Salary
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
                  Current Month Accrued Salary
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
                <label className="block text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  Late Arrivals Deduction (PKR 500/day)
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
                  Unapproved Absence Deduction
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
                  Asset Recovery / Unreturned Equipment
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
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                  Severance / Gratuity / Bonus Additions
                </label>
                <input
                  type="number"
                  min="0"
                  value={severanceBonus}
                  onChange={(e) => setSeveranceBonus(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono"
                />
              </div>
            </div>

            {/* Total Net Payable Banner */}
            <div className="p-4 rounded-xl bg-brand-600 text-white flex items-center justify-between shadow-md">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-200 block">
                  Net Final Payable Settlement
                </span>
                <span className="text-xl font-black font-mono">
                  PKR {Math.max(0, netFinalPayable).toLocaleString()}
                </span>
              </div>
              <DollarSign className="w-8 h-8 text-brand-300 opacity-70" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Clearance Notes & Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Email account revoked, credentials disabled, knowledge transfer handover complete..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
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
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Generate & Approve Settlement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
