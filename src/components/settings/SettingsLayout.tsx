import React from 'react';
import { useSafeNavigate, useSafeParams } from '../../lib/safeRouterHooks';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Building2, Archive, Activity, ShieldAlert, ArrowLeft, BookTemplate
} from 'lucide-react';
import { TeamManagementView } from '../views/TeamManagementView';
import { ClientManagementView } from '../views/ClientManagementView';
import { SettingsTab } from '../../types';
import { useOpsStore } from '../../store/opsStore';

const ServiceTemplatesView = React.lazy(() =>
  import('../templates/ServiceTemplatesView').then((m) => ({ default: m.ServiceTemplatesView }))
);
const ArchiveCenterView = React.lazy(() =>
  import('../archive/ArchiveCenterView').then((m) => ({ default: m.ArchiveCenterView }))
);
const AuditLogView = React.lazy(() =>
  import('../audit/AuditLogView').then((m) => ({ default: m.AuditLogView }))
);

export const SettingsLayout: React.FC<{ initialTab?: SettingsTab }> = ({ initialTab = 'team' }) => {
  const navigate = useSafeNavigate();
  const params = useSafeParams<{ tab?: string }>();
  const activeTab: SettingsTab = (params.tab as SettingsTab) || initialTab || 'team';
  const { profile } = useAuth();
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setViewMode = useOpsStore((state) => state.setViewMode);

  const isManagerOrOwner = profile?.role === 'owner' || profile?.role === 'operational_manager';

  // Strict Fail-Closed Route Guard for Team Members
  if (!isManagerOrOwner) {
    return (
      <div className="p-12 text-center text-gray-500 max-w-lg mx-auto mt-16 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
          Access Restricted
        </h3>
        <p className="text-xs text-gray-400">
          Settings and administrative governance tools are restricted to Executive Management and Operational Managers.
        </p>
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'team', label: 'Team Management', icon: Users },
    { id: 'clients', label: 'Client Management', icon: Building2 },
    { id: 'templates', label: 'Service Templates', icon: BookTemplate },
    { id: 'archive', label: 'Archive Center', icon: Archive },
    { id: 'audit', label: 'Audit Log', icon: Activity }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-dark-400 select-none">
      {/* Settings Navigation Sub-Header */}
      <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 flex-nowrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(`/settings/${tab.id}`)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 min-h-[40px] sm:min-h-[36px] cursor-pointer ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            navigate(selectedClientId ? `/clients/${selectedClientId}` : '/');
            setViewMode('client_workspace');
          }}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors flex-shrink-0 min-h-[40px] sm:min-h-[36px] cursor-pointer self-start md:self-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Back to Workspace</span>
        </button>
      </div>

      {/* Dynamic Tab Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'team' && <TeamManagementView />}

        {activeTab === 'clients' && <ClientManagementView />}

        {activeTab === 'templates' && (
          <React.Suspense
            fallback={
              <div className="p-8 flex items-center justify-center text-gray-400 text-xs">
                <span className="animate-pulse">Loading Service Templates...</span>
              </div>
            }
          >
            <ServiceTemplatesView currentUserProfile={profile} />
          </React.Suspense>
        )}

        {activeTab === 'archive' && (
          <React.Suspense
            fallback={
              <div className="p-8 flex items-center justify-center text-gray-400 text-xs">
                <span className="animate-pulse">Loading Archive Center...</span>
              </div>
            }
          >
            <ArchiveCenterView />
          </React.Suspense>
        )}

        {activeTab === 'audit' && (
          <React.Suspense
            fallback={
              <div className="p-8 flex items-center justify-center text-gray-400 text-xs">
                <span className="animate-pulse">Loading Audit Log...</span>
              </div>
            }
          >
            <AuditLogView />
          </React.Suspense>
        )}
      </div>
    </div>
  );
};