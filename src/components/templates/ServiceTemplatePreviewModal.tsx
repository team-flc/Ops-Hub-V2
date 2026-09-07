import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, Clock, ShieldCheck, Building2, Calendar } from 'lucide-react';
import { ServiceTemplate } from '../../types';

interface ServiceTemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: ServiceTemplate | null;
}

export const ServiceTemplatePreviewModal: React.FC<ServiceTemplatePreviewModalProps> = ({
  isOpen,
  onClose,
  template
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !template) return null;

  const taskCount = template.tasks.length;
  const taskCountLabel = `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-template-title"
    >
      <div
        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-dark-border flex items-start justify-between bg-gray-50/50 dark:bg-dark-card/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0 mt-0.5 border border-brand-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wider">
                  {template.serviceLabel}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-100 text-gray-600 dark:text-gray-300 text-[10px] font-bold">
                  v{template.version}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  template.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-gray-200 text-gray-600 dark:bg-dark-200 dark:text-gray-400'
                }`}>
                  {template.status}
                </span>
              </div>
              <h2 id="preview-template-title" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {template.name}
              </h2>
              {template.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {template.description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tasks List */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-dark-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Ordered Package Tasks ({taskCountLabel})
            </h3>
            <span className="text-[11px] text-gray-400">
              Creates {taskCountLabel} on launch
            </span>
          </div>

          <div className="space-y-3">
            {template.tasks.map((task, idx) => (
              <div
                key={task.id || task.definitionId || idx}
                className="p-4 rounded-2xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-100/30 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-dark-200 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {task.title}
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300">
                    {task.priority} Priority
                  </span>
                </div>

                {task.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 pl-8 leading-relaxed whitespace-pre-wrap">
                    {task.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pl-8 text-[11px] text-gray-500 pt-1">
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span>{task.departmentName || 'Department'}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{task.durationBusinessDays} business {task.durationBusinessDays === 1 ? 'day' : 'days'}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>Offset: Day {task.plannedOffsetDays}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                    <span>{task.approvalMode}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold transition-all min-h-[44px] cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
