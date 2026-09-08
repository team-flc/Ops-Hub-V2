import React, { useEffect, useState } from 'react';
import { Routes, Route, useParams, useLocation, Navigate } from 'react-router-dom';
import { useOpsStore } from './store/opsStore';
import { clientManagementService } from './lib/clientManagementService';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './components/auth/LoginPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { UpdatePasswordPage } from './components/auth/UpdatePasswordPage';
import { ClientPortalHoldingPage } from './components/auth/ClientPortalHoldingPage';
import { ClientPortalGate } from './components/portal/ClientPortalGate';

// Internal Workspace Views
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ListView } from './components/views/ListView';
import { BoardView } from './components/views/BoardView';
import { CalendarView } from './components/views/CalendarView';
import { TimelineView } from './components/views/TimelineView';
import { TableView } from './components/views/TableView';
import { DashboardView } from './components/views/DashboardView';
import { DocsView } from './components/views/DocsView';
import { OperationsDirectory } from './components/views/OperationsDirectory';
import { TeamManagementView } from './components/views/TeamManagementView';
import { ClientWorkspaceView } from './components/clients/ClientWorkspaceView';
import { SettingsLayout } from './components/settings/SettingsLayout';
import { MyProfileView } from './components/profile/MyProfileView';
import { TaskModal } from './components/tasks/TaskModal';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';
import { CommandPalette } from './components/layout/CommandPalette';
import { NewSpaceModal } from './components/spaces/NewSpaceModal';
import { NewListModal } from './components/spaces/NewListModal';
import { AutomationsModal } from './components/automations/AutomationsModal';
import { Building2 } from 'lucide-react';
import { UserProfile, SettingsTab } from './types';

/**
 * Existing Internal FLC Ops Hub Workspace
 * Strictly accessible only by authenticated staff (owner, operational_manager, team_member).
 */
export const OpsHubWorkspace: React.FC<{ initialView?: 'directory' | 'dashboard' | 'list' | 'client_workspace' | 'settings' | 'profile'; initialSettingsTab?: SettingsTab }> = ({ initialView, initialSettingsTab }) => {
  const viewMode = useOpsStore((state) => state.viewMode);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const clients = useOpsStore((state) => state.clients);
  const setClients = useOpsStore((state) => state.setClients);
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setSelectedClientId = useOpsStore((state) => state.setSelectedClientId);
  const updateClientRecord = useOpsStore((state) => state.updateClientRecord);

  const { user, profile } = useAuth();
  const params = useParams<{ clientId?: string; tab?: string }>();
  const location = useLocation();

  const [eligibleManagers, setEligibleManagers] = useState<UserProfile[]>([]);

  // Synchronize route param clientId with store
  useEffect(() => {
    if (params.clientId) {
      setSelectedClientId(params.clientId);
      setViewMode('client_workspace');
    }
  }, [params.clientId, setSelectedClientId, setViewMode]);

  // Synchronize route pathname with viewMode
  useEffect(() => {
    if (location.pathname.startsWith('/settings')) {
      setViewMode('settings');
    } else if (location.pathname.startsWith('/profile')) {
      setViewMode('profile');
    } else if (location.pathname.startsWith('/team')) {
      setViewMode('directory');
    } else if (location.pathname.startsWith('/clients')) {
      setViewMode('client_workspace');
    }
  }, [location.pathname, setViewMode]);

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView, setViewMode]);

  // Load clients & managers on mount
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

      if (params.clientId) {
        setSelectedClientId(params.clientId);
      } else if (!selectedClientId && fetchedClients.length > 0) {
        setSelectedClientId(fetchedClients[0].id);
      }
    }
    loadData();
  }, [user, params.clientId, setClients, selectedClientId, setSelectedClientId]);

  const isManagerOrOwner = profile?.role === 'owner' || profile?.role === 'operational_manager';
  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0] || null;

  const renderActiveView = () => {
    if (location.pathname.startsWith('/settings') || viewMode === 'settings') {
      const tabParam = params.tab || location.pathname.split('/settings/')[1];
      return <SettingsLayout initialTab={(tabParam as SettingsTab) || initialSettingsTab || 'team'} />;
    }
    if (location.pathname.startsWith('/profile') || viewMode === 'profile') {
      return <MyProfileView />;
    }
    if (location.pathname.startsWith('/team') || viewMode === 'directory') {
      return isManagerOrOwner ? <TeamManagementView /> : <OperationsDirectory />;
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
      case 'dashboard':
        return <DashboardView />;
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
          {renderActiveView()}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <TaskModal />
      <CreateTaskModal />
      <CommandPalette />
      <NewSpaceModal />
      <NewListModal />
      <AutomationsModal />
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
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />

      {/* Protected Client Portal Route (Strictly Client Role Only) */}
      <Route
        path="/client"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <ClientPortalHoldingPage />
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

      {/* Dedicated Settings Route for Owner and Operational Manager */}
      <Route
        path="/settings/:tab"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
            <OpsHubWorkspace initialView="settings" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['owner', 'operational_manager']}>
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
  );
};

export default App;
