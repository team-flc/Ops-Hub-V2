import React, { useState, useEffect, useCallback } from 'react';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import { useOpsStore } from '../../store/opsStore';
import { 
  Building2, ChevronsLeft, ChevronsRight, Briefcase, X,
  Globe, HardDrive, MessageCircle, ExternalLink, Clock, Users, UserCheck,
  Image, Video, PlaySquare, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ClientRecord, UserProfile } from '../../types';
import { ClientSwitcher } from '../clients/ClientSwitcher';
import { CreateClientModal } from '../clients/CreateClientModal';
import { DuplicateClientModal } from '../clients/DuplicateClientModal';
import { clientManagementService } from '../../lib/clientManagementService';

// Custom SVG Brand Icons for Client Workspace Links
const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.762-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

const FacebookIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const SlackIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

export const Sidebar: React.FC = () => {
  const navigate = useSafeNavigate();
  const viewMode = useOpsStore((state) => state.viewMode);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const sidebarCollapsed = useOpsStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useOpsStore((state) => state.toggleSidebar);
  
  // Phase 2B Clients
  const clients = useOpsStore((state) => state.clients);
  const setClients = useOpsStore((state) => state.setClients);
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setSelectedClientId = useOpsStore((state) => state.setSelectedClientId);
  const addClientRecord = useOpsStore((state) => state.addClientRecord);

  const { profile } = useAuth();

  // Client Modals & Loading State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [sourceClientForDuplicate, setSourceClientForDuplicate] = useState<ClientRecord | null>(null);
  const [eligibleManagers, setEligibleManagers] = useState<UserProfile[]>([]);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);

  const loadClientData = useCallback(async () => {
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
  }, [selectedClientId, setClients, setSelectedClientId]);

  // Fetch Clients & Managers on mount
  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0] || null;

  // Reactive Workspace Links derived from selected client
  const clientLinks = selectedClient?.links || {};
  const workspaceLinks = [
    {
      key: 'website',
      label: 'Website',
      url: clientLinks.website,
      icon: <Globe className="w-3.5 h-3.5" />
    },
    {
      key: 'flc_landing_page',
      label: 'FLC Landing Page',
      url: clientLinks.flc_landing_page,
      icon: <Sparkles className="w-3.5 h-3.5" />
    },
    {
      key: 'google_drive',
      label: 'Google Drive',
      url: clientLinks.google_drive,
      icon: <HardDrive className="w-3.5 h-3.5" />
    },
    {
      key: 'static_creatives',
      label: 'Static',
      url: clientLinks.static_creatives,
      icon: <Image className="w-3.5 h-3.5" />
    },
    {
      key: 'videos',
      label: 'Videos',
      url: clientLinks.videos,
      icon: <Video className="w-3.5 h-3.5" />
    },
    {
      key: 'vsl',
      label: 'VSL',
      url: clientLinks.vsl,
      icon: <PlaySquare className="w-3.5 h-3.5" />
    },
    {
      key: 'linkedin_company_page',
      label: 'LinkedIn',
      url: clientLinks.linkedin_company_page,
      icon: <LinkedInIcon className="w-3.5 h-3.5" />
    },
    {
      key: 'facebook',
      label: 'Facebook',
      url: clientLinks.facebook,
      icon: <FacebookIcon className="w-3.5 h-3.5" />
    },
    {
      key: 'instagram',
      label: 'Instagram',
      url: clientLinks.instagram,
      icon: <InstagramIcon className="w-3.5 h-3.5" />
    },
    {
      key: 'slack_channel',
      label: 'Slack',
      url: clientLinks.slack_channel,
      icon: <SlackIcon className="w-3.5 h-3.5" />
    },
    {
      key: 'whatsapp_group',
      label: 'WhatsApp',
      url: clientLinks.whatsapp_group,
      icon: <MessageCircle className="w-3.5 h-3.5" />
    }
  ];

  const activeWorkspaceLinks = workspaceLinks.filter((l) => Boolean(l.url && l.url.trim()));

  const mobileSidebarOpen = useOpsStore((state) => state.mobileSidebarOpen);
  const setMobileSidebarOpen = useOpsStore((state) => state.setMobileSidebarOpen);

  const handleSelectClient = (client: ClientRecord) => {
    setSelectedClientId(client.id);
    navigate(`/clients/${client.id}`);
    setViewMode('client_workspace');
    setMobileSidebarOpen(false);
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
    navigate(`/clients/${newClient.id}`);
    setViewMode('client_workspace');
    setMobileSidebarOpen(false);
  };

  const isManagerOrOwner = profile?.role === 'owner' || profile?.role === 'operational_manager';
  const isSettingsActive = viewMode === 'settings';

  if (sidebarCollapsed && !mobileSidebarOpen) {
    return (
      <aside className="hidden md:flex w-16 bg-white dark:bg-dark-sidebar border-r border-gray-200 dark:border-dark-border h-screen flex-col items-center py-4 justify-between z-30 flex-shrink-0 select-none">
        <div className="flex flex-col items-center gap-4 w-full px-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-gray-100 hover:scale-105 transition-transform touch-target cursor-pointer"
            title="Expand Sidebar"
          >
            <img src="/logo.png" alt="Faseeh Lall Logo" className="w-8 h-8 object-contain" />
          </button>

          {/* Workspace icon button to return to client workspace */}
          <button
            type="button"
            onClick={() => {
              navigate(selectedClientId ? `/clients/${selectedClientId}` : '/');
              setViewMode('client_workspace');
              setMobileSidebarOpen(false);
            }}
            className={`p-2.5 rounded-xl transition-colors touch-target flex items-center justify-center cursor-pointer ${
              viewMode === 'client_workspace'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
            }`}
            title="Client Workspace"
          >
            <Briefcase className="w-5 h-5" />
          </button>

          {/* Employee Attendance & Portal button */}
          <button
            type="button"
            onClick={() => {
              navigate('/employee/dashboard');
              setViewMode('employee_dashboard');
              setMobileSidebarOpen(false);
            }}
            className={`p-2.5 rounded-xl transition-colors touch-target flex items-center justify-center cursor-pointer ${
              viewMode === 'employee_dashboard'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
            }`}
            title="Employee Attendance Portal"
          >
            <Clock className="w-5 h-5" />
          </button>

          {/* Employee Operations Management (Owner / Manager) */}
          {isManagerOrOwner && (
            <button
              type="button"
              onClick={() => {
                navigate('/operations/employees');
                setViewMode('employee_operations');
                setMobileSidebarOpen(false);
              }}
              className={`p-2.5 rounded-xl transition-colors touch-target flex items-center justify-center cursor-pointer ${
                viewMode === 'employee_operations' || viewMode === 'employee_dossier'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
              }`}
              title="Employee Operations & HR"
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          {/* Collapsed Workspace Links Icons with Tooltips (Phase 3D) */}
          {activeWorkspaceLinks.length > 0 && (
            <div className="flex flex-col items-center gap-1.5 py-2 border-y border-gray-100 dark:border-dark-border/60 w-full">
              {activeWorkspaceLinks.map((link) => (
                <a
                  key={link.key}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-dark-100 rounded-lg transition-colors touch-target flex items-center justify-center relative group"
                  title={`${link.label}: ${link.url}`}
                  aria-label={link.label}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          {/* Settings icon for Owner and Manager */}
          {isManagerOrOwner && (
            <button
              type="button"
              onClick={() => {
                navigate('/settings');
                setViewMode('settings');
                setMobileSidebarOpen(false);
              }}
              className={`p-2.5 rounded-xl transition-colors touch-target flex items-center justify-center cursor-pointer ${
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
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 touch-target flex items-center justify-center cursor-pointer"
            title="Expand Sidebar"
          >
            <ChevronsRight className="w-5 h-5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-30 bg-white dark:bg-dark-sidebar border-r border-gray-200 dark:border-dark-border h-[100dvh] md:h-screen flex flex-col justify-between flex-shrink-0 select-none shadow-2xl md:shadow-none transition-transform duration-200 ease-in-out ${
          sidebarCollapsed ? 'md:w-16' : 'md:w-64'
        } ${
          mobileSidebarOpen
            ? 'translate-x-0 w-72 max-w-[85vw]'
            : '-translate-x-full md:translate-x-0 w-64'
        }`}
      >
        {/* Top Organization Header & Client Switcher */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3.5 border-b border-gray-100 dark:border-dark-border/60 flex items-center justify-between bg-white dark:bg-dark-card/50 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 max-w-[160px] flex items-center">
                <img src="/logo.png" alt="FASEEH LALL & CO." className="h-7 w-auto object-contain" />
              </div>
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors touch-target flex items-center justify-center cursor-pointer"
              title="Close Sidebar"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop collapse button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:flex text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors touch-target sm:touch-auto items-center justify-center cursor-pointer"
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
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

          {/* Client Workspace Links (Relocated from Header in Phase 3D) */}
          {selectedClient && (
            <div className="p-3 border-b border-gray-100 dark:border-dark-border/60 flex-shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1 flex items-center justify-between">
                <span>Workspace Links</span>
                {activeWorkspaceLinks.length > 0 && (
                  <span className="text-[9px] font-mono text-gray-400 font-semibold">{activeWorkspaceLinks.length} active</span>
                )}
              </div>
              {activeWorkspaceLinks.length > 0 ? (
                <div className="space-y-1">
                  {activeWorkspaceLinks.map((link) => (
                    <a
                      key={link.key}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors group cursor-pointer"
                      title={`Open ${link.label}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-gray-400 group-hover:text-brand-500 transition-colors shrink-0">
                          {link.icon}
                        </span>
                        <span className="truncate">{link.label}</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="px-2 py-1 text-[11px] text-gray-400 italic">
                  No links configured
                </div>
              )}
            </div>
          )}

          {/* Staff & Management Operational Modules */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Operational Workspace Links */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1 px-1">
                Employee Operations
              </div>

              {/* My Employee Portal */}
              <button
                type="button"
                onClick={() => {
                  navigate('/employee/dashboard');
                  setViewMode('employee_dashboard');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'employee_dashboard'
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="truncate">My Attendance & Portal</span>
                </div>
              </button>

              {/* Operations & HR Management (Owner / Manager) */}
              {isManagerOrOwner && (
                <button
                  type="button"
                  onClick={() => {
                    navigate('/operations/employees');
                    setViewMode('employee_operations');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === 'employee_operations' || viewMode === 'employee_dossier'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="truncate">Employee Operations</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Single Settings Action for Owner/Manager */}
        {isManagerOrOwner && (
          <div className="p-3 border-t border-gray-100 dark:border-dark-border/60 bg-gray-50/50 dark:bg-dark-300/30 flex-shrink-0 pb-safe md:pb-3">
            <button
              type="button"
              onClick={() => {
                navigate('/settings');
                setViewMode('settings');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer touch-target ${
                isSettingsActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Settings</span>
            </button>
          </div>
        )}
      </aside>

      {/* Portalled Modals: mounted direct to document.body to prevent CSS transform containment */}
      <CreateClientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleClientCreated}
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
          eligibleManagers={eligibleManagers}
        />
      )}
    </>
  );
};