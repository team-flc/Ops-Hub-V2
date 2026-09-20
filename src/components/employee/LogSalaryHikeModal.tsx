import React, { useState } from 'react';
import { TrendingUp, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface LogSalaryHikeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  currentSalary: number;
  callerId: string;
  onSuccess: () => void;
}

export const LogSalaryHikeModal: React.FC<LogSalaryHikeModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  currentSalary,
  callerId,
  onSuccess
}) => {
  const [newSalary, setNewSalary] = useState(currentSalary > 0 ? currentSalary + 10000 : 100000);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalary || newSalary <= 0 || !reason.trim() || !effectiveDate) {
      setErrorMessage('New Salary (> 0), Effective Date, and Reason are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.logSalaryHike({
        employeeId,
        previousSalary: currentSalary,
        newSalary,
        effectiveDate,
        reason: reason.trim()
      }, callerId);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to log salary hike.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const delta = newSalary - currentSalary;
  const pct = currentSalary > 0 ? ((delta / currentSalary) * 100).toFixed(1) : '100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">Log Salary Increment / Hike</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">Formal compensation revision with audit trail</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Current Base Salary:</span>
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-gray-100">
                PKR {currentSalary.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Increase / Delta:</span>
              <span className={`text-sm font-bold font-mono ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {delta >= 0 ? '+' : ''}PKR {delta.toLocaleString()} ({pct}%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                New Base Salary (PKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1000"
                step="1000"
                value={newSalary}
                onChange={(e) => setNewSalary(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Effective Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Reason / Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual performance review, promotion to Lead Designer, exceptional client retention..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

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
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording...' : 'Record Salary Increment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
