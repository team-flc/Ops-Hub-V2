import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Clock, Calendar, User } from 'lucide-react';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { formatPKTTime, formatPKTDate } from '../../lib/pktDateUtils';

export interface DeleteAttendanceRecordData {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}

interface DeleteAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance: DeleteAttendanceRecordData | null;
  callerId: string;
  onSuccess: () => void;
}

export const DeleteAttendanceModal: React.FC<DeleteAttendanceModalProps> = ({
  isOpen,
  onClose,
  attendance,
  callerId,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !attendance) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('Please provide a mandatory reason for deleting this attendance record.');
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.deleteAttendanceRecord(
        attendance.id,
        callerId,
        reason.trim()
      );

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setReason('');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete attendance record.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      data-testid="delete-attendance-modal"
    >
      <div className="w-full max-w-lg bg-white dark:bg-dark-card border border-rose-200 dark:border-rose-900/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-rose-100 dark:border-rose-900/30 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <span>Delete Attendance Record</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                  Owner Only
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Authorized permanent removal of attendance entry and proof assets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-white/80 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDelete} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Details Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Employee Name:</span>
              </span>
              <span className="font-bold text-slate-900 dark:text-gray-100 font-mono">
                {attendance.employeeName}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Work Date:</span>
              </span>
              <span className="font-bold text-slate-900 dark:text-gray-100 font-mono">
                {attendance.workDate} ({formatPKTDate(attendance.workDate, 'medium')})
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Punch Times:</span>
              </span>
              <span className="font-bold text-slate-900 dark:text-gray-100 font-mono">
                IN: {formatPKTTime(attendance.checkInTime)} • OUT: {formatPKTTime(attendance.checkOutTime)}
              </span>
            </div>
          </div>

          {/* Caution Alert */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Permanent Deletion Warning</p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                This action permanently deletes this attendance record from the database, removes all associated screenshot evidence from storage, and resets any attendance hours or deduction penalties tied to this shift. This cannot be undone.
              </p>
            </div>
          </div>

          {/* Reason Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Reason for Deletion <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Test entry deletion authorized by owner M. Faseeh Lall..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none font-sans"
              data-testid="delete-attendance-reason-input"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-dark-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting || !reason.trim()}
              data-testid="confirm-delete-attendance-btn"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-500/20 flex items-center gap-2 cursor-pointer"
            >
              {isDeleting ? (
                <span>Deleting...</span>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
