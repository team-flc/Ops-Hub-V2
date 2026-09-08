// ==============================================================================
// COMPONENT: ClientPortalGate
// Location: src/components/portal/ClientPortalGate.tsx
// Phase: Client Experience Portal Route Guard & Preview Controller
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { clientPortalService, PortalDataResult } from '../../lib/clientPortalService';
import { ClientPortalLayout } from './ClientPortalLayout';
import { 
  Building2, ShieldAlert, AlertTriangle, 
  Loader2, LogOut, ArrowLeft, Eye, Sparkles
} from 'lucide-react';
import { getPresetDateRanges } from '../../lib/clientPdfReportService';
import { PortalDateRange } from '../../types';

export const ClientPortalGate: React.FC = () => {
  const { clientId: paramClientId } = useParams<{ clientId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, isLoading: isAuthLoading, signOut } = useAuth();

  const isPreviewRequested = searchParams.get('preview') === 'true';

  // State for date range (defaults to This Month)
  const defaultRanges = getPresetDateRanges();
  const [dateRange, setDateRange] = useState<PortalDateRange>(defaultRanges.thisMonth);

  // Portal data state
  const [portalData, setPortalData] = useState<PortalDataResult | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Determine effective client ID
  const effectiveClientId = paramClientId || (profile?.role === 'client' ? profile.organizationId : undefined);

  // Determine if this is a staff read-only preview
  const isStaffRole = profile?.role === 'owner' || profile?.role === 'operational_manager';
  const isReadOnlyPreview = isStaffRole && isPreviewRequested;

  const loadData = useCallback(async () => {
    if (!effectiveClientId) {
      setLoadError('No client workspace specified.');
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setLoadError(null);

    try {
      const res = await clientPortalService.fetchClientPortalData(
        effectiveClientId,
        profile,
        isReadOnlyPreview,
        dateRange
      );

      if (res.error) {
        setLoadError(res.error);
      } else {
        setPortalData(res);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load client workspace.');
    } finally {
      setIsLoadingData(false);
    }
  }, [effectiveClientId, profile, isReadOnlyPreview, dateRange]);

  useEffect(() => {
    if (!isAuthLoading) {
      if (!user) {
        // Redirect unauthenticated visitors to login with return path
        navigate('/login', { replace: true, state: { from: { pathname: window.location.pathname } } });
        return;
      }
      loadData();
    }
  }, [user, isAuthLoading, loadData, navigate]);

  // Handle Loading State
  if (isAuthLoading || isLoadingData) {
    return (
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-dark-400 flex flex-col items-center justify-center p-6 font-sans">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto border border-brand-500/20">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Connecting to Client Workspace...
          </p>
        </div>
      </div>
    );
  }

  // Handle Workspace Archived State
  if (loadError === 'WORKSPACE_ARCHIVED' || portalData?.client?.status === 'Archived') {
    return (
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-dark-400 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-dark-100 text-gray-500 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Workspace Inactive
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This client workspace has been archived. Client portal access is currently disabled.
            </p>
          </div>
          {isStaffRole ? (
            <button
              type="button"
              onClick={() => navigate('/clients/' + effectiveClientId)}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold transition-all min-h-[44px]"
            >
              Return to Staff Operations
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold transition-all min-h-[44px]"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    );
  }

  // Handle Access Denied (Without revealing client names or existence)
  if (loadError || !portalData?.client) {
    return (
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-dark-400 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Access Restricted
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isStaffRole 
                ? 'You do not have administrative or operational permissions to preview this client workspace.'
                : 'You are not authorized to access this client workspace. Please sign in with your approved client account.'}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            {isStaffRole ? (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold transition-all min-h-[44px]"
              >
                Back to Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signOut()}
                className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 text-xs font-bold transition-all min-h-[44px]"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-dark-400 text-gray-900 dark:text-gray-100 flex flex-col font-sans antialiased">
      {/* 1. PERSISTENT STAFF READ-ONLY PREVIEW BANNER */}
      {isReadOnlyPreview && (
        <div 
          role="status"
          aria-label="Staff Preview Mode"
          className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm border-b border-amber-600 z-50 select-none"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 shrink-0" />
            <span>
              Client preview · Read only
            </span>
            <span className="opacity-75 hidden sm:inline">
              (Staff Mode: Approvals, commenting, and client mutations are strictly disabled)
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/clients/' + portalData.client?.id)}
            className="flex items-center gap-1 px-2.5 py-1 bg-black/20 hover:bg-black/30 rounded-lg text-slate-950 font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Preview</span>
          </button>
        </div>
      )}

      {/* 2. PERSISTENT SETUP PENDING NOTICE (when remote migration is pending) */}
      {portalData.isSetupPending && isStaffRole && (
        <div 
          role="status"
          className="bg-sky-500/10 border-b border-sky-500/20 text-sky-700 dark:text-sky-300 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 text-center"
        >
          <Sparkles className="w-4 h-4 shrink-0 text-sky-500" />
          <span>
            Client Portal Setup Pending: Remote database tables are currently being configured. Deliverables are displayed in fallback mode.
          </span>
        </div>
      )}

      {/* 3. PERSISTENT CLIENT PAUSED NOTICE */}
      {portalData.client.status === 'Paused' && (
        <div 
          role="alert"
          className="bg-brand-500/15 border-b border-brand-500/30 text-brand-700 dark:text-brand-400 px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 text-center"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Workspace Notice: Your account is currently paused{portalData.client.pauseReason ? ` (${portalData.client.pauseReason})` : ''}. Deliverables and reports remain accessible in read-only mode.
          </span>
        </div>
      )}

      {/* 3. MAIN CLIENT PORTAL LAYOUT */}
      <ClientPortalLayout
        portalData={portalData}
        isReadOnlyPreview={isReadOnlyPreview}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={loadData}
      />
    </div>
  );
};
