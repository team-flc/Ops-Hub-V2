import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, Camera, Upload, AlertTriangle, CheckCircle2, 
  Monitor, Building, Home, Check, RefreshCw, X, AlertCircle 
} from 'lucide-react';
import { EmployeeAttendance, EmployeeRecord, WorkShift } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface EmployeeAttendanceControlProps {
  employeeRecord: EmployeeRecord | null;
  shift: WorkShift | null;
  todayAttendance: EmployeeAttendance | null;
  onAttendanceUpdated: () => void;
  onOpenSOPModal?: () => void;
}

export const EmployeeAttendanceControl: React.FC<EmployeeAttendanceControlProps> = ({
  employeeRecord,
  shift,
  todayAttendance,
  onAttendanceUpdated,
  onOpenSOPModal
}) => {
  // Current Pakistan Standard Time Ticker (PKT / UTC+5)
  const [currentPKT, setCurrentPKT] = useState<string>('');
  const [currentPKTDate, setCurrentPKTDate] = useState<Date>(new Date());
  
  // Form State
  const [workMode, setWorkMode] = useState<'office' | 'remote'>('office');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');
  
  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update live PKT clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format in Asia/Karachi
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Karachi',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setCurrentPKT(timeStr);
      setCurrentPKTDate(now);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute scheduled shift times
  const scheduledStartTimeStr = employeeRecord?.customCheckInTime || shift?.startTime || '11:00:00';
  const scheduledEndTimeStr = employeeRecord?.customCheckOutTime || shift?.endTime || '20:00:00';

  // Work date in PKT format (YYYY-MM-DD)
  const todayWorkDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(currentPKTDate);

  // Check if current time is late relative to shift start
  const getLatenessInfo = () => {
    if (!todayWorkDate) return { isLate: false, minutesLate: 0 };
    const [startH, startM] = scheduledStartTimeStr.split(':').map(Number);
    const scheduledStart = new Date(currentPKTDate);
    scheduledStart.setHours(startH, startM, 0, 0);

    const diffMs = currentPKTDate.getTime() - scheduledStart.getTime();
    if (diffMs > 0) {
      const minutesLate = Math.ceil(diffMs / 60000);
      return { isLate: true, minutesLate };
    }
    return { isLate: false, minutesLate: 0 };
  };

  const lateness = getLatenessInfo();

  // Screen capture action
  const handleCaptureScreen = async () => {
    setIsCapturingScreen(true);
    setErrorMessage(null);
    try {
      const res = await employeeOperationsService.captureScreenFrame();
      if (res.error || !res.blob) {
        setErrorMessage(res.error || 'Screen capture was cancelled or failed. Please use manual upload.');
      } else {
        setCapturedBlob(res.blob);
        setManualFile(null);
        const objectUrl = URL.createObjectURL(res.blob);
        setPreviewUrl(objectUrl);
        setSuccessMessage('Screen frame captured and compressed successfully (JPEG 0.70).');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Screen capture failed.');
    } finally {
      setIsCapturingScreen(false);
    }
  };

  // Manual screenshot upload fallback
  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPEG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Screenshot file size exceeds 5MB limit.');
      return;
    }

    setManualFile(file);
    setCapturedBlob(null);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
    setSuccessMessage('Screenshot attached.');
  };

  const clearEvidence = () => {
    setCapturedBlob(null);
    setManualFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clock In Action
  const handleClockIn = async () => {
    if (!employeeRecord) {
      setErrorMessage('Employee profile not loaded.');
      return;
    }

    if (!employeeRecord.sopAcknowledged) {
      setErrorMessage('You must review and acknowledge the Company SOP before clocking in.');
      if (onOpenSOPModal) onOpenSOPModal();
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await employeeOperationsService.checkIn({
        employeeId: employeeRecord.id,
        workDate: todayWorkDate,
        shiftId: shift?.id,
        evidenceBlob: capturedBlob || undefined,
        manualFile: manualFile || undefined,
        metadata: {
          workMode,
          browserTime: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(
          res.attendance?.status === 'late'
            ? `Clocked in successfully (Marked LATE with PKR ${res.attendance.lateDeduction} penalty).`
            : 'Clocked in on time! Have a productive shift.'
        );
        clearEvidence();
        onAttendanceUpdated();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to clock in.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Clock Out Action
  const handleClockOut = async () => {
    if (!todayAttendance || !employeeRecord) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await employeeOperationsService.checkOut({
        attendanceId: todayAttendance.id,
        employeeId: employeeRecord.id,
        evidenceBlob: capturedBlob || undefined,
        manualFile: manualFile || undefined,
        earlyCheckoutReason: earlyCheckoutReason.trim() || undefined,
        metadata: {
          browserTime: new Date().toISOString()
        }
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage('Clocked out successfully. Shift completed!');
        clearEvidence();
        onAttendanceUpdated();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to clock out.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isCheckedIn = Boolean(todayAttendance && todayAttendance.checkInTime);
  const isCheckedOut = Boolean(todayAttendance && todayAttendance.checkOutTime);

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border shadow-sm space-y-6">
      {/* Top Header & PKT Clock */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-gray-100">
                Attendance & Workstation Clock
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                Asia/Karachi (PKT)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Shift: <span className="font-semibold text-slate-700 dark:text-gray-300">{shift?.name || 'Standard Shift'}</span> ({scheduledStartTimeStr.slice(0, 5)} – {scheduledEndTimeStr.slice(0, 5)} PKT)
            </p>
          </div>
        </div>

        {/* Live Digital Clock */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-dark-sidebar border border-slate-800 dark:border-dark-border shadow-inner">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-sm sm:text-base font-bold tracking-wider">
            {currentPKT || '--:--:-- --'}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase">PKT</span>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">{successMessage}</div>
        </div>
      )}

      {/* State 1: Already Completed Shift */}
      {isCheckedOut && (
        <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Shift Completed Today ({todayWorkDate})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white/70 dark:bg-dark-card border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-500 dark:text-gray-400 block text-[10px] font-semibold uppercase">Check In</span>
              <span className="font-bold text-slate-800 dark:text-gray-200">
                {todayAttendance?.checkInTime ? new Date(todayAttendance.checkInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '--'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/70 dark:bg-dark-card border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-500 dark:text-gray-400 block text-[10px] font-semibold uppercase">Check Out</span>
              <span className="font-bold text-slate-800 dark:text-gray-200">
                {todayAttendance?.checkOutTime ? new Date(todayAttendance.checkOutTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '--'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/70 dark:bg-dark-card border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-500 dark:text-gray-400 block text-[10px] font-semibold uppercase">Status</span>
              <span className={`font-bold capitalize ${todayAttendance?.status === 'late' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {todayAttendance?.status || 'Present'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/70 dark:bg-dark-card border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-500 dark:text-gray-400 block text-[10px] font-semibold uppercase">Total Hours</span>
              <span className="font-bold text-slate-800 dark:text-gray-200">
                {todayAttendance?.totalHours ? `${todayAttendance.totalHours} hrs` : '--'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* State 2: Checked In (Awaiting Clock Out) */}
      {isCheckedIn && !isCheckedOut && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                Active Session
              </span>
              <div className="text-sm font-bold text-slate-900 dark:text-gray-100 mt-0.5">
                Checked in at {new Date(todayAttendance!.checkInTime!).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' })} PKT
                {todayAttendance?.status === 'late' && (
                  <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
                    Late ({todayAttendance.minutesLate}m)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-dark-card border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 shadow-xs">
                Work Mode: {todayAttendance?.workMode === 'remote' ? 'Remote' : 'Office'}
              </span>
            </div>
          </div>

          {/* Evidence Capture for Clock Out */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Shift End Workstation Evidence
            </label>

            {previewUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-300 dark:border-dark-border bg-black max-w-sm">
                <img src={previewUrl} alt="Screen Evidence" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={clearEvidence}
                  className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/70 text-white hover:bg-black transition-colors"
                  title="Remove screenshot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCaptureScreen}
                  disabled={isCapturingScreen}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-brand-600 hover:bg-slate-800 text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isCapturingScreen ? 'Capturing...' : 'Capture Desktop Screen'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-dark-card border border-slate-300 dark:border-dark-border hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-gray-200 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Screenshot</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleManualUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Early Checkout Reason Prompt if applicable */}
            <div className="space-y-1 pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Early Checkout Reason (Optional if checking out before {scheduledEndTimeStr.slice(0, 5)})
              </label>
              <input
                type="text"
                value={earlyCheckoutReason}
                onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                placeholder="e.g. Completed client sprint tasks early / Manager approved"
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Clock Out Action Button */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleClockOut}
            className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            <span>Clock Out & End Shift</span>
          </button>
        </div>
      )}

      {/* State 3: Not Checked In Yet */}
      {!isCheckedIn && (
        <div className="space-y-5">
          {/* Lateness Warning Banner */}
          {lateness.isLate ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Late Check-In Notice: {lateness.minutesLate} minutes past shift start</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Checking in now will record a Late mark with the standard flat PKR 500 late penalty deduction.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>You are on time for your scheduled shift ({scheduledStartTimeStr.slice(0, 5)} PKT).</span>
            </div>
          )}

          {/* Work Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Work Location
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => setWorkMode('office')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  workMode === 'office'
                    ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/30 dark:border-brand-400 dark:text-brand-300 shadow-xs'
                    : 'bg-slate-50 dark:bg-dark-sidebar border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-400 hover:bg-slate-100'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Office</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkMode('remote')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  workMode === 'remote'
                    ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/30 dark:border-brand-400 dark:text-brand-300 shadow-xs'
                    : 'bg-slate-50 dark:bg-dark-sidebar border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-400 hover:bg-slate-100'
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Remote / WFH</span>
              </button>
            </div>
          </div>

          {/* Evidence Capture for Clock In */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
                Workstation Screen Evidence (Mandatory)
              </label>
              <span className="text-[10px] text-slate-400 font-normal">Automated compression (JPEG 0.70)</span>
            </div>

            {previewUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-300 dark:border-dark-border bg-black max-w-sm">
                <img src={previewUrl} alt="Screen Evidence" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={clearEvidence}
                  className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/70 text-white hover:bg-black transition-colors"
                  title="Remove screenshot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCaptureScreen}
                  disabled={isCapturingScreen}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-brand-600 hover:bg-slate-800 text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isCapturingScreen ? 'Capturing...' : 'Capture Desktop Screen'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-dark-card border border-slate-300 dark:border-dark-border hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-gray-200 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Screenshot</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleManualUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Clock In Action Button */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleClockIn}
            className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span>Clock In Now ({todayWorkDate})</span>
          </button>
        </div>
      )}
    </div>
  );
};
