import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { 
  Building2, Users, ChevronsLeft, ChevronsRight, LogOut 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DISPLAY_NAMES, ClientRecord, UserProfile } from '../../types';
import { ClientSwitcher } from '../clients/ClientSwitcher';
import { CreateClientModal } from '../clients/CreateClientModal';
import { DuplicateClientModal } from '../clients/DuplicateClientModal';
import { clientManagementService } from '../../lib/clientManagementService';

export const Sidebar: React.FC = () => {
  const viewMode = useOpsStore((state) => state.viewMode);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const sidebarCollapsed = useOpsStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useOpsStore((state) => state.toggleSidebar);
  const currentUser = useOpsStore((state) => state.currentUser);
  
  // Phase 2B Clients
  const clients = useOpsStore((state) => state.clients);
  const setClients = useOpsStore((state) => state.setClients);
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setSelectedClientId = useOpsStore((state) => state.setSelectedClientId);
  const addClientRecord = useOpsStore((state) => state.addClientRecord);

  const { signOut, profile, user } = useAuth();
  const displayName = profile?.fullName || user?.email?.split('@')[0] || currentUser.name || 'Team Member';
  const displayRole = profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'Team Member';
  const displayInitials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'FL';

  // Client Modals & Loading State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [sourceClientForDuplicate, setSourceClientForDuplicate] = useState<ClientRecord | null>(null);
  const [eligibleManagers, setEligibleManagers] = useState<UserProfile[]>([]);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);

  const loadClientData = async () => {
    setIsClientsLoading(true);
    setClientsError(null);
    try {
      const [clientRes, fetchedManagers] = await Promise.all([
        clientManagementService.fetchClients(),
        clientManagementService.fetchEligibleManagers()
      ]);
      if (clientRes.error) {
        setClientsError(clientRes.error);
      } else {
        setClients(clientRes.data);
        if (!selectedClientId && clientRes.data.length > 0) {
          setSelectedClientId(clientRes.data[0].id);
        }
      }
      setEligibleManagers(fetchedManagers);
    } catch (err: any) {
      setClientsError(err?.message || 'Failed to load clients.');
    } finally {
      setIsClientsLoading(false);
    }
  };

  // Fetch Clients & Managers on mount
  useEffect(() => {
    loadClientData();
  }, [setClients]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0] || null;

  const handleSelectClient = (client: ClientRecord) => {
    setSelectedClientId(client.id);
    setViewMode('client_workspace');
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleOpenDuplicateModal = (client: ClientRecord) => {
    setSourceClientForDuplicate(client);
    setIsDuplicateModalOpen(true);
  };

  const handleClientCreated = (newClient: ClientRecord) => {
    addClientRecord(newClient);
    setSelectedClientId(newClient.id);
    setViewMode('client_workspace');
  };

  const isManagerOrOwner = profile?.role === 'owner' || profile?.role === 'operational_manager';
  const isClientWorkspaceActive = viewMode === 'client_workspace' || viewMode === 'clients' || !['directory'].includes(viewMode);
  const isTeamManagementActive = viewMode === 'directory';

  if (sidebarCollapsed) {
    return (
      <aside className="w-16 bg-white dark:bg-dark-sidebar border-r border-gray-200 dark:border-dark-border h-screen flex flex-col items-center py-4 justify-between z-30 flex-shrink-0 select-none">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-gray-100 hover:scale-105 transition-transform"
            title="Expand Sidebar"
          >
            <img src="/logo.png" alt="Faseeh Lall Logo" className="w-8 h-8 object-contain" />
          </button>

          {/* Quick Icons */}
          <button
            type="button"
            onClick={() => setViewMode('client_workspace')}
            className={`p-2.5 rounded-xl transition-colors ${
              isClientWorkspaceActive
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
            }`}
            title="Client Management"
          >
            <Building2 className="w-5 h-5" />
          </button>

          {isManagerOrOwner && (
            <button
              type="button"
              onClick={() => setViewMode('directory')}
              className={`p-2.5 rounded-xl transition-colors ${
                isTeamManagementActive
                  ? 'bg-brand-500/10 text-brand-500'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
              }`}
              title="Team Management"
            >
              <Users className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => signOut()}
            className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={toggleSidebar}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title="Expand Sidebar"
          >
            <ChevronsRight className="w-5 h-5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white dark:bg-dark-sidebar border-r border-gray-200 dark:border-dark-border h-screen flex flex-col justify-between z-30 flex-shrink-0 select-none">
      {/* Top Organization Header & Navigation */}
      <div>
        <div className="p-3.5 border-b border-gray-100 dark:border-dark-border/60 flex items-center justify-between bg-white dark:bg-dark-card/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 max-w-[160px] flex items-center">
              <img src="/logo.png" alt="FASEEH LALL & CO." className="h-7 w-auto object-contain" />
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>

        {/* GoHighLevel-Style Client Switcher */}
        <div className="p-3 border-b border-gray-100 dark:border-dark-border/60">
          <ClientSwitcher
            clients={clients}
            selectedClient={selectedClient}
            isLoading={isClientsLoading}
            fetchError={clientsError}
            onRetry={loadClientData}
            onSelectClient={handleSelectClient}
            onOpenCreateModal={handleOpenCreateModal}
            onOpenDuplicateModal={handleOpenDuplicateModal}
          />
        </div>

        {/* Clean Application Navigation */}
        <div className="p-3 space-y-1.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('client_workspace')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
              isClientWorkspaceActive
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 font-medium'
            }`}
          >
            <Building2 className="w-4 h-4 text-brand-500" />
            <span>Client Management</span>
          </button>

          {isManagerOrOwner && (
            <button
              type="button"
              onClick={() => setViewMode('directory')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
                isTeamManagementActive
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 font-medium'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-500" />
              <span>Team Management</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom User Profile Section with Single Sign Out */}
      <div className="p-3 border-t border-gray-100 dark:border-dark-border/60 bg-gray-50/50 dark:bg-dark-300/30">
        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-sm flex-shrink-0">
              {displayInitials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                {displayName}
              </div>
              <div className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 truncate">
                {displayRole}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modals for Create & Duplicate Client */}
      <CreateClientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleClientCreated}
        currentUserProfile={profile}
        eligibleManagers={eligibleManagers}
      />

      {sourceClientForDuplicate && (
        <DuplicateClientModal
          isOpen={isDuplicateModalOpen}
          onClose={() => {
            setIsDuplicateModalOpen(false);
            setSourceClientForDuplicate(null);
          }}
          onSuccess={handleClientCreated}
          sourceClient={sourceClientForDuplicate}
          currentUserProfile={profile}
          eligibleManagers={eligibleManagers}
        />
      )}
    </aside>
  );
};
