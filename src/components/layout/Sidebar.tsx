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
  const isSettingsActive = viewMode === 'settings';

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
        </div>

        <div className="flex flex-col items-center gap-3">
          {/* Settings icon for Owner and Manager */}
          {isManagerOrOwner && (
            <button
              type="button"
              onClick={() => setViewMode('settings')}
              className={`p-2.5 rounded-xl transition-colors ${
                isSettingsActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
              }`}
              title="Settings"
            >
              <Building2 className="w-5 h-5" />
            </button>
          )}

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
      {/* Top Organization Header & Client Switcher */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-3.5 border-b border-gray-100 dark:border-dark-border/60 flex items-center justify-between bg-white dark:bg-dark-card/50 flex-shrink-0">
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
        <div className="p-3 border-b border-gray-100 dark:border-dark-border/60 flex-shrink-0">
          <ClientSwitcher
            clients={clients}
            selectedClient={selectedClient}
            currentUserRole={profile?.role}
            isLoading={isClientsLoading}
            fetchError={clientsError}
            onRetry={loadClientData}
            onSelectClient={handleSelectClient}
            onOpenCreateModal={handleOpenCreateModal}
            onOpenDuplicateModal={handleOpenDuplicateModal}
          />
        </div>

        {/* Space reserved for future operational modules */}
        <div className="flex-1 overflow-y-auto p-3" />
      </div>

      {/* Bottom Section: Single Settings Action for Owner/Manager */}
      {isManagerOrOwner && (
        <div className="p-3 border-t border-gray-100 dark:border-dark-border/60 bg-gray-50/50 dark:bg-dark-300/30 flex-shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('settings')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all ${
              isSettingsActive
                ? 'bg-brand-500 text-white font-bold shadow-md shadow-brand-500/25'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 font-semibold'
            }`}
          >
            <Building2 className={`w-4 h-4 ${isSettingsActive ? 'text-white' : 'text-brand-500'}`} />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      )}

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
