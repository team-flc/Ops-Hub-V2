import React, { useState } from 'react';
import { FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { EmployeeWorkReport } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface SubmitWorkReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  defaultReportType?: 'weekly' | 'monthly';
  onSuccess: () => void;
}

export const SubmitWorkReportModal: React.FC<SubmitWorkReportModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  defaultReportType = 'weekly',
  onSuccess
}) => {
  const [reportType, setReportType] = useState<'weekly' | 'monthly'>(defaultReportType);
  const [period, setPeriod] = useState(
    defaultReportType === 'weekly'
      ? `${new Date().getFullYear()}-W${Math.ceil((new Date().getDate() + 6) / 7)}`
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [summary, setSummary] = useState('');
  const [achievements, setAchievements] = useState('');
  const [blockersOrIncidents, setBlockersOrIncidents] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !period.trim()) {
      setErrorMessage('Period and Summary are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.submitWorkReport({
        employeeId,
        reportType,
        period: period.trim(),
        summary: summary.trim(),
        achievements: achievements.trim() || undefined,
        blockersOrIncidents: blockersOrIncidents.trim() || undefined
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center border border-brand-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">Submit Work Report</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">Weekly progress & monthly deliverable summary</p>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => {
                  const t = e.target.value as 'weekly' | 'monthly';
                  setReportType(t);
                  setPeriod(
                    t === 'weekly'
                      ? `${new Date().getFullYear()}-W${Math.ceil((new Date().getDate() + 6) / 7)}`
                      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                  );
                }}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="weekly">Weekly Report</option>
                <option value="monthly">Monthly Report</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">Period (e.g. 2026-W37 / 2026-09)</label>
              <input
                type="text"
                required
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Executive Summary & Scope Accomplished <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Outline primary tasks, client milestones completed, and operations handled..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">Key Achievements / Highlights</label>
            <textarea
              rows={2}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder="Special accomplishments, client commendations, speed optimizations..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">Blockers, Incidents or Support Needed</label>
            <textarea
              rows={2}
              value={blockersOrIncidents}
              onChange={(e) => setBlockersOrIncidents(e.target.value)}
              placeholder="Any tooling issues, client bottlenecks, or operational blockers..."
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
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
