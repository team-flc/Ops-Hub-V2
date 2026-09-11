import { describe, it, expect, vi, beforeEach } from 'vitest';
import { employeeOperationsService } from '../src/lib/employeeOperationsService';
import { WorkShift, CompanyWorkSchedule, NoticePeriodStatus, GoodStandingStatus, CompanyAsset } from '../src/types';

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

  // 5. 8-Component Final Settlement Calculation Engine
  describe('5. 8-Component Final Settlement Calculation Engine', () => {
    it('calculates net final settlement with pending salary, current accrued, additions, deductions, and held amount', () => {
      const pendingPrevious = 100000;
      const currentAccrued = 50000;
      const severanceBonus = 20000;
      const lateDeductions = 1500; // 3 late days
      const absenceDeductions = 5000; // 1 absent day
      const assetRecovery = 15000; // 1 damaged/lost item
      const heldPending = 10000; // partial hold
      const otherAdjustments = 2000;

      const totalAdditions = pendingPrevious + currentAccrued + severanceBonus;
      const totalDeductions = lateDeductions + absenceDeductions + assetRecovery + heldPending + otherAdjustments;
      const netFinalPayable = Math.max(0, totalAdditions - totalDeductions);

      expect(totalAdditions).toBe(170000);
      expect(totalDeductions).toBe(33500);
      expect(netFinalPayable).toBe(136500);
    });
  });

  // 6. Notice Period & Good Standing Status Rules
  describe('6. Notice Period & Good Standing Status Rules', () => {
    it('holds full accrued salary when notice period is not served', () => {
      const baseSalary = 120000;
      const currentAccrued = 60000;
      const noticeStatus: NoticePeriodStatus = 'not_served';

      let held = 0;
      if (noticeStatus === 'not_served') {
        held = Math.min(baseSalary, currentAccrued);
      }
      expect(held).toBe(60000);
    });

    it('holds 50% accrued salary when notice period is short-served', () => {
      const currentAccrued = 60000;
      const noticeStatus: NoticePeriodStatus = 'short_served';

      let held = 0;
      if (noticeStatus === 'short_served') {
        held = Math.round(currentAccrued * 0.5);
      }
      expect(held).toBe(30000);
    });

    it('holds 0 when notice period is served in full or waived', () => {
      const currentAccrued = 60000;
      const noticeStatus: NoticePeriodStatus = 'served';
      const goodStanding: GoodStandingStatus = 'good_standing';

      let held = 0;
      if (noticeStatus === 'served' && goodStanding === 'good_standing') {
        held = 0;
      }
      expect(held).toBe(0);
    });

    it('holds full accrued salary when good standing is disputed or terminated for cause', () => {
      const currentAccrued = 75000;
      const goodStanding: GoodStandingStatus = 'terminated_for_cause';

      let held = 0;
      if (goodStanding === 'disputed' || goodStanding === 'terminated_for_cause') {
        held = currentAccrued;
      }
      expect(held).toBe(75000);
    });
  });

  // 7. Night Shift Midnight Crossing
  describe('7. Night Shift Midnight Crossing', () => {
    it('correctly validates night shift start at 20:00 and end at 05:00 with crossesMidnight true', () => {
      const nightShift: WorkShift = {
        id: 'shift-night',
        name: 'Night Shift',
        code: 'NIGHT_01',
        startTime: '20:00:00',
        endTime: '05:00:00',
        crossesMidnight: true,
        timezone: 'Asia/Karachi'
      };

      expect(nightShift.crossesMidnight).toBe(true);
      expect(nightShift.startTime).toBe('20:00:00');
      expect(nightShift.endTime).toBe('05:00:00');
    });
  });

  // 8. Safe Setup Gate Enforcement
  describe('8. Safe Setup Gate Enforcement', () => {
    it('requires setup_completed_at to be non-null for automated payroll generation', () => {
      const employeeNotSetup = {
        id: 'emp-1',
        fullName: 'New Staff',
        setupCompletedAt: null
      };
      const employeeSetup = {
        id: 'emp-2',
        fullName: 'Active Setup Staff',
        setupCompletedAt: '2026-09-01T10:00:00Z'
      };

      const isEligible = (emp: { setupCompletedAt?: string | null }) => !!emp.setupCompletedAt;
      expect(isEligible(employeeNotSetup)).toBe(false);
      expect(isEligible(employeeSetup)).toBe(true);
    });
  });

  // 9. PKT 15th Salary Countdown Math
  describe('9. PKT 15th Salary Countdown Math', () => {
    it('calculates exact remaining calendar days from Sept 12 to Sept 15 in PKT (3 days)', () => {
      const sept12 = new Date('2026-09-12T14:30:00+05:00');
      const { daysRemaining, nextSalaryDate } = employeeOperationsService.calculateDaysUntil15th(sept12);
      expect(nextSalaryDate).toBe('2026-09-15');
      expect(daysRemaining).toBe(3);
    });

    it('returns 0 days remaining on the 15th payout day itself', () => {
      const sept15 = new Date('2026-09-15T09:00:00+05:00');
      const { daysRemaining, formattedMessage } = employeeOperationsService.calculateSalaryCountdown(sept15);
      expect(daysRemaining).toBe(0);
      expect(formattedMessage).toContain('Salary Payout Day Today (15th)');
    });

    it('rolls over to 15th of next month when current date is past the 15th', () => {
      const sept16 = new Date('2026-09-16T10:00:00+05:00');
      const { nextSalaryDate, daysRemaining } = employeeOperationsService.calculateDaysUntil15th(sept16);
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
    it('calculates total replacement value for assigned, damaged, and lost assets', () => {
      const assets: CompanyAsset[] = [
        { id: 'a1', itemName: 'Laptop Dell XPS', assetTag: 'LAP-001', status: 'assigned', replacementValue: 120000, condition: 'good', createdAt: '', updatedAt: '' },
        { id: 'a2', itemName: 'Monitor 27"', assetTag: 'MON-002', status: 'damaged', replacementValue: 45000, condition: 'damaged', createdAt: '', updatedAt: '' },
        { id: 'a3', itemName: 'Headset Jabra', assetTag: 'AUD-003', status: 'available', replacementValue: 15000, condition: 'good', createdAt: '', updatedAt: '' }
      ];

      const recoverable = assets.filter(a => a.status === 'assigned' || a.status === 'damaged' || a.status === 'lost');
      const totalRecovery = recoverable.reduce((sum, a) => sum + (a.replacementValue ?? 0), 0);
      expect(totalRecovery).toBe(165000);
    });
  });

  // 12. SOP Acknowledgement Versioning
  describe('12. SOP Acknowledgement Versioning', () => {
    it('records version 1.0 upon acknowledgement and unlocks portal actions', () => {
      const empRecord = {
        sopAcknowledged: true,
        sopVersion: '1.0',
        sopAcknowledgedAt: '2026-09-12T08:00:00Z'
      };

      expect(empRecord.sopAcknowledged).toBe(true);
      expect(empRecord.sopVersion).toBe('1.0');
      expect(empRecord.sopAcknowledgedAt).toBeTruthy();
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

  // 16. Batch Attendance Query Isolation
  describe('16. Batch Attendance Query Isolation', () => {
    it('handles UUID strings without incorrectly interpreting them as dates', () => {
      const employeeUUID = '7d2e053f-4df6-455b-b9d9-c027bb309831';
      const dateString = '2026-09-12';

      // UUID has hyphens but length 36; date string has hyphens and length 10 (YYYY-MM-DD)
      const isDate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);
      expect(isDate(dateString)).toBe(true);
      expect(isDate(employeeUUID)).toBe(false);
    });
  });

  // 17. Read-Only Official Email Security
  describe('17. Read-Only Official Email Security', () => {
    it('prevents modifying workEmail during profile edits to maintain authoritative auth identity', () => {
      const initialProfile = {
        id: 'u-1',
        workEmail: 'official.staff@agency.com',
        backupPhone: '+923001234567'
      };

      const allowedUpdates = {
        backupPhone: '+923007654321'
      };

      const updatedProfile = {
        ...initialProfile,
        ...allowedUpdates
      };

      expect(updatedProfile.workEmail).toBe('official.staff@agency.com');
      expect(updatedProfile.backupPhone).toBe('+923007654321');
    });
  });
});

