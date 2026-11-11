import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeManagementDashboardView } from '../src/components/employee/EmployeeManagementDashboardView';
import { EmployeeDossierView } from '../src/components/employee/EmployeeDossierView';
import { EmployeeDashboardView } from '../src/components/employee/EmployeeDashboardView';
import { UserProfile, TeamMemberRecord, EmployeeAttendance, WorkShift, EmployeeRecord } from '../src/types';

// Mock Profiles
const mockTeamMemberProfile: UserProfile = {
  id: 'tm-self-123',
  fullName: 'Tariq TeamMember',
  workEmail: 'tariq@flc.internal',
  role: 'team_member',
  status: 'active',
  designationName: 'Senior Content Creator'
};

const mockOtherTeamMemberProfile: UserProfile = {
  id: 'tm-other-456',
  fullName: 'Zainab OtherMember',
  workEmail: 'zainab@flc.internal',
  role: 'team_member',
  status: 'active',
  designationName: 'UI Designer'
};

const mockOwnerProfile: UserProfile = {
  id: 'owner-789',
  fullName: 'Faseeh Lall',
  workEmail: 'teamflc786@gmail.com',
  role: 'owner',
  status: 'active',
  designationName: 'Agency Principal'
};

let currentTestProfile: UserProfile = mockTeamMemberProfile;
let mockRouteParams: { employeeId?: string } = {};

// Mock react-router-dom
vi.mock('react-router-dom', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useParams: () => mockRouteParams
  };
});

// Mock Auth Context
vi.mock('../src/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: currentTestProfile.id, email: currentTestProfile.workEmail },
    profile: currentTestProfile,
    isLoading: false,
    profileError: null,
    signOut: vi.fn()
  }))
}));

// Mock Data
const mockShifts: WorkShift[] = [
  {
    id: 'shift-morning',
    name: 'Morning Shift',
    code: 'MS',
    startTime: '11:00:00',
    endTime: '20:00:00',
    isActive: true,
    sortOrder: 1
  }
];

const mockSelfRecord: EmployeeRecord = {
  id: 'tm-self-123',
  employeeId: 'FLC-123',
  employmentType: 'full_time',
  salary: 120000,
  shiftId: 'shift-morning',
  employmentStatus: 'active',
  sopAcknowledged: true,
  setupCompletedAt: '2026-09-01T00:00:00Z',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z'
};

const mockOtherRecord: EmployeeRecord = {
  id: 'tm-other-456',
  employeeId: 'FLC-456',
  employmentType: 'full_time',
  salary: 150000,
  shiftId: 'shift-morning',
  employmentStatus: 'active',
  sopAcknowledged: true,
  setupCompletedAt: '2026-09-01T00:00:00Z',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z'
};

const mockTeamMembers: TeamMemberRecord[] = [
  {
    id: 'tm-self-123',
    fullName: 'Tariq TeamMember',
    workEmail: 'tariq@flc.internal',
    role: 'team_member',
    status: 'active',
    designationName: 'Senior Content Creator',
    departments: [],
    clientAccessCount: 2,
    clientIds: [],
    startDate: '2026-01-01',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'tm-other-456',
    fullName: 'Zainab OtherMember',
    workEmail: 'zainab@flc.internal',
    role: 'team_member',
    status: 'active',
    designationName: 'UI Designer',
    departments: [],
    clientAccessCount: 3,
    clientIds: [],
    startDate: '2026-02-01',
    createdAt: '2026-02-01',
    updatedAt: '2026-02-01'
  }
];

const mockAttendanceList: EmployeeAttendance[] = [
  {
    id: 'att-self',
    employeeId: 'tm-self-123',
    workDate: '2026-11-11',
    scheduledCheckIn: '11:00:00',
    scheduledCheckOut: '20:00:00',
    checkInTime: '2026-11-11T06:20:00Z', // 20m late
    checkOutTime: null,
    totalHours: 4,
    status: 'late',
    minutesLate: 20,
    lateDeduction: 500,
    absenceDeduction: 0,
    checkInScreenshotPath: 'proofs/tm-self-123/in.png',
    checkInSignedUrl: 'https://storage.flc.internal/proofs/tm-self-123/in.png?token=signed-self',
    checkOutScreenshotPath: null,
    checkOutSignedUrl: null,
    createdAt: '2026-11-11T06:20:00Z',
    updatedAt: '2026-11-11T06:20:00Z'
  },
  {
    id: 'att-other',
    employeeId: 'tm-other-456',
    workDate: '2026-11-11',
    scheduledCheckIn: '11:00:00',
    scheduledCheckOut: '20:00:00',
    checkInTime: '2026-11-11T06:45:00Z', // 45m late
    checkOutTime: null,
    totalHours: 3.5,
    status: 'late',
    minutesLate: 45,
    lateDeduction: 1500,
    absenceDeduction: 0,
    checkInScreenshotPath: 'proofs/tm-other-456/in.png',
    checkInSignedUrl: 'https://storage.flc.internal/proofs/tm-other-456/in.png?token=signed-other',
    checkOutScreenshotPath: null,
    checkOutSignedUrl: null,
    createdAt: '2026-11-11T06:45:00Z',
    updatedAt: '2026-11-11T06:45:00Z'
  }
];

