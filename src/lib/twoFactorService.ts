import { supabase } from './supabase';

export interface TwoFactorStatus {
  isEnabled: boolean;
  factorId: string | null;
  remainingRecoveryCodes: number;
}

/**
 * Generate cryptographically random, unambiguous single-use recovery codes.
 * Format: 8 characters split by hyphen, uppercase (e.g., ABCD-EF23).
 */
export function generateRecoveryCodes(count: number = 10): string[] {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codes: string[] = [];
  const randomBytes = new Uint8Array(8 * count);
  crypto.getRandomValues(randomBytes);

  for (let i = 0; i < count; i++) {
    let part1 = '';
    let part2 = '';
    for (let j = 0; j < 4; j++) {
      part1 += chars[randomBytes[i * 8 + j] % chars.length];
      part2 += chars[randomBytes[i * 8 + 4 + j] % chars.length];
    }
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

export const twoFactorService = {
  generateRecoveryCodes,

  /**
   * Fetch current 2FA status for a user: whether active TOTP factor exists
   * and count of remaining unused recovery codes.
   */
  async get2FAStatus(userId: string): Promise<{ data: TwoFactorStatus | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Database service is unconfigured.' };
    try {
      const { data, error } = await supabase.rpc('fn_2fa_get_status', {
        p_user_id: userId
      });

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: {
          isEnabled: Boolean(data?.is_enabled),
          factorId: data?.factor_id || null,
          remainingRecoveryCodes: data?.remaining_recovery_codes || 0
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to fetch 2FA status.' };
    }
  },

  /**
   * Check if account is temporarily locked out due to failed 2FA verification attempts.
   */
  async checkLockout(userId: string): Promise<{ isLocked: boolean; remainingSeconds?: number; error?: string }> {
    if (!supabase) return { isLocked: false };
    try {
      const { data, error } = await supabase.rpc('fn_2fa_check_lockout', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error checking 2FA lockout:', error);
        return { isLocked: false };
      }

      return {
        isLocked: Boolean(data?.is_locked),
        remainingSeconds: data?.remaining_seconds,
        error: data?.error
      };
    } catch (err) {
      console.error('Exception checking 2FA lockout:', err);
      return { isLocked: false };
    }
  },

  /**
   * Enroll a new TOTP factor. Cleans up any leftover unverified factors first.
   * Returns QR code SVG and manual entry secret.
   */
  async enrollTOTP(): Promise<{
    data: { factorId: string; qrCodeSvg: string; qrCodeUrl: string; secret: string; uri: string } | null;
    error: string | null;
  }> {
    if (!supabase) return { data: null, error: 'Database service is unconfigured.' };
    try {
      // 1. Unenroll any unverified TOTP factors to avoid factor clutter
      const factorsRes = await supabase.auth.mfa.listFactors();
      if (factorsRes.data?.totp) {
        const unverified = factorsRes.data.totp.filter((f) => (f.status as string) === 'unverified');
        for (const f of unverified) {
          await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
        }
      }

      // 2. Enroll new TOTP factor
      const enrollRes = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'FLC Ops Hub',
        friendlyName: 'FLC Ops Hub Authenticator'
      });

      if (enrollRes.error || !enrollRes.data) {
        return { data: null, error: enrollRes.error?.message || 'Failed to initiate 2FA enrollment.' };
      }

      const totp = enrollRes.data.totp;
      const rawSvg = totp.qr_code;
      const qrCodeUrl = rawSvg.startsWith('data:')
        ? rawSvg
        : `data:image/svg+xml;utf-8,${encodeURIComponent(rawSvg)}`;

      return {
        data: {
          factorId: enrollRes.data.id,
          qrCodeSvg: rawSvg,
          qrCodeUrl,
          secret: totp.secret,
          uri: totp.uri
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err?.message || 'An unexpected error occurred during 2FA enrollment.' };
    }
  },

  /**
   * Verify the 6-digit code to activate the TOTP factor, and atomically store
   * 10 hashed single-use recovery codes.
   */
  async verifyAndActivateTOTP(params: {
    factorId: string;
    code: string;
    plainRecoveryCodes: string[];
    userId: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database service is unconfigured.' };
    try {
      // 1. Verify TOTP challenge
      const verifyRes = await supabase.auth.mfa.challengeAndVerify({
        factorId: params.factorId,
        code: params.code.trim()
      });

      if (verifyRes.error) {
        return {
          success: false,
          error: 'Invalid 6-digit code. Please enter the current code from your authenticator app.'
        };
      }

      // 2. Authoritatively store hashed recovery codes in database
      const storeRes = await supabase.rpc('fn_2fa_store_recovery_codes', {
        p_user_id: params.userId,
        p_plain_codes: params.plainRecoveryCodes
      });

      if (storeRes.error) {
        console.error('Failed to store recovery codes:', storeRes.error);
        return {
          success: false,
          error: storeRes.error.message || 'Failed to save recovery codes. Please try again.'
        };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'An error occurred during 2FA activation.'
      };
    }
  },

  /**
   * Verify 6-digit TOTP code during login with rate limiting & lockout.
   */
  async verifyLoginTOTP(params: {
    userId: string;
    factorId: string;
    code: string;
  }): Promise<{ success: boolean; isLocked?: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database service is unconfigured.' };

    const cleanCode = params.code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      return { success: false, error: 'Please enter a valid 6-digit code.' };
    }

    try {
      // 1. Check if user is locked out
      const lockout = await this.checkLockout(params.userId);
      if (lockout.isLocked) {
        return {
          success: false,
          isLocked: true,
          error: lockout.error || 'Account is temporarily locked due to multiple failed verification attempts. Please try again later.'
        };
      }

      // 2. Verify with Supabase MFA
      const verifyRes = await supabase.auth.mfa.challengeAndVerify({
        factorId: params.factorId,
        code: cleanCode
      });

      if (verifyRes.error) {
        // Record failed attempt in database
        const failRes = await supabase.rpc('fn_2fa_record_failed_attempt', {
          p_user_id: params.userId,
          p_reason: 'Invalid TOTP code'
        });

        const failData = failRes.data;
        if (failData?.is_locked) {
          return {
            success: false,
            isLocked: true,
            error: failData.error || 'Too many failed verification attempts. Your account is temporarily locked for 15 minutes.'
          };
        }

        return {
          success: false,
          isLocked: false,
          error: failData?.error || 'Invalid verification code. Please check your authenticator app and try again.'
        };
      }

      // 3. Record successful verification (resets failed attempts)
      await supabase.rpc('fn_2fa_record_success', {
        p_user_id: params.userId
      });

      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Unable to verify code. Please check your authenticator app and try again.'
      };
    }
  },

  /**
   * Verify single-use recovery code during login with rate limiting & single-use enforcement.
   */
  async verifyLoginRecoveryCode(params: {
    userId: string;
    code: string;
  }): Promise<{ success: boolean; isLocked?: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database service is unconfigured.' };

    const cleanCode = params.code.trim();
    if (!cleanCode) {
      return { success: false, error: 'Please enter a recovery code.' };
    }

    try {
      const res = await supabase.rpc('fn_2fa_verify_recovery_code', {
        p_user_id: params.userId,
        p_code: cleanCode
      });

      if (res.error) {
        return { success: false, error: res.error.message || 'Verification failed.' };
      }

      if (!res.data?.success) {
        return {
          success: false,
          isLocked: res.data?.is_locked,
          error: res.data?.error || 'Invalid or already used recovery code.'
        };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Unable to verify recovery code. Please try again.' };
    }
  },

  /**
   * Regenerate 10 new recovery codes.
   * Requires confirming current password AND current 6-digit TOTP code.
   */
  async regenerateRecoveryCodes(params: {
    userId: string;
    email: string;
    passwordVerify: string;
    code: string;
    factorId: string;
  }): Promise<{ success: boolean; codes?: string[]; error?: string }> {
    if (!supabase) return { success: false, error: 'Database service is unconfigured.' };

    try {
      // 1. Verify password
      const pwRes = await supabase.auth.signInWithPassword({
        email: params.email.trim().toLowerCase(),
        password: params.passwordVerify
      });

      if (pwRes.error || !pwRes.data.user) {
        return { success: false, error: 'Password confirmation failed. Please check your password.' };
      }

      // 2. Verify current TOTP
      const totpRes = await supabase.auth.mfa.challengeAndVerify({
        factorId: params.factorId,
        code: params.code.trim()
      });

      if (totpRes.error) {
        return { success: false, error: 'Invalid authenticator code.' };
      }

      // 3. Generate 10 new codes
      const newCodes = generateRecoveryCodes(10);

      // 4. Store in database
      const storeRes = await supabase.rpc('fn_2fa_store_recovery_codes', {
        p_user_id: params.userId,
        p_plain_codes: newCodes
      });

      if (storeRes.error) {
        return { success: false, error: storeRes.error.message || 'Failed to update recovery codes.' };
      }

      return { success: true, codes: newCodes };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to regenerate recovery codes.' };
    }
  },

  /**
   * Disable 2FA.
   * Requires confirming current password AND current 6-digit TOTP code.
   */
  async disable2FA(params: {
    userId: string;
    email: string;
    passwordVerify: string;
    code: string;
    factorId: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database service is unconfigured.' };

    try {
      // 1. Verify password
      const pwRes = await supabase.auth.signInWithPassword({
        email: params.email.trim().toLowerCase(),
        password: params.passwordVerify
      });

      if (pwRes.error || !pwRes.data.user) {
        return { success: false, error: 'Password confirmation failed. Please check your password.' };
      }

      // 2. Verify current TOTP
      const totpRes = await supabase.auth.mfa.challengeAndVerify({
        factorId: params.factorId,
        code: params.code.trim()
      });

      if (totpRes.error) {
        return { success: false, error: 'Invalid authenticator code.' };
      }

      // 3. Unenroll TOTP factor from Supabase MFA
      const unenrollRes = await supabase.auth.mfa.unenroll({
        factorId: params.factorId
      });

      if (unenrollRes.error) {
        console.warn('Unenroll notice:', unenrollRes.error.message);
      }

      // 4. Authoritatively wipe recovery codes, attempts, and audit-log via database RPC
      const disableRes = await supabase.rpc('fn_2fa_disable', {
        p_user_id: params.userId
      });

      if (disableRes.error) {
        return { success: false, error: disableRes.error.message || 'Failed to disable 2FA.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to disable 2FA.' };
    }
  },

  /**
   * Emergency Admin Reset of 2FA by Owner.
   * Strictly restricted to Owner role; removes factors, recovery codes, and attempts,
   * and writes immutable audit entry to system_audit_events.
   */
  async adminReset2FA(params: {
    targetUserId: string;
    reason: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database service is unconfigured.' };

    if (!params.reason?.trim()) {
      return { success: false, error: 'A reason is required to reset Two-Factor Authentication.' };
    }

    try {
      const res = await supabase.rpc('fn_2fa_admin_reset', {
        p_target_user_id: params.targetUserId,
        p_reason: params.reason.trim()
      });

      if (res.error) {
        return { success: false, error: res.error.message || 'Admin 2FA reset failed.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'An error occurred during admin 2FA reset.' };
    }
  }
};
