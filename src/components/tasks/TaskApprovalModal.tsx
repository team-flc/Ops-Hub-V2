import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Link as LinkIcon, FileText, AlertCircle, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { ClientTask } from '../../types';
import { validateHttpsLink } from '../../lib/taskManagementService';

interface TaskApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { evidenceUrl?: string; completionNotes?: string }) => Promise<void>;
  task: ClientTask;
}

function formatCompact(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

export const TaskApprovalModal: React.FC<TaskApprovalModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  task
}) => {
  const [evidenceUrl, setEvidenceUrl] = useState(task.evidenceUrl || '');
  const [completionNotes, setCompletionNotes] = useState(task.completionNotes || '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalSeconds, setFinalSeconds] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    setEvidenceError(null);

    const hasEvidence = evidenceUrl.trim().length > 0;
    const hasNotes = completionNotes.trim().length > 0;

    // Mandatory: at least one must be provided
    if (!hasEvidence && !hasNotes) {
      setEvidenceError('At least a completion note or an evidence URL is required before submitting for approval.');
      return;
    }

    let sanitizedUrl: string | undefined = undefined;
    if (hasEvidence) {
      const validation = validateHttpsLink(evidenceUrl.trim());
      if (!validation.valid) {
        setUrlError(validation.error || 'Please enter a valid HTTPS URL.');
        return;
      }
      sanitizedUrl = validation.sanitized;
    }

    setIsSubmitting(true);
    try {
      // Compute live seconds for display before submitting
      let computedSecs = task.timeSpentSeconds || 0;
      if (task.timerStartedAt) {
        const startMs = new Date(task.timerStartedAt).getTime();
        if (!isNaN(startMs)) {
          computedSecs += Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        }
      }
      setFinalSeconds(computedSecs);

      await onSubmit({
        evidenceUrl: sanitizedUrl,
        completionNotes: completionNotes.trim() || undefined
      });
      setSubmitted(true);
      // Auto-close after brief "Work Completed" confirmation
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch {
      // Error handled in parent
      setFinalSeconds(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-200/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Submit Task for Approval
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-xs">
                {task.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success State */}
        {submitted ? (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-black text-gray-900 dark:text-gray-100">Work Completed</p>
              {finalSeconds !== null && finalSeconds > 0 && (
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5 justify-center">
                  <Clock className="w-4 h-4" />
                  Completed in: {formatCompact(finalSeconds)}
                  {(task.pausedSeconds || 0) > 0 && (
                    <span className="text-gray-400 font-normal text-xs ml-1">
                      · Paused: {formatCompact(task.pausedSeconds || 0)}
                    </span>
                  )}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Sent for management review. Moving to Approval…
              </p>
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30 text-purple-800 dark:text-purple-300 text-xs flex items-start gap-2">
              <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Submitting will permanently stop the timer and move this task to Approval. Management will review your deliverables.
              </span>
            </div>

            {/* Mandatory evidence notice */}
            {evidenceError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span data-testid="evidence-required-error">{evidenceError}</span>
              </div>
            )}

            {/* Drive / Evidence URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-brand-500" />
                <span>Google Drive / Evidence URL <span className="text-gray-400 font-normal">(required if no notes)</span></span>
              </label>
              <input
                type="url"
                data-testid="evidence-url-input"
                value={evidenceUrl}
                onChange={(e) => {
                  setEvidenceUrl(e.target.value);
                  if (urlError) setUrlError(null);
                  if (evidenceError) setEvidenceError(null);
                }}
                placeholder="https://drive.google.com/..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
                  urlError
                    ? 'border-rose-500 focus:ring-rose-500/20'
                    : evidenceError
                    ? 'border-rose-400/60 focus:ring-rose-500/20'
                    : 'border-gray-300 dark:border-dark-border focus:ring-brand-500/20 focus:border-brand-500'
                }`}
              />
              {urlError && (
                <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {urlError}
                </p>
              )}
            </div>

            {/* Completion Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-500" />
                <span>Completion Notes <span className="text-gray-400 font-normal">(required if no URL)</span></span>
              </label>
              <textarea
                data-testid="completion-notes-input"
                value={completionNotes}
                onChange={(e) => {
                  setCompletionNotes(e.target.value);
                  if (evidenceError) setEvidenceError(null);
                }}
                placeholder="Summarize deliverables, actions taken, or reviewer instructions…"
                rows={3}
                maxLength={2000}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none ${
                  evidenceError
                    ? 'border-rose-400/60'
                    : 'border-gray-300 dark:border-dark-border'
                }`}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200 dark:border-dark-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="submit-approval-confirm-btn"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting…' : 'Submit for Approval'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
