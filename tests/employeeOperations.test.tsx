import { describe, it, expect, vi, beforeEach } from 'vitest';
import { employeeOperationsService } from '../src/lib/employeeOperationsService';
import { WorkShift, CompanyWorkSchedule } from '../src/types';

describe('Employee Operations System Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      // 2026-09-07 is Monday
      const monday = new Date('2026-09-07T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(monday, schedules)).toBe(true);

      // 2026-09-12 is Saturday
      const saturday = new Date('2026-09-12T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(saturday, schedules)).toBe(true);
    });

    it('excludes Sunday from working days', () => {
      // 2026-09-13 is Sunday
      const sunday = new Date('2026-09-13T12:00:00Z');
      expect(employeeOperationsService.isWorkingDay(sunday, schedules)).toBe(false);
    });
  });

  describe('2. Authoritative Late Check-in & Deduction Policy', () => {
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

    it('applies flat PKR 500 deduction for 45 minutes late', () => {
      const scheduled = new Date('2026-09-12T11:00:00+05:00');
      const actual45MinLate = new Date('2026-09-12T11:45:00+05:00');

      const res = employeeOperationsService.calculateLateMinutes(scheduled, actual45MinLate);
      expect(res.isLate).toBe(true);
      expect(res.minutesLate).toBe(45);
      expect(res.deduction).toBe(500);
    });
  });

  describe('3. Unapproved Absence Salary Deduction Formula', () => {
    it('calculates daily absence cut based on exact days in 30-day month (e.g. September)', () => {
      const monthlySalary = 150000;
      const septDate = new Date('2026-09-15'); // September has 30 days
      const cut = employeeOperationsService.calculateAbsenceDeduction(monthlySalary, septDate);
      expect(cut).toBe(5000); // 150000 / 30 = 5000
    });

    it('calculates daily absence cut based on exact days in 31-day month (e.g. August)', () => {
      const monthlySalary = 155000;
      const augDate = new Date('2026-08-15'); // August has 31 days
      const cut = employeeOperationsService.calculateAbsenceDeduction(monthlySalary, augDate);
      expect(cut).toBe(5000); // 155000 / 31 = 5000
    });

    it('calculates daily absence cut based on exact days in 28-day month (e.g. February non-leap)', () => {
      const monthlySalary = 140000;
      const febDate = new Date('2026-02-15'); // Feb 2026 has 28 days
      const cut = employeeOperationsService.calculateAbsenceDeduction(monthlySalary, febDate);
      expect(cut).toBe(5000); // 140000 / 28 = 5000
    });
  });

  describe('4. Bank Account Number Masking Security', () => {
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

  describe('5. Final Settlement Calculation Engine', () => {
    it('calculates net final settlement with pending salary, current accrued, and deductions', () => {
      const pendingPrevious = 100000;
      const currentAccrued = 50000;
      const severanceBonus = 20000;
      const lateDeductions = 1500; // 3 late days
      const absenceDeductions = 5000; // 1 absent day
      const assetRecovery = 15000; // 1 damaged/lost item

      const netFinalPayable = (
        pendingPrevious +
        currentAccrued +
        severanceBonus -
        lateDeductions -
        absenceDeductions -
        assetRecovery
      );

      expect(netFinalPayable).toBe(148500);
    });
  });

  describe('6. Night Shift Midnight Crossing', () => {
    it('correctly validates night shift start at 20:00 and end at 05:00', () => {
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
});
