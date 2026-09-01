import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Loader2, CheckCircle2, UserCheck, ShieldAlert } from 'lucide-react';
import { 
  ClientRecord, 
  ClientTask, 
  ClientTaskPriority, 
  Department, 
  UserProfile 
} from '../../types';
import { taskManagementService, isSunday } from '../../lib/taskManagementService';

interface CreateClientTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTask: ClientTask) => void;
  client: ClientRecord;
  weekNumber: 1 | 2 | 3 | 4;
  departments: Department[];
  eligibleAssignees: UserProfile[];
}

export const CreateClientTaskModal: React.FC<CreateClientTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  client,
  weekNumber,
  departments,
  eligibleAssignees
}) => {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(weekNumber);
  const [departmentId, setDepartmentId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<ClientTaskPriority>('Normal');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedStartTime, setPlannedStartTime] = useState('09:00');
  const [dueDate, setDueDate] = useState('');
  const [dueDateTime, setDueDateTime] = useState('18:00');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync week on modal open
  useEffect(() => {
    if (isOpen) {
      setSelectedWeek(weekNumber);
      setTitle('');
      setDetails('');
      setAssigneeId('');
      setPriority('Normal');
      setErrorMessage(null);

      if (departments.length > 0 && !departmentId) {
        setDepartmentId(departments[0].id);
      }

      // Default start date = today (or next Monday if Sunday)
      const now = new Date();
      if (now.getUTCDay() === 0) {
        now.setDate(now.getDate() + 1);
      }
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setPlannedStartDate(todayStr);

      // Default due date = 3 days later (skip Sunday)
      const due = new Date(now);
      due.setDate(due.getDate() + 3);
      if (due.getUTCDay() === 0) {
        due.setDate(due.getDate() + 1);
      }
      const dYyyy = due.getFullYear();
      const dMm = String(due.getMonth() + 1).padStart(2, '0');
      const dDd = String(due.getDate()).padStart(2, '0');
      setDueDate(`${dYyyy}-${dMm}-${dDd}`);
    }
  }, [isOpen, weekNumber, departments]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Task title is required.');
      return;
    }
    if (!departmentId) {
      setErrorMessage('Responsible department is required.');
      return;
    }
    if (!plannedStartDate) {
      setErrorMessage('Planned start date is required.');
      return;
    }
    if (!dueDate) {
      setErrorMessage('Due date is required.');
      return;
    }

    // Sunday checks
    if (isSunday(plannedStartDate)) {
      setErrorMessage('Planned start date cannot fall on a Sunday.');
      return;
    }
    if (isSunday(dueDate)) {
      setErrorMessage('Due date cannot fall on a Sunday.');
      return;
    }

    const startIso = new Date(`${plannedStartDate}T${plannedStartTime || '09:00'}:00.000Z`).toISOString();
    const dueIso = new Date(`${dueDate}T${dueDateTime || '18:00'}:00.000Z`).toISOString();

    if (new Date(dueIso).getTime() <= new Date(startIso).getTime()) {
      setErrorMessage('Due date and time must be strictly later than planned start date and time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await taskManagementService.createTask({
        clientId: client.id,
        weekNumber: selectedWeek,
        title: title.trim(),
        details: details.trim() || undefined,
        departmentId,
        assigneeId: assigneeId || undefined,
        priority,
        plannedStart: startIso,
        dueDate: dueIso
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || 'Failed to create task.');
      } else {
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An error occurred creating task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between bg-gray-50/50 dark:bg-dark-card/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase">
                Week {selectedWeek} Setup
              </span>
              <span className="text-xs text-gray-400 font-medium">for</span>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{client.companyName}</span>
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">
              Create Operational Task
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Set up Apollo.io lead scraper and sequence filters"
              required
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Week & Priority Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-week-select" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Workspace Week <span className="text-rose-500">*</span>
              </label>
              <select
                id="task-week-select"
                aria-label="Workspace Week"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value) as any)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                <option value={1}>Week 1</option>
                <option value={2}>Week 2</option>
                <option value={3}>Week 3</option>
                <option value={4}>Week 4</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-priority-select" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Priority Level <span className="text-rose-500">*</span>
              </label>
              <select
                id="task-priority-select"
                aria-label="Priority Level"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ClientTaskPriority)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal (Default)</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Department & Primary Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-dept-select" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Responsible Department <span className="text-rose-500">*</span>
              </label>
              <select
                id="task-dept-select"
                aria-label="Responsible Department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-assignee-select" className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Primary Assignee <span className="text-gray-400 font-normal">(Optional = Draft)</span>
              </label>
              <select
                id="task-assignee-select"
                aria-label="Primary Assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                <option value="">Leave Unassigned (Draft)</option>
                {eligibleAssignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Planned Start Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50/70 dark:bg-dark-200/50 rounded-xl border border-gray-200/60 dark:border-dark-border/60">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Planned Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">Cannot fall on Sunday</span>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={plannedStartTime}
                onChange={(e) => setPlannedStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50/70 dark:bg-dark-200/50 rounded-xl border border-gray-200/60 dark:border-dark-border/60">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">Cannot fall on Sunday</span>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Due Time
              </label>
              <input
                type="time"
                value={dueDateTime}
                onChange={(e) => setDueDateTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Task Details / Description */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
              Task Details & SOP Guidelines <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add operational instructions, specific filter requirements, or target deliverables..."
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-md shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Task...</span>
                </>
              ) : (
                <span>Create Task</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
