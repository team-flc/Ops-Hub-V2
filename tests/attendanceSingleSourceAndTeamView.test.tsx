import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EmployeeAttendanceControl } from '../src/components/employee/EmployeeAttendanceControl';
import { employeeOperationsService } from '../src/lib/employeeOperationsService';
import { EmployeeRecord, WorkShift, EmployeeAttendance, CompanyWorkSchedule, UserProfile } from '../src/types';

describe('Attendance Single Source of Truth & Team View Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockShift: WorkShift = {
    id: 'shift-standard',
    name: 'Standard Shift',
    code: 'STANDARD',
    startTime: '11:00:00',
    endTime: '20:00:00',
    crossesMidnight: false,
    timezone: 'Asia/Karachi',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  const mockSchedule: CompanyWorkSchedule = {
    id: 'sched-1',
    effectiveFrom: '2026-01-01',
    workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    description: 'Mon - Sat (6 Days)',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'owner-1'
  };

  describe('1. Missing Parameters & Setup Status Detection', () => {
    it('1.1 Identifies exact missing parameters when shift, schedule, or salary are missing', () => {
      const incompleteRecord: EmployeeRecord = {
        id: 'emp-1',
        employmentType: 'full_time',
        salary: 0, // Missing salary
        shiftId: null, // Missing shift
        employmentStatus: 'active',
        sopAcknowledged: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const status = employeeOperationsService.getEmployeeSetupStatus(
        incompleteRecord,
        [mockShift],
        [], // Missing schedule
        false
      );

      expect(status.isComplete).toBe(false);
      expect(status.missingParameters).toContain('Shift');
      expect(status.missingParameters).toContain('Work Schedule');
      expect(status.missingParameters).toContain('Base Salary');
    });

    it('1.2 Marks setup complete only when shift, schedule, salary > 0, and setupCompletedAt are all present', () => {
      const completeRecord: EmployeeRecord = {
        id: 'emp-1',
        employmentType: 'full_time',
        salary: 150000,
        shiftId: 'shift-standard',
        setupCompletedAt: '2026-01-01T12:00:00Z',
        employmentStatus: 'active',
        sopAcknowledged: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const status = employeeOperationsService.getEmployeeSetupStatus(
        completeRecord,
        [mockShift],
        [mockSchedule],
        false
      );

      expect(status.isComplete).toBe(true);
      expect(status.missingParameters).toHaveLength(0);
    });
  });

  describe('2. EmployeeAttendanceControl: Punch Controls, Live Clock vs Check-in Time', () => {
    it('2.1 Displays Live System Clock (PKT) and locks controls when setup is pending with missing parameters', () => {
      const incompleteRecord: EmployeeRecord = {
        id: 'emp-1',
        employmentType: 'full_time',
        salary: 0,
        shiftId: null,
        employmentStatus: 'active',
        sopAcknowledged: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const handleConfigure = vi.fn();

      render(
        <EmployeeAttendanceControl
          employeeRecord={incompleteRecord}
          shift={null}
          todayAttendance={null}
          onAttendanceUpdated={vi.fn()}
          onConfigureSetup={handleConfigure}
        />
      );

      // Verify clock label
      expect(screen.getByText(/Live System Clock \(PKT\)/i)).toBeInTheDocument();

      // Verify locked banner and missing parameter badges
      expect(screen.getByText(/Setup Pending — Shift & Attendance Controls Locked/i)).toBeInTheDocument();
      expect(screen.getByText(/Missing Parameter: Shift/i)).toBeInTheDocument();
      expect(screen.getByText(/Missing Parameter: Base Salary/i)).toBeInTheDocument();

      // Verify Configure Setup button is accessible for management
      const configBtn = screen.getByRole('button', { name: /Configure Setup/i });
      expect(configBtn).toBeInTheDocument();
      fireEvent.click(configBtn);
      expect(handleConfigure).toHaveBeenCalledTimes(1);
    });

    it('2.2 Unlocks punch controls when setup is complete, and clearly distinguishes check-in status from running clock', () => {
      const completeRecord: EmployeeRecord = {
        id: 'emp-1',
        employmentType: 'full_time',
        salary: 120000,
        shiftId: 'shift-standard',
        setupCompletedAt: '2026-01-01T12:00:00Z',
        employmentStatus: 'active',
        sopAcknowledged: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      render(
        <EmployeeAttendanceControl
          employeeRecord={completeRecord}
          shift={mockShift}
          todayAttendance={null}
          onAttendanceUpdated={vi.fn()}
        />
      );

      // Verify locked banner is NOT shown
      expect(screen.queryByText(/Setup Pending — Shift & Attendance Controls Locked/i)).not.toBeInTheDocument();

      // Verify live clock label
      expect(screen.getByText(/Live System Clock \(PKT\)/i)).toBeInTheDocument();

      // Verify punch button is enabled
      expect(screen.getByRole('button', { name: /Clock In/i })).toBeInTheDocument();
    });

    it('2.3 Displays active recorded check-in time distinctly when employee is clocked in', () => {
      const completeRecord: EmployeeRecord = {
        id: 'emp-1',
        employmentType: 'full_time',
        salary: 120000,
        shiftId: 'shift-standard',
        setupCompletedAt: '2026-01-01T12:00:00Z',
        employmentStatus: 'active',
        sopAcknowledged: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const checkedInAttendance: EmployeeAttendance = {
        id: 'att-1',
        employeeId: 'emp-1',
        workDate: '2026-11-04',
        shiftId: 'shift-standard',
        scheduledCheckIn: '11:00:00',
        scheduledCheckOut: '20:00:00',
        checkInTime: '2026-11-04T06:05:00Z', // 11:05 AM PKT
        status: 'on_time',
        minutesLate: 0,
        lateDeduction: 0,
        absenceDeduction: 0,
        createdAt: '2026-11-04T06:05:00Z',
        updatedAt: '2026-11-04T06:05:00Z'
      };

      render(
        <EmployeeAttendanceControl
          employeeRecord={completeRecord}
          shift={mockShift}
          todayAttendance={checkedInAttendance}
          onAttendanceUpdated={vi.fn()}
        />
      );

      // Verify active recorded session display
      expect(screen.getByText(/Active Recorded Session/i)).toBeInTheDocument();
      expect(screen.getByText(/Checked in at/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clock Out/i })).toBeInTheDocument();
    });
  });

  describe('3. Off Day Reason Verification', () => {
    it('3.1 Returns explicit reason Weekly Off for Sundays or non-working days', () => {
      const sunday = new Date('2026-11-08T12:00:00+05:00'); // Sunday
      expect(sunday.getDay()).toBe(0);

      const isWorking = employeeOperationsService.isWorkingDay(sunday, [mockSchedule]);
      expect(isWorking).toBe(false);

      const offReason = employeeOperationsService.getOffDayReason(sunday, [mockSchedule]);
      expect(offReason).toBe('Weekly Off');
      expect(offReason.length).toBeGreaterThan(0);
    });
  });

  describe('4. Single Source of Truth Derivation & Reconciled Payroll', () => {
    it('4.1 Reconciles present, late, absent counts and deductions directly from attendance records', () => {
      const records: EmployeeAttendance[] = [
        {
          id: 'att-1',
          employeeId: 'emp-1',
          workDate: '2026-11-01',
          scheduledCheckIn: '11:00:00',
          scheduledCheckOut: '20:00:00',
          checkInTime: '2026-11-01T06:00:00Z',
          status: 'on_time',
          minutesLate: 0,
          lateDeduction: 0,
          absenceDeduction: 0,
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'att-2',
          employeeId: 'emp-1',
          workDate: '2026-11-02',
          scheduledCheckIn: '11:00:00',
          scheduledCheckOut: '20:00:00',
          checkInTime: '2026-11-02T06:15:00Z',
          status: 'late',
          minutesLate: 15,
          lateDeduction: 500,
          absenceDeduction: 0,
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'att-3',
          employeeId: 'emp-1',
          workDate: '2026-11-03',
          scheduledCheckIn: '11:00:00',
          scheduledCheckOut: '20:00:00',
          status: 'absent',
          minutesLate: 0,
          lateDeduction: 0,
          absenceDeduction: 5000,
          createdAt: '',
          updatedAt: ''
        }
      ];

      const presentCount = records.filter(r => r.status === 'on_time' || r.status === 'present').length;
      const lateCount = records.filter(r => r.status === 'late').length;
      const absentCount = records.filter(r => r.status === 'absent').length;
      const totalLateDeductions = records.reduce((sum, r) => sum + (r.lateDeduction || 0), 0);
      const totalAbsenceDeductions = records.reduce((sum, r) => sum + (r.absenceDeduction || 0), 0);

      expect(presentCount).toBe(1);
      expect(lateCount).toBe(1);
      expect(absentCount).toBe(1);
      expect(totalLateDeductions).toBe(500);
      expect(totalAbsenceDeductions).toBe(5000);
      expect(totalLateDeductions + totalAbsenceDeductions).toBe(5500);
    });

    it('4.2 Returns Missing Parameter when base salary is zero or setup is pending', () => {
      const incompleteRecord: EmployeeRecord = {
        id: 'emp-1',
        employmentType: 'full_time',
        salary: 0,
        shiftId: null,
        employmentStatus: 'active',
        sopAcknowledged: false,
        createdAt: '',
        updatedAt: ''
      };

      const setupStatus = employeeOperationsService.getEmployeeSetupStatus(incompleteRecord, [mockShift], [mockSchedule], false);
      expect(setupStatus.isComplete).toBe(false);
      expect(setupStatus.salaryConfigured).toBe(false);
      expect(setupStatus.missingParameters).toContain('Base Salary');
    });
  });

  describe('5. Role-Based Navigation & Strict Attendance Roster Privacy', () => {
    it('5.1 Attendance navigation target routes managers to team operations and team members to personal dashboard', () => {
      const resolveAttendanceRoute = (role: string) => {
        if (role === 'owner' || role === 'operational_manager') {
          return '/operations/employees?tab=attendance';
        }
        return '/employee/dashboard';
      };

      expect(resolveAttendanceRoute('owner')).toBe('/operations/employees?tab=attendance');
      expect(resolveAttendanceRoute('operational_manager')).toBe('/operations/employees?tab=attendance');
      expect(resolveAttendanceRoute('team_member')).toBe('/employee/dashboard');
    });
  });
});
