import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BookTemplate, AlertCircle, Loader2 } from 'lucide-react';
import {
  Department,
  TaskTemplate,
  ClientTaskPriority,
  TaskApprovalMode
} from '../../types';
import { taskTemplateService } from '../../lib/taskTemplateService';
import { 
  saveFormDraft, 
  loadFormDraft, 
  clearFormDraft, 
  DraftRestoredBanner, 
  AutosaveBadge, 
  AutosaveStatus 
} from '../../lib/autosaveUtils';

interface CreateEditTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (template: TaskTemplate) => void;
  template: TaskTemplate | null;
  departments: Department[];
}

export const CreateEditTemplateModal: React.FC<CreateEditTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  template,
  departments
}) => {
  const isEditing = Boolean(template);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [defaultTaskTitle, setDefaultTaskTitle] = useState('');
  const [defaultPriority, setDefaultPriority] = useState<ClientTaskPriority>('Normal');
  const [defaultApprovalMode, setDefaultApprovalMode] = useState<TaskApprovalMode>('Internal Only');
  const [suggestedDurationDays, setSuggestedDurationDays] = useState<number>(3);
  const [taskDetails, setTaskDetails] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const saveSeqRef = React.useRef(0);
  const latestCompletedSeqRef = React.useRef(0);
  const isLoadedRef = React.useRef(false);
  const DRAFT_KEY = 'opshub_draft_new_task_template';

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setAutosaveStatus('idle');
      setAutosaveError(null);

      if (template) {
        setName(template.name);
        setDescription(template.description || '');
        setDepartmentId(template.departmentId);
        setDefaultTaskTitle(template.defaultTaskTitle);
        setDefaultPriority(template.defaultPriority || 'Normal');
        setDefaultApprovalMode(template.defaultApprovalMode || 'Internal Only');
        setSuggestedDurationDays(template.suggestedDurationDays || 3);
        setTaskDetails(template.taskDetails || '');
        setDraftRestored(false);
      } else {
        const draft = loadFormDraft<any>(DRAFT_KEY);
        if (draft) {
          if (draft.name !== undefined) setName(draft.name);
          if (draft.description !== undefined) setDescription(draft.description);
          if (draft.departmentId !== undefined) setDepartmentId(draft.departmentId);
          if (draft.defaultTaskTitle !== undefined) setDefaultTaskTitle(draft.defaultTaskTitle);
          if (draft.defaultPriority !== undefined) setDefaultPriority(draft.defaultPriority);
          if (draft.defaultApprovalMode !== undefined) setDefaultApprovalMode(draft.defaultApprovalMode);
          if (draft.suggestedDurationDays !== undefined) setSuggestedDurationDays(draft.suggestedDurationDays);
          if (draft.taskDetails !== undefined) setTaskDetails(draft.taskDetails);
          setDraftRestored(true);
        } else {
          setName('');
          setDescription('');
          setDepartmentId(departments.length > 0 ? departments[0].id : '');
          setDefaultTaskTitle('');
          setDefaultPriority('Normal');
          setDefaultApprovalMode('Internal Only');
          setSuggestedDurationDays(3);
          setTaskDetails('');
          setDraftRestored(false);
        }
      }
      isLoadedRef.current = true;
    } else {
      isLoadedRef.current = false;
    }
  }, [isOpen, template, departments]);

  const isDirty = React.useMemo(() => {
    if (!isEditing || !template) return false;
    if (name !== template.name) return true;
    if (description !== (template.description || '')) return true;
    if (departmentId !== template.departmentId) return true;
    if (defaultTaskTitle !== template.defaultTaskTitle) return true;
    if (defaultPriority !== (template.defaultPriority || 'Normal')) return true;
    if (defaultApprovalMode !== (template.defaultApprovalMode || 'Internal Only')) return true;
    if (suggestedDurationDays !== (template.suggestedDurationDays || 3)) return true;
    if (taskDetails !== (template.taskDetails || '')) return true;
    return false;
  }, [isEditing, template, name, description, departmentId, defaultTaskTitle, defaultPriority, defaultApprovalMode, suggestedDurationDays, taskDetails]);

  const validateForm = React.useCallback((): { valid: boolean; error?: string } => {
    if (!name.trim()) return { valid: false, error: 'Template name is required.' };
    if (!departmentId) return { valid: false, error: 'Responsible department is required.' };
    if (!defaultTaskTitle.trim()) return { valid: false, error: 'Default task title is required.' };
    if (suggestedDurationDays < 1 || suggestedDurationDays > 30) {
      return { valid: false, error: 'Suggested duration must be between 1 and 30 business days.' };
    }
    return { valid: true };
  }, [name, departmentId, defaultTaskTitle, suggestedDurationDays]);

  const performAutosave = React.useCallback(async (isManual = false): Promise<boolean> => {
    if (!isEditing || !template) return false;
    const val = validateForm();
    if (!val.valid) {
      if (isManual) setErrorMessage(val.error || 'Please fix errors.');
      return false;
    }

    const currentSeq = ++saveSeqRef.current;
    if (isManual) {
      setIsSubmitting(true);
      setErrorMessage(null);
    }
    setAutosaveStatus('saving');
    setAutosaveError(null);

    try {
      const res = await taskTemplateService.updateTemplate(template.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        departmentId,
        defaultTaskTitle: defaultTaskTitle.trim(),
        taskDetails: taskDetails.trim() || undefined,
        defaultPriority,
        defaultApprovalMode,
        suggestedDurationDays,
        expectedVersion: template.version
      });

      if (currentSeq < latestCompletedSeqRef.current) return false;
      latestCompletedSeqRef.current = currentSeq;

      if (res.error || !res.data) {
        setAutosaveStatus('failed');
        setAutosaveError(res.error || 'Failed to auto-save template.');
        if (isManual) setErrorMessage(res.error || 'Failed to update template.');
        return false;
      }

      setAutosaveStatus('saved');
      setAutosaveError(null);
      onSuccess(res.data);
      if (isManual) onClose();
      return true;
    } catch (err: any) {
      if (currentSeq >= latestCompletedSeqRef.current) {
        latestCompletedSeqRef.current = currentSeq;
        setAutosaveStatus('failed');
        setAutosaveError(err?.message || 'Failed to auto-save template.');
        if (isManual) setErrorMessage(err?.message || 'Failed to update template.');
      }
      return false;
    } finally {
      if (isManual) setIsSubmitting(false);
    }
  }, [isEditing, template, name, description, departmentId, defaultTaskTitle, taskDetails, defaultPriority, defaultApprovalMode, suggestedDurationDays, onSuccess, onClose, validateForm]);

  // Debounced autosave effect for editing
  useEffect(() => {
    if (!isOpen || !isLoadedRef.current || !isEditing || !isDirty) return;
    const val = validateForm();
    if (!val.valid) return;

    const timer = setTimeout(() => {
      performAutosave(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [isOpen, isEditing, isDirty, performAutosave, validateForm]);

  // Draft auto-save for new templates
  useEffect(() => {
    if (!isOpen || !isLoadedRef.current || isEditing) return;
    if (name.trim() || defaultTaskTitle.trim() || taskDetails.trim() || description.trim()) {
      saveFormDraft(DRAFT_KEY, {
        name,
        description,
        departmentId,
        defaultTaskTitle,
        defaultPriority,
        defaultApprovalMode,
        suggestedDurationDays,
        taskDetails
      });
    }
  }, [isOpen, isEditing, name, description, departmentId, defaultTaskTitle, defaultPriority, defaultApprovalMode, suggestedDurationDays, taskDetails]);

  const handleClearDraft = () => {
    clearFormDraft(DRAFT_KEY);
    setDraftRestored(false);
    setName('');
    setDescription('');
    setDefaultTaskTitle('');
    setDefaultPriority('Normal');
    setDefaultApprovalMode('Internal Only');
    setSuggestedDurationDays(3);
    setTaskDetails('');
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const val = validateForm();
    if (!val.valid) {
      setErrorMessage(val.error || 'Please fix errors.');
      return;
    }

    if (isEditing && template) {
      await performAutosave(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await taskTemplateService.createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        departmentId,
        defaultTaskTitle: defaultTaskTitle.trim(),
        taskDetails: taskDetails.trim() || undefined,
        defaultPriority,
        defaultApprovalMode,
        suggestedDurationDays
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || 'Failed to create template.');
      } else {
        clearFormDraft(DRAFT_KEY);
        setDraftRestored(false);
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save template.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tpl-modal-title"
    >
      <div
        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between bg-gray-50/50 dark:bg-dark-card/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <BookTemplate className="w-4 h-4" />
            </div>
            <div>
              <h2 id="tpl-modal-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
                {isEditing ? 'Edit Task Template' : 'Create Task Template'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEditing ? `Editing SOP v${template?.version}` : 'Configure a reusable operational SOP'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {!isEditing && draftRestored && (
            <DraftRestoredBanner onClear={handleClearDraft} />
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Template Name & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="tpl-name-input" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Template Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="tpl-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Media Buying Campaign Setup & Launch"
                required
                maxLength={200}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label htmlFor="tpl-dept-select" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Responsible Department <span className="text-rose-500">*</span>
              </label>
              <select
                id="tpl-dept-select"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                <option value="" disabled>Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label htmlFor="tpl-desc-input" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
              Short Description
            </label>
            <input
              id="tpl-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of when and how to apply this SOP..."
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Default Task Title */}
          <div>
            <label htmlFor="tpl-default-title-input" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
              Default Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="tpl-default-title-input"
              type="text"
              value={defaultTaskTitle}
              onChange={(e) => setDefaultTaskTitle(e.target.value)}
              placeholder="e.g. Campaign Setup & Tracking Verification"
              required
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Configuration Grid: Priority, Approval Mode, Suggested Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="tpl-priority-select" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Default Priority <span className="text-rose-500">*</span>
              </label>
              <select
                id="tpl-priority-select"
                value={defaultPriority}
                onChange={(e) => setDefaultPriority(e.target.value as ClientTaskPriority)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label htmlFor="tpl-approval-select" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Approval Flow <span className="text-rose-500">*</span>
              </label>
              <select
                id="tpl-approval-select"
                value={defaultApprovalMode}
                onChange={(e) => setDefaultApprovalMode(e.target.value as TaskApprovalMode)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                <option value="Internal Only">Internal Only</option>
                <option value="Client Approval Required">Client Approval Required</option>
              </select>
            </div>

            <div>
              <label htmlFor="tpl-duration-input" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Duration (Business Days) <span className="text-rose-500">*</span>
              </label>
              <input
                id="tpl-duration-input"
                type="number"
                min={1}
                max={30}
                value={suggestedDurationDays}
                onChange={(e) => setSuggestedDurationDays(Number(e.target.value))}
                required
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* SOP Checklist / Markdown Details */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="tpl-details-input" className="block text-gray-700 dark:text-gray-300 font-bold">
                SOP Checklist & Operational Instructions
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Markdown supported</span>
            </div>
            <textarea
              id="tpl-details-input"
              rows={8}
              value={taskDetails}
              onChange={(e) => setTaskDetails(e.target.value)}
              placeholder={`Write step-by-step SOP instructions or a checklist:\n\n- [ ] 1. Verify ad accounts and pixel tracking\n- [ ] 2. Review creative assets with client\n- [ ] 3. Launch initial testing campaign`}
              className="w-full p-3 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border font-mono text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all resize-y"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-gray-100 dark:border-dark-border">
            <div className="flex items-center">
              {isEditing && (
                <AutosaveBadge status={autosaveStatus} error={autosaveError} />
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 flex items-center justify-center gap-1.5 transition-all min-h-[44px] cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditing ? 'Save Changes' : 'Create Template'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
