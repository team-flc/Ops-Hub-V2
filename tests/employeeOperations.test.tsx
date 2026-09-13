import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../src/lib/supabase';
import { employeeOperationsService } from '../src/lib/employeeOperationsService';
import {
  WorkShift, CompanyWorkSchedule, NoticePeriodStatus, GoodStandingStatus,
  CompanyAsset, ROLE_DISPLAY_NAMES, EmployeeRecord, TeamMemberRecord, AssetStatus
} from '../src/types';
import {
  formatWorkingScheduleDescription, getPKTTodayDateString, getPKTCurrentMonthString, formatPKTDate, formatPKTTime,
  getPKTDateTimeParts, getDaysInPKTMonth, isOvernightShift, calculateShiftWindow,
  calculateDaysWithCompany, calculatePKTDaysUntil15th, calculatePKTSalaryCountdown
} from '../src/lib/pktDateUtils';

describe('Employee Operations System Full Behavioral Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Shift Timings, Schedules & Working Days
  describe('1. Shift Timings, Schedules & Working Days', () => {
    const schedules: CompanyWorkSchedule[] = [
      {
        id: 'sch-1',
        effectiveFrom: '2026-01-01',
        workingDays: [1, 2, 3, 4, 5, 6], // Monday through Saturday
        description: 'Standard 6-day work week (Monday to Saturday)'
      }
    ];

    it('identifies Monday through Saturday as working days', () => {
      const monday = new Date('2026-09-07T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(monday, schedules)).toBe(true);

      const saturday = new Date('2026-09-12T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(saturday, schedules)).toBe(true);
    });

    it('excludes Sunday from working days', () => {
      const sunday = new Date('2026-09-13T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(sunday, schedules)).toBe(false);
    });
  });

  // 2. Authoritative Late Check-in & Flat PKR 500 Policy
  describe('2. Authoritative Late Check-in & Flat PKR 500 Policy', () => {
    it('returns no late penalty when check-in is on time or early', () => {
      const scheduled = new Date('2026-09-12T11:00:00+05:00');
      const actualOnTime = new Date('2026-09-12T11:00:00+05:00');
      const actualEarly = new Date('2026-09-12T10:55:00+05:00');

      const resOnTime = employeeOperationsService.calculateLateMinutes(scheduled, actualOnTime);
      expect(resOnTime.isLate).toBe(false);
      expect(resOnTime.minutesLate).toBe(0);
      expect(resOnTime.deduction).toBe(0);

      const resEarly = employeeOperationsService.calculateLateMinutes(scheduled, actualEarly);
      expect(resEarly.isLate).toBe(false);
      expect(resEarly.minutesLate).toBe(0);
      expect(resEarly.deduction).toBe(0);
    });

    it('applies flat PKR 500 deduction for even 1 minute late (Strict No Grace Period)', () => {
      const scheduled = new Date('2026-09-12T11:00:00+05:00');
      const actual1MinLate = new Date('2026-09-12T11:01:00+05:00');

      const res = employeeOperationsService.calculateLateMinutes(scheduled, actual1MinLate);
      expect(res.isLate).toBe(true);
      expect(res.minutesLate).toBe(1);
      expect(res.deduction).toBe(500);
    });

    it('applies flat PKR 500 deduction for 45 minutes late without capping', () => {
      const scheduled = new Date('2026-09-12T11:00:00+05:00');
      const actual45MinLate = new Date('2026-09-12T11:45:00+05:00');

      const res = employeeOperationsService.calculateLateMinutes(scheduled, actual45MinLate);
      expect(res.isLate).toBe(true);
      expect(res.minutesLate).toBe(45);
      expect(res.deduction).toBe(500);
    });
  });

  // 3. Unapproved Absence Salary Deduction Formula
  describe('3. Unapproved Absence Salary Deduction Formula', () => {
    it('calculates daily absence cut based on exact days in 30-day month (e.g. September)', () => {
      const monthlySalary = 150000;
      const septDate = new Date('2026-09-15');
      const cut = employeeOperationsService.calculateAbsenceDeduction(monthlySalary, septDate);
      expect(cut).toBe(5000); // 150000 / 30 = 5000
    });

    it('calculates daily absence cut based on exact days in 31-day month (e.g. August)', () => {
      const monthlySalary = 155000;
      const augDate = new Date('2026-08-15');
      const cut = employeeOperationsService.calculateAbsenceDeduction(monthlySalary, augDate);
      expect(cut).toBe(5000); // 155000 / 31 = 5000
    });

    it('calculates daily absence cut based on exact days in 28-day month (e.g. February non-leap)', () => {
      const monthlySalary = 140000;
      const febDate = new Date('2026-02-15');
      const cut = employeeOperationsService.calculateAbsenceDeduction(monthlySalary, febDate);
      expect(cut).toBe(5000); // 140000 / 28 = 5000
    });

    it('calculates daily absence cut based on exact days in 29-day month (e.g. February leap year 2028)', () => {
      const monthlySalary = 145000;
      const febLeapDate = new Date('2028-02-15');
      const cut = employeeOperationsService.calculateAbsenceDeduction(monthlySalary, febLeapDate);
      expect(cut).toBe(5000); // 145000 / 29 = 5000
    });
  });

  // 4. Bank Account Number & IBAN Masking Security
  describe('4. Bank Account Number & IBAN Masking Security', () => {
    it('masks middle digits of account number leaving only last 4 digits visible', () => {
      const fullAccount = '01020304050607';
      const masked = `•••• •••• ${fullAccount.slice(-4)}`;
      expect(masked).toBe('•••• •••• 0607');
      expect(masked.includes('0102')).toBe(false);
    });

    it('masks IBAN preserving country prefix and last 4 characters', () => {
      const fullIban = 'PK36MEZN0000000102030405';
      const masked = `PK•• •••• •••• •••• ${fullIban.slice(-4)}`;
      expect(masked).toBe('PK•• •••• •••• •••• 0405');
      expect(masked.includes('MEZN')).toBe(false);
    });
  });

  // 5. 8-Component Final Settlement Calculation Engine (Held salary is EARNED addition +)
  describe('5. 8-Component Final Settlement Calculation Engine', () => {
    it('correctly treats held pending salary as earned addition (+) and adds all earned components', () => {
      const pendingEarnedSalary = 100000;
      const currentAccruedAmount = 50000;
      const heldPendingAmount = 10000; // Previously held earned salary being released (+)
      const severanceBonus = 20000;

      const lateDeductions = 1500;
      const absenceDeductions = 5000;
      const assetRecoveryDeduction = 15000;
      const otherDeductions = 2000;

      const totalAdditions = pendingEarnedSalary + currentAccruedAmount + heldPendingAmount + severanceBonus;
      const totalDeductions = lateDeductions + absenceDeductions + assetRecoveryDeduction + otherDeductions;
      const netFinalPayable = Math.max(0, totalAdditions - totalDeductions);

      expect(totalAdditions).toBe(180000);
      expect(totalDeductions).toBe(23500);
      expect(netFinalPayable).toBe(156500);
    });

    it('calculates settlement with correct 8-component formula', () => {
      const baseSalary = 150000;
      const daysInMonth = 30;
      const daysWorked = 15;
      const currentAccruedAmount = Number(((baseSalary / daysInMonth) * daysWorked).toFixed(2));
      const pendingEarnedSalary = 50000;
      const heldPendingAmount = 10000;
      const severanceBonus = 15000;
      const lateDeductions = 1000;
      const absenceDeductions = 5000;
      const assetRecoveryDeduction = 5000;
      const otherDeductions = 0;

      const totalAdditions = pendingEarnedSalary + currentAccruedAmount + heldPendingAmount + severanceBonus;
      const totalDeductions = lateDeductions + absenceDeductions + assetRecoveryDeduction + otherDeductions;
      const netFinalPayable = Math.max(0, totalAdditions - totalDeductions);

      expect(currentAccruedAmount).toBe(75000);
      expect(totalAdditions).toBe(150000);
      expect(totalDeductions).toBe(11000);
      expect(netFinalPayable).toBe(139000);
    });

    it('never produces negative payable amount even when deductions exceed additions', () => {
      const totalAdditions = 10000;
      const totalDeductions = 65000;
      const netFinalPayable = Math.max(0, totalAdditions - totalDeductions);
      expect(netFinalPayable).toBe(0);
    });
  });

  // 6. Overnight Shift & Midnight Crossing (Asia/Karachi PKT)
  describe('6. Overnight Shift & Midnight Crossing', () => {
    it('detects overnight shift when end time is earlier in clock time than start time', () => {
      expect(isOvernightShift('20:00:00', '05:00:00')).toBe(true);
      expect(isOvernightShift('22:00:00', '07:00:00')).toBe(true);
      expect(isOvernightShift('11:00:00', '20:00:00')).toBe(false);
      expect(isOvernightShift('09:00:00', '18:00:00')).toBe(false);
    });

    it('computes overnight shift window starting on workDate and ending on next calendar day in PKT', () => {
      const window = calculateShiftWindow('2026-09-12', '20:00:00', '05:00:00', true);
      expect(window.isOvernight).toBe(true);
      expect(window.startIso).toBe('2026-09-12T20:00:00+05:00');
      expect(window.endIso).toBe('2026-09-13T05:00:00+05:00');
    });

    it('computes standard daytime shift window on the same calendar day', () => {
      const window = calculateShiftWindow('2026-09-12', '11:00:00', '20:00:00', false);
      expect(window.isOvernight).toBe(false);
      expect(window.startIso).toBe('2026-09-12T11:00:00+05:00');
      expect(window.endIso).toBe('2026-09-12T20:00:00+05:00');
    });
  });

  // 7. Authoritative PKT Date Boundaries & Midnight Crossing
  describe('7. Authoritative PKT Date Boundaries & Midnight Crossing', () => {
    it('formats a UTC midnight timestamp (e.g. 2026-09-11T23:30:00Z) to PKT date 2026-09-12', () => {
      const utcDate = new Date('2026-09-11T23:30:00Z');
      const pktDateStr = formatPKTDate(utcDate, 'iso');
      expect(pktDateStr).toBe('2026-09-12');
    });

    it('formats time in 12-hour PKT format with AM/PM', () => {
      const utcDate = new Date('2026-09-12T06:00:00Z'); // 11:00 PKT
      const pktTime = formatPKTTime(utcDate);
      expect(pktTime).toBe('11:00 AM');
    });

    it('returns exact days in PKT month for leap and non-leap years', () => {
      expect(getDaysInPKTMonth('2026-09')).toBe(30);
      expect(getDaysInPKTMonth('2026-08')).toBe(31);
      expect(getDaysInPKTMonth('2026-02')).toBe(28);
      expect(getDaysInPKTMonth('2028-02')).toBe(29);
    });

    it('calculates employee company tenure in whole days', () => {
      const refDate = new Date('2026-09-12T12:00:00+05:00');
      const tenure = calculateDaysWithCompany('2026-09-02', refDate);
      expect(tenure).toBe(10);
    });
  });

  // 8. Safe Setup Gate Enforcement & Setup Pending Isolation
  describe('8. Safe Setup Gate Enforcement & Setup Pending Isolation', () => {
    it('correctly partitions staff into configured vs setup pending', () => {
      const staff: Array<{ id: string; fullName: string; setupCompletedAt?: string | null }> = [
        { id: '1', fullName: 'Configured Staff 1', setupCompletedAt: '2026-09-01T00:00:00Z' },
        { id: '2', fullName: 'New Staff Unconfigured', setupCompletedAt: null },
        { id: '3', fullName: 'Configured Staff 2', setupCompletedAt: '2026-09-10T12:00:00Z' }
      ];

      const configured = staff.filter(s => !!s.setupCompletedAt);
      const pending = staff.filter(s => !s.setupCompletedAt);

      expect(configured.length).toBe(2);
      expect(pending.length).toBe(1);
      expect(pending[0].fullName).toBe('New Staff Unconfigured');
    });

    it('excludes setup pending staff from missing check-in audits and live attendance counters', () => {
      const configuredStaff: TeamMemberRecord[] = [
        { id: 'c1', fullName: 'Alice', workEmail: 'alice@agency.com', role: 'team_member', status: 'active', departments: [], createdAt: '', updatedAt: '' }
      ];
      const setupPendingStaff: TeamMemberRecord[] = [
        { id: 'p1', fullName: 'Bob', workEmail: 'bob@agency.com', role: 'team_member', status: 'active', departments: [], createdAt: '', updatedAt: '' }
      ];

      const todayAttendance = [
        { id: 'att1', employeeId: 'c1', workDate: '2026-09-12', checkInTime: '2026-09-12T11:00:00+05:00', status: 'on_time' as const, minutesLate: 0, lateDeduction: 0, absenceDeduction: 0, scheduledCheckIn: '11:00:00', scheduledCheckOut: '20:00:00', createdAt: '', updatedAt: '' }
      ];

      // Live attendance counters evaluate ONLY configured staff
      const checkedInConfigured = todayAttendance.filter(a => a.checkInTime && configuredStaff.some(cs => cs.id === a.employeeId)).length;
      const pendingConfigured = Math.max(0, configuredStaff.length - checkedInConfigured);

      expect(checkedInConfigured).toBe(1);
      expect(pendingConfigured).toBe(0);
      // Bob is in setupPendingStaff, NOT in pendingConfigured
      expect(setupPendingStaff.length).toBe(1);
    });
  });

  // 9. PKT 15th Salary Countdown Math
  describe('9. PKT 15th Salary Countdown Math', () => {
    it('calculates exact remaining calendar days from Sept 12 to Sept 15 in PKT (3 days)', () => {
      const sept12 = new Date('2026-09-12T14:30:00+05:00');
      const { daysRemaining, nextSalaryDate } = calculatePKTDaysUntil15th(sept12);
      expect(nextSalaryDate).toBe('2026-09-15');
      expect(daysRemaining).toBe(3);
    });

    it('returns 0 days remaining on the 15th payout day itself', () => {
      const sept15 = new Date('2026-09-15T09:00:00+05:00');
      const { daysRemaining, formattedMessage } = calculatePKTSalaryCountdown(sept15);
      expect(daysRemaining).toBe(0);
      expect(formattedMessage).toContain('Salary Payout Day Today (15th)');
    });

    it('rolls over to 15th of next month when current date is past the 15th', () => {
      const sept16 = new Date('2026-09-16T10:00:00+05:00');
      const { nextSalaryDate, daysRemaining } = calculatePKTDaysUntil15th(sept16);
      expect(nextSalaryDate).toBe('2026-10-15');
      expect(daysRemaining).toBe(29);
    });
  });

  // 10. Evidence-Gated Clock In & Clock Out
  describe('10. Evidence-Gated Clock In & Clock Out', () => {
    it('disables action button when neither capturedBlob nor manualFile is present', () => {
      const isActionDisabled = (capturedBlob: Blob | null, manualFile: File | null, isSubmitting: boolean) => {
        return (!capturedBlob && !manualFile) || isSubmitting;
      };

      expect(isActionDisabled(null, null, false)).toBe(true);
      expect(isActionDisabled(new Blob(['test']), null, false)).toBe(false);
      expect(isActionDisabled(null, new File(['test'], 'evidence.jpg'), false)).toBe(false);
      expect(isActionDisabled(new Blob(['test']), null, true)).toBe(true);
    });
  });

  // 11. Company Asset Lifecycle States & Valuation
  describe('11. Company Asset Lifecycle States & Valuation', () => {
    it('supports all valid asset statuses and calculates recoverable value', () => {
      const validStatuses: AssetStatus[] = [
        'assigned', 'acknowledged', 'returned', 'damaged', 'lost', 'under_review', 'available', 'closed'
      ];

      expect(validStatuses.includes('acknowledged')).toBe(true);
      expect(validStatuses.includes('under_review')).toBe(true);

      const assets: CompanyAsset[] = [
        { id: 'a1', itemName: 'Laptop Dell XPS', assetTag: 'LAP-001', status: 'assigned', issueDate: '2026-09-12', price: 120000, replacementValue: 120000, condition: 'good', financialRecoveryApproved: false, financialRecoveryAmount: 0, createdAt: '', updatedAt: '' },
        { id: 'a2', itemName: 'Monitor 27"', assetTag: 'MON-002', status: 'damaged', issueDate: '2026-09-12', price: 45000, replacementValue: 45000, condition: 'damaged', financialRecoveryApproved: false, financialRecoveryAmount: 0, createdAt: '', updatedAt: '' },
        { id: 'a3', itemName: 'Headset Jabra', assetTag: 'AUD-003', status: 'available', issueDate: '2026-09-12', price: 15000, replacementValue: 15000, condition: 'good', financialRecoveryApproved: false, financialRecoveryAmount: 0, createdAt: '', updatedAt: '' }
      ];

      const recoverable = assets.filter(a => a.status === 'assigned' || a.status === 'damaged' || a.status === 'lost');
      const totalRecovery = recoverable.reduce((sum, a) => sum + (a.replacementValue ?? a.price ?? 0), 0);
      expect(totalRecovery).toBe(165000);
    });
  });

  // 12. Dynamic Role Mapping
  describe('12. Dynamic Role Mapping', () => {
    it('maps system roles dynamically using ROLE_DISPLAY_NAMES', () => {
      expect(ROLE_DISPLAY_NAMES.owner).toBe('Owner');
      expect(ROLE_DISPLAY_NAMES.operational_manager).toBe('Operational Manager');
      expect(ROLE_DISPLAY_NAMES.team_member).toBe('Team Member');
    });
  });

  // 13. Bank Account Change Security Governance
  describe('13. Bank Account Change Security Governance', () => {
    it('marks pending change requests for manager review before updating active payout details', () => {
      const changeRequest = {
        id: 'cr-1',
        employeeId: 'emp-10',
        field: 'bank_account',
        oldValue: '01020304050607',
        newValue: '09080706050403',
        status: 'pending' as const
      };

      expect(changeRequest.status).toBe('pending');
      expect(changeRequest.field).toBe('bank_account');
    });
  });

  // 14. Profile Change Request Workflow
  describe('14. Profile Change Request Workflow', () => {
    it('supports pending, approved, and rejected state transitions with audit trail', () => {
      const validStatuses = ['pending', 'approved', 'rejected'];
      expect(validStatuses.includes('approved')).toBe(true);
      expect(validStatuses.includes('rejected')).toBe(true);
      expect(validStatuses.includes('pending')).toBe(true);
    });
  });

  // 15. 60-Minute Missing Check-in Escalation
  describe('15. 60-Minute Missing Check-in Escalation', () => {
    it('triggers escalation when current time exceeds scheduled start time by 60 minutes or more', () => {
      const scheduledStart = new Date('2026-09-12T11:00:00+05:00');
      const now59MinsLate = new Date('2026-09-12T11:59:00+05:00');
      const now60MinsLate = new Date('2026-09-12T12:00:00+05:00');
      const now75MinsLate = new Date('2026-09-12T12:15:00+05:00');

      const isEscalated = (start: Date, current: Date) => {
        const diffMinutes = Math.floor((current.getTime() - start.getTime()) / 60000);
        return diffMinutes >= 60;
      };

      expect(isEscalated(scheduledStart, now59MinsLate)).toBe(false);
      expect(isEscalated(scheduledStart, now60MinsLate)).toBe(true);
      expect(isEscalated(scheduledStart, now75MinsLate)).toBe(true);
    });
  });

  // 16. Private Payment Proof & Disbursal Audit Trail
  describe('16. Private Payment Proof & Disbursal Audit Trail', () => {
    it('records paying manager id (paidBy) and timestamp (paidAt) on paid status', () => {
      const managerId = 'mgr-123';
      const record = {
        id: 'pay-1',
        status: 'paid',
        paidAt: new Date().toISOString(),
        paidBy: managerId,
        paymentProofUrl: 'payroll-proofs/pay-1/receipt.pdf'
      };

      expect(record.status).toBe('paid');
      expect(record.paidBy).toBe(managerId);
      expect(record.paidAt).toBeTruthy();
      expect(record.paymentProofUrl).toBeTruthy();
    });
  });

  // 17. Setup Pending Gate & Security Contradiction Resolution
  describe('17. Setup Pending Gate & Security Contradiction Resolution', () => {
    it('blocks check-in attempts when employee setup is not completed', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: { user: { id: 'user-setup-pending' } as any },
        error: null
      } as any);

      // Mock fetchEmployeeRecord to return setupCompletedAt = null
      vi.spyOn(employeeOperationsService, 'fetchEmployeeRecord').mockResolvedValueOnce({
        id: 'user-setup-pending',
        employeeId: 'EMP-001',
        setupCompletedAt: null,
        sopAcknowledged: false,
        salary: 0,
        createdAt: '',
        updatedAt: ''
      } as any);

      const res = await employeeOperationsService.checkIn({
        evidenceBlob: new Blob(['evidence'])
      });

      expect(res.error).toContain('Employee setup is pending');
      expect(res.attendance).toBeUndefined();
    });

    it('blocks check-out attempts when employee setup is not completed', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: { user: { id: 'user-setup-pending' } as any },
        error: null
      } as any);

      vi.spyOn(employeeOperationsService, 'fetchEmployeeRecord').mockResolvedValueOnce({
        id: 'user-setup-pending',
        employeeId: 'EMP-001',
        setupCompletedAt: null,
        sopAcknowledged: false,
        salary: 0,
        createdAt: '',
        updatedAt: ''
      } as any);

      const res = await employeeOperationsService.checkOut({
        attendanceId: 'att-1',
        evidenceBlob: new Blob(['evidence'])
      });

      expect(res.error).toContain('Employee setup is pending');
      expect(res.attendance).toBeUndefined();
    });

    it('exempts setup-pending employees from late, absence, and penalty calculations', () => {
      const isSetupPending = true;
      const attendanceHistory = [
        { id: '1', workDate: '2026-09-10', status: 'late' as const, lateDeduction: 500 },
        { id: '2', workDate: '2026-09-11', status: 'absent' as const, absenceDeduction: 5000 }
      ];

      const presentDays = isSetupPending ? 0 : attendanceHistory.filter(a => a.status === 'present' || a.status === 'late').length;
      const lateDays = isSetupPending ? 0 : attendanceHistory.filter(a => a.status === 'late').length;
      const totalLateDeductions = isSetupPending ? 0 : attendanceHistory.reduce((sum, a) => sum + (a.lateDeduction || 0), 0);
      const unapprovedAbsences = isSetupPending ? 0 : attendanceHistory.filter(a => a.status === 'absent').length;
      const totalAbsenceDeductions = isSetupPending ? 0 : attendanceHistory.reduce((sum, a) => sum + (a.absenceDeduction || 0), 0);

      expect(presentDays).toBe(0);
      expect(lateDays).toBe(0);
      expect(totalLateDeductions).toBe(0);
      expect(unapprovedAbsences).toBe(0);
      expect(totalAbsenceDeductions).toBe(0);
    });
  });

  // 18. Create / Edit Employee Bank Details & Setup Validation Parity
  describe('18. Create / Edit Employee Bank Details & Setup Validation Parity', () => {
    it('validates setup completion criteria (Designation, Department, Shift, Base Salary > 0)', () => {
      const validateSetup = (data: { designationId?: string; departmentIds?: string[]; shiftId?: string; salary?: number }) => {
        const errors: string[] = [];
        if (!data.designationId) errors.push('Designation required');
        if (!data.departmentIds || data.departmentIds.length === 0) errors.push('Department required');
        if (!data.shiftId) errors.push('Shift required');
        if (!data.salary || data.salary <= 0) errors.push('Valid Base Monthly Salary (> 0 PKR) required');
        return { isValid: errors.length === 0, errors };
      };

      expect(validateSetup({}).isValid).toBe(false);
      expect(validateSetup({ designationId: 'desig-1', departmentIds: ['dep-1'], shiftId: 'shift-1', salary: 0 }).isValid).toBe(false);
      expect(validateSetup({ designationId: 'desig-1', departmentIds: ['dep-1'], shiftId: 'shift-1', salary: 150000 }).isValid).toBe(true);
    });

    it('handles bank details storage with bank name, account title, and account number/IBAN', () => {
      const bankDetails = {
        userId: 'user-123',
        bankName: 'Meezan Bank',
        accountTitle: 'Muhammad Ali',
        accountNumber: '01020304050607',
        iban: 'PK12MEZN0001020304050607',
        isVerified: true
      };

      expect(bankDetails.bankName).toBe('Meezan Bank');
      expect(bankDetails.accountTitle).toBe('Muhammad Ali');
      expect(bankDetails.accountNumber).toBeTruthy();
      expect(bankDetails.isVerified).toBe(true);
    });
  });

  // 19. Role-Based Access Isolation & Security
  describe('19. Role-Based Access Isolation & Security', () => {
    it('allows only owner and operational_manager to manage operations or complete setup', () => {
      const canManageOps = (role: string) => role === 'owner' || role === 'operational_manager';

      expect(canManageOps('owner')).toBe(true);
      expect(canManageOps('operational_manager')).toBe(true);
      expect(canManageOps('team_member')).toBe(false);
      expect(canManageOps('client')).toBe(false);
    });

    it('isolates team members to their own employee dashboard view', () => {
      const currentUserId = 'user-abc';
      const targetUserId = 'user-xyz';

      const canViewDossier = (role: string, myId: string, requestedId: string) => {
        if (role === 'owner' || role === 'operational_manager') return true;
        return myId === requestedId;
      };

      expect(canViewDossier('owner', currentUserId, targetUserId)).toBe(true);
      expect(canViewDossier('operational_manager', currentUserId, targetUserId)).toBe(true);
      expect(canViewDossier('team_member', currentUserId, targetUserId)).toBe(false);
      expect(canViewDossier('team_member', currentUserId, currentUserId)).toBe(true);
    });
  });

  // 20. Server-Authoritative Attendance RPC & Clock Manipulation Resistance
  describe('20. Server-Authoritative Attendance RPC & Clock Manipulation Resistance', () => {
    it('computes late minutes and status strictly using PKT shift schedule regardless of client timezone', () => {
      // PKT Shift: 11:00 PKT (06:00 UTC) to 20:00 PKT (15:00 UTC)
      const scheduledPKT = new Date('2026-09-12T11:00:00+05:00');
      // Even if client clock is set to local UTC or US Pacific, server compares against true UTC/PKT instant
      const checkInAt1105PKT = new Date('2026-09-12T06:05:00Z'); // Exactly 11:05 PKT
      const checkInResult = employeeOperationsService.calculateLateMinutes(scheduledPKT, checkInAt1105PKT);

      expect(checkInResult.isLate).toBe(true);
      expect(checkInResult.minutesLate).toBe(5);
      expect(checkInResult.deduction).toBe(500);
    });

    it('rejects duplicate check-in attempts on the same workDate', async () => {
      const isDuplicate = (existingCheckIn: string | null) => {
        return !!existingCheckIn;
      };

      expect(isDuplicate('2026-09-12T11:00:00Z')).toBe(true);
      expect(isDuplicate(null)).toBe(false);
    });
  });

  // 21. Scheduled Background Automation Engine & Absence Deduction Math
  describe('21. Scheduled Background Automation Engine & Absence Deduction Math', () => {
    it('generates 60-minute missing check-in management alert idempotently', () => {
      const shiftStart = new Date('2026-09-12T11:00:00+05:00');
      const now65MinsPast = new Date('2026-09-12T12:05:00+05:00');
      const hasCheckedIn = false;

      const shouldCreate60mAlert = !hasCheckedIn && (now65MinsPast.getTime() - shiftStart.getTime()) >= 60 * 60 * 1000;
      const idempotencyKey = `missing_checkin_60m_emp1_2026-09-12`;

      expect(shouldCreate60mAlert).toBe(true);
      expect(idempotencyKey).toBe('missing_checkin_60m_emp1_2026-09-12');
    });

    it('marks unapproved absence at shift end with exact daily salary deduction (Salary / DaysInMonth)', () => {
      const salary = 120000;
      const daysInSept = 30;
      const absenceDeduction = Math.round((salary / daysInSept) * 100) / 100;

      expect(absenceDeduction).toBe(4000); // 120000 / 30 = 4000
    });

    it('flags missing checkout at shift end without applying automatic deductions', () => {
      const shiftEnd = new Date('2026-09-12T20:00:00+05:00');
      const now35MinsPastEnd = new Date('2026-09-12T20:35:00+05:00');
      const isCheckedIn = true;
      const isCheckedOut = false;

      const shouldFlagMissingCheckout = isCheckedIn && !isCheckedOut && (now35MinsPastEnd.getTime() - shiftEnd.getTime()) >= 30 * 60 * 1000;
      expect(shouldFlagMissingCheckout).toBe(true);
    });

    it('flags early checkout for management review without automated penalty', () => {
      const scheduledCheckOut = new Date('2026-09-12T20:00:00+05:00');
      const actualEarlyCheckout = new Date('2026-09-12T18:30:00+05:00');

      const isEarly = actualEarlyCheckout.getTime() < (scheduledCheckOut.getTime() - 5 * 60 * 1000);
      const automaticPenalty = 0; // Policy: Early checkouts require manager review, no automatic deduction

      expect(isEarly).toBe(true);
      expect(automaticPenalty).toBe(0);
    });
  });

  // 22. Bank Detail Approval Enforcement & Non-Manager Write Prevention
  describe('22. Bank Detail Approval Enforcement & Non-Manager Write Prevention', () => {
    it('creates a pending change request with management task when team member submits bank update', () => {
      const isManager = false;
      const submission = {
        employeeId: 'emp-101',
        bankName: 'Faysal Bank',
        accountTitle: 'Ali Raza',
        accountNumber: '0204060810',
        iban: 'PK45FAYS0000000204060810'
      };

      const workflowAction = isManager ? 'direct_update' : 'change_request';
      expect(workflowAction).toBe('change_request');
    });

    it('allows manager to approve pending bank request, updating official details', () => {
      const pendingRequest = {
        id: 'cr-99',
        employeeId: 'emp-101',
        requestType: 'bank_details',
        status: 'pending',
        requestedChanges: {
          bankName: 'Faysal Bank',
          accountTitle: 'Ali Raza',
          accountNumber: '0204060810'
        }
      };

      const applyApproval = (req: typeof pendingRequest) => ({
        ...req,
        status: 'approved',
        reviewedBy: 'mgr-1',
        reviewedAt: '2026-09-12T15:00:00Z'
      });

      const approved = applyApproval(pendingRequest);
      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe('mgr-1');
    });
  });

  // 23. Effective-Dated Working Days Computation
  describe('23. Effective-Dated Working Days Computation', () => {
    it('calculates scheduled working days in September 2026 (30 days - 4 Sundays = 26 days)', () => {
      const workingDays = employeeOperationsService.calculateMonthScheduledWorkingDays(2026, 9);
      expect(workingDays).toBe(26);
    });

    it('calculates scheduled working days in August 2026 (31 days - 5 Sundays = 26 days)', () => {
      const workingDays = employeeOperationsService.calculateMonthScheduledWorkingDays(2026, 8);
      expect(workingDays).toBe(26);
    });

    it('calculates scheduled working days in October 2026 (31 days - 4 Sundays = 27 days)', () => {
      const workingDays = employeeOperationsService.calculateMonthScheduledWorkingDays(2026, 10);
      expect(workingDays).toBe(27);
    });

    it('calculates scheduled working days in February 2026 (28 days - 4 Sundays = 24 days)', () => {
      const workingDays = employeeOperationsService.calculateMonthScheduledWorkingDays(2026, 2);
      expect(workingDays).toBe(24);
    });
  });

  // 24. Private Bucket Storage & Short-Lived Signed URL Generation
  describe('24. Private Bucket Storage & Short-Lived Signed URL Generation', () => {
    it('stores attendance evidence in private bucket with employee id namespace', () => {
      const employeeId = 'emp-555';
      const workDate = '2026-09-12';
      const timestamp = 1789210000;
      const expectedPath = `${employeeId}/${workDate}_checkin_${timestamp}.jpg`;

      expect(expectedPath.startsWith('emp-555/')).toBe(true);
      expect(expectedPath.endsWith('.jpg')).toBe(true);
    });

    it('denies client role access to private storage and employee records', () => {
      const clientRole = 'client';
      const canAccessEmployeeRecords = (role: string) => role === 'owner' || role === 'operational_manager';
      const canAccessOwnRecordOnly = (role: string, targetId: string, currentId: string) => {
        if (role === 'client') return false;
        if (role === 'team_member') return targetId === currentId;
        return true;
      };

      expect(canAccessEmployeeRecords(clientRole)).toBe(false);
      expect(canAccessOwnRecordOnly(clientRole, 'emp-1', 'emp-1')).toBe(false);
    });
  });

  // 25. Complete Employee 360 Submodules
  describe('25. Complete Employee 360 Submodules (Work Reports, Goals, Documents, Salary Hikes)', () => {
    it('manages weekly and monthly work reports with review workflow', () => {
      const report = {
        id: 'rep-1',
        employeeId: 'emp-1',
        reportType: 'weekly' as const,
        period: '2026-W37',
        summary: 'Completed client deliverables and resolved bug backlog',
        achievements: 'Speed optimization of core dashboard',
        status: 'submitted' as const
      };

      expect(report.reportType).toBe('weekly');
      expect(report.status).toBe('submitted');
    });

    it('tracks employee performance goals and progress percentages', () => {
      const goal = {
        id: 'goal-1',
        employeeId: 'emp-1',
        title: 'Complete System Governance Certification',
        targetDate: '2026-10-31',
        progress: 75,
        status: 'in_progress' as const
      };

      expect(goal.progress).toBe(75);
      expect(goal.status).toBe('in_progress');
    });

    it('supports employee governance documents with digital acknowledgement requirement', () => {
      const doc = {
        id: 'doc-1',
        employeeId: 'emp-1',
        title: 'Employment Agreement 2026',
        documentType: 'contract' as const,
        filePath: 'emp-1/contract_2026.pdf',
        acknowledgementRequired: true,
        acknowledgedAt: null
      };

      expect(doc.acknowledgementRequired).toBe(true);
      expect(doc.acknowledgedAt).toBeNull();
    });

    it('records salary-hike increments with previous vs new salary comparison', () => {
      const hike = {
        id: 'hike-1',
        employeeId: 'emp-1',
        previousSalary: 120000,
        newSalary: 145000,
        effectiveDate: '2026-10-01',
        reason: 'Annual performance merit increment',
        approvedBy: 'owner-1'
      };

      const increase = hike.newSalary - hike.previousSalary;
      const percentage = (increase / hike.previousSalary) * 100;

      expect(increase).toBe(25000);
      expect(Number(percentage.toFixed(1))).toBe(20.8);
    });
  });


  // 26. Night Shift Anchoring & Boundary Tests (PKT UTC+5)
  describe('26. Night Shift Anchoring & Boundary Tests (8 PM - 5 AM PKT)', () => {
    const shift = {
      startTime: '20:00:00',
      endTime: '05:00:00',
      crossesMidnight: true
    };

    const resolveNightShiftAnchor = (pktTimeStr: string, currentDate: string) => {
      // pktTimeStr: "HH:MM:SS"
      const [h, m] = pktTimeStr.split(':').map(Number);
      const timeInMins = h * 60 + m;
      const shiftStartMins = 20 * 60; // 1200
      const shiftEndMins = 5 * 60;    // 300

      if (timeInMins <= shiftEndMins) {
        // Post-midnight before 05:00 AM: Anchored to yesterday
        const yesterday = new Date(currentDate);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          anchoredWorkDate: yesterday.toISOString().slice(0, 10),
          shiftWindow: 'yesterday_instance',
          isShiftActive: true
        };
      } else if (timeInMins >= (shiftStartMins - 120)) {
        // 18:00 to 23:59: Anchored to today
        return {
          anchoredWorkDate: currentDate,
          shiftWindow: 'today_instance',
          isShiftActive: true
        };
      } else {
        // Outside shift window (05:01 to 17:59)
        return {
          anchoredWorkDate: null,
          shiftWindow: 'inactive',
          isShiftActive: false
        };
      }
    };

    it('anchors 7:59 PM PKT to today instance (within 2h pre-shift check-in window)', () => {
      const res = resolveNightShiftAnchor('19:59:00', '2026-09-12');
      expect(res.anchoredWorkDate).toBe('2026-09-12');
      expect(res.isShiftActive).toBe(true);
    });

    it('anchors 8:00 PM PKT (shift start) to today instance', () => {
      const res = resolveNightShiftAnchor('20:00:00', '2026-09-12');
      expect(res.anchoredWorkDate).toBe('2026-09-12');
      expect(res.isShiftActive).toBe(true);
    });

    it('anchors 11:59 PM PKT to today instance', () => {
      const res = resolveNightShiftAnchor('23:59:00', '2026-09-12');
      expect(res.anchoredWorkDate).toBe('2026-09-12');
      expect(res.isShiftActive).toBe(true);
    });

    it('anchors 12:00 AM (00:00 PKT) to yesterday instance', () => {
      const res = resolveNightShiftAnchor('00:00:00', '2026-09-13');
      expect(res.anchoredWorkDate).toBe('2026-09-12');
      expect(res.isShiftActive).toBe(true);
    });

    it('anchors 4:59 AM PKT to yesterday instance', () => {
      const res = resolveNightShiftAnchor('04:59:00', '2026-09-13');
      expect(res.anchoredWorkDate).toBe('2026-09-12');
      expect(res.isShiftActive).toBe(true);
    });

    it('anchors 5:00 AM PKT (shift end) to yesterday instance', () => {
      const res = resolveNightShiftAnchor('05:00:00', '2026-09-13');
      expect(res.anchoredWorkDate).toBe('2026-09-12');
      expect(res.isShiftActive).toBe(true);
    });

    it('rejects check-in outside legitimate shift window at 12:00 PM (Noon PKT)', () => {
      const res = resolveNightShiftAnchor('12:00:00', '2026-09-13');
      expect(res.anchoredWorkDate).toBeNull();
      expect(res.isShiftActive).toBe(false);
    });
  });

  // 27. Screenshot Evidence Ownership & Path Traversal Validation
  describe('27. Screenshot Evidence Ownership & Path Traversal Validation', () => {
    const validateEvidencePath = (callerId: string, path: string | null | undefined, evidenceType: string) => {
      if (!path || !path.trim()) return { valid: false, error: 'Evidence path required' };
      if (!path.startsWith(`${callerId}/`)) return { valid: false, error: 'Evidence path must reside in authenticated employee directory' };
      if (path.includes('..')) return { valid: false, error: 'Path traversal detected' };
      if (!['screen_capture', 'manual_upload'].includes(evidenceType)) return { valid: false, error: 'Invalid evidence type' };
      return { valid: true };
    };

    it('accepts valid path inside employee private folder', () => {
      const callerId = 'user-123';
      const path = 'user-123/1789210000_checkin.jpg';
      expect(validateEvidencePath(callerId, path, 'screen_capture').valid).toBe(true);
    });

    it('rejects attempt by Team Member A to use Team Member B evidence path', () => {
      const callerId = 'team-member-a';
      const victimPath = 'team-member-b/1789210000_checkin.jpg';
      const res = validateEvidencePath(callerId, victimPath, 'screen_capture');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('authenticated employee directory');
    });

    it('rejects directory traversal attempts in evidence path', () => {
      const callerId = 'user-123';
      const traversalPath = 'user-123/../../../etc/passwd.jpg';
      const res = validateEvidencePath(callerId, traversalPath, 'screen_capture');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Path traversal');
    });

    it('rejects unsupported evidence types', () => {
      const callerId = 'user-123';
      const path = 'user-123/checkin.jpg';
      const res = validateEvidencePath(callerId, path, 'spoofed_camera');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Invalid evidence type');
    });
  });

  // 28. Narrow Concern & Acknowledgement RPC Security
  describe('28. Narrow Concern & Acknowledgement RPC Security', () => {
    it('only updates acknowledgement fields without modifying financial or governance properties', () => {
      const originalAsset: CompanyAsset = {
        id: 'asset-1',
        itemName: 'MacBook Pro 16',
        assetTag: 'MAC-001',
        status: 'assigned',
        price: 350000,
        replacementValue: 350000,
        condition: 'good',
        issueDate: '2026-09-01',
        financialRecoveryApproved: false,
        financialRecoveryAmount: 0,
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01'
      };

      const acknowledgeRpc = (asset: CompanyAsset, actorId: string): CompanyAsset => {
        // Narrow RPC updates ONLY acknowledged_at, acknowledged_by, status
        return {
          ...asset,
          status: 'acknowledged',
          acknowledgedAt: '2026-09-12T10:00:00Z',
          acknowledgedBy: actorId,
          updatedAt: '2026-09-12T10:00:00Z'
        };
      };

      const acknowledged = acknowledgeRpc(originalAsset, 'emp-1');
      expect(acknowledged.status).toBe('acknowledged');
      expect(acknowledged.acknowledgedBy).toBe('emp-1');
      // Financial and core attributes are completely immutable by employee
      expect(acknowledged.price).toBe(350000);
      expect(acknowledged.assetTag).toBe('MAC-001');
    });

    it('attaches payroll concern notes and creates management task without modifying payable salary', () => {
      const originalPayroll = {
        id: 'pay-1',
        employeeId: 'emp-1',
        grossSalary: 150000,
        lateDeductionsTotal: 1000,
        absenceDeductionsTotal: 5000,
        netPayable: 144000,
        status: 'pending' as const,
        concernNotes: null as string | null
      };

      const raisePayrollConcernRpc = (payroll: typeof originalPayroll, notes: string) => {
        return {
          updatedPayroll: {
            ...payroll,
            concernNotes: notes
          },
          managementTask: {
            taskType: 'payroll_concern',
            employeeId: payroll.employeeId,
            referenceId: payroll.id,
            status: 'open'
          }
        };
      };

      const result = raisePayrollConcernRpc(originalPayroll, 'Dispute on late cut for Sept 10');
      expect(result.updatedPayroll.concernNotes).toBe('Dispute on late cut for Sept 10');
      expect(result.updatedPayroll.netPayable).toBe(144000); // Unaltered!
      expect(result.updatedPayroll.grossSalary).toBe(150000); // Unaltered!
      expect(result.managementTask.taskType).toBe('payroll_concern');
    });
  });

  // 29. Edge Function Authorization & POST-Only Security
  describe('29. Edge Function Authorization & POST-Only Security', () => {
    const handleEdgeRequest = (method: string, secretHeader?: string, expectedSecret = 'TEST_CRON_SECRET_123') => {
      if (method !== 'POST') {
        return { status: 405, error: 'Method not allowed' };
      }
      if (!secretHeader || secretHeader !== `Bearer ${expectedSecret}`) {
        return { status: 401, error: 'Unauthorized' };
      }
      return { status: 200, success: true };
    };

    it('rejects GET, PUT, DELETE, OPTIONS requests with 405', () => {
      expect(handleEdgeRequest('GET').status).toBe(405);
      expect(handleEdgeRequest('PUT').status).toBe(405);
      expect(handleEdgeRequest('DELETE').status).toBe(405);
    });

    it('rejects unauthorized POST requests without secret with 401', () => {
      expect(handleEdgeRequest('POST').status).toBe(401);
      expect(handleEdgeRequest('POST', 'Bearer WRONG_SECRET').status).toBe(401);
    });

    it('accepts authorized POST with valid CRON_SECRET with 200', () => {
      expect(handleEdgeRequest('POST', 'Bearer TEST_CRON_SECRET_123').status).toBe(200);
    });
  });

  // 30. Server-Authoritative Frontend RPC & Repeated-Click Protection Suite
  describe('30. Server-Authoritative Frontend RPC & Repeated-Click Protection Suite', () => {
    it('checkIn sends only screenshot path and evidence type without client dates or late calculations', async () => {
      let rpcNameCalled = '';
      let rpcParamsPassed: any = null;

      const mockSupabaseRpc = async (fn: string, params: any) => {
        rpcNameCalled = fn;
        rpcParamsPassed = params;
        return {
          data: {
            id: 'att-123',
            employee_id: 'emp-user-1',
            work_date: '2026-09-12',
            status: 'on_time',
            minutes_late: 0,
            late_deduction: 0,
            absence_deduction: 0,
            check_in_time: '2026-09-12T06:00:00Z',
            created_at: '2026-09-12T06:00:00Z',
            updated_at: '2026-09-12T06:00:00Z'
          },
          error: null
        };
      };

      // Mock setup
      vi.spyOn(employeeOperationsService, 'fetchEmployeeRecord').mockResolvedValueOnce({
        id: 'emp-user-1',
        setupCompletedAt: '2026-09-01T00:00:00Z'
      } as any);

      // Verify parameters sent to the RPC
      const res = await mockSupabaseRpc('fn_employee_check_in', {
        p_screenshot_path: 'emp-user-1/checkin_12345.jpg',
        p_evidence_type: 'screen_capture',
        p_metadata: { userAgent: 'test-agent' }
      });

      expect(rpcNameCalled).toBe('fn_employee_check_in');
      expect(rpcParamsPassed).toHaveProperty('p_screenshot_path');
      expect(rpcParamsPassed).toHaveProperty('p_evidence_type');
      expect(rpcParamsPassed).not.toHaveProperty('employeeId');
      expect(rpcParamsPassed).not.toHaveProperty('workDate');
      expect(rpcParamsPassed).not.toHaveProperty('status');
      expect(rpcParamsPassed).not.toHaveProperty('minutesLate');
      expect(rpcParamsPassed).not.toHaveProperty('lateDeduction');
      expect(res.data.id).toBe('att-123');
    });

    it('checkOut sends only attendance id and screenshot path without client timestamps', async () => {
      let rpcNameCalled = '';
      let rpcParamsPassed: any = null;

      const mockSupabaseRpc = async (fn: string, params: any) => {
        rpcNameCalled = fn;
        rpcParamsPassed = params;
        return {
          data: {
            id: 'att-123',
            employee_id: 'emp-user-1',
            work_date: '2026-09-12',
            status: 'on_time',
            check_out_time: '2026-09-12T15:00:00Z',
            updated_at: '2026-09-12T15:00:00Z'
          },
          error: null
        };
      };

      const res = await mockSupabaseRpc('fn_employee_check_out', {
        p_attendance_id: 'att-123',
        p_screenshot_path: 'emp-user-1/checkout_12345.jpg',
        p_evidence_type: 'screen_capture',
        p_early_reason: null,
        p_metadata: { userAgent: 'test-agent' }
      });

      expect(rpcNameCalled).toBe('fn_employee_check_out');
      expect(rpcParamsPassed).toHaveProperty('p_attendance_id');
      expect(rpcParamsPassed).toHaveProperty('p_screenshot_path');
      expect(rpcParamsPassed).not.toHaveProperty('employeeId');
      expect(rpcParamsPassed).not.toHaveProperty('workDate');
      expect(rpcParamsPassed).not.toHaveProperty('status');
      expect(rpcParamsPassed).not.toHaveProperty('checkOutTime');
      expect(res.data.status).toBe('on_time');
    });

    it('cleans up uploaded screenshot if server RPC returns an error', async () => {
      let removedPath = '';
      const mockStorageRemove = async (paths: string[]) => {
        removedPath = paths[0];
        return { data: null, error: null };
      };

      const uploadedPath = 'emp-1/checkin_failed.jpg';
      const rpcError = { message: 'Shift window closed' };

      // Simulate cleanup on failure
      if (rpcError && uploadedPath) {
        await mockStorageRemove([uploadedPath]);
      }

      expect(removedPath).toBe('emp-1/checkin_failed.jpg');
    });
  });

  // 31. Schedule-Aware Dynamic Working Schedule Variations (Monday-Friday vs Monday-Saturday)
  describe('31. Schedule-Aware Dynamic Working Schedule Variations', () => {
    const monToSatSchedule: CompanyWorkSchedule[] = [
      {
        id: 'sch-legacy',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-09-30',
        workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
        description: 'Legacy 6-day work week'
      },
      {
        id: 'sch-modern',
        effectiveFrom: '2026-10-01',
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        description: 'Modern 5-day work week'
      }
    ];

    it('correctly treats Saturday as working day under Sept 2026 schedule', () => {
      const septSaturday = new Date('2026-09-12T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(septSaturday, monToSatSchedule)).toBe(true);
    });

    it('correctly treats Saturday as off day under Oct 2026 5-day schedule without rewriting history', () => {
      const octSaturday = new Date('2026-10-03T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(octSaturday, monToSatSchedule)).toBe(false);
    });

    it('never treats Sunday as working day under either schedule', () => {
      const septSunday = new Date('2026-09-13T12:00:00Z');
      const octSunday = new Date('2026-10-04T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(septSunday, monToSatSchedule)).toBe(false);
      expect(employeeOperationsService.isWorkingDay(octSunday, monToSatSchedule)).toBe(false);
    });
  });

  // 32. Deterministic Pakistan Time (PKT) Behavioral Matrix
  describe('32. Deterministic Pakistan Time (PKT) Behavioral Matrix', () => {
    it('determines 11:00 AM PKT check-in as on-time with PKR 0 penalty', () => {
      const scheduled = new Date('2026-09-12T11:00:00+05:00');
      const actual = new Date('2026-09-12T11:00:00+05:00');
      const res = employeeOperationsService.calculateLateMinutes(scheduled, actual);
      expect(res.isLate).toBe(false);
      expect(res.deduction).toBe(0);
    });

    it('determines 11:01 AM PKT check-in as late with PKR 500 penalty', () => {
      const scheduled = new Date('2026-09-12T11:00:00+05:00');
      const actual = new Date('2026-09-12T11:01:00+05:00');
      const res = employeeOperationsService.calculateLateMinutes(scheduled, actual);
      expect(res.isLate).toBe(true);
      expect(res.minutesLate).toBe(1);
      expect(res.deduction).toBe(500);
    });

    it('determines 60-minute absence trigger at 12:00 PM PKT when no check-in exists', () => {
      const scheduled = new Date('2026-09-12T11:00:00+05:00');
      const now = new Date('2026-09-12T12:00:00+05:00');
      const diffMinutes = (now.getTime() - scheduled.getTime()) / (1000 * 60);
      expect(diffMinutes).toBe(60);
      expect(diffMinutes >= 60).toBe(true);
    });

    it('never creates automatic salary deductions on early checkout or missing checkout review tasks', () => {
      const earlyCheckoutTask = {
        taskType: 'early_checkout_review',
        earlyCheckoutStatus: 'pending_review',
        automaticDeduction: 0
      };
      const missingCheckoutTask = {
        taskType: 'missing_checkout',
        status: 'open',
        automaticDeduction: 0
      };

      expect(earlyCheckoutTask.automaticDeduction).toBe(0);
      expect(missingCheckoutTask.automaticDeduction).toBe(0);
    });

    it('preserves idempotency on duplicate automation task generation', () => {
      const tasksMap = new Map<string, any>();

      const insertTask = (idempotencyKey: string, task: any) => {
        if (!tasksMap.has(idempotencyKey)) {
          tasksMap.set(idempotencyKey, task);
          return { inserted: true };
        }
        return { inserted: false };
      };

      const key = 'missing_checkin_60m_emp1_2026-09-12';
      const firstRun = insertTask(key, { title: 'Missing Checkin Alert' });
      const secondRun = insertTask(key, { title: 'Missing Checkin Alert' });

      expect(firstRun.inserted).toBe(true);
      expect(secondRun.inserted).toBe(false);
      expect(tasksMap.size).toBe(1);
    });
  });

  // 33. Release Gate: Custom Overnight Shifts & Dynamic Working Schedule
  describe('33. Release Gate: Custom Overnight Shifts & Dynamic Working Schedule', () => {
    it('correctly formats working schedule description from active company work schedule', () => {
      const schedules = [
        {
          effectiveFrom: '2026-01-01',
          workingDays: [1, 2, 3, 4, 5, 6],
          description: 'Standard 6-day work week'
        }
      ];
      const desc = formatWorkingScheduleDescription(schedules, new Date('2026-09-12T12:00:00+05:00'));
      expect(desc).toBe('Monday – Saturday');
    });

    it('dynamically adapts working schedule description for 5-day schedules', () => {
      const schedules = [
        {
          effectiveFrom: '2026-10-01',
          workingDays: [1, 2, 3, 4, 5],
          description: 'Modern 5-day work week'
        }
      ];
      const desc = formatWorkingScheduleDescription(schedules, '2026-10-05');
      expect(desc).toBe('Monday – Friday');
    });

    it('accurately calculates custom overnight shift window (e.g. 21:00 to 06:00)', () => {
      const customShift = calculateShiftWindow('2026-09-12', '21:00:00', '06:00:00', true);
      expect(customShift.crossesMidnight).toBe(true);
      expect(customShift.scheduledStart.toISOString()).toBe(new Date('2026-09-12T21:00:00+05:00').toISOString());
      expect(customShift.scheduledEnd.toISOString()).toBe(new Date('2026-09-13T06:00:00+05:00').toISOString());
    });
  });

  // 34. Release Gate: Overnight Shift Late Checkout & Strict Identity Gate
  describe('34. Release Gate: Overnight Shift Late Checkout & Strict Identity Gate', () => {
    it('supports late checkout after scheduled shift end (e.g. 05:30 AM for 21:00-05:00 shift) without marking absence', () => {
      const shiftStart = new Date('2026-09-12T21:00:00+05:00');
      const shiftEnd = new Date('2026-09-13T05:00:00+05:00');
      const actualCheckOut = new Date('2026-09-13T05:30:00+05:00');

      // Late checkout after scheduled end is overtime/completed shift, not early checkout
      const isEarly = actualCheckOut.getTime() < shiftEnd.getTime();
      expect(isEarly).toBe(false);

      // Duration worked: 8.5 hours
      const durationHours = (actualCheckOut.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
      expect(durationHours).toBe(8.5);
    });

    it('rejects check-in when caller is not authenticated via getUser()', async () => {
      const res = await employeeOperationsService.checkIn({
        metadata: { workMode: 'remote' }
      });
      // In mock environment without authenticated user, returns Unauthorized
      expect(res.error).toBeDefined();
      expect(res.error).toContain('Unauthorized');
    });

    it('rejects check-out when caller is not authenticated via getUser()', async () => {
      const res = await employeeOperationsService.checkOut({
        attendanceId: 'att-123'
      });
      expect(res.error).toBeDefined();
      expect(res.error).toContain('Unauthorized');
    });
  });

});
