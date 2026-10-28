import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { generateRecoveryCodes, twoFactorService } from '../src/lib/twoFactorService';
import { LoginPage } from '../src/components/auth/LoginPage';
import { MyProfileView } from '../src/components/profile/MyProfileView';
import { EditTeamMemberModal } from '../src/components/team/EditTeamMemberModal';

// Mock contexts and services
const mockSignIn = vi.fn();
const mockComplete2FASignIn = vi.fn();
const mockCancel2FASignIn = vi.fn();
let mockCurrentUser: any = null;
let mockCurrentProfile: any = null;

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    profile: mockCurrentProfile,
    session: mockCurrentUser ? { user: mockCurrentUser } : null,
    signIn: mockSignIn,
    complete2FASignIn: mockComplete2FASignIn,
    cancel2FASignIn: mockCancel2FASignIn,
    signOut: vi.fn(),
    refreshProfile: vi.fn()
  }),
  AuthProvider: ({ children }: any) => <>{children}</>
}));

vi.mock('../src/lib/safeRouterHooks', () => ({
  useSafeNavigate: () => vi.fn()
}));

vi.mock('../src/lib/storageService', () => ({
  storageService: {
    uploadAvatar: vi.fn()
  },
  useSignedUrl: () => null
}));

vi.mock('../src/lib/employeeOperationsService', () => ({
  employeeOperationsService: {
    fetchBankDetails: vi.fn().mockResolvedValue(null),
    fetchWorkShifts: vi.fn().mockResolvedValue([]),
    fetchEmployeeRecord: vi.fn().mockResolvedValue(null),
    fetchCompanyWorkSchedules: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../src/store/opsStore', () => ({
  useOpsStore: (selector: any) =>
    selector({
      selectedClientId: null,
      setViewMode: vi.fn(),
      clients: []
    })
}));

describe('Two-Factor Authentication (2FA) Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    mockCurrentProfile = null;
  });

  describe('1. Recovery Code Generation & Cryptographic Integrity', () => {
    it('generates 10 cryptographically random, formatted, unambiguous recovery codes', () => {
      const codes = generateRecoveryCodes(10);
      expect(codes).toHaveLength(10);

      // Verify uniqueness
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);

      // Verify format XXXX-XXXX using unambiguous charset (2-9, A-Z excluding 0/O, 1/I)
      const codeRegex = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;
      codes.forEach((code) => {
        expect(code).toMatch(codeRegex);
      });
    });
  });

  describe('2. Login 2FA Flow (Step 1 -> Step 2)', () => {
    it('prompts for 6-digit authenticator code when account has 2FA enabled', async () => {
      mockSignIn.mockResolvedValue({
        requires2FA: true,
        factorId: 'factor-totp-123',
        userId: 'usr-owner-1',
        userEmail: 'owner@faseehlall.com'
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Step 1: Submit credentials
      fireEvent.change(screen.getByLabelText(/work email/i), {
        target: { value: 'owner@faseehlall.com' }
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'CorrectPassword123!' }
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in to ops hub/i }));
      });

      // Verify transition to Step 2
      expect(screen.getByText('Two-Factor Verification')).toBeInTheDocument();
      expect(screen.getByLabelText(/6-digit verification code/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /verify & sign in/i })).toBeInTheDocument();
      expect(screen.getByText(/lost access to your app\? use a recovery code/i)).toBeInTheDocument();
    });

    it('rejects wrong 6-digit code with rate-limited generic error message', async () => {
      mockSignIn.mockResolvedValue({
        requires2FA: true,
        factorId: 'factor-totp-123',
        userId: 'usr-owner-1',
        userEmail: 'owner@faseehlall.com'
      });

      const verifyMock = vi.spyOn(twoFactorService, 'verifyLoginTOTP').mockResolvedValue({
        success: false,
        error: 'Invalid verification code. Please check your authenticator app and try again.'
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Enter credentials
      fireEvent.change(screen.getByLabelText(/work email/i), {
        target: { value: 'owner@faseehlall.com' }
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'Password123' }
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in to ops hub/i }));
      });

      // Enter invalid 6-digit code
      const codeInput = screen.getByLabelText(/6-digit verification code/i);
      fireEvent.change(codeInput, { target: { value: '999999' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
      });

      expect(verifyMock).toHaveBeenCalledWith({
        userId: 'usr-owner-1',
        factorId: 'factor-totp-123',
        code: '999999'
      });

      expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
      expect(mockComplete2FASignIn).not.toHaveBeenCalled();
    });

    it('successfully completes sign-in with valid 6-digit code', async () => {
      mockSignIn.mockResolvedValue({
        requires2FA: true,
        factorId: 'factor-totp-123',
        userId: 'usr-owner-1',
        userEmail: 'owner@faseehlall.com'
      });

      vi.spyOn(twoFactorService, 'verifyLoginTOTP').mockResolvedValue({
        success: true
      });
      mockComplete2FASignIn.mockResolvedValue({});

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/work email/i), {
        target: { value: 'owner@faseehlall.com' }
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'Password123' }
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in to ops hub/i }));
      });

      const codeInput = screen.getByLabelText(/6-digit verification code/i);
      fireEvent.change(codeInput, { target: { value: '123456' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
      });

      expect(mockComplete2FASignIn).toHaveBeenCalledWith(false);
    });

    it('allows fallback to single-use recovery code during login', async () => {
      mockSignIn.mockResolvedValue({
        requires2FA: true,
        factorId: 'factor-totp-123',
        userId: 'usr-owner-1',
        userEmail: 'owner@faseehlall.com'
      });

      const recMock = vi.spyOn(twoFactorService, 'verifyLoginRecoveryCode').mockResolvedValue({
        success: true
      });
      mockComplete2FASignIn.mockResolvedValue({});

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/work email/i), {
        target: { value: 'owner@faseehlall.com' }
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'Password123' }
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in to ops hub/i }));
      });

      // Switch to recovery code mode
      fireEvent.click(screen.getByText(/lost access to your app\? use a recovery code/i));

      expect(screen.getByLabelText(/single-use recovery code/i)).toBeInTheDocument();

      const recInput = screen.getByLabelText(/single-use recovery code/i);
      fireEvent.change(recInput, { target: { value: 'ABCD-1111' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
      });

      expect(recMock).toHaveBeenCalledWith({
        userId: 'usr-owner-1',
        code: 'ABCD-1111'
      });
      expect(mockComplete2FASignIn).toHaveBeenCalledWith(true);
    });

    it('cancels 2FA prompt and returns cleanly to credentials when Back to login is clicked', async () => {
      mockSignIn.mockResolvedValue({
        requires2FA: true,
        factorId: 'factor-totp-123',
        userId: 'usr-owner-1',
        userEmail: 'owner@faseehlall.com'
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/work email/i), {
        target: { value: 'owner@faseehlall.com' }
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'Password123' }
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in to ops hub/i }));
      });

      expect(screen.getByText('Two-Factor Verification')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
      });

      expect(mockCancel2FASignIn).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /sign in to ops hub/i })).toBeInTheDocument();
    });
  });

  describe('3. Profile Settings 2FA Management & Recovery Codes', () => {
    it('renders 2FA disabled status card and "Enable 2FA" button when user has no factor', async () => {
      mockCurrentUser = { id: 'usr-tm-1', email: 'staff@faseehlall.com' };
      mockCurrentProfile = {
        id: 'usr-tm-1',
        fullName: 'Staff Member',
        role: 'team_member',
        status: 'active',
        workEmail: 'staff@faseehlall.com'
      };

      vi.spyOn(twoFactorService, 'get2FAStatus').mockResolvedValue({
        data: { isEnabled: false, factorId: null, remainingRecoveryCodes: 0 },
        error: null
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <MyProfileView />
          </MemoryRouter>
        );
      });

      expect(screen.getByText('Two-Factor Authentication (2FA)')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument();
    });

    it('renders 2FA active status card with remaining recovery codes count and action buttons', async () => {
      mockCurrentUser = { id: 'usr-owner-1', email: 'owner@faseehlall.com' };
      mockCurrentProfile = {
        id: 'usr-owner-1',
        fullName: 'Atif Khan',
        role: 'owner',
        status: 'active',
        workEmail: 'owner@faseehlall.com'
      };

      vi.spyOn(twoFactorService, 'get2FAStatus').mockResolvedValue({
        data: { isEnabled: true, factorId: 'factor-abc', remainingRecoveryCodes: 9 },
        error: null
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <MyProfileView />
          </MemoryRouter>
        );
      });

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText(/9 single-use recovery codes remaining/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /regenerate recovery codes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeInTheDocument();
    });
  });

  describe('4. Owner Emergency 2FA Reset in Team Management', () => {
    it('displays "Reset 2FA" button for Owner and triggers emergency reset with mandatory reason', async () => {
      const ownerProfile: any = {
        id: 'usr-owner-1',
        fullName: 'Atif Khan',
        role: 'owner',
        status: 'active'
      };

      const staffMember: any = {
        id: 'usr-locked-staff',
        fullName: 'Locked Staff Member',
        role: 'team_member',
        status: 'active',
        departments: []
      };

      vi.spyOn(twoFactorService, 'get2FAStatus').mockResolvedValue({
        data: { isEnabled: true, factorId: 'factor-xyz', remainingRecoveryCodes: 5 },
        error: null
      });

      const resetMock = vi.spyOn(twoFactorService, 'adminReset2FA').mockResolvedValue({
        success: true
      });

      await act(async () => {
        render(
          <EditTeamMemberModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            member={staffMember}
            currentUserProfile={ownerProfile}
            departments={[]}
            designations={[]}
            eligibleManagers={[]}
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reset 2fa/i })).toBeInTheDocument();
      });

      // Open reset modal
      fireEvent.click(screen.getByRole('button', { name: /reset 2fa/i }));

      expect(screen.getByText(/reset 2fa for locked staff member/i)).toBeInTheDocument();

      // Enter mandatory reason
      const reasonInput = screen.getByPlaceholderText(/e\.g\. employee lost authenticator phone/i);
      fireEvent.change(reasonInput, { target: { value: 'Staff member lost mobile device while travelling' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm emergency reset/i }));
      });

      expect(resetMock).toHaveBeenCalledWith({
        targetUserId: 'usr-locked-staff',
        reason: 'Staff member lost mobile device while travelling'
      });
    });

    it('does NOT display 2FA Reset controls to Operational Manager role', async () => {
      const managerProfile: any = {
        id: 'usr-mgr-1',
        fullName: 'Operations Manager',
        role: 'operational_manager',
        status: 'active'
      };

      const staffMember: any = {
        id: 'usr-locked-staff',
        fullName: 'Staff Member',
        role: 'team_member',
        status: 'active',
        departments: []
      };

      await act(async () => {
        render(
          <EditTeamMemberModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            member={staffMember}
            currentUserProfile={managerProfile}
            departments={[]}
            designations={[]}
            eligibleManagers={[]}
          />
        );
      });

      expect(screen.queryByRole('button', { name: /reset 2fa/i })).not.toBeInTheDocument();
    });
  });
});