// Mock Employee Operations Service
vi.mock('../src/lib/employeeOperationsService', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    formatAttendanceHours: actual.formatAttendanceHours || vi.fn(() => '4.0h'),
    employeeOperationsService: {
      ...actual.employeeOperationsService,
      fetchEmployeeRecord: vi.fn(async (id: string) => (id === 'tm-self-123' ? mockSelfRecord : mockOtherRecord)),
      fetchAllEmployeeRecords: vi.fn(async () => [mockSelfRecord, mockOtherRecord]),
      fetchWorkShifts: vi.fn(async () => mockShifts),
      fetchCompanyWorkSchedules: vi.fn(async () => []),
      fetchCompanySchedules: vi.fn(async () => []),
      fetchAllTodayAttendance: vi.fn(async (dateStr?: string, employeeId?: string) => {
        if (employeeId) {
          return mockAttendanceList.filter(a => a.employeeId === employeeId);
        }
        return mockAttendanceList;
      }),
      fetchCurrentShiftAttendance: vi.fn(async () => mockAttendanceList[0]),
      fetchAttendanceHistory: vi.fn(async () => [mockAttendanceList[0]]),
      fetchBankDetails: vi.fn(async () => null),
      fetchEmployeeAssets: vi.fn(async () => []),
      fetchAllAssets: vi.fn(async () => []),
      fetchPayrollHistory: vi.fn(async () => []),
      fetchMonthlyPayrollSummary: vi.fn(async () => []),
      fetchPerformanceRecords: vi.fn(async () => []),
      fetchManagementTasks: vi.fn(async () => []),
      fetchProfileChangeRequests: vi.fn(async () => []),
      fetchWorkReports: vi.fn(async () => []),
      fetchGoals: vi.fn(async () => []),
      fetchDocuments: vi.fn(async () => []),
      fetchSalaryHikes: vi.fn(async () => []),
      fetchFinalSettlements: vi.fn(async () => []),
      getEmployeeSetupStatus: vi.fn(() => ({ isComplete: true, salaryConfigured: true, missingParameters: [] })),
      fetchFullDossier: vi.fn(async (id: string) => ({
        profile: id === 'tm-self-123' ? mockTeamMemberProfile : mockOtherTeamMemberProfile,
        employeeRecord: id === 'tm-self-123' ? mockSelfRecord : mockOtherRecord,
        attendanceHistory: mockAttendanceList.filter(a => a.employeeId === id),
        payrollRecords: [],
        performanceRecords: []
      }))
    }
  };
});

// Mock Team Management Service
vi.mock('../src/lib/teamManagementService', () => ({
  teamManagementService: {
    fetchTeamMembers: vi.fn(async (callerRole: string, callerId: string) => {
      if (callerRole === 'team_member') {
        return mockTeamMembers.filter(m => m.id === callerId);
      }
      return mockTeamMembers;
    }),
    fetchDepartments: vi.fn(async () => []),
    fetchDesignations: vi.fn(async () => []),
    fetchEligibleManagers: vi.fn(async () => [])
  }
}));

