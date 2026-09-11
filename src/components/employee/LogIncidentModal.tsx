import React, { useState } from 'react';
import { Award, AlertOctagon, HelpCircle, CheckCircle2, AlertCircle, X, Star } from 'lucide-react';
import { EmployeePerformanceRecord, TeamMemberRecord, UserProfile } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface LogIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList?: (TeamMemberRecord | UserProfile)[];
  defaultEmployeeId?: string;
  callerId: string;
  onSuccess: () => void;
}

export const LogIncidentModal: React.FC<LogIncidentModalProps> = ({
  isOpen,
  onClose,
  staffList = [],
  defaultEmployeeId,
  callerId,
  onSuccess
}) => {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || '');
  const [recordType, setRecordType] = useState<EmployeePerformanceRecord['recordType']>('coaching');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<EmployeePerformanceRecord['severity']>('medium');
  const [rating, setRating] = useState<number | ''>('');
  const [actionPlan, setActionPlan] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmpId = employeeId || defaultEmployeeId;
    if (!targetEmpId) {
      setErrorMessage('Please select an employee.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      setErrorMessage('Title and Description are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.logPerformanceRecord({
        employeeId: targetEmpId,
        recordType,
        title: title.trim(),
        description: description.trim(),
        severity: recordType === 'warning' || recordType === 'incident' ? severity : undefined,
        rating: rating ? Number(rating) : undefined,
        actionPlan: actionPlan.trim() || undefined
      }, callerId);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record performance log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              recordType === 'warning' || recordType === 'incident'
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : recordType === 'commendation'
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}>
              {recordType === 'commendation' ? (
                <Award className="w-5 h-5" />
              ) : recordType === 'warning' || recordType === 'incident' ? (
                <AlertOctagon className="w-5 h-5" />
              ) : (
                <HelpCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                Log Performance / Incident Note
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Coaching sessions, commendations, warnings, and performance logs
              </p>
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!defaultEmployeeId && staffList.length > 0 && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Target Employee <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Select Employee --</option>
                {staffList.map((s) => {
                  const name = 'fullName' in s ? s.fullName : (s as any).full_name || 'Staff';
                  const email = 'workEmail' in s ? s.workEmail : (s as any).email || '';
                  return (
                    <option key={s.id} value={s.id}>
                      {name} ({email})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Entry Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
              >
                <option value="coaching">Coaching / 1-on-1 Note</option>
                <option value="commendation">Commendation / Recognition</option>
                <option value="warning">Formal Warning</option>
                <option value="incident">Operational Incident</option>
                <option value="review">Performance Review</option>
              </select>
            </div>

            {(recordType === 'warning' || recordType === 'incident') ? (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Severity Level
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="low">Low (Minor Advisory)</option>
                  <option value="medium">Medium (Documented Concern)</option>
                  <option value="high">High (First/Second Written Warning)</option>
                  <option value="critical">Critical (Final Warning / Actionable)</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Rating (1 – 5 Stars)
                </label>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">-- No Rating --</option>
                  <option value="5">5 Stars (Exceptional)</option>
                  <option value="4">4 Stars (Exceeds Expectations)</option>
                  <option value="3">3 Stars (Meets Expectations)</option>
                  <option value="2">2 Stars (Needs Improvement)</option>
                  <option value="1">1 Star (Unsatisfactory)</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Title / Summary <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Completed Sprint 4 Early with Zero Defects"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Detailed Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide objective facts, context, client feedback, or incident details..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Action Plan / Next Steps (Optional)
            </label>
            <textarea
              rows={2}
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder="Agreed improvement goals, timeline, follow-up check-in date..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Footer */}
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
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Record</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
