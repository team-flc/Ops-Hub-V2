import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Layers, Calendar, Check, AlertTriangle, 
  AlertCircle, Loader2, ArrowUp, ArrowDown, Plus, Trash2, Building2, Clock, ShieldAlert
} from 'lucide-react';
import { 
  ServiceTemplate, 
  ServiceTemplateTask, 
  Department, 
  ClientRecord, 
  UserProfile,
  ClientTaskPriority,
  TaskApprovalMode
} from '../../types';
import { serviceTemplateService } from '../../lib/serviceTemplateService';
import { taskLaunchEngine, generateRequestId } from '../../lib/taskLaunchEngine';
import { calculateTaskDatesForWeek } from '../../lib/workPlanCalendar';

interface ApplyServiceTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (taskIds: string[]) => void;
  client: ClientRecord;
  initialWeek: 1 | 2 | 3 | 4;
  departments: Department[];
}

export const ApplyServiceTemplateModal: React.FC<ApplyServiceTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  client,
  initialWeek,
  departments
}) => {
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [targetWeek, setTargetWeek] = useState<number>(initialWeek);
  
  // Launch-specific adjustable tasks
  const [customizedTasks, setCustomizedTasks] = useState<ServiceTemplateTask[]>([]);
  const [requestId, setRequestId] = useState<string>('');
  const [hasExistingApplication, setHasExistingApplication] = useState<boolean>(false);
  const [allowDuplicateApplication, setAllowDuplicateApplication] = useState<boolean>(false);

  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load templates on open
  useEffect(() => {
    if (!isOpen) return;
    setRequestId(generateRequestId());
    setTargetWeek(initialWeek);
    setHasExistingApplication(false);
    setAllowDuplicateApplication(false);
    setErrorMessage(null);

    async function load() {
      setIsLoadingTemplates(true);
      const res = await serviceTemplateService.fetchTemplates(false);
      if (res.data && res.data.length > 0) {
        setTemplates(res.data);
        setSelectedTemplateId(res.data[0].id);
      }
      setIsLoadingTemplates(false);
    }
    load();
  }, [isOpen, initialWeek]);

  // When selectedTemplateId changes, copy its tasks into customizedTasks
  useEffect(() => {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (tpl) {
      setCustomizedTasks(tpl.tasks.map((t, idx) => ({ ...t, displayOrder: idx })));
    } else {
      setCustomizedTasks([]);
    }
  }, [selectedTemplateId, templates]);

  // Check if template was already applied to this client & week
  useEffect(() => {
    if (!selectedTemplateId || !client.id) return;
    async function checkDuplicate() {
      const exists = await taskLaunchEngine.checkExistingTemplateApplication(client.id, selectedTemplateId, targetWeek);
      setHasExistingApplication(exists);
    }
    checkDuplicate();
  }, [selectedTemplateId, client.id, targetWeek]);

  // Body scroll lock
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

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const handleAddTask = () => {
    if (customizedTasks.length >= 100) return;
    const newTask: ServiceTemplateTask = {
      definitionId: crypto.randomUUID(),
      title: '',
      description: '',
      departmentId: departments[0]?.id || '',
      priority: 'Normal',
      approvalMode: 'Internal Only',
      plannedOffsetDays: 0,
      durationBusinessDays: 1,
      displayOrder: customizedTasks.length
    };
    setCustomizedTasks([...customizedTasks, newTask]);
  };

  const handleRemoveTask = (index: number) => {
    if (customizedTasks.length <= 1) return;
    setCustomizedTasks(customizedTasks.filter((_, i) => i !== index).map((t, i) => ({ ...t, displayOrder: i })));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...customizedTasks];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    setCustomizedTasks(copy.map((t, i) => ({ ...t, displayOrder: i })));
  };

  const handleMoveDown = (index: number) => {
    if (index === customizedTasks.length - 1) return;
    const copy = [...customizedTasks];
    const temp = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = temp;
    setCustomizedTasks(copy.map((t, i) => ({ ...t, displayOrder: i })));
  };

  const handleUpdateTask = (index: number, field: keyof ServiceTemplateTask, value: any) => {
    const copy = [...customizedTasks];
    copy[index] = { ...copy[index], [field]: value };
    setCustomizedTasks(copy);
  };

  const handleLaunch = async () => {
    if (!selectedTemplate) {
      setErrorMessage('Please select a service template.');
      return;
    }
    if (client.status === 'Archived' || client.status === 'Paused') {
      setErrorMessage(`Cannot launch tasks: Client is currently ${client.status}.`);
      return;
    }
    if (hasExistingApplication && !allowDuplicateApplication) {
      setErrorMessage('This template has already been applied to this client and week. Please confirm intentional duplicate launch.');
      return;
    }
    if (customizedTasks.length === 0) {
      setErrorMessage('At least one task is required.');
      return;
    }

    for (let i = 0; i < customizedTasks.length; i++) {
      if (!customizedTasks[i].title.trim()) {
        setErrorMessage(`Task #${i + 1} must have a title.`);
        return;
      }
      if (!customizedTasks[i].departmentId) {
        setErrorMessage(`Task #${i + 1} must have a department assigned.`);
        return;
      }
    }

    setIsLaunching(true);
    setErrorMessage(null);

    // If intentional second application, issue a fresh request ID
    const activeReqId = hasExistingApplication && allowDuplicateApplication ? generateRequestId() : requestId;

    try {
      const res = await taskLaunchEngine.launchServiceTemplate({
        clientId: client.id,
        templateId: selectedTemplate.id,
        templateVersion: selectedTemplate.version,
        targetWeek,
        tasks: customizedTasks.map((t) => ({
          title: t.title.trim(),
          description: t.description?.trim() || null,
          departmentId: t.departmentId,
          priority: t.priority,
          approvalMode: t.approvalMode
        })),
        requestId: activeReqId
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to launch service template.');
      } else {
        onSuccess(res.taskIds || []);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected launch error.');
    } finally {
      setIsLaunching(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-template-modal-title"
        className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="apply-template-modal-title" className="text-lg font-bold text-slate-900 dark:text-gray-100">
                Apply Service Template
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Select a service template, adjust launch tasks, and bulk-create Draft tasks for {client.companyName}
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
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {client.status === 'Paused' && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>Client Workspace Paused: Task creation is blocked while client organization is paused.</div>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Mandatory Confirmation Notice */}
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 text-xs flex items-start gap-3 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-slate-900 dark:text-gray-100">
                Bulk Task Creation Guarantee
              </div>
              <div>
                All tasks will be created with <strong>Status = Draft</strong> and <strong>Assignee = Unassigned</strong>. Task review, staff assignment, and scheduling can be managed after launch.
              </div>
            </div>
          </div>

          {/* Configuration: Template & Target Week */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Select Service Template <span className="text-rose-500">*</span>
              </label>
              {isLoadingTemplates ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                  <span>Loading templates...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-dark-200 rounded-xl text-xs text-slate-500">
                  No active Service Templates available. Create one in Settings &gt; Service Templates.
                </div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.serviceLabel} â€” {t.tasks.length} tasks)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Target Week <span className="text-rose-500">*</span>
              </label>
              <select
                value={targetWeek}
                onChange={(e) => setTargetWeek(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
              >
                <option value={1}>Week 1</option>
                <option value={2}>Week 2</option>
                <option value={3}>Week 3</option>
                <option value={4}>Week 4</option>
              </select>
            </div>
          </div>

          {/* Duplicate Application Warning */}
          {hasExistingApplication && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-300 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Notice:</strong> This Service Template has already been applied to <strong>{client.companyName} (Week {targetWeek})</strong>.
                  If this is an intentional second delivery pack, please confirm below.
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                <input
                  type="checkbox"
                  checked={allowDuplicateApplication}
                  onChange={(e) => setAllowDuplicateApplication(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Yes, create an intentional second application of this service template</span>
              </label>
            </div>
          )}

          {/* Launch-Specific Task Adjustments */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">
                  Launch Tasks ({customizedTasks.length} tasks to be created)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Customizations here apply only to this launch batch and do not edit the master template
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTask}
                disabled={customizedTasks.length >= 100}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-100 dark:hover:bg-dark-sidebar text-slate-700 dark:text-gray-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {customizedTasks.map((task, idx) => (
                <div 
                  key={task.definitionId || idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-dark-200 text-slate-700 dark:text-gray-200 text-[11px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={task.title}
                        onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                        placeholder="Task title"
                        className="text-xs font-bold text-slate-900 dark:text-gray-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:outline-none px-1 py-0.5 min-w-[200px]"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        aria-label={`Move task ${idx + 1} up`}
                        className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-dark-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === customizedTasks.length - 1}
                        aria-label={`Move task ${idx + 1} down`}
                        className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-dark-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        disabled={customizedTasks.length <= 1}
                        aria-label={`Remove task ${idx + 1}`}
                        className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-0.5">
                      <label className="block text-[10px] text-slate-400 font-semibold">Department</label>
                      <select
                        value={task.departmentId}
                        onChange={(e) => handleUpdateTask(idx, 'departmentId', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-gray-200"
                      >
                        {departments.filter((d) => d.status === 'active').map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="block text-[10px] text-slate-400 font-semibold">Priority</label>
                      <select
                        value={task.priority}
                        onChange={(e) => handleUpdateTask(idx, 'priority', e.target.value as ClientTaskPriority)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-gray-200"
                      >
                        <option value="Low">Low</option>
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="block text-[10px] text-slate-400 font-semibold">Approval Mode</label>
                      <select
                        value={task.approvalMode}
                        onChange={(e) => handleUpdateTask(idx, 'approvalMode', e.target.value as TaskApprovalMode)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-gray-200"
                      >
                        <option value="Internal Only">Internal Only</option>
                        <option value="Client Approval Required">Client Approval Required</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar">
          <div className="text-xs text-slate-500 dark:text-gray-400">
            <strong>{customizedTasks.length}</strong> tasks will be created for <strong>Week {targetWeek}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-dark-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={isLaunching || client.status === 'Paused' || client.status === 'Archived' || (hasExistingApplication && !allowDuplicateApplication) || customizedTasks.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-md shadow-brand-500/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLaunching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Launch Service Pack</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
