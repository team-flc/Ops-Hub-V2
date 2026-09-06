import React, { useState, useEffect } from 'react';
import { X, Archive, AlertCircle, Loader2 } from 'lucide-react';
import { TaskTemplate } from '../../types';

interface ArchiveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  template: TaskTemplate | null;
}

export const ArchiveTemplateModal: React.FC<ArchiveTemplateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  template
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !template) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A mandatory archive reason is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive template.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-template-title"
    >
      <div
        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 id="archive-template-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
                Archive Template
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                v{template.version} • {template.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 leading-relaxed">
            Archiving removes this SOP from the active task picker. Existing tasks instantiated from this template will remain completely unaffected. You can restore this template at any time.
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="archive-reason-input" className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
              Reason for Archiving <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="archive-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Replaced by 2026 Q4 campaign strategy, or deprecated process..."
              required
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition-all"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Archive</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
