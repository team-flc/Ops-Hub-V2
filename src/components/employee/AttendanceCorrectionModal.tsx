import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { EmployeeAttendance } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { getPKTTodayDateString } from '../../lib/pktDateUtils';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance: EmployeeAttendance | null;
  employeeId?: string;
  callerId: string;
  onSuccess: () => void;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  attendance,
  employeeId,
  callerId,
  onSuccess
}) => {
  const [workDate, setWorkDate] = useState(getPKTTodayDateString());
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [status, setStatus] = useState<EmployeeAttendance['status']>('present');
  const [lateDeduction, setLateDeduction] = useState<number>(0);
  const [absenceDeduction, setAbsenceDeduction] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (attendance) {
      setWorkDate(attendance.workDate || getPKTTodayDateString());
      setCheckInTime(attendance.checkInTime ? attendance.checkInTime.slice(11, 16) : '');
      setCheckOutTime(attendance.checkOutTime ? attendance.checkOutTime.slice(11, 16) : '');
      setStatus(attendance.status);
      setLateDeduction(attendance.lateDeduction || 0);
      setAbsenceDeduction(attendance.absenceDeduction || 0);
      setOverrideReason(attendance.correctionReason || '');
    } else {
      setWorkDate(getPKTTodayDateString());
      setCheckInTime('11:00');
      setCheckOutTime('20:00');
      setStatus('present');
      setLateDeduction(0);
      setAbsenceDeduction(0);
      setOverrideReason('');
    }
    setErrorMessage(null);
  }, [attendance, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setErrorMessage('Correction reason is strictly required for management audit trail.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const targetEmpId = attendance?.employeeId || employeeId;
      if (!targetEmpId) {
        setErrorMessage('Employee ID missing.');
        setIsSubmitting(false);
        return;
      }

      // Format ISO strings
      const checkInIso = checkInTime ? `${workDate}T${checkInTime}:00+05:00` : undefined;
      const checkOutIso = checkOutTime ? `${workDate}T${checkOutTime}:00+05:00` : undefined;

      const res = await employeeOperationsService.manualAttendanceCorrection({
        attendanceId: attendance?.id,
        employeeId: targetEmpId,
        workDate,
        checkInTime: checkInIso,
        checkOutTime: checkOutIso,
        status,
        lateDeduction,
        absenceDeduction,
        correctionReason: overrideReason.trim()
      }, callerId);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to apply attendance correction.');
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
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center border border-brand-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                Attendance Correction / Override
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Authoritative timestamp correction with immutable audit trail
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

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Work Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Check In Time (PKT)
              </label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Check Out Time (PKT)
              </label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Attendance Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value as any;
                  setStatus(s);
                  if (s === 'present' || s === 'corrected') {
                    setLateDeduction(0);
                    setAbsenceDeduction(0);
                  } else if (s === 'late') {
                    setLateDeduction(500);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
              >
                <option value="present">Present (On-Time)</option>
                <option value="late">Late Arrival</option>
                <option value="absent">Unapproved Absent</option>
                <option value="early_checkout">Early Checkout</option>
                <option value="incomplete">Incomplete / Missing Punch</option>
                <option value="corrected">Excused / Corrected</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Late Penalty (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={lateDeduction}
                onChange={(e) => setLateDeduction(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Absence Cut (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={absenceDeduction}
                onChange={(e) => setAbsenceDeduction(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Correction / Override Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Excused 15m delay due to power outage / Verified manual check-in..."
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
                  <span>Apply Correction</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
