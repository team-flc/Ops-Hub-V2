import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle2, AlertCircle, X, Upload, FileCheck } from 'lucide-react';
import { EmployeePayrollRecord } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface PayrollAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollRecord: EmployeePayrollRecord | null;
  employeeName: string;
  callerId: string;
  onSuccess: () => void;
}

export const PayrollAdjustmentModal: React.FC<PayrollAdjustmentModalProps> = ({
  isOpen,
  onClose,
  payrollRecord,
  employeeName,
  callerId,
  onSuccess
}) => {
  const [bonuses, setBonuses] = useState<number>(0);
  const [allowances, setAllowances] = useState<number>(0);
  const [assetDeductions, setAssetDeductions] = useState<number>(0);
  const [otherAdjustments, setOtherAdjustments] = useState<number>(0);
  const [status, setStatus] = useState<EmployeePayrollRecord['status']>('draft');
  const [notes, setNotes] = useState('');
  
  // Payment proof upload
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (payrollRecord) {
      setBonuses(payrollRecord.bonuses || 0);
      setAllowances(payrollRecord.allowances || 0);
      setAssetDeductions(payrollRecord.assetDeductions || 0);
      setOtherAdjustments(payrollRecord.otherAdjustments || 0);
      setStatus(payrollRecord.status);
      setNotes(payrollRecord.notes || '');
      setProofFile(null);
    }
    setErrorMessage(null);
  }, [payrollRecord, isOpen]);

  if (!isOpen || !payrollRecord) return null;

  const baseSalaryVal = payrollRecord.baseSalary ?? payrollRecord.grossSalary ?? 0;
  const lateDeductionsVal = payrollRecord.lateDeductions ?? payrollRecord.lateDeductionsTotal ?? 0;
  const absenceDeductionsVal = payrollRecord.unapprovedAbsenceDeductions ?? payrollRecord.absenceDeductionsTotal ?? 0;

  // Real-time recalculated net pay
  const calculatedNetPay = (
    baseSalaryVal +
    bonuses +
    allowances -
    lateDeductionsVal -
    absenceDeductionsVal -
    assetDeductions +
    otherAdjustments
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let proofUrl: string | undefined = payrollRecord.paymentProofUrl || payrollRecord.paymentProofPath || undefined;

      // If proof file was attached, upload it
      if (proofFile) {
        const uploadRes = await employeeOperationsService.uploadPayrollProof(
          payrollRecord.id,
          proofFile,
          callerId
        );
        if (uploadRes.error) {
          setErrorMessage(uploadRes.error);
          setIsSubmitting(false);
          return;
        }
        proofUrl = uploadRes.path;
      }

      const res = await employeeOperationsService.updatePayrollRecord(payrollRecord.id, {
        bonuses,
        allowances,
        assetDeductions,
        otherAdjustments,
        netPayable: Math.max(0, calculatedNetPay),
        status,
        paidAt: (status === 'paid' || status === 'Paid') ? new Date().toISOString() : undefined,
        paymentProofUrl: proofUrl || undefined,
        notes: notes.trim() || undefined
      }, callerId);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update payroll.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                Adjust Payroll & Payment
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {employeeName} • {payrollRecord.payrollPeriod || payrollRecord.payrollMonth}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Locked Baseline Summary */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Base Salary</span>
              <span className="font-bold text-slate-800 dark:text-gray-200 font-mono">PKR {baseSalaryVal.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] text-rose-500 font-semibold uppercase block">Late Deductions</span>
              <span className="font-bold text-rose-600 font-mono">-PKR {lateDeductionsVal.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] text-rose-500 font-semibold uppercase block">Absence Cuts</span>
              <span className="font-bold text-rose-600 font-mono">-PKR {absenceDeductionsVal.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Bonus / Commission (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={bonuses}
                onChange={(e) => setBonuses(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Allowances / Reimbursement (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={allowances}
                onChange={(e) => setAllowances(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Asset Deductions (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={assetDeductions}
                onChange={(e) => setAssetDeductions(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Other Adjustments (+/- PKR)
              </label>
              <input
                type="number"
                value={otherAdjustments}
                onChange={(e) => setOtherAdjustments(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Payout Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
            >
              <option value="draft">Draft (Calculating)</option>
              <option value="approved">Approved (Ready for 15th Payout)</option>
              <option value="paid">Paid (Disbursed to Bank)</option>
              <option value="disputed">Disputed / Under Review</option>
            </select>
          </div>

          {/* Payment Proof Slip Upload */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Bank Payment Transfer Receipt (Optional/PDF/Image)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              />
              {payrollRecord.paymentProofUrl && !proofFile && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" /> Proof on file
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Notes & Justification
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Q3 Performance bonus PKR 10,000 added with Owner approval..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Net Payable Display Banner */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-white dark:bg-dark-sidebar border border-slate-800 dark:border-dark-border flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Calculated Net Payable:</span>
            <span className="text-base font-black font-mono text-emerald-400">
              PKR {Math.max(0, calculatedNetPay).toLocaleString()}
            </span>
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
                <span>Saving...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Adjustments</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
