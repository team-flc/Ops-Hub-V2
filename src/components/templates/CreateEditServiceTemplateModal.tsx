import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Layers, Plus, Trash2, ArrowUp, ArrowDown, 
  Check, AlertCircle, Loader2, Sparkles, Building2, Clock, ShieldCheck
} from 'lucide-react';
import { 
  ServiceTemplate, 
  ServiceTemplateTask, 
  Department, 
  ClientTaskPriority, 
  TaskApprovalMode 
} from '../../types';
import { serviceTemplateService } from '../../lib/serviceTemplateService';

interface CreateEditServiceTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (template: ServiceTemplate) => void;
  template: ServiceTemplate | null;
  departments: Department[];
}

export const CreateEditServiceTemplateModal: React.FC<CreateEditServiceTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  template,
  departments
}) => {
  const isEditing = !!template;

  const [name, setName] = useState('');
  const [serviceLabel, setServiceLabel] = useState('Social Media');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState<ServiceTemplateTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    if (template) {
      setName(template.name);
      setServiceLabel(template.serviceLabel || 'General Service');
      setDescription(template.description || '');
      setTasks(template.tasks.map((t, idx) => ({ ...t, displayOrder: idx })));
    } else {
      setName('');
      setServiceLabel('Social Media');
      setDescription('');
      // Default 1 initial task
      setTasks([
        {
          definitionId: crypto.randomUUID(),
          title: '',
          description: '',
          departmentId: departments[0]?.id || '',
          priority: 'Normal',
          approvalMode: 'Internal Only',
          plannedOffsetDays: 0,
          durationBusinessDays: 1,
          displayOrder: 0
        }
      ]);
    }
    setErrorMessage(null);
  }, [template, isOpen, departments]);

  // Lock body scroll when modal is open
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

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddTask = () => {
    if (tasks.length >= 100) {
      setErrorMessage('A Service Template cannot exceed 100 tasks.');
      return;
    }
    const newTask: ServiceTemplateTask = {
      definitionId: crypto.randomUUID(),
      title: '',
      description: '',
      departmentId: departments[0]?.id || '',
      priority: 'Normal',
      approvalMode: 'Internal Only',
      plannedOffsetDays: 0,
      durationBusinessDays: 1,
      displayOrder: tasks.length
    };
    setTasks([...tasks, newTask]);
  };

  const handleRemoveTask = (index: number) => {
    if (tasks.length <= 1) {
      setErrorMessage('A Service Template must contain at least one task.');
      return;
    }
    const filtered = tasks.filter((_, i) => i !== index).map((t, i) => ({ ...t, displayOrder: i }));
    setTasks(filtered);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...tasks];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    setTasks(copy.map((t, i) => ({ ...t, displayOrder: i })));
  };

  const handleMoveDown = (index: number) => {
    if (index === tasks.length - 1) return;
    const copy = [...tasks];
    const temp = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = temp;
    setTasks(copy.map((t, i) => ({ ...t, displayOrder: i })));
  };

  const handleUpdateTaskField = (index: number, field: keyof ServiceTemplateTask, value: any) => {
    const copy = [...tasks];
    copy[index] = { ...copy[index], [field]: value };
    setTasks(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Template name is required.');
      return;
    }
    if (!serviceLabel.trim()) {
      setErrorMessage('Service category label is required.');
      return;
    }
    if (tasks.length === 0) {
      setErrorMessage('At least one task definition is required.');
      return;
    }
    if (tasks.length > 100) {
      setErrorMessage('A Service Template cannot exceed 100 tasks.');
      return;
    }

    for (let i = 0; i < tasks.length; i++) {
      if (!tasks[i].title.trim()) {
        setErrorMessage(`Task #${i + 1} must have a title.`);
        return;
      }
      if (!tasks[i].departmentId) {
        setErrorMessage(`Task #${i + 1} must have an assigned department.`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditing && template) {
        const res = await serviceTemplateService.updateTemplate(template.id, {
          name: name.trim(),
          serviceLabel: serviceLabel.trim(),
          description: description.trim() || undefined,
          tasks,
          expectedVersion: template.version
        });
        if (res.error || !res.data) {
          setErrorMessage(res.error || 'Failed to update service template.');
        } else {
          onSuccess(res.data);
          onClose();
        }
      } else {
        const res = await serviceTemplateService.createTemplate({
          name: name.trim(),
          serviceLabel: serviceLabel.trim(),
          description: description.trim() || undefined,
          tasks
        });
        if (res.error || !res.data) {
          setErrorMessage(res.error || 'Failed to create service template.');
        } else {
          onSuccess(res.data);
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-template-modal-title"
        className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="service-template-modal-title" className="text-lg font-bold text-slate-900 dark:text-gray-100">
                {isEditing ? 'Edit Service Template' : 'Create Service Template'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Define an ordered pack of operational tasks with business-day offsets and approval rules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Template Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Template Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Social Media Weekly Delivery"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Service Category <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={serviceLabel}
                onChange={(e) => setServiceLabel(e.target.value)}
                placeholder="e.g. Social Media, Paid Ads, CRM"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Standard operating guidelines or context for this service pack..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
          </div>

          {/* Child Tasks Section */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">
                  Ordered Child Tasks ({tasks.length} / 100)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Tasks will be created as Draft and Unassigned upon launch
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTask}
                disabled={tasks.length >= 100}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-100 dark:hover:bg-dark-sidebar text-slate-700 dark:text-gray-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            <div className="space-y-3">
              {tasks.map((task, idx) => (
                <div 
                  key={task.definitionId || idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-dark-200 text-slate-700 dark:text-gray-200 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-gray-200">
                        Task Definition
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Move Up / Move Down buttons for mobile and keyboard accessibility */}
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        aria-label={`Move task ${idx + 1} up`}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-dark-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === tasks.length - 1}
                        aria-label={`Move task ${idx + 1} down`}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-dark-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        disabled={tasks.length <= 1}
                        aria-label={`Remove task ${idx + 1}`}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-30 cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-7 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                        Task Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={task.title}
                        onChange={(e) => handleUpdateTaskField(idx, 'title', e.target.value)}
                        placeholder="e.g. Prepare content calendar"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div className="sm:col-span-5 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                        Department <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={task.departmentId}
                        onChange={(e) => handleUpdateTaskField(idx, 'departmentId', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {departments.filter((d) => d.status === 'active').map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                        Priority
                      </label>
                      <select
                        value={task.priority}
                        onChange={(e) => handleUpdateTaskField(idx, 'priority', e.target.value as ClientTaskPriority)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="Low">Low</option>
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                        Approval Mode
                      </label>
                      <select
                        value={task.approvalMode}
                        onChange={(e) => handleUpdateTaskField(idx, 'approvalMode', e.target.value as TaskApprovalMode)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="Internal Only">Internal Only</option>
                        <option value="Client Approval Required">Client Approval Required</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                        Offset (Days)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={task.plannedOffsetDays}
                        onChange={(e) => handleUpdateTaskField(idx, 'plannedOffsetDays', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                        Duration (Days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={task.durationBusinessDays}
                        onChange={(e) => handleUpdateTaskField(idx, 'durationBusinessDays', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div className="sm:col-span-12 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                        SOP / Checklist / Description
                      </label>
                      <textarea
                        rows={2}
                        value={task.description || ''}
                        onChange={(e) => handleUpdateTaskField(idx, 'description', e.target.value)}
                        placeholder="Step-by-step SOP checklist or execution instructions for this task..."
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-dark-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-md shadow-brand-500/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isEditing ? 'Save Template Version' : 'Create Service Template'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
