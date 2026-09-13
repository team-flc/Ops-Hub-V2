import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Link as LinkIcon, FileText, AlertCircle, Sparkles } from 'lucide-react';
import { ClientTask } from '../../types';
import { validateHttpsLink } from '../../lib/taskManagementService';

interface TaskApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { evidenceUrl?: string; completionNotes?: string }) => Promise<void>;
  task: ClientTask;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    let sanitizedUrl: string | undefined = undefined;
    if (evidenceUrl.trim()) {
      const validation = validateHttpsLink(evidenceUrl.trim());
      if (!validation.valid) {
        setUrlError(validation.error || 'Please enter a valid HTTPS URL.');
        return;
      }
      sanitizedUrl = validation.sanitized;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        evidenceUrl: sanitizedUrl,
        completionNotes: completionNotes.trim() || undefined
      });
      onClose();
    } catch {
      // Error handled in parent
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30 text-purple-800 dark:text-purple-300 text-xs flex items-start gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Submitting this task for approval will automatically stop and record your active timer. Management will review deliverables.
            </span>
          </div>

          {/* Drive / Evidence URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-brand-500" />
              <span>Google Drive / Evidence Deliverable URL (Optional)</span>
            </label>
            <input
              type="url"
              data-testid="evidence-url-input"
              value={evidenceUrl}
              onChange={(e) => {
                setEvidenceUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="https://drive.google.com/..."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
                urlError
                  ? 'border-rose-500 focus:ring-rose-500/20'
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
              <span>Completion Notes & Summary (Optional)</span>
            </label>
            <textarea
              data-testid="completion-notes-input"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Summarize key deliverables, actions taken, or instructions for the reviewer..."
              rows={3}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border text-xs bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
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
              <span>{isSubmitting ? 'Submitting...' : 'Submit to Approval'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