describe('PROMPT 10: Team Member Attendance, Screenshot, Salary & Deduction Isolation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTestProfile = mockTeamMemberProfile;
  });

  describe('1. Team Member Live Roster Isolation', () => {
    it('1.1 Team member in EmployeeManagementDashboardView sees only their own record on the roster', async () => {
      currentTestProfile = mockTeamMemberProfile;

      render(
        <MemoryRouter initialEntries={['/operations/employees?tab=attendance']}>
          <EmployeeManagementDashboardView />
        </MemoryRouter>
      );

      // Verify Header adapts to personal view
      await waitFor(() => {
        expect(screen.getByText(/Personal Attendance Record & Proof Vault/i)).toBeInTheDocument();
      });

      // Verify roster title indicates 1 Member
      expect(screen.getByText(/Personal Attendance Roster \(1 Member\)/i)).toBeInTheDocument();

      // Verify self member appears
      expect(screen.getByText('Tariq TeamMember')).toBeInTheDocument();

      // CRITICAL LEAK CHECK: Other team member MUST NOT appear anywhere on the roster
      expect(screen.queryByText('Zainab OtherMember')).not.toBeInTheDocument();
      expect(screen.queryByText('zainab@flc.internal')).not.toBeInTheDocument();
    });

    it('1.2 Team member sees only their own deductions and proof buttons, never another member\'s', async () => {
      currentTestProfile = mockTeamMemberProfile;

      render(
        <MemoryRouter initialEntries={['/operations/employees?tab=attendance']}>
          <EmployeeManagementDashboardView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Tariq TeamMember')).toBeInTheDocument();
      });

      // Self deductions: 500
      expect(screen.getByText('-PKR 500')).toBeInTheDocument();

      // CRITICAL LEAK CHECK: Other member's deduction (1500) MUST NOT be present
      expect(screen.queryByText('-PKR 1,500')).not.toBeInTheDocument();
      expect(screen.queryByText('-PKR 1500')).not.toBeInTheDocument();

      // Self proof button is present
      expect(screen.getByTestId('roster-proof-in-tm-self-123')).toBeInTheDocument();

      // CRITICAL LEAK CHECK: Other member's proof button MUST NOT exist
      expect(screen.queryByTestId('roster-proof-in-tm-other-456')).not.toBeInTheDocument();

      // Administrative action buttons must be hidden for team members
      expect(screen.queryByTestId('configure-btn-tm-self-123')).not.toBeInTheDocument();
      expect(screen.queryByTestId('roster-delete-btn-tm-self-123')).not.toBeInTheDocument();
      expect(screen.queryByText('Manual Attendance Log')).not.toBeInTheDocument();
    });
  });

  describe('2. Clock-In Proof Vault Isolation', () => {
    it('2.1 Proof Vault displays only the team member\'s own card and own screenshots', async () => {
      currentTestProfile = mockTeamMemberProfile;

      render(
        <MemoryRouter initialEntries={['/operations/employees?tab=attendance']}>
          <EmployeeManagementDashboardView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('tab-clock-in-proof')).toBeInTheDocument();
      });

      // Switch to Clock-In Proof tab
      fireEvent.click(screen.getByTestId('tab-clock-in-proof'));

      await waitFor(() => {
        expect(screen.getByText(/Personal Clock-In & Check-Out Proof Vault/i)).toBeInTheDocument();
      });

      // Member dropdown must be locked to self and NOT have "All Members (39)"
      expect(screen.queryByText(/All Members/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Tariq TeamMember \(Self\)/i)).toBeInTheDocument();

      // Self proof thumbnail button is present
      expect(screen.getByTestId('proof-vault-in-tm-self-123')).toBeInTheDocument();

      // CRITICAL LEAK CHECK: Other member's proof thumbnail MUST NOT exist
      expect(screen.queryByTestId('proof-vault-in-tm-other-456')).not.toBeInTheDocument();
      expect(screen.queryByText('Zainab OtherMember')).not.toBeInTheDocument();
    });
  });

  describe('3. Tab & Salary Protection', () => {
    it('3.1 Team member cannot view management tabs (Payroll, Directory, Performance, etc.)', async () => {
      currentTestProfile = mockTeamMemberProfile;

      render(
        <MemoryRouter initialEntries={['/operations/employees?tab=payroll']}>
          <EmployeeManagementDashboardView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Personal Attendance & Proof/i)).toBeInTheDocument();
      });

      // Management tabs must be completely absent from tab navigation
      expect(screen.queryByText('Employee Directory')).not.toBeInTheDocument();
      expect(screen.queryByText('Payroll (1st–End)')).not.toBeInTheDocument();
      expect(screen.queryByText(/Company Assets/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Employee Concerns/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Final Settlements')).not.toBeInTheDocument();

      // Total salaries of other members must never appear
      expect(screen.queryByText('150,000')).not.toBeInTheDocument();
    });
  });

  describe('4. Owner Perspective Verification', () => {
    it('4.1 Owner sees full team roster, all proof cards, and administrative controls', async () => {
      currentTestProfile = mockOwnerProfile;

      render(
        <MemoryRouter initialEntries={['/operations/employees?tab=attendance']}>
          <EmployeeManagementDashboardView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Employee Operations & HR Governance/i)).toBeInTheDocument();
      });

      // Full management tabs are available for owner
      expect(screen.getByText('Employee Directory')).toBeInTheDocument();
      expect(screen.getByText('Payroll (1st–End)')).toBeInTheDocument();

      // Both members visible on owner's roster
      expect(screen.getByText('Tariq TeamMember')).toBeInTheDocument();
      expect(screen.getByText('Zainab OtherMember')).toBeInTheDocument();

      // Admin controls visible for owner
      expect(screen.getByText('Manual Attendance Log')).toBeInTheDocument();
      expect(screen.getByTestId('configure-btn-tm-self-123')).toBeInTheDocument();
    });
  });

  describe('5. Cross-Member Dossier Access Guard', () => {
    it('5.1 Team member attempting to view another employee\'s dossier is blocked fail-closed', async () => {
      currentTestProfile = mockTeamMemberProfile;
      mockRouteParams = { employeeId: 'tm-other-456' };

      render(
        <MemoryRouter initialEntries={['/operations/employees/tm-other-456']}>
          <EmployeeDossierView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
        expect(screen.getByText(/You are only authorized to view your own employee dossier/i)).toBeInTheDocument();
      });

      // Must not render other member's salary or profile
      expect(screen.queryByText('Zainab OtherMember')).not.toBeInTheDocument();
    });
  });
});
