import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Filter, BookTemplate, Clock, ShieldCheck, Tag, ArrowRight, Eye, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { ClientRecord, Department, TaskTemplate } from '../../types';
import { taskTemplateService } from '../../lib/taskTemplateService';
import { TemplatePreviewModal } from '../templates/TemplatePreviewModal';

interface TaskTemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TaskTemplate) => void;
  onCreateBlankInstead: () => void;
  client: ClientRecord;
  weekNumber: 1 | 2 | 3 | 4;
  departments: Department[];
}

export const TaskTemplatePickerModal: React.FC<TaskTemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onCreateBlankInstead,
  client,
  weekNumber,
  departments
}) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [previewTemplate, setPreviewTemplate] = useState<TaskTemplate | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadTemplates() {
      setIsLoading(true);
      setError(null);
      setIsUnavailable(false);

      try {
        const res = await taskTemplateService.fetchTemplates(false);
        if (!isMounted) return;

        if (res.isUnavailable) {
          setIsUnavailable(true);
        }
        if (res.error) {
          setError(res.error);
        }
        setTemplates(res.data || []);
      } catch (err: any) {
        if (!isMounted) return;
        setIsUnavailable(true);
        setError(err?.message || 'Unable to load task templates.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTemplates();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filter templates by search and department
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      // Must be Active
      if (tpl.status !== 'Active') return false;

      // Department filter
      if (selectedDepartmentId !== 'all' && tpl.departmentId !== selectedDepartmentId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = tpl.name.toLowerCase().includes(q);
        const matchTitle = tpl.defaultTaskTitle.toLowerCase().includes(q);
        const matchDesc = tpl.description?.toLowerCase().includes(q) || false;
        const matchDetails = tpl.taskDetails?.toLowerCase().includes(q) || false;
        const matchDept = tpl.departmentName?.toLowerCase().includes(q) || false;
        if (!matchName && !matchTitle && !matchDesc && !matchDetails && !matchDept) {
          return false;
        }
      }

      return true;
    });
  }, [templates, selectedDepartmentId, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
      >
        <div
          className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between bg-gray-50/50 dark:bg-dark-card/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase">
                  Week {weekNumber} Setup
                </span>
                <span className="text-xs text-gray-400 font-medium">for</span>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{client.companyName}</span>
              </div>
              <h2 id="template-picker-title" className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                Select Task Template
              </h2>
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

          {/* Search & Filter Controls */}
          <div className="p-4 border-b border-gray-100 dark:border-dark-border bg-gray-50/30 dark:bg-dark-100/30 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search templates by name, title, or SOP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                aria-label="Filter by department"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {/* Backend Unavailable Notice */}
            {isUnavailable && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-xs font-bold">Template library is currently synchronizing or awaiting backend rollout.</p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    You can continue creating your operational task directly without delay.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && !isUnavailable && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Loading State */}
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                <span className="text-xs font-medium">Loading templates...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <BookTemplate className="w-8 h-8 mx-auto text-gray-400 opacity-60" />
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {isUnavailable ? 'Template library unavailable' : 'No matching templates found'}
                </h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  {isUnavailable
                    ? 'Templates will be available following backend database deployment.'
                    : searchQuery || selectedDepartmentId !== 'all'
                    ? 'Try adjusting your search query or department filter.'
                    : 'No active templates are currently configured in the library.'}
                </p>
                {!isUnavailable && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onCreateBlankInstead}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-100 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300 text-xs font-bold transition-colors"
                    >
                      Create Blank Task Instead
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:border-brand-500/50 dark:hover:border-brand-500/50 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-dark-100 text-gray-700 dark:text-gray-300">
                          {template.departmentName || 'Department'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-400">
                          v{template.version}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                        {template.name}
                      </h4>

                      {template.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {template.description}
                        </p>
                      )}

                      {/* Specs pills */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {template.suggestedDurationDays}d SLA
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                            template.defaultApprovalMode === 'Client Approval Required'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <ShieldCheck className="w-2.5 h-2.5" /> {template.defaultApprovalMode}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" /> {template.defaultPriority}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-4 mt-3 border-t border-gray-100 dark:border-dark-border flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewTemplate(template)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview SOP</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectTemplate(template)}
                        className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                      >
                        <span>Use Template</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/50 flex items-center justify-between">
            {!isUnavailable ? (
              <>
                <button
                  type="button"
                  onClick={onCreateBlankInstead}
                  className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-brand-500 underline underline-offset-2 transition-colors"
                >
                  Or create a blank task manually
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className="flex items-center justify-end gap-2 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onCreateBlankInstead}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Create Blank Task Instead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SOP Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          isOpen={Boolean(previewTemplate)}
          onClose={() => setPreviewTemplate(null)}
          template={previewTemplate}
          onUseTemplate={(tpl) => {
            setPreviewTemplate(null);
            onSelectTemplate(tpl);
          }}
        />
      )}
    </>
  );
};
