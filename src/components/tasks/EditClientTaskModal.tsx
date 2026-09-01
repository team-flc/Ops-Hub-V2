import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { 
  ClientTask, 
  ClientTaskPriority, 
  Department 
} from '../../types';
import { taskManagementService, isSunday } from '../../lib/taskManagementService';

interface EditClientTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedTask: ClientTask) => void;
  task: ClientTask;
  departments: Department[];
}

export const EditClientTaskModal: React.FC<EditClientTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  task,
  departments
}) => {
  const [title, setTitle] = useState(task.title);
  const [details, setDetails] = useState(task.details || '');
  const [departmentId, setDepartmentId] = useState(task.departmentId);
  const [priority, setPriority] = useState<ClientTaskPriority>(task.priority);
  
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedStartTime, setPlannedStartTime] = useState('09:00');
  const [dueDate, setDueDate] = useState('');
  const [dueDateTime, setDueDateTime] = useState('18:00');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title);
      setDetails(task.details || '');
      setDepartmentId(task.departmentId);
      setPriority(task.priority);
      setErrorMessage(null);

      if (task.plannedStart) {
        const start = new Date(task.plannedStart);
        const yyyy = start.getFullYear();
        const mm = String(start.getMonth() + 1).padStart(2, '0');
        const dd = String(start.getDate()).padStart(2, '0');
        const hh = String(start.getHours()).padStart(2, '0');
        const min = String(start.getMinutes()).padStart(2, '0');
        setPlannedStartDate(`${yyyy}-${mm}-${dd}`);
        setPlannedStartTime(`${hh}:${min}`);
      }

      if (task.dueDate) {
        const due = new Date(task.dueDate);
        const yyyy = due.getFullYear();
        const mm = String(due.getMonth() + 1).padStart(2, '0');
        const dd = String(due.getDate()).padStart(2, '0');
        const hh = String(due.getHours()).padStart(2, '0');
        const min = String(due.getMinutes()).padStart(2, '0');
        setDueDate(`${yyyy}-${mm}-${dd}`);
        setDueDateTime(`${hh}:${min}`);
      }
    }
  }, [isOpen, task]);

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
      setErrorMessage('Due date/time must be strictly later than planned start date/time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await taskManagementService.updateTask({
        taskId: task.id,
        title: title.trim(),
        details: details.trim() || undefined,
        departmentId,
        priority,
        plannedStart: startIso,
        dueDate: dueIso
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || 'Failed to update task.');
      } else {
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An error occurred updating task.');
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
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between bg-gray-50/50 dark:bg-dark-card/50">
          <div>
            <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase">
              Week {task.weekNumber} Task
            </span>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">
              Edit Operational Task
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Responsible Department <span className="text-rose-500">*</span>
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                Priority Level <span className="text-rose-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ClientTaskPriority)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

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

          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
              Task Details & Instructions
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

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
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
