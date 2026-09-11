import { supabase } from './supabase';
import { 
  WorkShift, 
  CompanyWorkSchedule, 
  EmployeeRecord, 
  EmployeeAttendance, 
  CompanyAsset, 
  EmployeeBankDetails, 
  EmployeeProfileChangeRequest, 
  EmployeePayrollRecord, 
  EmployeePerformanceRecord, 
  EmployeeManagementTask, 
  EmployeeFinalSettlement, 
  EmployeeFullDossier,
  UserProfile,
  UserRole,
  AttendanceStatus,
  AssetStatus,
  NoticePeriodStatus,
  GoodStandingStatus,
  AssetClearanceStatus
} from '../types';

export interface CheckInPayload {
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  shiftId?: string;
  evidenceBlob?: Blob;
  manualFile?: File;
  metadata?: Record<string, any>;
}

export interface CheckOutPayload {
  attendanceId: string;
  employeeId: string;
  evidenceBlob?: Blob;
  manualFile?: File;
  earlyCheckoutReason?: string;
  metadata?: Record<string, any>;
}

export const employeeOperationsService = {
  // Timezone & Date Utilities (Asia/Karachi PKT)
  getTodayDatePKT(d: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  },

  formatPKTDateTime(dateInput: string | Date): string {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d) + ' PKT';
  },

  getDaysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  },

  // ===========================================================================
  // 1. WORK SHIFTS & COMPANY SCHEDULES
  // ===========================================================================

  async fetchWorkShifts(): Promise<WorkShift[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('work_shifts')
        .select('*')
        .order('start_time', { ascending: true });

      if (error || !data) return [];
      return data.map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        startTime: s.start_time,
        endTime: s.end_time,
        crossesMidnight: s.crosses_midnight,
        timezone: s.timezone,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));
    } catch {
      return [];
    }
  },

  async fetchCompanySchedules(): Promise<CompanyWorkSchedule[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('company_work_schedules')
        .select('*')
        .order('effective_from', { ascending: false });

      if (error || !data) return [];
      return data.map((s: any) => ({
        id: s.id,
        effectiveFrom: s.effective_from,
        effectiveTo: s.effective_to,
        workingDays: s.working_days || [1, 2, 3, 4, 5, 6],
        description: s.description,
        createdAt: s.created_at,
        createdBy: s.created_by
      }));
    } catch {
      return [];
    }
  },

  isWorkingDay(date: Date, schedules: CompanyWorkSchedule[]): boolean {
    const dateStr = this.getTodayDatePKT(date);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const normalizedDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 1..7 (Mon..Sun)

    // Find schedule active for this date
    const activeSchedule = schedules.find((s) => {
      const fromMatch = s.effectiveFrom <= dateStr;
      const toMatch = !s.effectiveTo || s.effectiveTo >= dateStr;
      return fromMatch && toMatch;
    });

    const workingDays = activeSchedule ? activeSchedule.workingDays : [1, 2, 3, 4, 5, 6];
    // Sunday (0 or 7) is not a working day unless explicitly in workingDays
    return workingDays.includes(dayOfWeek) || workingDays.includes(normalizedDay);
  },

  // ===========================================================================
  // 2. EMPLOYEE RECORDS & COMPANION PROFILES
  // ===========================================================================

  async fetchEmployeeRecord(employeeId: string): Promise<EmployeeRecord | null> {
    if (!supabase || !employeeId) return null;
    try {
      const { data, error } = await supabase
        .from('employee_records')
        .select('*, work_shifts(*)')
        .eq('id', employeeId)
        .maybeSingle();

      if (error || !data) return null;
      return {
        id: data.id,
        employeeId: data.employee_id,
        employmentType: data.employment_type,
        dateOfBirth: data.date_of_birth,
        salary: Number(data.salary || 0),
        jobDescription: data.job_description,
        shiftId: data.shift_id,
        shift: data.work_shifts ? {
          id: data.work_shifts.id,
          name: data.work_shifts.name,
          code: data.work_shifts.code,
          startTime: data.work_shifts.start_time,
          endTime: data.work_shifts.end_time,
          crossesMidnight: data.work_shifts.crosses_midnight,
          timezone: data.work_shifts.timezone,
          createdAt: data.work_shifts.created_at,
          updatedAt: data.work_shifts.updated_at
        } : null,
        customCheckInTime: data.custom_check_in_time,
        customCheckOutTime: data.custom_check_out_time,
        employmentStatus: data.employment_status,
        sopAcknowledged: data.sop_acknowledged,
        sopAcknowledgedAt: data.sop_acknowledged_at,
        sopVersion: data.sop_version,
        setupCompletedAt: data.setup_completed_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        createdBy: data.created_by,
        updatedBy: data.updated_by
      };
    } catch {
      return null;
    }
  },

  async fetchAllEmployeeRecords(): Promise<EmployeeRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('employee_records')
        .select('*, work_shifts(*)');

      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        employeeId: d.employee_id,
        employmentType: d.employment_type,
        dateOfBirth: d.date_of_birth,
        salary: Number(d.salary || 0),
        jobDescription: d.job_description,
        shiftId: d.shift_id,
        shift: d.work_shifts ? {
          id: d.work_shifts.id,
          name: d.work_shifts.name,
          code: d.work_shifts.code,
          startTime: d.work_shifts.start_time,
          endTime: d.work_shifts.end_time,
          crossesMidnight: d.work_shifts.crosses_midnight,
          timezone: d.work_shifts.timezone,
          createdAt: d.work_shifts.created_at,
          updatedAt: d.work_shifts.updated_at
        } : null,
        customCheckInTime: d.custom_check_in_time,
        customCheckOutTime: d.custom_check_out_time,
        employmentStatus: d.employment_status,
        sopAcknowledged: d.sop_acknowledged,
        sopAcknowledgedAt: d.sop_acknowledged_at,
        sopVersion: d.sop_version,
        setupCompletedAt: d.setup_completed_at,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        createdBy: d.created_by,
        updatedBy: d.updated_by
      }));
    } catch {
      return [];
    }
  },

  async upsertEmployeeRecord(
    record: Partial<EmployeeRecord> & { id: string },
    callerId: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const dbPayload: any = {
        id: record.id,
        employee_id: record.employeeId || null,
        employment_type: record.employmentType || 'full_time',
        date_of_birth: record.dateOfBirth || null,
        salary: record.salary !== undefined ? record.salary : 0,
        job_description: record.jobDescription || null,
        shift_id: record.shiftId || null,
        custom_check_in_time: record.customCheckInTime || null,
        custom_check_out_time: record.customCheckOutTime || null,
        employment_status: record.employmentStatus || 'active',
        setup_completed_at: record.setupCompletedAt !== undefined ? record.setupCompletedAt : undefined,
        updated_at: new Date().toISOString(),
        updated_by: callerId
      };

      const { error } = await supabase
        .from('employee_records')
        .upsert(dbPayload, { onConflict: 'id' });

      if (error) return { error: error.message };

      // Immutable audit event
      await supabase.from('system_audit_events').insert({
        actor_id: callerId,
        action: 'employee_record_updated',
        entity_type: 'employee_record',
        entity_id: record.id,
        new_state: {
          employeeId: record.employeeId,
          employmentType: record.employmentType,
          salary: record.salary,
          employmentStatus: record.employmentStatus,
          setupCompleted: Boolean(record.setupCompletedAt)
        },
        reason: 'Management employee record update'
      });

      return {};
    } catch (err: any) {
      return { error: err.message || 'Failed to save employee record.' };
    }
  },

  async acknowledgeSOP(employeeId: string, version: string = '1.0'): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const { error } = await supabase
        .from('employee_records')
        .upsert({
          id: employeeId,
          sop_acknowledged: true,
          sop_acknowledged_at: new Date().toISOString(),
          sop_version: version,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ===========================================================================
  // 3. ATTENDANCE & EVIDENCE WORKFLOWS
  // ===========================================================================

  calculateLateMinutes(scheduledTime: Date, actualTime: Date): { isLate: boolean; minutesLate: number; deduction: number } {
    const diffMs = actualTime.getTime() - scheduledTime.getTime();
    if (diffMs > 0) {
      const minutesLate = Math.ceil(diffMs / 60000);
      // Flat PKR 500 late deduction per late occurrence (1m, 15m, 180m = PKR 500, no monthly cap)
      return { isLate: true, minutesLate, deduction: 500 };
    }
    return { isLate: false, minutesLate: 0, deduction: 0 };
  },

  calculateLateDeduction(minutesLate: number): number {
    return minutesLate > 0 ? 500 : 0;
  },

  calculateAbsenceDeduction(monthlySalary: number, dateOrDateStr: Date | string): number {
    if (monthlySalary <= 0) return 0;
    let year: number;
    let month: number;
    if (typeof dateOrDateStr === 'string') {
      const [y, m] = dateOrDateStr.split('-').map(Number);
      year = y;
      month = m;
    } else {
      year = dateOrDateStr.getFullYear();
      month = dateOrDateStr.getMonth() + 1;
    }
    const totalDaysInMonth = this.getDaysInMonth(year, month);
    return Math.round((monthlySalary / totalDaysInMonth) * 100) / 100;
  },

  async captureScreenFrame(): Promise<{ blob?: Blob; error?: string }> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return { error: 'Desktop screen capture is not supported in this browser. Please use manual screenshot upload.' };
    }

    try {
      // Prompt for Entire Screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor' as any
        }
      });

      // Strict enforcement: Where browser exposes displaySurface, reject tab / window captures
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings() as any;
      if (settings?.displaySurface && settings.displaySurface !== 'monitor') {
        stream.getTracks().forEach((t) => t.stop());
        return { 
          error: 'Please select "Entire Screen" rather than an individual tab or window so your workstation taskbar and system clock can be verified.' 
        };
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Wait a moment for frame to stabilize
      await new Promise((r) => setTimeout(r, 400));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        stream.getTracks().forEach((t) => t.stop());
        return { error: 'Failed to create canvas context for screenshot.' };
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Stop stream immediately after capture
      stream.getTracks().forEach((t) => t.stop());

      // Overlay official PKT date/time stamp badge in bottom-right corner
      const nowPKT = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date());

      const stampText = `Ops Hub PKT: ${nowPKT} PKT`;
      ctx.font = 'bold 20px monospace';
      const textMetrics = ctx.measureText(stampText);
      const textWidth = textMetrics.width;
      const boxPadding = 12;
      const boxX = canvas.width - textWidth - boxPadding * 2 - 20;
      const boxY = canvas.height - 48;

      // Dark translucent badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(boxX, boxY, textWidth + boxPadding * 2, 36);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, textWidth + boxPadding * 2, 36);

      // Text
      ctx.fillStyle = '#10b981';
      ctx.fillText(stampText, boxX + boxPadding, boxY + 24);

      // Compress JPEG at 0.70 quality keeping taskbar clock legible and storage small (~60-120KB)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.70);
      });

      if (!blob) {
        return { error: 'Failed to compress screenshot image.' };
      }

      return { blob };
    } catch (err: any) {
      return { error: err.message || 'Screen capture was cancelled or denied.' };
    }
  },

  async checkIn(payload: CheckInPayload): Promise<{ attendance?: EmployeeAttendance; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };

    try {
      // 1. Fetch employee record to get shift & schedule
      const empRecord = await this.fetchEmployeeRecord(payload.employeeId);
      const shifts = await this.fetchWorkShifts();
      const defaultShift = shifts.find((s) => s.code === 'morning') || shifts[0];
      const activeShift = (empRecord?.shiftId ? shifts.find((s) => s.id === empRecord.shiftId) : null) || defaultShift;

      // 2. Compute scheduled check-in time in Asia/Karachi (PKT)
      const checkInTimeStr = empRecord?.customCheckInTime || activeShift?.startTime || '11:00:00';
      const checkOutTimeStr = empRecord?.customCheckOutTime || activeShift?.endTime || '20:00:00';

      const scheduledCheckIn = new Date(`${payload.workDate}T${checkInTimeStr}`);
      let scheduledCheckOut = new Date(`${payload.workDate}T${checkOutTimeStr}`);
      if (activeShift?.crossesMidnight || checkOutTimeStr < checkInTimeStr) {
        scheduledCheckOut = new Date(scheduledCheckOut.getTime() + 24 * 60 * 60 * 1000);
      }

      const actualCheckIn = new Date(); // authoritative server/client timestamptz

      // Check if already checked in
      const { data: existing } = await supabase
        .from('employee_attendance')
        .select('id, check_in_time')
        .eq('employee_id', payload.employeeId)
        .eq('work_date', payload.workDate)
        .maybeSingle();

      if (existing && existing.check_in_time) {
        return { error: 'You have already checked in for this scheduled shift.' };
      }

      // Calculate Late Status and Flat PKR 500 Deduction
      const lateCalc = this.calculateLateMinutes(scheduledCheckIn, actualCheckIn);
      const status = lateCalc.isLate ? 'late' : 'on_time';

      // 3. Upload Screenshot Evidence to Private Bucket
      let screenshotPath: string | null = null;
      let evidenceType: 'screen_capture' | 'manual_upload' = 'screen_capture';

      if (payload.evidenceBlob) {
        const fileName = `${payload.employeeId}/${payload.workDate}_checkin_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('employee-attendance-evidence')
          .upload(fileName, payload.evidenceBlob, { contentType: 'image/jpeg', upsert: true });

        if (!uploadErr && uploadData) {
          screenshotPath = uploadData.path;
        }
      } else if (payload.manualFile) {
        evidenceType = 'manual_upload';
        const fileExt = payload.manualFile.name.split('.').pop() || 'jpg';
        const fileName = `${payload.employeeId}/${payload.workDate}_checkin_manual_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('employee-attendance-evidence')
          .upload(fileName, payload.manualFile, { upsert: true });

        if (!uploadErr && uploadData) {
          screenshotPath = uploadData.path;
        }
      }

      if (!screenshotPath) {
        return { error: 'Attendance proof screenshot is required to complete check-in.' };
      }

      // 4. Upsert Attendance Record
      const attendanceData: any = {
        employee_id: payload.employeeId,
        work_date: payload.workDate,
        shift_id: activeShift?.id || null,
        scheduled_check_in: scheduledCheckIn.toISOString(),
        scheduled_check_out: scheduledCheckOut.toISOString(),
        check_in_time: actualCheckIn.toISOString(),
        status,
        minutes_late: lateCalc.minutesLate,
        late_deduction: lateCalc.deduction,
        absence_deduction: 0,
        check_in_screenshot_path: screenshotPath,
        check_in_evidence_type: evidenceType,
        check_in_metadata: payload.metadata || { userAgent: navigator.userAgent },
        updated_at: new Date().toISOString()
      };

      const { data: saved, error: saveErr } = await supabase
        .from('employee_attendance')
        .upsert(attendanceData, { onConflict: 'employee_id,work_date' })
        .select()
        .single();

      if (saveErr || !saved) {
        return { error: saveErr?.message || 'Failed to record attendance.' };
      }

      // Resolve any open missing_checkin_60m alert tasks for this employee/date
      await supabase
        .from('employee_management_tasks')
        .update({
          status: 'resolved',
          resolution_notes: `Employee checked in at ${actualCheckIn.toLocaleTimeString()} (${status})`,
          resolved_at: new Date().toISOString()
        })
        .eq('employee_id', payload.employeeId)
        .eq('task_type', 'missing_checkin_60m')
        .eq('reference_id', payload.workDate);

      return {
        attendance: {
          id: saved.id,
          employeeId: saved.employee_id,
          workDate: saved.work_date,
          shiftId: saved.shift_id,
          scheduledCheckIn: saved.scheduled_check_in,
          scheduledCheckOut: saved.scheduled_check_out,
          checkInTime: saved.check_in_time,
          checkOutTime: saved.check_out_time,
          status: saved.status,
          minutesLate: saved.minutes_late,
          lateDeduction: Number(saved.late_deduction || 0),
          absenceDeduction: Number(saved.absence_deduction || 0),
          checkInScreenshotPath: saved.check_in_screenshot_path,
          checkOutScreenshotPath: saved.check_out_screenshot_path,
          checkInEvidenceType: saved.check_in_evidence_type,
          checkOutEvidenceType: saved.check_out_evidence_type,
          earlyCheckoutReason: saved.early_checkout_reason,
          earlyCheckoutStatus: saved.early_checkout_status,
          correctionReason: saved.correction_reason,
          correctedBy: saved.corrected_by,
          correctedAt: saved.corrected_at,
          createdAt: saved.created_at,
          updatedAt: saved.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message || 'Check-in failed.' };
    }
  },

  async checkOut(payload: CheckOutPayload): Promise<{ attendance?: EmployeeAttendance; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };

    try {
      const { data: attendance, error: fetchErr } = await supabase
        .from('employee_attendance')
        .select('*')
        .eq('id', payload.attendanceId)
        .single();

      if (fetchErr || !attendance) {
        return { error: 'Active check-in attendance record not found.' };
      }

      if (!attendance.check_in_time) {
        return { error: 'Cannot checkout without an initial check-in.' };
      }

      const actualCheckOut = new Date();
      const scheduledCheckOut = new Date(attendance.scheduled_check_out);

      // Check for Early Checkout
      const isEarly = actualCheckOut.getTime() < scheduledCheckOut.getTime() - 5 * 60 * 1000; // >5 mins early
      let status = attendance.status;
      if (isEarly && status === 'on_time') {
        status = 'early_checkout';
      }

      // Upload Evidence
      let screenshotPath: string | null = null;
      let evidenceType: 'screen_capture' | 'manual_upload' = 'screen_capture';

      if (payload.evidenceBlob) {
        const fileName = `${payload.employeeId}/${attendance.work_date}_checkout_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('employee-attendance-evidence')
          .upload(fileName, payload.evidenceBlob, { contentType: 'image/jpeg', upsert: true });

        if (!uploadErr && uploadData) {
          screenshotPath = uploadData.path;
        }
      } else if (payload.manualFile) {
        evidenceType = 'manual_upload';
        const fileExt = payload.manualFile.name.split('.').pop() || 'jpg';
        const fileName = `${payload.employeeId}/${attendance.work_date}_checkout_manual_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('employee-attendance-evidence')
          .upload(fileName, payload.manualFile, { upsert: true });

        if (!uploadErr && uploadData) {
          screenshotPath = uploadData.path;
        }
      }

      if (!screenshotPath) {
        return { error: 'Attendance proof screenshot is required to complete checkout.' };
      }

      const updateData: any = {
        check_out_time: actualCheckOut.toISOString(),
        status,
        check_out_screenshot_path: screenshotPath,
        check_out_evidence_type: evidenceType,
        check_out_metadata: payload.metadata || { userAgent: navigator.userAgent },
        early_checkout_reason: payload.earlyCheckoutReason || null,
        early_checkout_status: isEarly ? 'pending_review' : null,
        updated_at: new Date().toISOString()
      };

      const { data: updated, error: updateErr } = await supabase
        .from('employee_attendance')
        .update(updateData)
        .eq('id', payload.attendanceId)
        .select()
        .single();

      if (updateErr || !updated) {
        return { error: updateErr?.message || 'Failed to record checkout.' };
      }

      // If early checkout, create internal management review task
      if (isEarly) {
        await supabase.from('employee_management_tasks').insert({
          task_type: 'early_checkout_review',
          employee_id: payload.employeeId,
          title: `Early Checkout Review: ${attendance.work_date}`,
          description: `Employee checked out early at ${actualCheckOut.toLocaleTimeString()} (Scheduled: ${scheduledCheckOut.toLocaleTimeString()}). Reason: ${payload.earlyCheckoutReason || 'None provided'}.`,
          status: 'open',
          priority: 'normal',
          reference_id: payload.attendanceId,
          idempotency_key: `early_checkout_${payload.attendanceId}`
        });
      }

      return {
        attendance: {
          id: updated.id,
          employeeId: updated.employee_id,
          workDate: updated.work_date,
          shiftId: updated.shift_id,
          scheduledCheckIn: updated.scheduled_check_in,
          scheduledCheckOut: updated.scheduled_check_out,
          checkInTime: updated.check_in_time,
          checkOutTime: updated.check_out_time,
          status: updated.status,
          minutesLate: updated.minutes_late,
          lateDeduction: Number(updated.late_deduction || 0),
          absenceDeduction: Number(updated.absence_deduction || 0),
          checkInScreenshotPath: updated.check_in_screenshot_path,
          checkOutScreenshotPath: updated.check_out_screenshot_path,
          checkInEvidenceType: updated.check_in_evidence_type,
          checkOutEvidenceType: updated.check_out_evidence_type,
          earlyCheckoutReason: updated.early_checkout_reason,
          earlyCheckoutStatus: updated.early_checkout_status,
          correctionReason: updated.correction_reason,
          correctedBy: updated.corrected_by,
          correctedAt: updated.corrected_at,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message || 'Checkout failed.' };
    }
  },

  async fetchEmployeeAttendance(
    employeeId: string,
    startDate?: string,
    endDate?: string
  ): Promise<EmployeeAttendance[]> {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('employee_attendance')
        .select('*')
        .eq('employee_id', employeeId);

      if (startDate) query = query.gte('work_date', startDate);
      if (endDate) query = query.lte('work_date', endDate);

      const { data, error } = await query.order('work_date', { ascending: false });
      if (error || !data) return [];

      return data.map((a: any) => ({
        id: a.id,
        employeeId: a.employee_id,
        workDate: a.work_date,
        shiftId: a.shift_id,
        scheduledCheckIn: a.scheduled_check_in,
        scheduledCheckOut: a.scheduled_check_out,
        checkInTime: a.check_in_time,
        checkOutTime: a.check_out_time,
        status: a.status,
        minutesLate: a.minutes_late,
        lateDeduction: Number(a.late_deduction || 0),
        absenceDeduction: Number(a.absence_deduction || 0),
        checkInScreenshotPath: a.check_in_screenshot_path,
        checkOutScreenshotPath: a.check_out_screenshot_path,
        checkInEvidenceType: a.check_in_evidence_type,
        checkOutEvidenceType: a.check_out_evidence_type,
        earlyCheckoutReason: a.early_checkout_reason,
        earlyCheckoutStatus: a.early_checkout_status,
        correctionReason: a.correction_reason,
        correctedBy: a.corrected_by,
        correctedAt: a.corrected_at,
        createdAt: a.created_at,
        updatedAt: a.updated_at
      }));
    } catch {
      return [];
    }
  },

  async fetchTodayAttendance(
    employeeId: string,
    dateStr?: string
  ): Promise<EmployeeAttendance | null> {
    if (!supabase || !employeeId) return null;
    try {
      const today = dateStr || this.getTodayDatePKT();
      const { data, error } = await supabase
        .from('employee_attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('work_date', today)
        .maybeSingle();

      if (error || !data) return null;
      return {
        id: data.id,
        employeeId: data.employee_id,
        workDate: data.work_date,
        shiftId: data.shift_id,
        scheduledCheckIn: data.scheduled_check_in || '11:00:00',
        scheduledCheckOut: data.scheduled_check_out || '20:00:00',
        checkInTime: data.check_in_time,
        checkOutTime: data.check_out_time,
        status: data.status,
        minutesLate: data.minutes_late || 0,
        lateDeduction: Number(data.late_deduction || 0),
        absenceDeduction: Number(data.absence_deduction || 0),
        checkInScreenshotPath: data.check_in_screenshot_path,
        checkOutScreenshotPath: data.check_out_screenshot_path,
        checkInEvidenceType: data.check_in_evidence_type,
        checkOutEvidenceType: data.check_out_evidence_type,
        earlyCheckoutReason: data.early_checkout_reason,
        earlyCheckoutStatus: data.early_checkout_status,
        correctionReason: data.correction_reason,
        correctedBy: data.corrected_by,
        correctedAt: data.corrected_at,
        screenCaptureUrl: data.check_in_screenshot_path,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch {
      return null;
    }
  },

  async fetchAllTodayAttendance(dateStr?: string): Promise<EmployeeAttendance[]> {
    if (!supabase) return [];
    try {
      const today = dateStr || this.getTodayDatePKT();
      const { data, error } = await supabase
        .from('employee_attendance')
        .select('*')
        .eq('work_date', today)
        .not('check_in_time', 'is', null)
        .order('check_in_time', { ascending: true });

      if (error || !data) return [];
      return data.map((a: any) => ({
        id: a.id,
        employeeId: a.employee_id,
        workDate: a.work_date,
        shiftId: a.shift_id,
        scheduledCheckIn: a.scheduled_check_in || '11:00:00',
        scheduledCheckOut: a.scheduled_check_out || '20:00:00',
        checkInTime: a.check_in_time,
        checkOutTime: a.check_out_time,
        status: a.status,
        minutesLate: a.minutes_late || 0,
        lateDeduction: Number(a.late_deduction || 0),
        absenceDeduction: Number(a.absence_deduction || 0),
        checkInScreenshotPath: a.check_in_screenshot_path,
        checkOutScreenshotPath: a.check_out_screenshot_path,
        checkInEvidenceType: a.check_in_evidence_type,
        checkOutEvidenceType: a.check_out_evidence_type,
        earlyCheckoutReason: a.early_checkout_reason,
        earlyCheckoutStatus: a.early_checkout_status,
        correctionReason: a.correction_reason,
        correctedBy: a.corrected_by,
        correctedAt: a.corrected_at,
        screenCaptureUrl: a.check_in_screenshot_path,
        createdAt: a.created_at,
        updatedAt: a.updated_at
      }));
    } catch {
      return [];
    }
  },

  async correctAttendanceRecord(
    attendanceId: string,
    correction: {
      status?: 'on_time' | 'late' | 'absent' | 'incomplete' | 'early_checkout' | 'corrected';
      checkInTime?: string;
      checkOutTime?: string;
      lateDeduction?: number;
      absenceDeduction?: number;
      correctionReason: string;
    },
    callerId: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    if (!correction.correctionReason.trim()) {
      return { error: 'A mandatory correction reason is required for audit history.' };
    }

    try {
      const updateData: any = {
        correction_reason: correction.correctionReason.trim(),
        corrected_by: callerId,
        corrected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (correction.status) updateData.status = correction.status;
      if (correction.checkInTime) updateData.check_in_time = correction.checkInTime;
      if (correction.checkOutTime) updateData.check_out_time = correction.checkOutTime;
      if (correction.lateDeduction !== undefined) updateData.late_deduction = correction.lateDeduction;
      if (correction.absenceDeduction !== undefined) updateData.absence_deduction = correction.absenceDeduction;

      const { error } = await supabase
        .from('employee_attendance')
        .update(updateData)
        .eq('id', attendanceId);

      if (error) return { error: error.message };

      // Immutable Audit Entry
      await supabase.from('system_audit_events').insert({
        actor_id: callerId,
        action: 'attendance_corrected',
        entity_type: 'employee_attendance',
        entity_id: attendanceId,
        new_state: updateData,
        reason: correction.correctionReason.trim()
      });

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ===========================================================================
  // 4. COMPANY ASSETS
  // ===========================================================================

  async fetchEmployeeAssets(employeeId: string): Promise<CompanyAsset[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('company_assets')
        .select('*')
        .eq('employee_id', employeeId)
        .order('issue_date', { ascending: false });

      if (error || !data) return [];
      return data.map((a: any) => ({
        id: a.id,
        employeeId: a.employee_id,
        itemName: a.item_name,
        issueDate: a.issue_date,
        price: Number(a.price || 0),
        status: a.status,
        acknowledgedAt: a.acknowledged_at,
        acknowledgedBy: a.acknowledged_by,
        returnDate: a.return_date,
        damageLossReason: a.damage_loss_reason,
        damageLossEvidenceUrl: a.damage_loss_evidence_url,
        financialRecoveryApproved: a.financial_recovery_approved,
        financialRecoveryAmount: Number(a.financial_recovery_amount || 0),
        recoveryPayrollPeriod: a.recovery_payroll_period,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        createdBy: a.created_by,
        updatedBy: a.updated_by
      }));
    } catch {
      return [];
    }
  },

  async assignAsset(
    payload: { employeeId: string; itemName: string; issueDate: string; price: number },
    callerId: string
  ): Promise<{ asset?: CompanyAsset; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    if (!payload.itemName.trim()) return { error: 'Item Name is required.' };
    if (payload.price < 0) return { error: 'Price must be non-negative.' };

    try {
      const { data, error } = await supabase
        .from('company_assets')
        .insert({
          employee_id: payload.employeeId,
          item_name: payload.itemName.trim(),
          issue_date: payload.issueDate,
          price: payload.price,
          status: 'assigned',
          created_by: callerId
        })
        .select()
        .single();

      if (error || !data) return { error: error?.message || 'Failed to assign asset.' };

      // Audit Log
      await supabase.from('system_audit_events').insert({
        actor_id: callerId,
        action: 'asset_assigned',
        entity_type: 'company_asset',
        entity_id: data.id,
        new_state: { itemName: data.item_name, price: data.price, employeeId: data.employee_id }
      });

      return {
        asset: {
          id: data.id,
          employeeId: data.employee_id,
          itemName: data.item_name,
          issueDate: data.issue_date,
          price: Number(data.price),
          status: data.status,
          financialRecoveryApproved: false,
          financialRecoveryAmount: 0,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async acknowledgeAsset(assetId: string, employeeId: string): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const { error } = await supabase
        .from('company_assets')
        .update({
          status: 'received',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: employeeId,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId)
        .eq('employee_id', employeeId);

      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async updateAssetStatus(
    assetId: string,
    update: {
      status: 'returned' | 'damaged' | 'lost';
      returnDate?: string;
      damageLossReason?: string;
      damageLossEvidenceUrl?: string;
      financialRecoveryApproved?: boolean;
      financialRecoveryAmount?: number;
      recoveryPayrollPeriod?: string;
    },
    callerId: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    if ((update.status === 'damaged' || update.status === 'lost') && !update.damageLossReason?.trim()) {
      return { error: 'A mandatory reason is required for damaged or lost assets.' };
    }

    try {
      const dbUpdate: any = {
        status: update.status,
        return_date: update.returnDate || new Date().toISOString().split('T')[0],
        damage_loss_reason: update.damageLossReason?.trim() || null,
        damage_loss_evidence_url: update.damageLossEvidenceUrl || null,
        financial_recovery_approved: update.financialRecoveryApproved || false,
        financial_recovery_amount: update.financialRecoveryAmount || 0,
        recovery_payroll_period: update.recoveryPayrollPeriod || null,
        updated_at: new Date().toISOString(),
        updated_by: callerId
      };

      const { error } = await supabase
        .from('company_assets')
        .update(dbUpdate)
        .eq('id', assetId);

      if (error) return { error: error.message };

      await supabase.from('system_audit_events').insert({
        actor_id: callerId,
        action: `asset_${update.status}`,
        entity_type: 'company_asset',
        entity_id: assetId,
        new_state: dbUpdate,
        reason: update.damageLossReason || 'Asset status update'
      });

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ===========================================================================
  // 5. BANK DETAILS & PROFILE CHANGE REQUESTS
  // ===========================================================================

  maskAccountNumber(acc: string): string {
    if (!acc) return '';
    const clean = acc.trim();
    if (clean.length <= 4) return '****';
    return `${clean.slice(0, 2)}${'*'.repeat(clean.length - 6)}${clean.slice(-4)}`;
  },

  async fetchBankDetails(employeeId: string): Promise<EmployeeBankDetails | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('employee_bank_details')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (error || !data) return null;
      return {
        id: data.id,
        employeeId: data.employee_id,
        bankName: data.bank_name,
        accountTitle: data.account_title,
        accountNumberOrIban: data.account_number_or_iban,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        createdBy: data.created_by,
        updatedBy: data.updated_by
      };
    } catch {
      return null;
    }
  },

  async upsertBankDetails(
    payload: {
      employeeId: string;
      bankName: string;
      accountTitle: string;
      accountNumberOrIban?: string;
      accountNumber?: string;
      iban?: string;
      branchCode?: string;
    },
    callerId?: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    const accNum = (payload.accountNumberOrIban || payload.accountNumber || payload.iban || '').trim();
    if (!payload.bankName.trim() || !payload.accountTitle.trim() || !accNum) {
      return { error: 'Bank Name, Account Title, and Account Number/IBAN are all required.' };
    }
    const actorId = callerId || payload.employeeId;

    try {
      const { error } = await supabase
        .from('employee_bank_details')
        .upsert({
          employee_id: payload.employeeId,
          bank_name: payload.bankName.trim(),
          account_title: payload.accountTitle.trim(),
          account_number_or_iban: accNum,
          status: 'active',
          updated_at: new Date().toISOString(),
          updated_by: actorId
        }, { onConflict: 'employee_id' });

      if (error) return { error: error.message };

      // Safe Audit Log (never log complete account number)
      await supabase.from('system_audit_events').insert({
        actor_id: actorId,
        action: 'bank_details_updated',
        entity_type: 'employee_bank_details',
        entity_id: payload.employeeId,
        new_state: {
          bankName: payload.bankName.trim(),
          accountTitle: payload.accountTitle.trim(),
          maskedAccount: this.maskAccountNumber(accNum)
        }
      });

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async submitProfileChangeRequest(
    payload: {
      employeeId: string;
      requestType: 'profile_details' | 'bank_details';
      requestedChanges: Record<string, any>;
      currentValues?: Record<string, any>;
      reason?: string;
    }
  ): Promise<{ request?: EmployeeProfileChangeRequest; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const { data, error } = await supabase
        .from('employee_profile_change_requests')
        .insert({
          employee_id: payload.employeeId,
          request_type: payload.requestType,
          requested_changes: payload.requestedChanges,
          current_values: payload.currentValues || null,
          reason: payload.reason || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error || !data) return { error: error?.message || 'Failed to submit request.' };

      // Create Management Task
      await supabase.from('employee_management_tasks').insert({
        task_type: 'profile_change_request',
        employee_id: payload.employeeId,
        title: `Profile Change Request: ${payload.requestType === 'bank_details' ? 'Bank Details' : 'Personal Info'}`,
        description: `Employee submitted request to update ${payload.requestType}. Reason: ${payload.reason || 'None provided'}.`,
        status: 'open',
        priority: 'normal',
        reference_id: data.id
      });

      return {
        request: {
          id: data.id,
          employeeId: data.employee_id,
          requestType: data.request_type,
          requestedChanges: data.requested_changes,
          currentValues: data.current_values,
          reason: data.reason,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async requestProfileChange(payload: {
    employeeId: string;
    requestType: 'profile_details' | 'bank_details' | 'contact_info' | 'emergency_contact' | 'bank_info' | 'tax_info';
    requestedChanges: Record<string, any>;
    currentValues?: Record<string, any>;
    reason?: string;
  }): Promise<{ request?: EmployeeProfileChangeRequest; error?: string }> {
    return this.submitProfileChangeRequest(payload as any);
  },

  async reviewProfileChangeRequest(
    requestId: string,
    decision: 'approved' | 'rejected',
    reviewerId: string,
    reviewNotes?: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const { data: request, error: fetchErr } = await supabase
        .from('employee_profile_change_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchErr || !request) return { error: 'Change request not found.' };

      // Apply changes if approved
      if (decision === 'approved') {
        if (request.request_type === 'bank_details') {
          await this.upsertBankDetails({
            employeeId: request.employee_id,
            bankName: request.requested_changes.bankName,
            accountTitle: request.requested_changes.accountTitle,
            accountNumberOrIban: request.requested_changes.accountNumberOrIban
          }, reviewerId);
        } else if (request.request_type === 'profile_details') {
          await supabase.from('profiles').update({
            full_name: request.requested_changes.fullName,
            phone: request.requested_changes.phone,
            contact_email: request.requested_changes.contactEmail,
            backup_phone: request.requested_changes.backupPhone,
            updated_at: new Date().toISOString()
          }).eq('id', request.employee_id);
        }
      }

      // Update Request status
      await supabase
        .from('employee_profile_change_requests')
        .update({
          status: decision,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      // Resolve Task
      await supabase
        .from('employee_management_tasks')
        .update({
          status: 'resolved',
          resolution_notes: `Request was ${decision}. Notes: ${reviewNotes || 'None'}`,
          resolved_by: reviewerId,
          resolved_at: new Date().toISOString()
        })
        .eq('reference_id', requestId);

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ===========================================================================
  // 6. PAYROLL MANAGEMENT & SALARY CYCLE
  // ===========================================================================

  calculateDaysUntil15th(currentDate: Date = new Date()): { nextSalaryDate: string; daysRemaining: number } {
    const pktDateStr = this.getTodayDatePKT(currentDate); // 'YYYY-MM-DD'
    const [yearStr, monthStr, dayStr] = pktDateStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1..12
    const day = parseInt(dayStr, 10); // 1..31

    let targetYear = year;
    let targetMonth = month;
    let daysRemaining = 0;

    if (day <= 15) {
      daysRemaining = 15 - day;
    } else {
      const daysInCurrentMonth = this.getDaysInMonth(year, month);
      const daysLeftInCurrentMonth = daysInCurrentMonth - day;
      daysRemaining = daysLeftInCurrentMonth + 15;
      if (month === 12) {
        targetYear = year + 1;
        targetMonth = 1;
      } else {
        targetMonth = month + 1;
      }
    }

    const targetMonthStr = targetMonth.toString().padStart(2, '0');
    const nextSalaryDate = `${targetYear}-${targetMonthStr}-15`;

    return { nextSalaryDate, daysRemaining };
  },

  calculateSalaryCountdown(currentDate: Date = new Date()): { nextSalaryDate: string; daysRemaining: number; formattedMessage: string } {
    const { nextSalaryDate, daysRemaining } = this.calculateDaysUntil15th(currentDate);
    let formattedMessage = '';
    if (daysRemaining === 0) {
      formattedMessage = 'Salary Payout Day Today (15th)';
    } else if (daysRemaining === 1) {
      formattedMessage = '1 day until 15th salary payout';
    } else {
      formattedMessage = `${daysRemaining} days until 15th salary payout`;
    }
    return { nextSalaryDate, daysRemaining, formattedMessage };
  },

  async fetchEmployeePayrollRecords(employeeId: string): Promise<EmployeePayrollRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('employee_payroll_records')
        .select('*')
        .eq('employee_id', employeeId)
        .order('payroll_period', { ascending: false });

      if (error || !data) return [];
      return data.map((p: any) => ({
        id: p.id,
        employeeId: p.employee_id,
        payrollPeriod: p.payroll_period,
        grossSalary: Number(p.gross_salary || 0),
        lateDeductionsTotal: Number(p.late_deductions_total || 0),
        absenceDeductionsTotal: Number(p.absence_deductions_total || 0),
        manualAdjustmentsTotal: Number(p.manual_adjustments_total || 0),
        assetRecoveryDeduction: Number(p.asset_recovery_deduction || 0),
        netPayable: Number(p.net_payable || 0),
        scheduledPaymentDate: p.scheduled_payment_date,
        status: p.status,
        paymentProofPath: p.payment_proof_path,
        paymentDate: p.payment_date,
        paidBy: p.paid_by,
        managementNotes: p.management_notes,
        concernNotes: p.concern_notes,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        createdBy: p.created_by,
        updatedBy: p.updated_by
      }));
    } catch {
      return [];
    }
  },

  async generateMonthlyPayrollRecord(
    employeeId: string,
    period: string, // 'YYYY-MM'
    callerId: string
  ): Promise<{ record?: EmployeePayrollRecord; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      // 1. Fetch Employee Record
      const emp = await this.fetchEmployeeRecord(employeeId);
      if (!emp) return { error: 'Employee record not found.' };

      const [yearStr, monthStr] = period.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const startDate = `${period}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${period}-${lastDay.toString().padStart(2, '0')}`;

      // 2. Fetch Attendance for Period
      const attendance = await this.fetchEmployeeAttendance(employeeId, startDate, endDate);
      const lateTotal = attendance.reduce((sum, a) => sum + (a.lateDeduction || 0), 0);
      const absenceTotal = attendance.reduce((sum, a) => sum + (a.absenceDeduction || 0), 0);

      // 3. Fetch Approved Asset Recovery for this period
      const assets = await this.fetchEmployeeAssets(employeeId);
      const assetRecovery = assets
        .filter((a) => a.financialRecoveryApproved && a.recoveryPayrollPeriod === period)
        .reduce((sum, a) => sum + (a.financialRecoveryAmount || 0), 0);

      // 4. Calculate Net Payable
      const grossSalary = emp.salary || 0;
      const netPayable = Math.max(0, grossSalary - lateTotal - absenceTotal - assetRecovery);

      // Scheduled payment date is 15th of following month
      const nextMonthDate = new Date(year, month, 15);
      const scheduledPaymentDate = nextMonthDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('employee_payroll_records')
        .upsert({
          employee_id: employeeId,
          payroll_period: period,
          gross_salary: grossSalary,
          late_deductions_total: lateTotal,
          absence_deductions_total: absenceTotal,
          asset_recovery_deduction: assetRecovery,
          net_payable: netPayable,
          scheduled_payment_date: scheduledPaymentDate,
          status: 'Draft',
          updated_at: new Date().toISOString(),
          updated_by: callerId
        }, { onConflict: 'employee_id,payroll_period' })
        .select()
        .single();

      if (error || !data) return { error: error?.message || 'Failed to generate payroll.' };

      return {
        record: {
          id: data.id,
          employeeId: data.employee_id,
          payrollPeriod: data.payroll_period,
          grossSalary: Number(data.gross_salary),
          lateDeductionsTotal: Number(data.late_deductions_total),
          absenceDeductionsTotal: Number(data.absence_deductions_total),
          manualAdjustmentsTotal: Number(data.manual_adjustments_total),
          assetRecoveryDeduction: Number(data.asset_recovery_deduction),
          netPayable: Number(data.net_payable),
          scheduledPaymentDate: data.scheduled_payment_date,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async generateMonthlyPayroll(
    periodOrEmployeeId: string,
    callerIdOrPeriod?: string,
    callerId?: string
  ): Promise<any> {
    if (callerId) {
      return this.generateMonthlyPayrollRecord(periodOrEmployeeId, callerIdOrPeriod || '', callerId);
    }
    if (supabase) {
      const { data: employees } = await supabase
        .from('employee_records')
        .select('id, setup_completed_at, employment_status')
        .not('setup_completed_at', 'is', null)
        .neq('employment_status', 'terminated')
        .neq('employment_status', 'resigned');

      if (employees && employees.length > 0) {
        for (const emp of employees) {
          await this.generateMonthlyPayrollRecord(emp.id, periodOrEmployeeId, callerIdOrPeriod || 'system');
        }
      }
    }
    return {};
  },

  async uploadSalaryPaymentProof(
    recordId: string,
    file: File,
    callerId: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `payroll_${recordId}_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('employee-payroll-proofs')
        .upload(fileName, file, { upsert: true });

      if (uploadErr || !uploadData) {
        return { error: uploadErr?.message || 'Failed to upload payment proof.' };
      }

      const { error } = await supabase
        .from('employee_payroll_records')
        .update({
          payment_proof_path: uploadData.path,
          status: 'Paid',
          payment_date: new Date().toISOString(),
          paid_by: callerId,
          updated_at: new Date().toISOString(),
          updated_by: callerId
        })
        .eq('id', recordId);

      if (error) return { error: error.message };

      await supabase.from('system_audit_events').insert({
        actor_id: callerId,
        action: 'salary_paid',
        entity_type: 'employee_payroll_record',
        entity_id: recordId,
        new_state: { status: 'Paid', paymentProof: uploadData.path }
      });

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async uploadPayrollProof(
    recordId: string,
    file: File,
    callerId: string
  ): Promise<{ path?: string; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `payroll_${recordId}_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('employee-payroll-proofs')
        .upload(fileName, file, { upsert: true });

      if (uploadErr || !uploadData) {
        return { error: uploadErr?.message || 'Failed to upload payment proof.' };
      }

      return { path: uploadData.path };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async updatePayrollRecord(
    recordId: string,
    updates: {
      bonuses?: number;
      allowances?: number;
      assetDeductions?: number;
      otherAdjustments?: number;
      netPayable?: number;
      status?: any;
      paidAt?: string;
      paymentProofUrl?: string;
      notes?: string;
    },
    callerId: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const dbUpdate: any = {
        updated_at: new Date().toISOString(),
        updated_by: callerId
      };

      if (updates.bonuses !== undefined || updates.allowances !== undefined || updates.otherAdjustments !== undefined) {
        dbUpdate.manual_adjustments_total = (updates.bonuses || 0) + (updates.allowances || 0) + (updates.otherAdjustments || 0);
      }
      if (updates.assetDeductions !== undefined) {
        dbUpdate.asset_recovery_deduction = updates.assetDeductions;
      }
      if (updates.netPayable !== undefined) {
        dbUpdate.net_payable = updates.netPayable;
      }
      if (updates.status !== undefined) {
        dbUpdate.status = updates.status;
      }
      if (updates.paidAt !== undefined) {
        dbUpdate.payment_date = updates.paidAt;
        dbUpdate.paid_by = callerId;
      }
      if (updates.paymentProofUrl !== undefined) {
        dbUpdate.payment_proof_path = updates.paymentProofUrl;
      }
      if (updates.notes !== undefined) {
        dbUpdate.management_notes = updates.notes;
      }

      const { error } = await supabase
        .from('employee_payroll_records')
        .update(dbUpdate)
        .eq('id', recordId);

      if (error) return { error: error.message };

      await supabase.from('system_audit_events').insert({
        actor_id: callerId,
        action: 'payroll_record_updated',
        entity_type: 'employee_payroll_record',
        entity_id: recordId,
        new_state: dbUpdate
      });

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async raisePayrollConcern(
    recordId: string,
    employeeId: string,
    notes: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    if (!notes.trim()) return { error: 'Please enter details regarding your salary concern.' };

    try {
      const { error } = await supabase
        .from('employee_payroll_records')
        .update({
          status: 'Concern Raised',
          concern_notes: notes.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId)
        .eq('employee_id', employeeId);

      if (error) return { error: error.message };

      // Create Management Task
      await supabase.from('employee_management_tasks').insert({
        task_type: 'employee_concern',
        employee_id: employeeId,
        title: 'Payroll Calculation Concern Raised',
        description: `Employee raised a payroll concern: "${notes.trim()}".`,
        status: 'open',
        priority: 'high',
        reference_id: recordId
      });

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ===========================================================================
  // 7. PERFORMANCE, INCIDENTS & COACHING, WARNINGS
  // ===========================================================================

  async fetchPerformanceRecords(employeeId?: string): Promise<EmployeePerformanceRecord[]> {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('employee_performance_records')
        .select('*')
        .order('date', { ascending: false });

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;

      if (error || !data) return [];
      return data.map((r: any) => ({
        id: r.id,
        employeeId: r.employee_id,
        recordType: r.record_type,
        title: r.title,
        description: r.description,
        date: r.date,
        severity: r.severity,
        documentUrl: r.document_url,
        previousSalary: r.previous_salary ? Number(r.previous_salary) : null,
        newSalary: r.new_salary ? Number(r.new_salary) : null,
        status: r.status,
        concernStatus: r.concern_status,
        concernText: r.concern_text,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        createdBy: r.created_by
      }));
    } catch {
      return [];
    }
  },

  async addPerformanceRecord(
    payload: {
      employeeId: string;
      recordType: 'goal' | 'achievement' | 'incident_coaching' | 'warning' | 'salary_hike' | 'contract_document' | 'status_change' | 'exit_settlement';
      title: string;
      description?: string;
      date: string;
      severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
      documentUrl?: string;
      previousSalary?: number;
      newSalary?: number;
    },
    callerId: string
  ): Promise<{ record?: EmployeePerformanceRecord; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    if (!payload.title.trim()) return { error: 'Title is required.' };

    try {
      const { data, error } = await supabase
        .from('employee_performance_records')
        .insert({
          employee_id: payload.employeeId,
          record_type: payload.recordType,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          date: payload.date,
          severity: payload.severity || 'info',
          document_url: payload.documentUrl || null,
          previous_salary: payload.previousSalary || null,
          new_salary: payload.newSalary || null,
          status: 'active',
          concern_status: 'none',
          created_by: callerId
        })
        .select()
        .single();

      if (error || !data) return { error: error?.message || 'Failed to add performance record.' };

      // If salary hike, update employee record salary
      if (payload.recordType === 'salary_hike' && payload.newSalary && payload.newSalary > 0) {
        await supabase
          .from('employee_records')
          .update({ salary: payload.newSalary, updated_at: new Date().toISOString() })
          .eq('id', payload.employeeId);
      }

      await supabase.from('system_audit_events').insert({
        actor_id: callerId,
        action: `performance_${payload.recordType}_added`,
        entity_type: 'employee_performance_record',
        entity_id: data.id,
        new_state: { title: data.title, type: data.record_type, employeeId: data.employee_id }
      });

      return {
        record: {
          id: data.id,
          employeeId: data.employee_id,
          recordType: data.record_type,
          title: data.title,
          description: data.description,
          date: data.date,
          severity: data.severity,
          documentUrl: data.document_url,
          previousSalary: data.previous_salary ? Number(data.previous_salary) : null,
          newSalary: data.new_salary ? Number(data.new_salary) : null,
          status: data.status,
          concernStatus: data.concern_status,
          concernText: data.concern_text,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          createdBy: data.created_by
        }
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async logPerformanceRecord(
    payload: {
      employeeId: string;
      recordType: any;
      title: string;
      description: string;
      severity?: any;
      rating?: number;
      actionPlan?: string;
    },
    callerId: string
  ): Promise<{ record?: EmployeePerformanceRecord; error?: string }> {
    return this.addPerformanceRecord({
      employeeId: payload.employeeId,
      recordType: payload.recordType,
      title: payload.title,
      description: payload.actionPlan ? `${payload.description}\n\nAction Plan: ${payload.actionPlan}` : payload.description,
      date: new Date().toISOString().split('T')[0],
      severity: payload.severity || 'info'
    }, callerId);
  },

  async raisePerformanceConcern(
    recordId: string,
    employeeId: string,
    concernText: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    if (!concernText.trim()) return { error: 'Please enter details regarding your concern.' };

    try {
      const { error } = await supabase
        .from('employee_performance_records')
        .update({
          concern_status: 'concern_raised',
          concern_text: concernText.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId)
        .eq('employee_id', employeeId);

      if (error) return { error: error.message };

      await supabase.from('employee_management_tasks').insert({
        task_type: 'employee_concern',
        employee_id: employeeId,
        title: 'Performance / Warning Concern Raised',
        description: `Employee raised a concern against record: "${concernText.trim()}".`,
        status: 'open',
        priority: 'high',
        reference_id: recordId
      });

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ===========================================================================
  // 8. FINAL SETTLEMENT
  // ===========================================================================

  async fetchFinalSettlement(employeeId: string): Promise<EmployeeFinalSettlement | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('employee_final_settlements')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (error || !data) return null;
      return {
        id: data.id,
        employeeId: data.employee_id,
        lastWorkingDate: data.last_working_date,
        noticePeriodStatus: data.notice_period_status,
        pendingEarnedSalary: Number(data.pending_earned_salary || 0),
        currentAccruedAmount: Number(data.current_accrued_amount || 0),
        approvedDeductions: Number(data.approved_deductions || 0),
        assetClearanceStatus: data.asset_clearance_status,
        finalPayableAmount: Number(data.final_payable_amount || 0),
        paymentProofPath: data.payment_proof_path,
        status: data.status,
        settledAt: data.settled_at,
        settledBy: data.settled_by,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch {
      return null;
    }
  },

  async calculateFinalSettlementEstimate(
    employeeId: string,
    lastWorkingDate: string,
    noticePeriodStatus: NoticePeriodStatus = 'served',
    goodStandingStatus: GoodStandingStatus = 'good_standing'
  ): Promise<{
    baseSalary: number;
    daysInMonth: number;
    daysWorked: number;
    pendingEarnedSalary: number;
    currentAccruedAmount: number;
    heldPendingAmount: number;
    lateDeductions: number;
    absenceDeductions: number;
    assetRecoveryDeduction: number;
    otherAdjustments: number;
    approvedDeductions: number;
    finalPayable: number;
  }> {
    const emp = await this.fetchEmployeeRecord(employeeId);
    const baseSalary = emp?.salary || 0;
    const lDate = new Date(lastWorkingDate);

    // Current month accrual
    const year = lDate.getFullYear();
    const month = lDate.getMonth() + 1;
    const daysInMonth = this.getDaysInMonth(year, month);
    const daysWorked = Math.min(daysInMonth, lDate.getDate());
    const currentAccruedAmount = Number(((baseSalary / daysInMonth) * daysWorked).toFixed(2));

    // Check unpaid previous months
    const payrolls = await this.fetchEmployeePayrollRecords(employeeId);
    const unpaidPayrolls = payrolls.filter((p) => p.status === 'Approved' || p.status === 'Draft' || p.status === 'under_review' || p.status === 'draft');
    const pendingEarnedSalary = unpaidPayrolls.reduce((sum, p) => sum + (p.netPayable || 0), 0);

    // Fetch attendance for the current month up to last working date
    const periodMonthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${periodMonthStr}-01`;
    const attendance = await this.fetchEmployeeAttendance(employeeId, startDate, lastWorkingDate);
    const lateDeductions = attendance.reduce((sum, a) => sum + (a.lateDeduction || 0), 0);
    const absenceDeductions = attendance.reduce((sum, a) => sum + (a.absenceDeduction || 0), 0);

    // Check unreturned assets
    const assets = await this.fetchEmployeeAssets(employeeId);
    const unreturnedAssets = assets.filter((a) => a.status === 'assigned' || a.status === 'damaged' || a.status === 'lost');
    const assetRecoveryDeduction = unreturnedAssets.reduce((sum, a) => sum + (a.replacementValue ?? a.price ?? 0), 0);

    // Naturally pending held amount based on Notice Period or Good Standing
    let heldPendingAmount = 0;
    if (noticePeriodStatus === 'not_served') {
      heldPendingAmount = Math.min(baseSalary, currentAccruedAmount);
    } else if (noticePeriodStatus === 'short_served' || noticePeriodStatus === 'short') {
      heldPendingAmount = Math.round(currentAccruedAmount * 0.5);
    } else if (goodStandingStatus === 'disputed' || goodStandingStatus === 'terminated_for_cause') {
      heldPendingAmount = currentAccruedAmount;
    }

    const otherAdjustments = 0;
    const approvedDeductions = lateDeductions + absenceDeductions + assetRecoveryDeduction + otherAdjustments;
    const finalPayable = Math.max(0, pendingEarnedSalary + currentAccruedAmount - heldPendingAmount - approvedDeductions);

    return {
      baseSalary,
      daysInMonth,
      daysWorked,
      pendingEarnedSalary,
      currentAccruedAmount,
      heldPendingAmount,
      lateDeductions,
      absenceDeductions,
      assetRecoveryDeduction,
      otherAdjustments,
      approvedDeductions,
      finalPayable
    };
  },

  async calculateFinalSettlement(
    payloadOrEmpId: string | {
      employeeId: string;
      separationReason?: string;
      lastWorkingDate: string;
      noticePeriodStatus?: NoticePeriodStatus;
      goodStandingStatus?: GoodStandingStatus;
      pendingPreviousSalary?: number;
      currentMonthAccruedSalary?: number;
      heldPendingAmount?: number;
      lateDeductions?: number;
      unapprovedAbsenceDeductions?: number;
      assetRecoveryDeductions?: number;
      otherDeductions?: number;
      severanceBonus?: number;
      netFinalPayable?: number;
      deductionReasonNotes?: string;
      notes?: string;
    },
    lastWorkingDateOrCallerId?: string
  ): Promise<any> {
    if (typeof payloadOrEmpId === 'string') {
      return this.calculateFinalSettlementEstimate(payloadOrEmpId, lastWorkingDateOrCallerId || new Date().toISOString().split('T')[0]);
    }
    return this.saveFinalSettlement({
      employeeId: payloadOrEmpId.employeeId,
      lastWorkingDate: payloadOrEmpId.lastWorkingDate,
      noticePeriodStatus: payloadOrEmpId.noticePeriodStatus || 'served',
      goodStandingStatus: payloadOrEmpId.goodStandingStatus || 'good_standing',
      pendingEarnedSalary: payloadOrEmpId.pendingPreviousSalary || 0,
      currentAccruedAmount: payloadOrEmpId.currentMonthAccruedSalary || 0,
      heldPendingAmount: payloadOrEmpId.heldPendingAmount || 0,
      lateDeductions: payloadOrEmpId.lateDeductions || 0,
      absenceDeductions: payloadOrEmpId.unapprovedAbsenceDeductions || 0,
      assetRecoveryDeduction: payloadOrEmpId.assetRecoveryDeductions || 0,
      otherAdjustments: (payloadOrEmpId.otherDeductions || 0) - (payloadOrEmpId.severanceBonus || 0),
      approvedDeductions: (payloadOrEmpId.lateDeductions || 0) + (payloadOrEmpId.unapprovedAbsenceDeductions || 0) + (payloadOrEmpId.assetRecoveryDeductions || 0) + (payloadOrEmpId.otherDeductions || 0),
      assetClearanceStatus: 'cleared',
      finalPayableAmount: payloadOrEmpId.netFinalPayable || 0,
      separationReason: payloadOrEmpId.separationReason || 'resignation',
      deductionReasonNotes: payloadOrEmpId.deductionReasonNotes,
      notes: payloadOrEmpId.notes
    }, lastWorkingDateOrCallerId || 'system');
  },

  async saveFinalSettlement(
    payload: {
      employeeId: string;
      lastWorkingDate: string;
      noticePeriodStatus: NoticePeriodStatus;
      goodStandingStatus?: GoodStandingStatus;
      pendingEarnedSalary: number;
      currentAccruedAmount: number;
      heldPendingAmount?: number;
      lateDeductions?: number;
      absenceDeductions?: number;
      assetRecoveryDeduction?: number;
      otherAdjustments?: number;
      approvedDeductions: number;
      assetClearanceStatus: AssetClearanceStatus;
      finalPayableAmount: number;
      separationReason?: string;
      deductionReasonNotes?: string;
      notes?: string;
    },
    callerId: string
  ): Promise<{ settlement?: EmployeeFinalSettlement; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const dbPayload: any = {
        employee_id: payload.employeeId,
        last_working_date: payload.lastWorkingDate,
        notice_period_status: payload.noticePeriodStatus,
        good_standing_status: payload.goodStandingStatus || 'good_standing',
        pending_earned_salary: payload.pendingEarnedSalary,
        current_accrued_amount: payload.currentAccruedAmount,
        held_pending_amount: payload.heldPendingAmount || 0,
        late_deductions: payload.lateDeductions || 0,
        absence_deductions: payload.absenceDeductions || 0,
        asset_recovery_deduction: payload.assetRecoveryDeduction || 0,
        other_adjustments: payload.otherAdjustments || 0,
        approved_deductions: payload.approvedDeductions,
        asset_clearance_status: payload.assetClearanceStatus,
        final_payable_amount: payload.finalPayableAmount,
        separation_reason: payload.separationReason || 'resignation',
        deduction_reason_notes: payload.deductionReasonNotes || null,
        status: 'under_review',
        notes: payload.notes || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('employee_final_settlements')
        .upsert(dbPayload, { onConflict: 'employee_id' })
        .select()
        .single();

      if (error || !data) return { error: error?.message || 'Failed to save final settlement.' };

      // Update employment status to 'resigned' or 'terminated'
      await supabase
        .from('employee_records')
        .update({ 
          employment_status: payload.separationReason === 'termination' ? 'terminated' : 'resigned', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', payload.employeeId);

      await supabase.from('system_audit_events').insert({
        actor_id: callerId,
        action: 'final_settlement_calculated',
        entity_type: 'employee_final_settlement',
        entity_id: data.id,
        new_state: { finalPayable: data.final_payable_amount, employeeId: data.employee_id }
      });

      return {
        settlement: {
          id: data.id,
          employeeId: data.employee_id,
          lastWorkingDate: data.last_working_date,
          noticePeriodStatus: data.notice_period_status,
          goodStandingStatus: data.good_standing_status,
          pendingEarnedSalary: Number(data.pending_earned_salary || 0),
          currentAccruedAmount: Number(data.current_accrued_amount || 0),
          heldPendingAmount: Number(data.held_pending_amount || 0),
          lateDeductions: Number(data.late_deductions || 0),
          absenceDeductions: Number(data.absence_deductions || 0),
          assetRecoveryDeduction: Number(data.asset_recovery_deduction || 0),
          otherAdjustments: Number(data.other_adjustments || 0),
          approvedDeductions: Number(data.approved_deductions || 0),
          assetClearanceStatus: data.asset_clearance_status,
          finalPayableAmount: Number(data.final_payable_amount || 0),
          netFinalPayable: Number(data.final_payable_amount || 0),
          separationReason: data.separation_reason,
          deductionReasonNotes: data.deduction_reason_notes,
          status: data.status,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ===========================================================================
  // 9. MANAGEMENT TASKS & DIRECTORY DOSSIER
  // ===========================================================================

  async fetchManagementTasks(taskType?: string, employeeId?: string): Promise<EmployeeManagementTask[]> {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('employee_management_tasks')
        .select('*, profiles:employee_id(full_name)')
        .order('created_at', { ascending: false });

      if (taskType) {
        query = query.eq('task_type', taskType);
      }
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;

      if (error || !data) return [];
      return data.map((t: any) => ({
        id: t.id,
        taskType: t.task_type,
        employeeId: t.employee_id,
        employeeName: t.profiles?.full_name || 'Employee',
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        referenceId: t.reference_id,
        assignedTo: t.assigned_to,
        resolutionNotes: t.resolution_notes,
        resolvedBy: t.resolved_by,
        resolvedAt: t.resolved_at,
        idempotencyKey: t.idempotency_key,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));
    } catch {
      return [];
    }
  },

  async resolveManagementTask(
    taskId: string,
    resolutionNotes: string,
    callerId: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const { error } = await supabase
        .from('employee_management_tasks')
        .update({
          status: 'resolved',
          resolution_notes: resolutionNotes.trim(),
          resolved_by: callerId,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async createManagementTask(payload: {
    taskType?: any;
    employeeId: string;
    title: string;
    description?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    referenceId?: string;
  }): Promise<{ task?: EmployeeManagementTask; error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const { data, error } = await supabase
        .from('employee_management_tasks')
        .insert({
          task_type: payload.taskType || 'employee_concern',
          employee_id: payload.employeeId,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          priority: payload.priority || 'normal',
          reference_id: payload.referenceId || null,
          status: 'open'
        })
        .select()
        .single();

      if (error || !data) return { error: error?.message || 'Failed to create task.' };
      return {
        task: {
          id: data.id,
          taskType: data.task_type,
          employeeId: data.employee_id,
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          referenceId: data.reference_id,
          assignedTo: data.assigned_to,
          resolutionNotes: data.resolution_notes,
          resolvedBy: data.resolved_by,
          resolvedAt: data.resolved_at,
          idempotencyKey: data.idempotency_key,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async updateManagementTaskStatus(
    taskId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'completed',
    callerId: string,
    notes?: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    try {
      const { error } = await supabase
        .from('employee_management_tasks')
        .update({
          status: status === 'completed' ? 'resolved' : status,
          resolution_notes: notes || undefined,
          resolved_by: callerId,
          resolved_at: (status === 'resolved' || status === 'completed') ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async fetchFullEmployeeDossier(employeeId: string): Promise<EmployeeFullDossier | null> {
    if (!supabase) return null;
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (profErr || !prof) return null;

      const profile: UserProfile = {
        id: prof.id,
        fullName: prof.full_name,
        role: prof.role,
        status: prof.status,
        createdAt: prof.created_at,
        updatedAt: prof.updated_at,
        workEmail: prof.work_email,
        phone: prof.phone,
        designationId: prof.designation_id,
        reportingManagerId: prof.reporting_manager_id,
        startDate: prof.start_date,
        avatarUrl: prof.avatar_url,
        bio: prof.bio,
        linkedinUrl: prof.linkedin_url,
        contactEmail: prof.contact_email,
        backupPhone: prof.backup_phone
      };

      const [
        empRecord,
        bankDetails,
        attendanceHistory,
        assets,
        payrollRecords,
        performanceRecords,
        settlement
      ] = await Promise.all([
        this.fetchEmployeeRecord(employeeId),
        this.fetchBankDetails(employeeId),
        this.fetchEmployeeAttendance(employeeId),
        this.fetchEmployeeAssets(employeeId),
        this.fetchEmployeePayrollRecords(employeeId),
        this.fetchPerformanceRecords(employeeId),
        this.fetchFinalSettlement(employeeId)
      ]);

      return {
        profile,
        employeeRecord: empRecord,
        bankDetails,
        attendanceHistory,
        assets,
        payrollRecords,
        performanceRecords,
        changeRequests: [],
        tasks: [],
        settlement
      };
    } catch {
      return null;
    }
  },

  async fetchAttendanceHistory(employeeId: string, limit?: number): Promise<EmployeeAttendance[]> {
    return this.fetchEmployeeAttendance(employeeId);
  },

  async manualAttendanceCorrection(
    payload: {
      attendanceId?: string;
      employeeId: string;
      workDate: string;
      checkInTime?: string;
      checkOutTime?: string;
      status: AttendanceStatus;
      lateDeduction?: number;
      absenceDeduction?: number;
      correctionReason: string;
    },
    callerId: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    if (!payload.correctionReason.trim()) {
      return { error: 'A mandatory correction reason is required for audit history.' };
    }

    try {
      if (payload.attendanceId) {
        return this.correctAttendanceRecord(
          payload.attendanceId,
          {
            status: payload.status as any,
            checkInTime: payload.checkInTime,
            checkOutTime: payload.checkOutTime,
            lateDeduction: payload.lateDeduction,
            absenceDeduction: payload.absenceDeduction,
            correctionReason: payload.correctionReason
          },
          callerId
        );
      } else {
        const { data, error } = await supabase
          .from('employee_attendance')
          .insert({
            employee_id: payload.employeeId,
            work_date: payload.workDate,
            scheduled_check_in: `${payload.workDate}T11:00:00+05:00`,
            scheduled_check_out: `${payload.workDate}T20:00:00+05:00`,
            check_in_time: payload.checkInTime || null,
            check_out_time: payload.checkOutTime || null,
            status: payload.status,
            minutes_late: payload.status === 'late' ? 1 : 0,
            late_deduction: payload.lateDeduction || 0,
            absence_deduction: payload.absenceDeduction || 0,
            correction_reason: payload.correctionReason.trim(),
            corrected_by: callerId,
            corrected_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) return { error: error.message };

        await supabase.from('system_audit_events').insert({
          actor_id: callerId,
          action: 'attendance_logged_manually',
          entity_type: 'employee_attendance',
          entity_id: data.id,
          new_state: data,
          reason: payload.correctionReason.trim()
        });

        return {};
      }
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async upsertAsset(
    payload: {
      id?: string;
      assetTag: string;
      assetName: string;
      category?: string;
      serialNumber?: string;
      assignedTo?: string | null;
      condition?: string;
      replacementValue?: number;
      notes?: string;
      status?: AssetStatus | string;
    },
    callerId?: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database unconfigured.' };
    const actorId = callerId || payload.assignedTo || 'system';

    try {
      if (payload.id) {
        const { error } = await supabase
          .from('company_assets')
          .update({
            item_name: payload.assetName,
            asset_name: payload.assetName,
            asset_tag: payload.assetTag,
            category: payload.category || 'laptop',
            serial_number: payload.serialNumber || null,
            employee_id: payload.assignedTo || null,
            assigned_to: payload.assignedTo || null,
            condition: payload.condition || 'good',
            price: payload.replacementValue || 0,
            replacement_value: payload.replacementValue || 0,
            status: payload.status || (payload.assignedTo ? 'assigned' : 'available'),
            notes: payload.notes || null,
            updated_at: new Date().toISOString(),
            updated_by: actorId
          })
          .eq('id', payload.id);

        if (error) return { error: error.message };
      } else {
        const { error } = await supabase
          .from('company_assets')
          .insert({
            item_name: payload.assetName,
            asset_name: payload.assetName,
            asset_tag: payload.assetTag,
            category: payload.category || 'laptop',
            serial_number: payload.serialNumber || null,
            employee_id: payload.assignedTo || null,
            assigned_to: payload.assignedTo || null,
            condition: payload.condition || 'good',
            issue_date: new Date().toISOString().split('T')[0],
            price: payload.replacementValue || 0,
            replacement_value: payload.replacementValue || 0,
            status: payload.status || (payload.assignedTo ? 'assigned' : 'available'),
            notes: payload.notes || null,
            created_by: actorId
          });

        if (error) return { error: error.message };
      }

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async fetchPayrollHistory(employeeId: string): Promise<EmployeePayrollRecord[]> {
    return this.fetchEmployeePayrollRecords(employeeId);
  },

  async fetchProfileChangeRequests(employeeId?: string): Promise<EmployeeProfileChangeRequest[]> {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('employee_profile_change_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map((r: any) => ({
        id: r.id,
        employeeId: r.employee_id,
        requestType: r.request_type,
        requestedChanges: r.requested_changes || {},
        currentValues: r.current_values || null,
        reason: r.reason || null,
        status: r.status,
        reviewedBy: r.reviewed_by || null,
        reviewedAt: r.reviewed_at || null,
        reviewNotes: r.review_notes || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch {
      return [];
    }
  },

  async acknowledgeAssetReceipt(assetId: string, employeeId: string): Promise<{ error?: string }> {
    return this.acknowledgeAsset(assetId, employeeId);
  },

  async fetchFullDossier(employeeId: string): Promise<EmployeeFullDossier | null> {
    return this.fetchFullEmployeeDossier(employeeId);
  },

  async fetchAllAssets(): Promise<CompanyAsset[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('company_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data.map((a: any) => ({
        id: a.id,
        employeeId: a.employee_id || a.assigned_to,
        assignedTo: a.assigned_to || a.employee_id,
        itemName: a.item_name || a.asset_name,
        assetName: a.asset_name || a.item_name,
        assetTag: a.asset_tag,
        serialNumber: a.serial_number,
        category: a.category,
        condition: a.condition,
        issueDate: a.issue_date || a.created_at?.split('T')[0] || '',
        price: Number(a.price || a.replacement_value || 0),
        replacementValue: Number(a.replacement_value || a.price || 0),
        status: a.status,
        acknowledgedAt: a.acknowledged_at,
        acknowledgedBy: a.acknowledged_by,
        returnDate: a.return_date,
        damageLossReason: a.damage_loss_reason,
        damageLossEvidenceUrl: a.damage_loss_evidence_url,
        financialRecoveryApproved: !!a.financial_recovery_approved,
        financialRecoveryAmount: Number(a.financial_recovery_amount || 0),
        recoveryPayrollPeriod: a.recovery_payroll_period,
        notes: a.notes,
        createdAt: a.created_at,
        updatedAt: a.updated_at
      }));
    } catch {
      return [];
    }
  },

  async fetchMonthlyPayrollSummary(payrollMonth?: string): Promise<any[]> {
    if (!supabase) return [];
    try {
      const month = payrollMonth || new Date().toISOString().substring(0, 7);
      const { data, error } = await supabase
        .from('employee_payroll_records')
        .select('*, profiles:employee_id(full_name)')
        .eq('payroll_period', month);
      if (error || !data) return [];
      return data.map((p: any) => ({
        id: p.id,
        employeeId: p.employee_id,
        employeeName: p.profiles?.full_name || 'Employee',
        payrollPeriod: p.payroll_period,
        payrollMonth: p.payroll_period,
        grossSalary: Number(p.gross_salary || 0),
        baseSalary: Number(p.gross_salary || 0),
        lateDeductionsTotal: Number(p.late_deductions_total || 0),
        absenceDeductionsTotal: Number(p.absence_deductions_total || 0),
        manualAdjustmentsTotal: Number(p.manual_adjustments_total || 0),
        assetRecoveryDeduction: Number(p.asset_recovery_deduction || 0),
        netPayable: Number(p.net_payable || 0),
        scheduledPaymentDate: p.scheduled_payment_date,
        status: p.status,
        paymentProofPath: p.payment_proof_path,
        paymentProofUrl: p.payment_proof_url,
        paymentDate: p.payment_date,
        paidAt: p.payment_date,
        notes: p.notes,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
    } catch {
      return [];
    }
  },

  async fetchFinalSettlements(): Promise<EmployeeFinalSettlement[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('employee_final_settlements')
        .select('*, profiles:employee_id(full_name)')
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data.map((s: any) => ({
        id: s.id,
        employeeId: s.employee_id,
        employeeName: s.profiles?.full_name || 'Employee',
        lastWorkingDate: s.last_working_date,
        noticePeriodStatus: s.notice_period_status,
        pendingEarnedSalary: Number(s.pending_earned_salary || 0),
        currentAccruedAmount: Number(s.current_accrued_amount || 0),
        approvedDeductions: Number(s.approved_deductions || 0),
        assetClearanceStatus: s.asset_clearance_status,
        finalPayableAmount: Number(s.final_payable_amount || 0),
        netFinalPayable: Number(s.final_payable_amount || 0),
        separationReason: s.separation_reason || 'resignation',
        paymentProofPath: s.payment_proof_path,
        status: s.status,
        settledAt: s.settled_at,
        settledBy: s.settled_by,
        notes: s.notes,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));
    } catch {
      return [];
    }
  }
};
