import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Copy, Check } from 'lucide-react';

interface CaseStudiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  caseStudiesText: string;
}

export const CaseStudiesModal: React.FC<CaseStudiesModalProps> = ({
  isOpen,
  onClose,
  companyName,
  caseStudiesText
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!caseStudiesText) return;
    try {
      await navigator.clipboard.writeText(caseStudiesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement('textarea');
      textarea.value = caseStudiesText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-studies-modal-title"
    >
      <div
        className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="case-studies-modal-title"
                data-testid="case-studies-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
              >
                Case Studies (Text)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {companyName || 'Client Workspace'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="case-studies-close-btn"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
            title="Close"
            aria-label="Close Case Studies viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed scrollbar-thin">
          {caseStudiesText && caseStudiesText.trim() ? (
            <div
              data-testid="case-studies-content-text"
              className="whitespace-pre-wrap font-sans bg-slate-50 dark:bg-dark-200/50 p-4 rounded-xl border border-slate-200 dark:border-dark-border text-slate-800 dark:text-slate-200"
            >
              {caseStudiesText}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <p>No Case Studies text has been recorded for this client yet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 sm:px-6 border-t border-slate-100 dark:border-dark-border bg-slate-50/50 dark:bg-dark-sidebar flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!caseStudiesText || !caseStudiesText.trim()}
            data-testid="case-studies-copy-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-200 hover:bg-slate-50 dark:hover:bg-dark-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Text</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
