import React, { useState, useEffect } from 'react';
import { useSafeNavigate, useSafeParams } from '../../lib/safeRouterHooks';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Building2, Archive, Activity, ShieldAlert, ArrowLeft, BookTemplate,
  LayoutDashboard, Clock, UserCheck
} from 'lucide-react';
import { SettingsTab, UserProfile } from '../../types';
import { useOpsStore } from '../../store/opsStore';
import { clientManagementService } from '../../lib/clientManagementService';

const TeamManagementView = React.lazy(() =>
  import('../views/TeamManagementView').then((m) => ({ default: m.TeamManagementView }))
);
const ClientManagementView = React.lazy(() =>
  import('../views/ClientManagementView').then((m) => ({ default: m.ClientManagementView }))
);
const DashboardView = React.lazy(() =>
  import('../views/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const EmployeeDashboardView = React.lazy(() =>
  import('../employee/EmployeeDashboardView').then((m) => ({ default: m.EmployeeDashboardView }))
);
const EmployeeManagementDashboardView = React.lazy(() =>
  import('../employee/EmployeeManagementDashboardView').then((m) => ({ default: m.EmployeeManagementDashboardView }))
);
const ServiceTemplatesView = React.lazy(() =>
  import('../templates/ServiceTemplatesView').then((m) => ({ default: m.ServiceTemplatesView }))
);
const ArchiveCenterView = React.lazy(() =>
  import('../archive/ArchiveCenterView').then((m) => ({ default: m.ArchiveCenterView }))
);
const AuditLogView = React.lazy(() =>
  import('../audit/AuditLogView').then((m) => ({ default: m.AuditLogView }))
);

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  managerOnly?: boolean;
}

const ALL_TABS: TabConfig[] = [
  { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'My Attendance & Portal', icon: Clock },
  { id: 'employee_operations', label: 'Employee Operations', icon: Users, managerOnly: true },
  { id: 'team', label: 'Team Management', icon: UserCheck, managerOnly: true },
  { id: 'clients', label: 'Client Management', icon: Building2, managerOnly: true },
  { id: 'templates', label: 'Service Templates', icon: BookTemplate },
  { id: 'archive', label: 'Archive Center', icon: Archive, managerOnly: true },
  { id: 'audit', label: 'Audit Log', icon: Activity, managerOnly: true }
];

export const SettingsLayout: React.FC<{ initialTab?: SettingsTab }> = ({ initialTab = 'team' }) => {
  const navigate = useSafeNavigate();
  const params = useSafeParams<{ tab?: string }>();
  const { profile } = useAuth();

  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setViewMode = useOpsStore((state) => state.setViewMode);

  const [eligibleManagers, setEligibleManagers] = useState<UserProfile[]>([]);

  useEffect(() => {
    let isMounted = true;
    clientManagementService.fetchEligibleManagers().then((res) => {
      if (isMounted) setEligibleManagers(res);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const isManagerOrOwner = profile?.role === 'owner' || profile?.role === 'operational_manager';

  // Normalize tab param with support for hyphenated route aliases
  const rawTab = params.tab || initialTab;

  // Gracefully redirect legacy /settings/workspace directly to active client workspace
  useEffect(() => {
    if (rawTab === 'workspace' || rawTab === 'client_workspace' || rawTab === 'client-workspace') {
      navigate(selectedClientId ? `/clients/${selectedClientId}` : '/');
      setViewMode('client_workspace');
    }
  }, [rawTab, selectedClientId, navigate, setViewMode]);

  // Filter tabs by permission: team members only see permitted operational tabs
  const visibleTabs = ALL_TABS.filter((tab) => !tab.managerOnly || isManagerOrOwner);

  let normalizedTab: SettingsTab = 'dashboard';
  if (rawTab === 'attendance' || rawTab === 'employee_dashboard' || rawTab === 'employee-dashboard' || rawTab === 'my-portal' || rawTab === 'portal') {
    normalizedTab = 'attendance';
  } else if (rawTab === 'employee_operations' || rawTab === 'employee-operations' || rawTab === 'operations') {
    normalizedTab = 'employee_operations';
  } else if (rawTab === 'team' || rawTab === 'directory') {
    normalizedTab = 'team';
  } else if (rawTab === 'clients') {
    normalizedTab = 'clients';
  } else if (rawTab === 'templates' || rawTab === 'service-templates') {
    normalizedTab = 'templates';
  } else if (rawTab === 'archive') {
    normalizedTab = 'archive';
  } else if (rawTab === 'audit') {
    normalizedTab = 'audit';
  } else if (rawTab === 'dashboard') {
    normalizedTab = 'dashboard';
  } else {
    normalizedTab = isManagerOrOwner ? (initialTab || 'team') : 'dashboard';
  }

  const activeTabConfig = ALL_TABS.find((t) => t.id === normalizedTab);
  const isRestrictedForUser = activeTabConfig?.managerOnly && !isManagerOrOwner;

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-dark-400 select-none">
      {/* Settings Navigation Sub-Header with Responsive Horizontal Scroll */}
      <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 flex-nowrap min-w-0 flex-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = normalizedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`settings-tab-${tab.id}`}
                onClick={() => navigate(`/settings/${tab.id}`)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 min-h-[40px] sm:min-h-[36px] cursor-pointer ${
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
          data-testid="back-to-workspace-btn"
          onClick={() => {
            navigate(selectedClientId ? `/clients/${selectedClientId}` : '/');
            setViewMode('client_workspace');
          }}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex-shrink-0 min-h-[40px] sm:min-h-[36px] cursor-pointer self-start lg:self-auto shadow-2xs"
          title="Return to active client workspace"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Back to Workspace</span>
        </button>
      </div>

      {/* Dynamic Tab Body */}
      <div className="flex-1 overflow-y-auto">
        {isRestrictedForUser ? (
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
        ) : (
          <React.Suspense
            fallback={
              <div className="p-8 flex items-center justify-center text-gray-400 text-xs">
                <span className="animate-pulse">Loading view...</span>
              </div>
            }
          >
            {/* 1. My Dashboard */}
            {normalizedTab === 'dashboard' && <DashboardView />}

            {/* 2. My Attendance & Portal */}
            {normalizedTab === 'attendance' && <EmployeeDashboardView />}

            {/* 3. Employee Operations */}
            {normalizedTab === 'employee_operations' && <EmployeeManagementDashboardView />}

            {/* 4. Team Management */}
            {normalizedTab === 'team' && <TeamManagementView />}

            {/* 5. Client Management */}
            {normalizedTab === 'clients' && <ClientManagementView />}

            {/* 6. Service Templates */}
            {normalizedTab === 'templates' && <ServiceTemplatesView currentUserProfile={profile} />}

            {/* 7. Archive Center */}
            {normalizedTab === 'archive' && <ArchiveCenterView />}

            {/* 8. Audit Log */}
            {normalizedTab === 'audit' && <AuditLogView />}
          </React.Suspense>
        )}
      </div>
    </div>
  );
};