import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import { UserRole } from '../../types';
import { ShieldAlert, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = ['owner', 'operational_manager', 'team_member']
}) => {
  const { user, profile, isLoading, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // Unauthenticated visitors are always redirected to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Account status check (inactive or suspended)
  if (profile && profile.status !== 'active') {
    return (
      <div className="min-h-screen w-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Account {profile.status === 'suspended' ? 'Suspended' : 'Inactive'}</h2>
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

  // Client user attempting to access staff application
  if (profile?.role === 'client' && !allowedRoles.includes('client')) {
    return <Navigate to="/client" replace />;
  }

  // Staff user attempting to access route outside allowed roles
  if (profile && allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
