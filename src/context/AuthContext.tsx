import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole, AccountStatus, isStaffRole, isClientRole } from '../types';
import { useOpsStore } from '../store/opsStore';

export interface SignInResult {
  error?: string;
  requires2FA?: boolean;
  factorId?: string;
  userId?: string;
  userEmail?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  profileError: string | null;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  complete2FASignIn: (isRecoveryCode?: boolean) => Promise<{ error?: string }>;
  cancel2FASignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GENERIC_AUTH_ERROR = "We couldn't sign you in. Check your email and password and try again.";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Fetch verified profile from Supabase profiles table - Strict Fail-Closed
  const fetchProfile = useCallback(async (userId: string, userEmail?: string): Promise<{ profile: UserProfile | null; error: string | null }> => {
    if (!supabase) {
      return { profile: null, error: 'Database service is unconfigured.' };
    }

    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Full profile select encountered an issue, trying core fields fallback:', error.message);
        const fallbackRes = await supabase
          .from('profiles')
          .select('id, full_name, role, status, work_email, avatar_url, phone, bio, designation_id, reporting_manager_id, start_date, organization_id, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle();

        if (fallbackRes.error) {
          console.error('Profile fetch database error:', fallbackRes.error.message);
          return { profile: null, error: 'Unable to verify account profile. Please check your connection and try again.' };
        }
        data = fallbackRes.data;
      }

      if (!data) {
        return { profile: null, error: 'No profile found for this account. Please contact your FLC administrator.' };
      }

      const role = data.role as UserRole;
      if (!isStaffRole(role) && !isClientRole(role)) {
        return { profile: null, error: 'Invalid or unrecognized account role. Please contact your FLC administrator.' };
      }

      const status = data.status as AccountStatus;
      if (status !== 'active') {
        return { profile: null, error: status === 'suspended' ? 'Your account has been suspended.' : 'Your account is currently inactive.' };
      }

      let designationName: string | undefined = undefined;
      if (data.designation_id) {
        try {
          const { data: desData } = await supabase
            .from('designations')
            .select('name')
            .eq('id', data.designation_id)
            .maybeSingle();
          if (desData?.name) {
            designationName = desData.name;
          }
        } catch (e) {
          console.warn('Could not fetch designation name:', e);
        }
      } else if (role === 'owner') {
        designationName = 'Owner & Founder';
      }

      const userProf: UserProfile = {
        id: data.id,
        email: userEmail || data.work_email,
        workEmail: data.work_email,
        fullName: data.full_name || 'Ops User',
        phone: data.phone,
        backupPhone: data.backup_phone,
        bio: data.bio,
        avatarUrl: data.avatar_url || null,
        linkedinUrl: data.linkedin_url,
        facebookUrl: data.facebook_url,
        instagramUrl: data.instagram_url,
        contactEmail: data.contact_email,
        role,
        status,
        designationId: data.designation_id,
        designationName,
        reportingManagerId: data.reporting_manager_id,
        startDate: data.start_date,
        suspendedAt: data.suspended_at,
        suspendedBy: data.suspended_by,
        archivedAt: data.archived_at,
        archivedBy: data.archived_by,
        archiveReason: data.archive_reason,
        previousStatus: data.previous_status,
        organizationId: data.organization_id || null,
        createdAt: data.created_at || new Date().toISOString(),
        updatedAt: data.updated_at || new Date().toISOString()
      };

      return { profile: userProf, error: null };
    } catch (err) {
      console.error('Fatal profile loading error:', err);
      return { profile: null, error: 'A network or system error occurred while retrieving your profile.' };
    }
  }, []);

  const syncProfileToStore = useCallback((prof: UserProfile | null) => {
    if (prof) {
      useOpsStore.setState({
        currentUser: {
          id: prof.id,
          name: prof.fullName,
          email: prof.email || prof.workEmail || '',
          avatar: prof.avatarUrl || '',
          role: prof.role === 'owner' ? 'Ops Director' : prof.role === 'operational_manager' ? 'Operations Lead' : 'Ops Specialist',
          department: 'Faseeh Lall & Co. Operations',
          status: 'online',
          initials: prof.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'FL'
        }
      });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { profile: prof, error: err } = await fetchProfile(user.id, user.email);
    setProfile(prof);
    setProfileError(err);
    syncProfileToStore(prof);
    setIsLoading(false);
  }, [user, fetchProfile, syncProfileToStore]);

  // Check whether 2FA verification has been satisfied for the given user
  const is2FAComplete = useCallback(async (checkUser: User): Promise<boolean> => {
    if (!supabase?.auth?.mfa?.listFactors) return true;
    try {
      const factorsRes = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factorsRes.data?.totp?.find((f) => f.status === 'verified');
      if (!verifiedFactor) {
        return true; // No 2FA enabled for this account
      }

      if (supabase.auth.mfa.getAuthenticatorAssuranceLevel) {
        const aalRes = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalRes.data?.currentLevel === 'aal2') {
          return true; // Verified with TOTP
        }
      }

      const recKey = `flc_2fa_rec_verified_${checkUser.id}`;
      const recInLocal = typeof localStorage !== 'undefined' && localStorage.getItem(recKey) === 'true';
      const recInSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(recKey) === 'true';
      if (recInLocal || recInSession) {
        return true; // Verified with single-use recovery code this session
      }

      return false; // Factor exists but neither AAL2 nor recovery code satisfied
    } catch {
      return true;
    }
  }, []);

  // Initial Auth Check & Session Listener
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (!supabase) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser();

        if (verifyError || !verifiedUser) {
          if (mounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setProfileError(null);
            setIsLoading(false);
          }
          return;
        }

        const completed2FA = await is2FAComplete(verifiedUser);
        if (!completed2FA) {
          // Unverified tab does not broadcast signOut to other tabs
          if (mounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setProfileError(null);
            setIsLoading(false);
          }
          return;
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const { profile: prof, error: profErr } = await fetchProfile(verifiedUser.id, verifiedUser.email);

        if (mounted) {
          setUser(verifiedUser);
          setSession(currentSession);
          setProfile(prof);
          setProfileError(profErr);
          syncProfileToStore(prof);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        if (mounted) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setProfileError('Failed to verify session.');
          setIsLoading(false);
        }
      }
    }

    initAuth();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, newSession: Session | null) => {
          if (!mounted) return;

          if (event === 'SIGNED_OUT' || !newSession) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setProfileError(null);
            setIsLoading(false);
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            const authUser = newSession.user;
            const completed2FA = await is2FAComplete(authUser);
            if (!completed2FA) {
              // 2FA pending — do not issue active user or profile to app state
              return;
            }

            setUser(authUser);
            setSession(newSession);
            const { profile: prof, error: profErr } = await fetchProfile(authUser.id, authUser.email);
            setProfile(prof);
            setProfileError(profErr);
            syncProfileToStore(prof);
            setIsLoading(false);
          }
        }
      );

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } else {
      mounted = false;
    }
  }, [fetchProfile, syncProfileToStore, is2FAComplete]);

  // Real Email/Password Sign-In with 2FA Gate
  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    if (!supabase) {
      return { error: 'Authentication service is not configured. Contact your administrator.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { error: GENERIC_AUTH_ERROR };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (error || !data.user) {
        return { error: GENERIC_AUTH_ERROR };
      }

      // Check if user has 2FA enabled
      if (supabase.auth?.mfa?.listFactors) {
        const factorsRes = await supabase.auth.mfa.listFactors();
        const verifiedFactor = factorsRes.data?.totp?.find((f) => f.status === 'verified');
        if (verifiedFactor) {
          // Check rate-limiting lockout status
          if (supabase.rpc) {
            const { data: lockout } = await supabase.rpc('fn_2fa_check_lockout', {
              p_user_id: data.user.id
            });
            if (lockout?.is_locked) {
              await supabase.auth.signOut();
              return {
                error: lockout?.error || 'Account is temporarily locked due to multiple failed verification attempts. Please try again later.'
              };
            }
          }

          // Return 2FA requirement to trigger Step 2 in login form
          return {
            requires2FA: true,
            factorId: verifiedFactor.id,
            userId: data.user.id,
            userEmail: cleanEmail
          };
        }
      }

      // Normal flow for accounts without 2FA
      const { profile: prof, error: profErr } = await fetchProfile(data.user.id, data.user.email);
      if (profErr || !prof) {
        await supabase.auth.signOut();
        return { error: profErr || 'Account configuration error. Please contact your FLC administrator.' };
      }

      if (prof.status !== 'active') {
        await supabase.auth.signOut();
        return { error: prof.status === 'suspended' ? 'Your account has been suspended. Contact your FLC administrator.' : 'Your account is inactive. Contact your FLC administrator.' };
      }

      setUser(data.user);
      setSession(data.session);
      setProfile(prof);
      setProfileError(null);
      syncProfileToStore(prof);

      return {};
    } catch {
      return { error: GENERIC_AUTH_ERROR };
    }
  };

  // Complete 2FA Sign-In after successful code verification
  const complete2FASignIn = async (isRecoveryCode?: boolean): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Authentication service is not configured.' };
    try {
      const { data: { user: currentUser }, error: userErr } = await supabase.auth.getUser();
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (userErr || !currentUser) {
        return { error: 'Session expired. Please sign in again.' };
      }

      if (isRecoveryCode) {
        if (typeof localStorage !== 'undefined') localStorage.setItem(`flc_2fa_rec_verified_${currentUser.id}`, 'true');
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(`flc_2fa_rec_verified_${currentUser.id}`, 'true');
      }

      const { profile: prof, error: profErr } = await fetchProfile(currentUser.id, currentUser.email);
      if (profErr || !prof) {
        await supabase.auth.signOut();
        return { error: profErr || 'Account configuration error. Please contact your FLC administrator.' };
      }

      if (prof.status !== 'active') {
        await supabase.auth.signOut();
        return { error: prof.status === 'suspended' ? 'Your account has been suspended.' : 'Your account is inactive.' };
      }

      setUser(currentUser);
      setSession(currentSession);
      setProfile(prof);
      setProfileError(null);
      syncProfileToStore(prof);

      return {};
    } catch {
      return { error: 'Failed to complete two-factor authentication.' };
    }
  };

  // Cancel 2FA Sign-In
  const cancel2FASignIn = async (): Promise<void> => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignored on cancel
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setProfileError(null);
  };

  const resetPasswordForEmail = async (email: string): Promise<{ error?: string }> => {
    if (!supabase) {
      return { error: 'Authentication service is not configured.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { error: 'Please enter a valid email address.' };
    }

    try {
      const redirectTo = `${window.location.origin}/update-password`;
      const { error: directError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo
      });

      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('work_email, contact_email')
          .or(`contact_email.ilike.${cleanEmail},work_email.ilike.${cleanEmail}`)
          .limit(1)
          .maybeSingle();

        const altEmail = prof?.work_email?.toLowerCase().trim();
        if (altEmail && altEmail !== cleanEmail) {
          await supabase.auth.resetPasswordForEmail(altEmail, { redirectTo });
        }
      } catch {
        // Fallback
      }

      if (directError) {
        console.warn('Reset password error (masked):', directError.message);
      }
      return {};
    } catch {
      return {};
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ error?: string }> => {
    if (!supabase) {
      return { error: 'Authentication service is not configured.' };
    }

    if (!newPassword || newPassword.length < 8) {
      return { error: 'Password must be at least 8 characters long.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { error: error.message || 'Failed to update password. Please request a new link.' };
      }

      return {};
    } catch {
      return { error: 'An unexpected error occurred while updating password.' };
    }
  };

  const signOut = async () => {
    if (supabase) {
      try {
        if (user && typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(`flc_2fa_rec_verified_${user.id}`);
        }
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }

    setUser(null);
    setSession(null);
    setProfile(null);
    setProfileError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        profileError,
        isConfigured: isSupabaseConfigured,
        signIn,
        complete2FASignIn,
        cancel2FASignIn,
        signOut,
        resetPasswordForEmail,
        updatePassword,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const defaultAuthContext: AuthContextType = {
  user: null,
  profile: null,
  session: null,
  isLoading: false,
  profileError: null,
  isConfigured: false,
  signIn: async () => ({ error: 'AuthProvider not initialized' }),
  complete2FASignIn: async () => ({ error: 'AuthProvider not initialized' }),
  cancel2FASignIn: async () => {},
  signOut: async () => {},
  resetPasswordForEmail: async () => ({ error: 'AuthProvider not initialized' }),
  updatePassword: async () => ({ error: 'AuthProvider not initialized' }),
  refreshProfile: async () => {}
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultAuthContext;
  }
  return context;
};
