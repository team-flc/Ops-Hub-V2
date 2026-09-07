import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Calendar, Layers, Plus, Trash2, ArrowUp, ArrowDown, 
  Copy, Check, AlertCircle, AlertTriangle, Loader2, Clock, 
  Building2, ShieldAlert, Eye, MoveRight
} from 'lucide-react';
import { 
  ClientRecord, 
  ClientWorkPlan, 
  WorkPlanWeek, 
  WorkPlanOccurrence, 
  ServiceTemplate, 
  ServiceTemplateTask, 
  Department, 
  ClientTaskPriority, 
  TaskApprovalMode 
} from '../../types';
import { serviceTemplateService } from '../../lib/serviceTemplateService';
import { workPlanService } from '../../lib/workPlanService';
import { 
  compute90DayPlanRange, 
  generate13PlanWeeks, 
  calculateTaskDatesForWeek, 
  formatPlanDate 
} from '../../lib/workPlanCalendar';

interface WorkPlanBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (plan?: ClientWorkPlan) => void;
  client: ClientRecord;
  departments: Department[];
  existingPlan?: ClientWorkPlan | null;
  isBackendUnavailable?: boolean;
}

export const WorkPlanBuilderModal: React.FC<WorkPlanBuilderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  client,
  departments,
  existingPlan,
  isBackendUnavailable = false
}) => {
  const isEditing = !!existingPlan;

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeWeekTab, setActiveWeekTab] = useState<number>(1);
  const [weeks, setWeeks] = useState<WorkPlanWeek[]>([]);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');

  // Templates library for adding to weeks
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [selectedTemplateToAdd, setSelectedTemplateToAdd] = useState<string>('');
  const [isAddingTemplate, setIsAddingTemplate] = useState<boolean>(false);

  // Copy occurrence modal state
  const [occurrenceToCopy, setOccurrenceToCopy] = useState<{ weekNumber: number; occurrence: WorkPlanOccurrence } | null>(null);
  const [targetWeeksToCopy, setTargetWeeksToCopy] = useState<number[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [weekendWarning, setWeekendWarning] = useState<{ isWeekend: boolean; suggestedMonday: string } | null>(null);

  // Calculate 90-day range
  const { startDate: planStart, endDate: planEnd, isStartDateWeekend, suggestedMonday } = compute90DayPlanRange(startDate);

  // Initialize form
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setViewMode('editor');
    setActiveWeekTab(1);

    if (existingPlan) {
      setName(existingPlan.name);
      setStartDate(existingPlan.startDate);
      setWeeks(existingPlan.weeks || []);
    } else {
      setName(`${client.companyName} — 90-Day Work Plan`);
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      const generated = generate13PlanWeeks(today).map((gw) => ({
        weekNumber: gw.weekNumber,
        startDate: gw.startDate,
        endDate: gw.endDate,
        occurrences: [],
        customTasks: []
      }));
      setWeeks(generated);
    }

    // Load active templates
    async function loadTemplates() {
      const res = await serviceTemplateService.fetchTemplates(false);
      if (res.data && res.data.length > 0) {
        setTemplates(res.data);
        setSelectedTemplateToAdd(res.data[0].id);
      }
    }
    loadTemplates();
  }, [isOpen, existingPlan, client.companyName]);

  // Check weekend start date
  useEffect(() => {
    if (isStartDateWeekend) {
      setWeekendWarning({ isWeekend: true, suggestedMonday });
    } else {
      setWeekendWarning(null);
    }
  }, [startDate, isStartDateWeekend, suggestedMonday]);

  // When start date changes and not editing an existing plan, update week dates
  const handleStartDateChange = (newDate: string) => {
    setStartDate(newDate);
    const generated = generate13PlanWeeks(newDate);
    setWeeks((prev) =>
      generated.map((gw) => {
        const existing = prev.find((w) => w.weekNumber === gw.weekNumber);
        return {
          weekNumber: gw.weekNumber,
          startDate: gw.startDate,
          endDate: gw.endDate,
          occurrences: existing ? existing.occurrences : [],
          customTasks: existing ? existing.customTasks : []
        };
      })
    );
  };

  const handleApplySuggestedMonday = () => {
    if (weekendWarning?.suggestedMonday) {
      handleStartDateChange(weekendWarning.suggestedMonday);
      setWeekendWarning(null);
    }
  };

  // Lock body scroll
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

  const currentWeek = weeks.find((w) => w.weekNumber === activeWeekTab) || weeks[0];

  // Add a Service Template occurrence to the active week
  const handleAddTemplateOccurrence = () => {
    const tpl = templates.find((t) => t.id === selectedTemplateToAdd);
    if (!tpl || !currentWeek) return;

    const occurrence: WorkPlanOccurrence = {
      occurrenceId: crypto.randomUUID(),
      templateId: tpl.id,
      templateName: tpl.name,
      serviceLabel: tpl.serviceLabel,
      templateVersion: tpl.version,
      tasks: tpl.tasks.map((t, idx) => ({ ...t, displayOrder: idx }))
    };

    setWeeks((prev) =>
      prev.map((w) =>
        w.weekNumber === currentWeek.weekNumber
          ? { ...w, occurrences: [...w.occurrences, occurrence] }
          : w
      )
    );
    setIsAddingTemplate(false);
  };

  // Remove an occurrence from a week
  const handleRemoveOccurrence = (weekNum: number, occurrenceId: string) => {
    setWeeks((prev) =>
      prev.map((w) =>
        w.weekNumber === weekNum
          ? { ...w, occurrences: w.occurrences.filter((o) => o.occurrenceId !== occurrenceId) }
          : w
      )
    );
  };

  // Move occurrence to another week
  const handleMoveOccurrence = (fromWeek: number, occurrenceId: string, toWeek: number) => {
    if (fromWeek === toWeek) return;
    const occ = weeks.find((w) => w.weekNumber === fromWeek)?.occurrences.find((o) => o.occurrenceId === occurrenceId);
    if (!occ) return;

    setWeeks((prev) =>
      prev.map((w) => {
        if (w.weekNumber === fromWeek) {
          return { ...w, occurrences: w.occurrences.filter((o) => o.occurrenceId !== occurrenceId) };
        }
        if (w.weekNumber === toWeek) {
          return { ...w, occurrences: [...w.occurrences, occ] };
        }
        return w;
      })
    );
  };

  // Open copy occurrence dialog
  const handleOpenCopyModal = (weekNumber: number, occurrence: WorkPlanOccurrence) => {
    setOccurrenceToCopy({ weekNumber, occurrence });
    setTargetWeeksToCopy([]);
  };

  // Execute copy occurrence to multiple target weeks
  const handleExecuteCopy = () => {
    if (!occurrenceToCopy || targetWeeksToCopy.length === 0) return;

    setWeeks((prev) =>
      prev.map((w) => {
        if (targetWeeksToCopy.includes(w.weekNumber)) {
          const cloned: WorkPlanOccurrence = {
            ...occurrenceToCopy.occurrence,
            occurrenceId: crypto.randomUUID(),
            tasks: occurrenceToCopy.occurrence.tasks.map((t) => ({ ...t, definitionId: crypto.randomUUID() }))
          };
          return { ...w, occurrences: [...w.occurrences, cloned] };
        }
        return w;
      })
    );
    setOccurrenceToCopy(null);
  };

  // Add individual custom task to a week
  const handleAddCustomTask = (weekNum: number) => {
    const newTask: ServiceTemplateTask = {
      definitionId: crypto.randomUUID(),
      title: '',
      description: '',
      departmentId: departments[0]?.id || '',
      priority: 'Normal',
      approvalMode: 'Internal Only',
      plannedOffsetDays: 0,
      durationBusinessDays: 1,
      displayOrder: 0
    };

    setWeeks((prev) =>
      prev.map((w) =>
        w.weekNumber === weekNum
          ? { ...w, customTasks: [...w.customTasks, newTask] }
          : w
      )
    );
  };

  // Remove custom task
  const handleRemoveCustomTask = (weekNum: number, index: number) => {
    setWeeks((prev) =>
      prev.map((w) =>
        w.weekNumber === weekNum
          ? { ...w, customTasks: w.customTasks.filter((_, i) => i !== index) }
          : w
      )
    );
  };

  // Update task in occurrence
  const handleUpdateOccurrenceTask = (weekNum: number, occId: string, taskIdx: number, field: keyof ServiceTemplateTask, val: any) => {
    setWeeks((prev) =>
      prev.map((w) => {
        if (w.weekNumber !== weekNum) return w;
        return {
          ...w,
          occurrences: w.occurrences.map((o) => {
            if (o.occurrenceId !== occId) return o;
            const copy = [...o.tasks];
            copy[taskIdx] = { ...copy[taskIdx], [field]: val };
            return { ...o, tasks: copy };
          })
        };
      })
    );
  };

  // Update custom task
  const handleUpdateCustomTask = (weekNum: number, taskIdx: number, field: keyof ServiceTemplateTask, val: any) => {
    setWeeks((prev) =>
      prev.map((w) => {
        if (w.weekNumber !== weekNum) return w;
        const copy = [...w.customTasks];
        copy[taskIdx] = { ...copy[taskIdx], [field]: val };
        return { ...w, customTasks: copy };
      })
    );
  };

  // Compute total tasks and department distribution
  const allTasksFlat: Array<{
    task: ServiceTemplateTask;
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    occurrenceId?: string;
    templateId?: string;
    templateVersion?: number;
  }> = [];

  weeks.forEach((w) => {
    w.occurrences.forEach((occ) => {
      occ.tasks.forEach((t) => {
        allTasksFlat.push({
          task: t,
          weekNumber: w.weekNumber,
          weekStart: w.startDate,
          weekEnd: w.endDate,
          occurrenceId: occ.occurrenceId,
          templateId: occ.templateId,
          templateVersion: occ.templateVersion
        });
      });
    });
    w.customTasks.forEach((t) => {
      allTasksFlat.push({
        task: t,
        weekNumber: w.weekNumber,
        weekStart: w.startDate,
        weekEnd: w.endDate
      });
    });
  });

  const departmentCounts: Record<string, number> = {};
  allTasksFlat.forEach((item) => {
    const dept = departments.find((d) => d.id === item.task.departmentId)?.name || 'Unassigned Dept';
    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
  });

  // Validate tasks for scheduling errors
  const schedulingErrors: string[] = [];
  allTasksFlat.forEach((item, idx) => {
    if (!item.task.title.trim()) {
      schedulingErrors.push(`Week ${item.weekNumber}: Task #${idx + 1} is missing a title.`);
    }
    const dates = calculateTaskDatesForWeek({
      weekStartDate: item.weekStart,
      weekEndDate: item.weekEnd,
      planEndDate: planEnd,
      plannedOffsetDays: item.task.plannedOffsetDays,
      durationBusinessDays: item.task.durationBusinessDays
    });
    if (!dates.isValid && dates.error) {
      schedulingErrors.push(`Week ${item.weekNumber} ("${item.task.title || 'Untitled'}"): ${dates.error}`);
    }
  });

  // Save Draft Plan
  const handleSaveDraft = async () => {
    if (!name.trim()) {
      setErrorMessage('Plan name is required.');
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await workPlanService.saveDraftPlan({
        id: existingPlan?.id,
        clientId: client.id,
        name: name.trim(),
        startDate,
        weeks,
        expectedRevision: existingPlan?.revision
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || 'Failed to save draft plan.');
      } else {
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving draft plan.');
    } finally {
      setIsSaving(false);
    }
  };

  // Launch Work Plan
  const handleLaunchPlan = async () => {
    if (allTasksFlat.length === 0) {
      setErrorMessage('A Work Plan must contain at least one task to launch.');
      return;
    }
    if (schedulingErrors.length > 0) {
      setErrorMessage('Cannot launch: Please fix scheduling and validation errors first.');
      setViewMode('preview');
      return;
    }

    setIsLaunching(true);
    setErrorMessage(null);

    try {
      // 1. First save latest draft state
      const saveRes = await workPlanService.saveDraftPlan({
        id: existingPlan?.id,
        clientId: client.id,
        name: name.trim(),
        startDate,
        weeks,
        expectedRevision: existingPlan?.revision
      });

      if (saveRes.error || !saveRes.data) {
        setErrorMessage(saveRes.error || 'Failed to save plan before launch.');
        setIsLaunching(false);
        return;
      }

      const planId = saveRes.data.id;
      const planRevision = saveRes.data.revision;

      // 2. Prepare task definitions with calculated business dates
      const tasksToLaunch = allTasksFlat.map((item) => {
        const dates = calculateTaskDatesForWeek({
          weekStartDate: item.weekStart,
          weekEndDate: item.weekEnd,
          planEndDate: planEnd,
          plannedOffsetDays: item.task.plannedOffsetDays,
          durationBusinessDays: item.task.durationBusinessDays
        });
        return {
          title: item.task.title.trim(),
          description: item.task.description?.trim() || null,
          departmentId: item.task.departmentId,
          priority: item.task.priority,
          approvalMode: item.task.approvalMode,
          plannedDate: dates.plannedStart,
          dueDate: dates.dueDate,
          planWeek: item.weekNumber,
          occurrenceId: item.occurrenceId,
          sourceTemplateId: item.templateId,
          sourceTemplateVersion: item.templateVersion
        };
      });

      // 3. Trigger atomic launch
      const launchRes = await workPlanService.launchPlan({
        planId,
        clientId: client.id,
        expectedRevision: planRevision,
        allTasks: tasksToLaunch
      });

      if (!launchRes.success) {
        setErrorMessage(launchRes.error || 'Plan launch failed.');
      } else {
        const updatedPlan: ClientWorkPlan = {
          ...saveRes.data,
          status: 'Launched',
          launchedAt: new Date().toISOString()
        };
        onSuccess(updatedPlan);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected launch error.');
    } finally {
      setIsLaunching(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-plan-modal-title"
        className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 id="work-plan-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <span>{isEditing ? 'Edit 90-Day Work Plan' : 'Build 90-Day Work Plan'}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-200 text-slate-600 dark:text-gray-300 font-bold">
                  Draft
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Exact 90 calendar days ({formatPlanDate(planStart)} – {formatPlanDate(planEnd)}) · 13 Weeks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 dark:bg-dark-200 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'editor'
                    ? 'bg-white dark:bg-dark-300 text-slate-900 dark:text-gray-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                13-Week Editor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-dark-300 text-slate-900 dark:text-gray-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview & Summary ({allTasksFlat.length})</span>
              </button>
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
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {isBackendUnavailable && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-800 dark:text-gray-200 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">Phase 3D backend is not enabled in this environment yet. Preview is read-only.</div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Form Top Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-slate-50 dark:bg-dark-sidebar p-4 rounded-2xl border border-slate-200 dark:border-dark-border">
            <div className="sm:col-span-8 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Work Plan Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q2 Growth & Social Execution Plan"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
              />
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Start Date (Asia/Karachi) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
              />
            </div>

            {weekendWarning && (
              <div className="sm:col-span-12 p-3 rounded-xl bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-800 dark:text-gray-200 text-xs flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-brand-500 flex-shrink-0" />
                  <span>The selected start date falls on a weekend. Starting on Monday is recommended.</span>
                </div>
                <button
                  type="button"
                  onClick={handleApplySuggestedMonday}
                  className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-[11px] whitespace-nowrap cursor-pointer shadow-xs"
                >
                  Change to Monday ({formatPlanDate(weekendWarning.suggestedMonday)})
                </button>
              </div>
            )}
          </div>

          {/* MODE 1: 13-WEEK EDITOR */}
          {viewMode === 'editor' && (
            <div className="space-y-4">
              {/* 13-Week Horizontal Tab Strip */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin border-b border-slate-200 dark:border-dark-border">
                {weeks.map((w) => {
                  const taskCountInWeek = w.occurrences.reduce((sum, o) => sum + o.tasks.length, 0) + w.customTasks.length;
                  const isActive = w.weekNumber === activeWeekTab;
                  return (
                    <button
                      key={w.weekNumber}
                      type="button"
                      onClick={() => setActiveWeekTab(w.weekNumber)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                          : 'bg-slate-100 dark:bg-dark-sidebar hover:bg-slate-200 dark:hover:bg-dark-200 text-slate-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span>Week {w.weekNumber}</span>
                        {taskCountInWeek > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-dark-200 text-slate-700'}`}>
                            {taskCountInWeek}
                          </span>
                        )}
                      </span>
                      <span className={`text-[10px] font-normal ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                        {w.weekNumber === 13 ? '6 Days' : '7 Days'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Current Week Detail Panel */}
              {currentWeek && (
                <div className="space-y-4 p-4 rounded-2xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-dark-border">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100">
                        Week {currentWeek.weekNumber} Schedule
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        {formatPlanDate(currentWeek.startDate)} — {formatPlanDate(currentWeek.endDate)} ({currentWeek.weekNumber === 13 ? '6 calendar days' : '7 calendar days'})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingTemplate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 text-xs font-bold cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-brand-600" />
                        <span>+ Add Service Pack</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddCustomTask(currentWeek.weekNumber)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-100 text-slate-700 dark:text-gray-200 text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Custom Task</span>
                      </button>
                    </div>
                  </div>

                  {/* Add Template Occurrence Drawer / Selector */}
                  {isAddingTemplate && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs font-bold text-slate-700 dark:text-gray-300 whitespace-nowrap">Choose Template:</span>
                        <select
                          value={selectedTemplateToAdd}
                          onChange={(e) => setSelectedTemplateToAdd(e.target.value)}
                          className="px-3 py-1.5 text-xs bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-lg text-slate-900 dark:text-gray-100 font-semibold"
                        >
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name} ({t.serviceLabel} — {t.tasks.length} tasks)</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setIsAddingTemplate(false)}
                          className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddTemplateOccurrence}
                          className="px-3 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                        >
                          Add to Week {currentWeek.weekNumber}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Empty state for week */}
                  {currentWeek.occurrences.length === 0 && currentWeek.customTasks.length === 0 && (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-dark-border rounded-2xl space-y-2">
                      <p className="text-xs font-semibold text-slate-500">
                        No service packs or tasks planned for Week {currentWeek.weekNumber}.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Click "+ Add Service Pack" to apply a standard delivery pack or "+ Add Custom Task" for individual work.
                      </p>
                    </div>
                  )}

                  {/* Render Occurrences in Week */}
                  {currentWeek.occurrences.map((occ) => (
                    <div 
                      key={occ.occurrenceId}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-dark-border">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                            {occ.serviceLabel}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-gray-100">
                            {occ.templateName}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({occ.tasks.length} tasks)
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Move to another week dropdown */}
                          <select
                            value={currentWeek.weekNumber}
                            onChange={(e) => handleMoveOccurrence(currentWeek.weekNumber, occ.occurrenceId, Number(e.target.value))}
                            className="px-2 py-1 text-[11px] bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-gray-300"
                            title="Move occurrence to another week"
                          >
                            <option value={currentWeek.weekNumber}>Move to...</option>
                            {weeks.map((w) => (
                              <option key={w.weekNumber} value={w.weekNumber}>Week {w.weekNumber}</option>
                            ))}
                          </select>

                          {/* Copy occurrence to other weeks */}
                          <button
                            type="button"
                            onClick={() => handleOpenCopyModal(currentWeek.weekNumber, occ)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 dark:hover:bg-dark-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Copy occurrence to multiple weeks"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px]">Copy to Weeks</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveOccurrence(currentWeek.weekNumber, occ.occurrenceId)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            title="Remove occurrence"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Tasks inside this occurrence */}
                      <div className="space-y-2">
                        {occ.tasks.map((t, tIdx) => {
                          const dates = calculateTaskDatesForWeek({
                            weekStartDate: currentWeek.startDate,
                            weekEndDate: currentWeek.endDate,
                            planEndDate: planEnd,
                            plannedOffsetDays: t.plannedOffsetDays,
                            durationBusinessDays: t.durationBusinessDays
                          });
                          return (
                            <div 
                              key={t.definitionId || tIdx}
                              className="p-2.5 rounded-xl bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <span className="w-5 h-5 rounded bg-slate-100 dark:bg-dark-300 text-slate-600 dark:text-gray-300 font-bold flex items-center justify-center text-[10px]">
                                  {tIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={t.title}
                                  onChange={(e) => handleUpdateOccurrenceTask(currentWeek.weekNumber, occ.occurrenceId, tIdx, 'title', e.target.value)}
                                  className="font-bold text-slate-800 dark:text-gray-200 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:outline-none px-1 flex-1"
                                />
                              </div>

                              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-300 font-semibold">
                                  {departments.find((d) => d.id === t.departmentId)?.name || 'Dept'}
                                </span>
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{dates.plannedStart} → {dates.dueDate}</span>
                                </span>
                                {!dates.isValid && (
                                  <span className="text-rose-500 font-bold text-[10px]" title={dates.error}>
                                    ⚠️ Scheduling Error
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Render Custom Tasks in Week */}
                  {currentWeek.customTasks.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                        Custom Individual Tasks
                      </h4>
                      <div className="space-y-2">
                        {currentWeek.customTasks.map((t, tIdx) => (
                          <div 
                            key={t.definitionId || tIdx}
                            className="p-3 rounded-xl bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                required
                                value={t.title}
                                onChange={(e) => handleUpdateCustomTask(currentWeek.weekNumber, tIdx, 'title', e.target.value)}
                                placeholder="Custom task title..."
                                className="w-full text-xs font-bold text-slate-800 dark:text-gray-200 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:outline-none px-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomTask(currentWeek.weekNumber, tIdx)}
                                className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <select
                                value={t.departmentId}
                                onChange={(e) => handleUpdateCustomTask(currentWeek.weekNumber, tIdx, 'departmentId', e.target.value)}
                                className="px-2 py-1 bg-slate-50 dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-lg"
                              >
                                {departments.filter((d) => d.status === 'active').map((dept) => (
                                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                              </select>
                              <select
                                value={t.priority}
                                onChange={(e) => handleUpdateCustomTask(currentWeek.weekNumber, tIdx, 'priority', e.target.value as ClientTaskPriority)}
                                className="px-2 py-1 bg-slate-50 dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-lg"
                              >
                                <option value="Low">Low</option>
                                <option value="Normal">Normal</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                              </select>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <span>Offset:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={5}
                                  value={t.plannedOffsetDays}
                                  onChange={(e) => handleUpdateCustomTask(currentWeek.weekNumber, tIdx, 'plannedOffsetDays', parseInt(e.target.value) || 0)}
                                  className="w-12 px-1 py-0.5 border rounded"
                                />
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <span>Days:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={t.durationBusinessDays}
                                  onChange={(e) => handleUpdateCustomTask(currentWeek.weekNumber, tIdx, 'durationBusinessDays', parseInt(e.target.value) || 1)}
                                  className="w-12 px-1 py-0.5 border rounded"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MODE 2: PREVIEW & SUMMARY */}
          {viewMode === 'preview' && (
            <div className="space-y-5 animate-fade-in">
              {/* Mandatory Notice */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 text-xs flex items-start gap-3 shadow-sm">
                <ShieldAlert className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-gray-100">
                    Draft & Unassigned Launch Contract
                  </div>
                  <div>
                    When this Work Plan is launched, all <strong>{allTasksFlat.length}</strong> tasks will be created atomically with <strong>Status = Draft</strong> and <strong>Assignee = Unassigned</strong>.
                  </div>
                </div>
              </div>

              {/* Task Distribution by Department */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">
                  Task Distribution by Department ({allTasksFlat.length} Total Tasks)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(departmentCounts).map(([dept, count]) => (
                    <div key={dept} className="p-3 rounded-xl bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-gray-300">{dept}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-gray-100 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-300">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scheduling Errors List if any */}
              {schedulingErrors.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Scheduling & Validation Issues Detected ({schedulingErrors.length})</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {schedulingErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 13-Week Overview Summary */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">
                  13-Week Plan Breakdown
                </h4>
                <div className="space-y-2">
                  {weeks.map((w) => {
                    const taskCountInWeek = w.occurrences.reduce((sum, o) => sum + o.tasks.length, 0) + w.customTasks.length;
                    return (
                      <div key={w.weekNumber} className="p-3 rounded-xl bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 dark:text-gray-100">Week {w.weekNumber}</span>
                          <span className="text-slate-400 text-[11px] block">{formatPlanDate(w.startDate)} – {formatPlanDate(w.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-300 font-bold text-[11px]">
                            {taskCountInWeek} tasks
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Copy Occurrence Modal Overlay */}
        {occurrenceToCopy && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-dark-300 rounded-2xl p-5 border border-slate-200 dark:border-dark-border shadow-2xl max-w-md w-full space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100">
                Copy "{occurrenceToCopy.occurrence.templateName}" to Other Weeks
              </h3>
              <p className="text-xs text-slate-500">
                Select the target weeks to replicate this service pack:
              </p>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {weeks.map((w) => {
                  const isCurrent = w.weekNumber === occurrenceToCopy.weekNumber;
                  const isSelected = targetWeeksToCopy.includes(w.weekNumber);
                  return (
                    <button
                      key={w.weekNumber}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => {
                        if (isSelected) {
                          setTargetWeeksToCopy(targetWeeksToCopy.filter((n) => n !== w.weekNumber));
                        } else {
                          setTargetWeeksToCopy([...targetWeeksToCopy, w.weekNumber]);
                        }
                      }}
                      className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        isCurrent
                          ? 'opacity-30 border-slate-200 cursor-not-allowed'
                          : isSelected
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-slate-50 dark:bg-dark-200 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      Week {w.weekNumber}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOccurrenceToCopy(null)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCopy}
                  disabled={targetWeeksToCopy.length === 0}
                  className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  Apply to {targetWeeksToCopy.length} Weeks
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-dark-sidebar flex-shrink-0">
          <div className="text-xs text-slate-500 dark:text-gray-400">
            <strong>{allTasksFlat.length}</strong> total operational tasks configured
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-dark-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isBackendUnavailable || isSaving || isLaunching}
              title={isBackendUnavailable ? 'Phase 3D backend is not enabled in this environment yet. Preview is read-only.' : undefined}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-dark-100 dark:hover:bg-dark-200 text-slate-800 dark:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? 'Saving Draft...' : 'Save Draft Plan'}
            </button>
            <button
              type="button"
              onClick={handleLaunchPlan}
              disabled={isBackendUnavailable || isSaving || isLaunching || allTasksFlat.length === 0 || schedulingErrors.length > 0}
              title={isBackendUnavailable ? 'Phase 3D backend is not enabled in this environment yet. Preview is read-only.' : undefined}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-md shadow-brand-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLaunching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Launch 90-Day Plan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
