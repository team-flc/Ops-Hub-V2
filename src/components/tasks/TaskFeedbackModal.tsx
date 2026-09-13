import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, MessageSquare, AlertCircle } from 'lucide-react';
import { ClientTask } from '../../types';

interface TaskFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: string) => Promise<void>;
  task: ClientTask;
}

export const TaskFeedbackModal: React.FC<TaskFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  task
}) => {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) {
      setError('Please provide feedback notes explaining what revisions are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(feedback.trim());
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Return Task to In Progress
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
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              <span>Feedback & Requested Changes (Mandatory)</span>
            </label>
            <textarea
              data-testid="feedback-input"
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Explain the required revisions, missing deliverables, or instructions for the team member..."
              rows={4}
              maxLength={2000}
              autoFocus
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 resize-none ${
                error
                  ? 'border-rose-500 focus:ring-rose-500/20'
                  : 'border-gray-300 dark:border-dark-border focus:ring-amber-500/20 focus:border-amber-500'
              }`}
            />
            {error && (
              <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
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
              data-testid="submit-feedback-confirm-btn"
              disabled={isSubmitting || !feedback.trim()}
              className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md shadow-amber-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Returning...' : 'Return with Feedback'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
