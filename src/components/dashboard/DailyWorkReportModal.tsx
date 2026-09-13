import React, { useState, useEffect } from 'react';
import {
  FileText, CheckCircle2, AlertCircle, Clock, Send,
  Briefcase, Plus, Trash2, ArrowRight
} from 'lucide-react';
import { UserProfile, EmployeeWorkReportTaskItem } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { taskManagementService } from '../../lib/taskManagementService';

interface DailyWorkReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
  onSuccess?: () => void;
  isCheckoutFlow?: boolean;
  onConfirmCheckoutWithoutReport?: () => void;
  onConfirmCheckoutWithReport?: () => void;
}

export const DailyWorkReportModal: React.FC<DailyWorkReportModalProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  onSuccess,
  isCheckoutFlow = false,
  onConfirmCheckoutWithoutReport,
  onConfirmCheckoutWithReport
}) => {
  const [summary, setSummary] = useState('');
  const [achievements, setAchievements] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextPlan, setNextPlan] = useState('');
  const [tasksList, setTasksList] = useState<EmployeeWorkReportTaskItem[]>([]);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load Today's Task Rollup & Existing Daily Report if any
  useEffect(() => {
    if (!isOpen || !currentUserProfile?.id) return;

    async function loadTodayData() {
      setIsLoadingDraft(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const [existingReport, workedTasks] = await Promise.all([
          employeeOperationsService.getTodayWorkReport(currentUserProfile!.id),
          taskManagementService.fetchTodayWorkedTasks(currentUserProfile!.id)
        ]);

        if (existingReport) {
          setSummary(existingReport.summary || '');
          setAchievements(existingReport.achievements || '');
          setBlockers(existingReport.blockersOrIncidents || '');
          setNextPlan(existingReport.nextPlan || '');
          setTasksList(existingReport.tasksSummary || []);
        } else {
          // Pre-populate tasks summary from today's work
          const autoTasks: EmployeeWorkReportTaskItem[] = workedTasks.map((t) => ({
            taskId: t.taskId,
            taskTitle: t.taskTitle,
            clientName: t.clientName,
            clientId: t.clientId,
            status: t.status,
            durationMinutes: t.durationMinutes
          }));
          setTasksList(autoTasks);

          if (autoTasks.length > 0) {
            const taskTitles = autoTasks.map((t) => `${t.taskTitle} (${t.clientName || 'Client'})`).join(', ');
            setSummary(`Completed work on: ${taskTitles}.`);
          } else {
            setSummary('Standard operational shift activities and daily tasks.');
          }
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to auto-generate report draft.');
      } finally {
        setIsLoadingDraft(false);
      }
    }

    loadTodayData();
  }, [isOpen, currentUserProfile?.id]);

  if (!isOpen) return null;

  const totalMinutesWorked = tasksList.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);
  const todayPeriod = employeeOperationsService.getTodayDatePKT();

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile?.id) return;

    if (!summary.trim()) {
      setErrorMessage('Please provide a brief summary of today’s work.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.submitWorkReport({
        employeeId: currentUserProfile.id,
        reportType: 'daily',
        period: todayPeriod,
        summary: summary.trim(),
        achievements: achievements.trim() || undefined,
        blockersOrIncidents: blockers.trim() || undefined,
        nextPlan: nextPlan.trim() || undefined,
        tasksSummary: tasksList,
        missingFlag: false
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage('Daily Work Report submitted successfully!');
        if (isCheckoutFlow && onConfirmCheckoutWithReport) {
          onConfirmCheckoutWithReport();
        } else {
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 600);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit daily report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipAndCheckout = async () => {
    if (!currentUserProfile?.id) return;
    setIsSubmitting(true);
    try {
      await employeeOperationsService.flagMissingDailyReport(currentUserProfile.id, todayPeriod);
      onConfirmCheckoutWithoutReport?.();
    } catch {
      onConfirmCheckoutWithoutReport?.();
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>Daily Work Report & Shift Rollup</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  {todayPeriod}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                {isCheckoutFlow
                  ? 'Please review today’s task activity and submit your daily report before clocking out.'
                  : 'Record today’s deliverables, achievements, and next day’s operational plan.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
          {/* Section 1: Tasks Worked On Today */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-brand-500" />
                <span>Today's Task Activity Summary</span>
              </span>
              <span className="text-[11px] font-mono text-gray-500 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{totalMinutesWorked} mins logged</span>
              </span>
            </div>

            {isLoadingDraft ? (
              <div className="py-4 text-center text-gray-400 italic">Aggregating today's tasks...</div>
            ) : tasksList.length === 0 ? (
              <div className="py-3 text-center text-gray-400 italic text-[11px]">
                No specific task time recorded today. You can still submit your manual summary below.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {tasksList.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border flex items-center justify-between gap-2"
                  >
                    <div className="truncate flex-1">
                      <div className="font-bold text-gray-900 dark:text-gray-100 truncate">{t.taskTitle}</div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-brand-600 dark:text-brand-400">{t.clientName}</span>
                        <span>•</span>
                        <span className="capitalize">{t.status}</span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0">
                      {t.durationMinutes || 0}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Summary of Work */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
              Summary of Work Accomplished <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Outline your primary tasks, deliverables submitted, and client outputs..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border outline-none focus:ring-2 focus:ring-brand-500/20 font-medium resize-none"
            />
          </div>

          {/* Section 3: Blockers / Incidents */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
              Blockers, Incidents, or Delays (Optional)
            </label>
            <textarea
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Detail any client communication delays, technical issues, or dependencies..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border outline-none focus:ring-2 focus:ring-brand-500/20 font-medium resize-none"
            />
          </div>

          {/* Section 4: Next Working Day Plan */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
              Plan for Next Working Day
            </label>
            <input
              type="text"
              value={nextPlan}
              onChange={(e) => setNextPlan(e.target.value)}
              placeholder="e.g. Finalize statics for Faseeh Lall, follow up with PPC Shark Force..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-dark-border">
            {isCheckoutFlow ? (
              <button
                type="button"
                onClick={handleSkipAndCheckout}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-rose-500 font-bold text-xs cursor-pointer py-1 order-2 sm:order-1"
              >
                Skip Report & Clock Out (Flag as Missing)
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-dark-100 cursor-pointer order-2 sm:order-1"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all shadow-md shadow-brand-500/25 cursor-pointer disabled:opacity-50 order-1 sm:order-2"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Submitting Report...'
                  : isCheckoutFlow
                  ? 'Submit Report & Clock Out'
                  : 'Submit Daily Report'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
