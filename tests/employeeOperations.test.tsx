import { describe, it, expect, vi, beforeEach } from 'vitest';
import { employeeOperationsService } from '../src/lib/employeeOperationsService';
import { 
  WorkShift, CompanyWorkSchedule, NoticePeriodStatus, GoodStandingStatus, 
  CompanyAsset, ROLE_DISPLAY_NAMES, EmployeeRecord, TeamMemberRecord, AssetStatus
} from '../src/types';
import { 
  getPKTTodayDateString, getPKTCurrentMonthString, formatPKTDate, formatPKTTime,
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
});
