import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole, AccountStatus, isStaffRole, isClientRole, ROLE_DISPLAY_NAMES } from '../types';
import { useOpsStore } from '../store/opsStore';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  profileError: string | null;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, status, organization_id, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch database error:', error.message);
        return { profile: null, error: 'Unable to verify account profile. Please check your connection and try again.' };
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

      const userProf: UserProfile = {
        id: data.id,
        email: userEmail,
        fullName: data.full_name || 'Ops User',
        role,
        status,
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
          email: prof.email || '',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
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
  }, [fetchProfile, syncProfileToStore]);

  // Real Email/Password Sign-In
  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
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
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo
      });

      if (error) {
        console.warn('Reset password error (masked):', error.message);
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
