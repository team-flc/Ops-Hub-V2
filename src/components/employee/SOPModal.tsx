import React, { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, Clock, Camera, DollarSign, Laptop } from 'lucide-react';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface SOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onAcknowledged?: () => void;
}

export const SOPModal: React.FC<SOPModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  onAcknowledged
}) => {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAcknowledge = async () => {
    if (!agreed) {
      setErrorMessage('You must review and accept the SOP terms to proceed.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.acknowledgeSOP(employeeId, '1.0');
      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
      } else {
        setIsSubmitting(false);
        if (onAcknowledged) onAcknowledged();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record SOP acknowledgement.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border bg-gradient-to-r from-brand-50 to-indigo-50/40 dark:from-brand-950/30 dark:to-dark-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-md shadow-brand-500/25">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-gray-100">
                Company Standard Operating Procedures (SOP)
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Version 1.0 • Employee Operations Governance
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm text-slate-700 dark:text-gray-300 leading-relaxed">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* 1. Shift Timings & Late Policy */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-gray-100">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>1. Shift Timings, Punctuality & Late Arrival Policy</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                Standard shift timings are Morning Shift (11:00 AM – 8:00 PM PKT) and Night Shift (8:00 PM – 5:00 AM PKT). Employees must check in punctually at or before scheduled shift start time.
              </p>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-xs font-medium">
                <strong>Strict Late Policy:</strong> There is no grace period. Any check-in even 1 minute past shift start time constitutes a Late arrival and incurs a flat penalty deduction of <strong>PKR 500</strong> per late day without monthly cap.
              </div>
            </div>

            {/* 2. Screen Capture & Attendance Proof */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-gray-100">
                <Camera className="w-4 h-4 text-brand-600" />
                <span>2. Live Desktop Screen Capture & Attendance Evidence</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                When checking in and checking out, employees must select <strong>"Entire Screen"</strong> in the browser prompt to submit a live desktop capture of their active workstation. Fallback manual screenshot uploads require operational reason justification and audit. Screen captures are securely stored in Supabase storage and viewable solely by authorized Operations Management.
              </p>
            </div>

            {/* 3. Absence & Early Checkout */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-gray-100">
                <FileText className="w-4 h-4 text-brand-600" />
                <span>3. Unannounced Absence & 60-Minute Escalation</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                Failure to check in within 60 minutes after scheduled shift start generates an automatic missing check-in alert to Operations Management. Unapproved absences result in a full daily base salary deduction calculated by dividing monthly salary by the exact number of days in the month (e.g. 28, 29, 30, or 31 days).
              </p>
            </div>

            {/* 4. Company Assets Governance */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-gray-100">
                <Laptop className="w-4 h-4 text-brand-600" />
                <span>4. Company Assets & Equipment Governance</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                All company-issued equipment (laptops, accessories, accounts) must be acknowledged upon receipt and maintained in pristine working condition. In case of unreturned, damaged, or lost assets, replacement/repair costs will be deducted during monthly payroll or final offboarding settlement.
              </p>
            </div>

            {/* 5. Payroll Cycle & Bank Details Security */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-gray-100">
                <DollarSign className="w-4 h-4 text-brand-600" />
                <span>5. Payroll Cycle & Bank Security Governance</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                Payroll cycles run from the 1st to the final day of each calendar month. Salary disbursements are executed on the <strong>15th day of the subsequent month</strong>. To prevent fraudulent modifications, any updates to bank account or IBAN details require Operational Manager review and approval before becoming active for disbursements.
              </p>
            </div>
          </div>

          {/* Acknowledgement Checkbox */}
          <div className="pt-2 border-t border-slate-100 dark:border-dark-border">
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800/60 cursor-pointer hover:bg-brand-50 transition-colors">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-gray-200">
                I have read, understood, and agree to strictly comply with all Company Standard Operating Procedures, Attendance Policies, and Asset Governance rules detailed above.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-border bg-slate-50/50 dark:bg-dark-sidebar flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:text-slate-800 hover:bg-slate-200/50 dark:hover:bg-dark-100 rounded-xl transition-colors"
          >
            Review Later
          </button>
          <button
            type="button"
            disabled={!agreed || isSubmitting}
            onClick={handleAcknowledge}
            className="px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-brand-500/20 flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Acknowledge SOP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
