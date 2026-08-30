import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import { UserRole, isStaffRole, isClientRole } from '../../types';
import { ShieldAlert, LogOut, RefreshCw, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = ['owner', 'operational_manager', 'team_member']
}) => {
  const { user, profile, isLoading, profileError, signOut, refreshProfile } = useAuth();
  const location = useLocation();

  // 1. Loading state
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // 2. Unauthenticated visitor -> redirect to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Profile lookup error or missing profile -> Fail closed (Never expose staff or client portal)
  if (profileError || !profile) {
    return (
      <div className="min-h-screen w-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Account Configuration Notice</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {profileError || 'Your account profile could not be verified. Please contact your FLC administrator for activation.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => refreshProfile()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Verification</span>
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Inactive or Suspended account -> Block entry and provide sign out
  if (profile.status !== 'active') {
    return (
      <div className="min-h-screen w-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Account {profile.status === 'suspended' ? 'Suspended' : 'Inactive'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your account is currently {profile.status}. Please contact your FLC administrator for access restoration.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Strict Role Isolation Check:
  // Client user attempting to open staff route -> Redirect to /client
  if (isClientRole(profile.role) && !allowedRoles.includes('client')) {
    return <Navigate to="/client" replace />;
  }

  // Staff user attempting to open client portal -> Redirect to /
  if (isStaffRole(profile.role) && allowedRoles.length === 1 && allowedRoles[0] === 'client') {
    return <Navigate to="/" replace />;
  }

  // Generic unauthorized role check
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={isClientRole(profile.role) ? '/client' : '/'} replace />;
  }

  return <>{children}</>;
};
