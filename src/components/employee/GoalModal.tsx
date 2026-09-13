import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { EmployeeGoal } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  callerId: string;
  existingGoal?: EmployeeGoal | null;
  isManager?: boolean;
  onSuccess: () => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  callerId,
  existingGoal,
  isManager = false,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'in_progress' | 'achieved' | 'behind' | 'cancelled'>('in_progress');
  const [managementNotes, setManagementNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (existingGoal) {
      setTitle(existingGoal.title);
      setDescription(existingGoal.description || '');
      setTargetDate(existingGoal.targetDate);
      setProgress(existingGoal.progress || 0);
      setStatus(existingGoal.status || 'in_progress');
      setManagementNotes(existingGoal.managementNotes || '');
    } else {
      setTitle('');
      setDescription('');
      setTargetDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      setProgress(0);
      setStatus('in_progress');
      setManagementNotes('');
    }
    setErrorMessage(null);
  }, [existingGoal, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) {
      setErrorMessage('Goal Title and Target Date are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (existingGoal) {
        const res = await employeeOperationsService.updateGoal(existingGoal.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          targetDate,
          progress,
          status,
          managementNotes: isManager ? (managementNotes.trim() || undefined) : undefined
        });
        if (res.error) setErrorMessage(res.error);
        else {
          onSuccess();
          onClose();
        }
      } else {
        const res = await employeeOperationsService.createGoal({
          employeeId,
          title: title.trim(),
          description: description.trim() || undefined,
          targetDate,
          progress,
          status
        }, callerId);
        if (res.error) setErrorMessage(res.error);
        else {
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save goal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-500/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                {existingGoal ? 'Update Goal & Key Result' : 'Create Performance Goal'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">Target milestones and KPI progress tracking</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Goal Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master React 19 State Architecture or Reduce QA Defect Rate < 2%"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">Description & Success Criteria</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Measurable metrics, deliverables, or review criteria..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">Target Completion Date</label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="in_progress">In Progress</option>
                <option value="achieved">Achieved</option>
                <option value="behind">Behind Schedule</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-gray-300">
              <span>Progress Percentage</span>
              <span className="font-mono text-brand-600 font-bold">{progress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-dark-border rounded-lg appearance-none cursor-pointer accent-brand-600"
            />
          </div>

          {isManager && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">Management Notes & Evaluation</label>
              <textarea
                rows={2}
                value={managementNotes}
                onChange={(e) => setManagementNotes(e.target.value)}
                placeholder="Supervisor feedback or progress evaluation..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : (existingGoal ? 'Update Goal' : 'Create Goal')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
