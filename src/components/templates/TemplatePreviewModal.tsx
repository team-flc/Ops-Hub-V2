import React from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, ShieldCheck, Tag, CheckSquare, ArrowRight } from 'lucide-react';
import { TaskTemplate } from '../../types';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: TaskTemplate | null;
  onUseTemplate?: (template: TaskTemplate) => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  isOpen,
  onClose,
  template,
  onUseTemplate
}) => {
  if (!isOpen || !template) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-preview-title"
    >
      <div
        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-start justify-between bg-gray-50/50 dark:bg-dark-card/50">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wider">
                v{template.version} SOP Template
              </span>
              {template.departmentName && (
                <span className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-dark-200 text-gray-700 dark:text-gray-300 text-[10px] font-bold">
                  {template.departmentName}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  template.status === 'Active'
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-dark-100 dark:text-gray-400 border border-gray-200 dark:border-dark-border'
                }`}
              >
                {template.status}
              </span>
            </div>
            <h2 id="template-preview-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {template.name}
            </h2>
            {template.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {template.description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-sm text-gray-800 dark:text-gray-200">
          {/* Metadata Specs Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-100 dark:border-dark-border">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-brand-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">SLA Duration</p>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {template.suggestedDurationDays} Business Days
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Approval Flow</p>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {template.defaultApprovalMode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Tag className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Default Priority</p>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {template.defaultPriority}
                </p>
              </div>
            </div>
          </div>

          {/* Default Task Title */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Default Task Title
            </label>
            <div className="p-3 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border font-semibold text-gray-900 dark:text-gray-100">
              {template.defaultTaskTitle}
            </div>
          </div>

          {/* SOP Checklist / Markdown Details */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="w-4 h-4 text-brand-500" />
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                SOP Checklist & Execution Guidelines
              </label>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
              {template.taskDetails || 'No SOP details provided for this template.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            Close
          </button>

          {onUseTemplate && template.status === 'Active' && (
            <button
              type="button"
              onClick={() => {
                onUseTemplate(template);
                onClose();
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[44px] cursor-pointer"
            >
              <span>Use This Template</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
