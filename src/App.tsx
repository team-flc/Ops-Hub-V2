import React, { useEffect, useState } from 'react';
import { Routes, Route, useParams, useLocation, Navigate } from 'react-router-dom';
import { useOpsStore } from './store/opsStore';
import { clientManagementService } from './lib/clientManagementService';
import { resolveSelectedClientId, setStoredSelectedClientId } from './lib/clientPersistence';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Building2 } from 'lucide-react';
import { UserProfile, SettingsTab } from './types';

// Lazy-loaded Auth Pages
const LoginPage = React.lazy(() =>
  import('./components/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const ForgotPasswordPage = React.lazy(() =>
  import('./components/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const UpdatePasswordPage = React.lazy(() =>
  import('./components/auth/UpdatePasswordPage').then((m) => ({ default: m.UpdatePasswordPage }))
);
const ClientPortalHoldingPage = React.lazy(() =>
  import('./components/auth/ClientPortalHoldingPage').then((m) => ({ default: m.ClientPortalHoldingPage }))
);
const ClientPortalGate = React.lazy(() =>
  import('./components/portal/ClientPortalGate').then((m) => ({ default: m.ClientPortalGate }))
);

// Lazy-loaded Workspace Views
const ListView = React.lazy(() =>
  import('./components/views/ListView').then((m) => ({ default: m.ListView }))
);
const BoardView = React.lazy(() =>
  import('./components/views/BoardView').then((m) => ({ default: m.BoardView }))
);
const CalendarView = React.lazy(() =>
  import('./components/views/CalendarView').then((m) => ({ default: m.CalendarView }))
);
const TimelineView = React.lazy(() =>
  import('./components/views/TimelineView').then((m) => ({ default: m.TimelineView }))
);
const TableView = React.lazy(() =>
  import('./components/views/TableView').then((m) => ({ default: m.TableView }))
);
const DashboardView = React.lazy(() =>
  import('./components/views/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const DocsView = React.lazy(() =>
  import('./components/views/DocsView').then((m) => ({ default: m.DocsView }))
);
const OperationsDirectory = React.lazy(() =>
  import('./components/views/OperationsDirectory').then((m) => ({ default: m.OperationsDirectory }))
);
const TeamManagementView = React.lazy(() =>
  import('./components/views/TeamManagementView').then((m) => ({ default: m.TeamManagementView }))
);
const ClientWorkspaceView = React.lazy(() =>
  import('./components/clients/ClientWorkspaceView').then((m) => ({ default: m.ClientWorkspaceView }))
);
import { SettingsLayout } from './components/settings/SettingsLayout';
const MyProfileView = React.lazy(() =>
  import('./components/profile/MyProfileView').then((m) => ({ default: m.MyProfileView }))
);
const EmployeeDashboardView = React.lazy(() =>
  import('./components/employee/EmployeeDashboardView').then((m) => ({ default: m.EmployeeDashboardView }))
);
const EmployeeManagementDashboardView = React.lazy(() =>
  import('./components/employee/EmployeeManagementDashboardView').then((m) => ({ default: m.EmployeeManagementDashboardView }))
);
const EmployeeDossierView = React.lazy(() =>
  import('./components/employee/EmployeeDossierView').then((m) => ({ default: m.EmployeeDossierView }))
);

// Lazy-loaded Global Modals
const TaskModal = React.lazy(() =>
  import('./components/tasks/TaskModal').then((m) => ({ default: m.TaskModal }))
);
const CreateTaskModal = React.lazy(() =>
  import('./components/tasks/CreateTaskModal').then((m) => ({ default: m.CreateTaskModal }))
);
const CommandPalette = React.lazy(() =>
  import('./components/layout/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const NewSpaceModal = React.lazy(() =>
  import('./components/spaces/NewSpaceModal').then((m) => ({ default: m.NewSpaceModal }))
);
const NewListModal = React.lazy(() =>
  import('./components/spaces/NewListModal').then((m) => ({ default: m.NewListModal }))
);
const AutomationsModal = React.lazy(() =>
  import('./components/automations/AutomationsModal').then((m) => ({ default: m.AutomationsModal }))
);

/**
 * Existing Internal FLC Ops Hub Workspace
 * Strictly accessible only by authenticated staff (owner, operational_manager, team_member).
 */
export const OpsHubWorkspace: React.FC<{ initialView?: 'directory' | 'dashboard' | 'list' | 'client_workspace' | 'settings' | 'profile' | 'employee_dashboard' | 'employee_operations' | 'employee_dossier'; initialSettingsTab?: SettingsTab }> = ({ initialView, initialSettingsTab }) => {
  const viewMode = useOpsStore((state) => state.viewMode);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const clients = useOpsStore((state) => state.clients);
  const setClients = useOpsStore((state) => state.setClients);
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setSelectedClientId = useOpsStore((state) => state.setSelectedClientId);
  const updateClientRecord = useOpsStore((state) => state.updateClientRecord);

  const { user, profile } = useAuth();
  const params = useParams<{ clientId?: string; tab?: string; employeeId?: string }>();
  const location = useLocation();

  const [eligibleManagers, setEligibleManagers] = useState<UserProfile[]>([]);

  // Synchronize route param clientId with store and persistence
  useEffect(() => {
    if (params.clientId) {
      setSelectedClientId(params.clientId);
      if (user?.id) {
        setStoredSelectedClientId(user.id, params.clientId);
      }
      setViewMode('client_workspace');
    }
  }, [params.clientId, user?.id, setSelectedClientId, setViewMode]);

  // Synchronize route pathname with viewMode
  useEffect(() => {
    if (location.pathname === '/' || location.pathname.startsWith('/dashboard')) {
      setViewMode('dashboard');
    } else if (location.pathname.startsWith('/settings')) {
      setViewMode('settings');
    } else if (location.pathname.startsWith('/profile')) {
      setViewMode('profile');
    } else if (location.pathname.startsWith('/team')) {
      setViewMode('directory');
    } else if (location.pathname.startsWith('/employee/dashboard')) {
      setViewMode('employee_dashboard');
    } else if (location.pathname.startsWith('/operations/employees/') && location.pathname !== '/operations/employees') {
      setViewMode('employee_dossier');
    } else if (location.pathname.startsWith('/operations/employees')) {
      setViewMode('employee_operations');
    } else if (location.pathname.startsWith('/clients')) {
      setViewMode('client_workspace');
    }
  }, [location.pathname, setViewMode]);

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView, setViewMode]);

  // Load clients & managers on mount with persistent resolution
  useEffect(() => {
    if (!user) return;

    async function loadData() {
      const [clientRes, managers] = await Promise.all([
        clientManagementService.fetchClients(),
        clientManagementService.fetchEligibleManagers()
      ]);
      const fetchedClients = clientRes.data || [];
      setClients(fetchedClients);
      setEligibleManagers(managers);

      if (fetchedClients.length > 0) {
        const resolvedId = resolveSelectedClientId({
          clients: fetchedClients,
          userId: user?.id,
          routeClientId: params.clientId,
          currentSelectedId: selectedClientId
        });
        if (resolvedId) {
          setSelectedClientId(resolvedId);
          if (user?.id) {
            setStoredSelectedClientId(user.id, resolvedId);
          }
        }
      }
    }
    loadData();
  }, [user?.id, params.clientId, setClients, setSelectedClientId]);

  const isManagerOrOwner = profile?.role === 'owner' || profile?.role === 'operational_manager';
  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients.find((c) => c.status !== 'Archived') || clients[0] || null;

  const renderActiveView = () => {
    if (location.pathname.startsWith('/settings') || viewMode === 'settings') {
      const tabParam = params.tab || location.pathname.split('/settings/')[1];
      const defaultTab = isManagerOrOwner ? (initialSettingsTab || 'team') : 'dashboard';
      return <SettingsLayout initialTab={(tabParam as SettingsTab) || defaultTab} />;
    }
    if (location.pathname.startsWith('/profile') || viewMode === 'profile') {
      return <MyProfileView />;
    }
    if (location.pathname.startsWith('/team') || viewMode === 'directory') {
      return isManagerOrOwner ? <TeamManagementView /> : <OperationsDirectory />;
    }
    if (location.pathname.startsWith('/employee/dashboard') || viewMode === 'employee_dashboard') {
      return <EmployeeDashboardView />;
    }
    if ((location.pathname.startsWith('/operations/employees/') && location.pathname !== '/operations/employees') || viewMode === 'employee_dossier') {
      return <EmployeeDossierView />;
    }
    if (location.pathname.startsWith('/operations/employees') || viewMode === 'employee_operations') {
      return isManagerOrOwner ? <EmployeeManagementDashboardView /> : <EmployeeDashboardView />;
    }
    if (location.pathname === '/' || location.pathname.startsWith('/dashboard') || viewMode === 'dashboard') {
      return <DashboardView />;
    }

    switch (viewMode) {
      case 'list':
        return <ListView />;
      case 'board':
        return <BoardView />;
      case 'calendar':
        return <CalendarView />;
      case 'timeline':
        return <TimelineView />;
      case 'table':
        return <TableView />;
      case 'docs':
        return <DocsView />;
      case 'client_workspace':
      case 'clients':
      default:
        return selectedClient ? (
          <ClientWorkspaceView
            client={selectedClient}
            currentUserProfile={profile}
            eligibleManagers={eligibleManagers}
            onClientUpdated={updateClientRecord}
          />
        ) : (
          <div className="p-12 text-center text-gray-500 max-w-lg mx-auto mt-16 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto border border-brand-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
              No Accessible Client Workspace
            </h3>
            <p className="text-xs text-gray-400">
              Select an accessible client workspace from the Client Switcher in the left sidebar, or create a new client if authorized.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-[100dvh] w-full max-w-full overflow-hidden bg-gray-50 dark:bg-dark-400 text-gray-900 dark:text-gray-100 font-sans antialiased">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header />

        {/* Dynamic Views Content Container */}
        <main className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-dark-400">
          <React.Suspense
            fallback={
              <div className="p-8 flex items-center justify-center text-gray-400 text-xs min-h-[200px]">
                <span className="animate-pulse">Loading view...</span>
              </div>
            }
          >
            {renderActiveView()}
          </React.Suspense>
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <React.Suspense fallback={null}>
        <TaskModal />
        <CreateTaskModal />
        <CommandPalette />
        <NewSpaceModal />
        <NewListModal />
        <AutomationsModal />
      </React.Suspense>
    </div>
  );
};

/**
 * Top-Level Root Application with Mutually Exclusive Role Routing
 */

const ClientRedirect: React.FC = () => {
  const { profile } = useAuth();
  if (profile?.organizationId) {
    return <Navigate to={`/portal/${profile.organizationId}`} replace />;
  }
  return <ClientPortalHoldingPage />;
};

export const App: React.FC = () => {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-400 text-gray-400 text-xs">
          <span className="animate-pulse">Loading application...</span>
        </div>
      }
    >
      <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />

      {/* Dedicated Client Portal Route with Strict Role Isolation & Server Authorization */}
      <Route
        path="/portal/:clientId"
        element={
          <ProtectedRoute allowedRoles={['client', 'owner', 'operational_manager']}>
            <ClientPortalGate />
          </ProtectedRoute>
        }
      />

      {/* Portal root fallback (redirects to client's portal or shows holding page) */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={['client', 'owner', 'operational_manager']}>
            <ClientRedirect />
          </ProtectedRoute>
        }
      />

      {/* Protected Client Portal Route (Redirects authenticated client to their portal) */}
      <Route
        path="/client"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <ClientRedirect />
          </ProtectedRoute>
        }
      />

      {/* Dedicated My Dashboard Operational Route */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
            <OpsHubWorkspace initialView="dashboard" />
          </ProtectedRoute>
        }
      />

      {/* Dedicated Employee Self-Service Dashboard / Clock Portal */}
      <Route
        path="/employee/dashboard"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
            <OpsHubWorkspace initialView="employee_dashboard" />
          </ProtectedRoute>
        }
      />

      {/* Dedicated Employee Operations & Dossier Routes for Management */}
      <Route
        path="/operations/employees/:employeeId"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
            <OpsHubWorkspace initialView="employee_dossier" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/employees"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
            <OpsHubWorkspace initialView="employee_operations" />
          </ProtectedRoute>
        }
      />

      {/* Dedicated Team Management Route for Owner and Operational Manager */}
      <Route
        path="/team"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
            <OpsHubWorkspace initialView="directory" />
          </ProtectedRoute>
        }
      />

      {/* Dedicated Settings Route for All Staff */}
      <Route
        path="/settings/:tab"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
            <OpsHubWorkspace initialView="settings" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
            <OpsHubWorkspace initialView="settings" />
          </ProtectedRoute>
        }
      />

      {/* Dedicated My Profile Route for all Staff Members */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
            <OpsHubWorkspace initialView="profile" />
          </ProtectedRoute>
        }
      />

      {/* Dedicated Client Management Direct Routes */}
      <Route
        path="/clients/:clientId"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
            <OpsHubWorkspace initialView="client_workspace" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
            <OpsHubWorkspace initialView="client_workspace" />
          </ProtectedRoute>
        }
      />

      {/* Protected Internal Staff Application (Strictly Staff Roles Only) */}
      <Route
        path="/*"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
            <OpsHubWorkspace />
          </ProtectedRoute>
        }
      />
    </Routes>
    </React.Suspense>
  );
};

export default App;
