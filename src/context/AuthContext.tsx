import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole, AccountStatus } from '../types';
import { useOpsStore } from '../store/opsStore';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GENERIC_AUTH_ERROR = "We couldn't sign you in. Check your email and password and try again.";
const GENERIC_RESET_SUCCESS = "If an account exists for this email, password reset instructions have been sent.";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch verified profile from Supabase profiles table
  const fetchProfile = useCallback(async (userId: string, userEmail?: string): Promise<UserProfile | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // Fallback: If trigger didn't run or table has no row yet, attempt creating minimal profile
        const fallbackProfile: UserProfile = {
          id: userId,
          email: userEmail,
          fullName: userEmail ? userEmail.split('@')[0] : 'Ops User',
          role: 'team_member',
          status: 'active',
          organizationId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return fallbackProfile;
      }

      const userProf: UserProfile = {
        id: data.id,
        email: userEmail,
        fullName: data.full_name || 'Ops User',
        role: (data.role as UserRole) || 'team_member',
        status: (data.status as AccountStatus) || 'active',
        organizationId: data.organization_id || null,
        createdAt: data.created_at || new Date().toISOString(),
        updatedAt: data.updated_at || new Date().toISOString()
      };

      return userProf;
    } catch (err) {
      console.error('Error loading profile:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const prof = await fetchProfile(user.id, user.email);
    setProfile(prof);
  }, [user, fetchProfile]);

  // Initial Auth Check & Session Listener
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (!supabase) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        // Use verified server check getUser() instead of getSession() alone
        const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser();

        if (verifyError || !verifiedUser) {
          if (mounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setIsLoading(false);
          }
          return;
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const prof = await fetchProfile(verifiedUser.id, verifiedUser.email);

        if (mounted) {
          setUser(verifiedUser);
          setSession(currentSession);
          setProfile(prof);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        if (mounted) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    }

    initAuth();

    // Supabase reactive listener
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, newSession: Session | null) => {
          if (!mounted) return;

          if (event === 'SIGNED_OUT' || !newSession) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setIsLoading(false);
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            const authUser = newSession.user;
            setUser(authUser);
            setSession(newSession);
            const prof = await fetchProfile(authUser.id, authUser.email);
            setProfile(prof);
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
  }, [fetchProfile]);

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
        password: password // Do not trim or alter password
      });

      if (error || !data.user) {
        return { error: GENERIC_AUTH_ERROR };
      }

      const prof = await fetchProfile(data.user.id, data.user.email);
      if (!prof || prof.status !== 'active') {
        await supabase.auth.signOut();
        return { error: 'Your account is inactive or suspended. Contact your FLC administrator.' };
      }

      setUser(data.user);
      setSession(data.session);
      setProfile(prof);

      // Sync into opsStore for current active session display
      useOpsStore.setState({
        currentUser: {
          id: prof.id,
          name: prof.fullName,
          email: prof.email || cleanEmail,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          role: prof.role === 'owner' ? 'Ops Director' : prof.role === 'operational_manager' ? 'Operations Lead' : 'Ops Specialist',
          department: 'Faseeh Lall & Co. Operations',
          status: 'online',
          initials: prof.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        }
      });

      return {};
    } catch {
      return { error: GENERIC_AUTH_ERROR };
    }
  };

  // Real Password Reset Request
  const resetPasswordForEmail = async (email: string): Promise<{ error?: string }> => {
    if (!supabase) {
      return { error: 'Authentication service is not configured.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { error: 'Please enter a valid email address.' };
    }

    try {
      // Use current window origin (Cloudflare Pages deployment URL) for password update redirect
      const redirectTo = `${window.location.origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo
      });

      // Always return generic success message to prevent user enumeration
      if (error) {
        console.warn('Reset password error (masked):', error.message);
      }
      return {};
    } catch {
      return {};
    }
  };

  // Real Password Update
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

  // Sign Out
  const signOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }

    // Clear state
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
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
