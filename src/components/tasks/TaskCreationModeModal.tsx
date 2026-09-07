import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BookTemplate, FilePlus2, Sparkles, Layers } from 'lucide-react';
import { ClientRecord } from '../../types';

interface TaskCreationModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'service_template' | 'template' | 'blank', weekNumber: 1 | 2 | 3 | 4) => void;
  client: ClientRecord;
  weekNumber: 1 | 2 | 3 | 4;
}

export const TaskCreationModeModal: React.FC<TaskCreationModeModalProps> = ({
  isOpen,
  onClose,
  onSelectMode,
  client,
  weekNumber
}) => {
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(weekNumber);

  useEffect(() => {
    if (isOpen) {
      setSelectedWeek(weekNumber);
    }
  }, [isOpen, weekNumber]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creation-mode-title"
    >
      <div
        className="bg-white dark:bg-dark-card border-0 sm:border border-gray-200 dark:border-dark-border w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between bg-gray-50/50 dark:bg-dark-card/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase">
                Week {selectedWeek} Setup
              </span>
              <span className="text-xs text-gray-400 font-medium">for</span>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{client.companyName}</span>
            </div>
            <h2 id="creation-mode-title" className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
              Create Operational Task
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Workspace Week Selector */}
          <div>
            <label htmlFor="modal-week-select" className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Workspace Week <span className="text-brand-500">*</span>
            </label>
            <select
              id="modal-week-select"
              aria-label="Workspace Week"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value) as 1 | 2 | 3 | 4)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-sm text-gray-900 dark:text-gray-100 min-h-[44px]"
            >
              <option value={1}>Week 1</option>
              <option value={2}>Week 2</option>
              <option value={3}>Week 3</option>
              <option value={4}>Week 4</option>
            </select>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Choose how you would like to create this task. You can use standard operating procedures or create a custom task.
          </p>

          {/* Action Cards */}
          <div className="grid grid-cols-1 gap-3">
            {/* Start from Template */}
            <button
              type="button"
              onClick={() => onSelectMode('template', selectedWeek)}
              className="group relative p-4 rounded-xl border-2 border-brand-500/30 hover:border-brand-500 bg-brand-500/5 hover:bg-brand-500/10 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-left transition-all flex items-start gap-4 min-h-[72px] cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-brand-500 text-white shadow-md shadow-brand-500/20 shrink-0">
                <BookTemplate className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    Start from Template
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-brand-500 text-white flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> SOP
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                  Select from standardized SOP checklists with pre-configured approval modes and business-day SLAs.
                </p>
              </div>
            </button>

            {/* Apply Multi-Task Service Template (Phase 3D) */}
            <button
              type="button"
              onClick={() => onSelectMode('service_template', selectedWeek)}
              className="group relative p-4 rounded-xl border border-gray-200 dark:border-dark-border hover:border-brand-500/50 bg-white hover:bg-gray-50/50 dark:bg-dark-100/50 dark:hover:bg-dark-100 text-left transition-all flex items-start gap-4 min-h-[72px] cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    Apply Service Template
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    Multi-Task
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  Bulk launch a full multi-task service package into Draft, Unassigned tasks.
                </p>
              </div>
            </button>

            {/* Create Blank Task */}
            <button
              type="button"
              onClick={() => onSelectMode('blank', selectedWeek)}
              className="group p-4 rounded-xl border border-gray-200 dark:border-dark-border hover:border-gray-400 dark:hover:border-gray-600 bg-white hover:bg-gray-50/50 dark:bg-dark-100/50 dark:hover:bg-dark-100 text-left transition-all flex items-start gap-4 min-h-[72px] cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300 shrink-0">
                <FilePlus2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Create Blank Task
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  Start with a clean slate and configure task details, department, dates, and assignee manually.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/30 dark:bg-dark-card/30 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors min-h-[44px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};