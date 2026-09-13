import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, Plus, Search, Filter, CheckCircle2, Clock, 
  PauseCircle, Layers, ExternalLink, Shield, User, Archive, 
  RotateCcw, AlertCircle, X, ChevronRight, Briefcase
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import { useOpsStore } from '../../store/opsStore';
import { useSignedUrl } from '../../lib/storageService';
import { clientManagementService } from '../../lib/clientManagementService';
import { teamManagementService } from '../../lib/teamManagementService';
import { archiveService } from '../../lib/archiveService';
import { CreateClientModal } from '../clients/CreateClientModal';
import { ClientRecord, UserProfile, ClientPackage, ClientStatus } from '../../types';

export const ClientLogoAvatar: React.FC<{
  logoUrl?: string | null;
  companyName: string;
  sizeClass?: string;
}> = ({
  logoUrl,
  companyName,
  sizeClass = 'w-10 h-10 rounded-2xl'
}) => {
  const displayUrl = useSignedUrl('client-logos', logoUrl);
  const initials = (companyName || 'Client')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'CL';

  if (displayUrl) {
    return (
      <img
        src={displayUrl}
        alt={companyName}
        className={`${sizeClass} object-contain border border-slate-200 dark:border-dark-border p-1 bg-white dark:bg-dark-card flex-shrink-0 shadow-xs`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} bg-gradient-to-br from-slate-800 to-slate-900 dark:from-dark-100 dark:to-dark-200 text-white font-black text-xs flex items-center justify-center flex-shrink-0 border border-slate-700/50 shadow-xs`}
    >
      {initials}
    </div>
  );
};

const PACKAGE_BADGE_STYLES: Record<string, string> = {
  Basic: 'bg-slate-100 text-slate-700 dark:bg-dark-100 dark:text-slate-300 border-slate-200 dark:border-dark-border',
  Intermediate: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Advanced: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  Active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  Onboarding: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Paused: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
};

export const ClientManagementView: React.FC = () => {
  const { profile: currentUserProfile } = useAuth();
  const navigate = useSafeNavigate();

  const clients = useOpsStore((state) => state.clients);
  const setClients = useOpsStore((state) => state.setClients);
  const setSelectedClientId = useOpsStore((state) => state.setSelectedClientId);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const updateClientRecord = useOpsStore((state) => state.updateClientRecord);

  // Eligible managers for modal and filters
  const [eligibleManagers, setEligibleManagers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [packageFilter, setPackageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [clientToArchive, setClientToArchive] = useState<ClientRecord | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const isManagerOrOwner =
    currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';

  // Load fresh managers and client list
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clientRes, managers] = await Promise.all([
        clientManagementService.fetchClients(),
        teamManagementService.fetchEligibleManagers()
      ]);
      if (clientRes.data && clientRes.data.length > 0) {
        setClients(clientRes.data);
      }
      if (managers && managers.length > 0) {
        setEligibleManagers(managers);
      }
    } catch (err) {
      console.error('Failed to refresh clients:', err);
    } finally {
      setIsLoading(false);
    }
  }, [setClients]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Active / non-archived clients
  const activeClientsList = useMemo(() => {
    return clients.filter((c) => c.status !== 'Archived');
  }, [clients]);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    return activeClientsList.filter((client) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCompany = client.companyName?.toLowerCase().includes(q);
        const matchesContact = client.clientName?.toLowerCase().includes(q);
        const matchesManager = client.operationalManagerName?.toLowerCase().includes(q);
        const matchesPkg = client.package?.toLowerCase().includes(q);
        if (!matchesCompany && !matchesContact && !matchesManager && !matchesPkg) {
          return false;
        }
      }

      // Package filter
      if (packageFilter && client.package !== packageFilter) {
        return false;
      }

      // Status filter
      if (statusFilter && client.status !== statusFilter) {
        return false;
      }

      // Manager filter
      if (managerFilter) {
        if (client.operationalManagerId !== managerFilter && client.operationalManagerName !== managerFilter) {
          return false;
        }
      }

      return true;
    });
  }, [activeClientsList, searchQuery, packageFilter, statusFilter, managerFilter]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const total = activeClientsList.length;
    const active = activeClientsList.filter((c) => c.status === 'Active').length;
    const onboarding = activeClientsList.filter((c) => c.status === 'Onboarding').length;
    const paused = activeClientsList.filter((c) => c.status === 'Paused').length;
    const basic = activeClientsList.filter((c) => c.package === 'Basic').length;
    const intermediate = activeClientsList.filter((c) => c.package === 'Intermediate').length;
    const advanced = activeClientsList.filter((c) => c.package === 'Advanced').length;

    return {
      total,
      active,
      onboarding,
      paused,
      basic,
      intermediate,
      advanced
    };
  }, [activeClientsList]);

  // Unique Managers for Filter Dropdown
  const uniqueManagers = useMemo(() => {
    const mgrMap = new Map<string, string>();
    eligibleManagers.forEach((m) => {
      mgrMap.set(m.id, m.fullName);
    });
    activeClientsList.forEach((c) => {
      if (c.operationalManagerId && c.operationalManagerName) {
        mgrMap.set(c.operationalManagerId, c.operationalManagerName);
      }
    });
    return Array.from(mgrMap.entries()).map(([id, name]) => ({ id, name }));
  }, [eligibleManagers, activeClientsList]);

  const handleOpenClientWorkspace = (client: ClientRecord) => {
    setSelectedClientId(client.id);
    setViewMode('client_workspace');
    navigate(`/clients/${client.id}`);
  };

  const handleArchiveClient = async () => {
    if (!clientToArchive || !archiveReason.trim()) {
      setArchiveError('Mandatory archive reason is required.');
      return;
    }

    setIsArchiving(true);
    setArchiveError(null);
    const res = await archiveService.archiveClient(clientToArchive.id, archiveReason);
    setIsArchiving(false);

    if (res.error || !res.success) {
      setArchiveError(res.error || 'Failed to archive client.');
    } else {
      updateClientRecord({
        ...clientToArchive,
        status: 'Archived'
      });
      setClientToArchive(null);
      setArchiveReason('');
    }
  };

  const handleClientCreated = (newClient: ClientRecord) => {
    setClients([newClient, ...clients.filter((c) => c.id !== newClient.id)]);
    setIsCreateModalOpen(false);
  };

  const hasActiveFilters = Boolean(searchQuery || packageFilter || statusFilter || managerFilter);

  const resetFilters = () => {
    setSearchQuery('');
    setPackageFilter('');
    setStatusFilter('');
    setManagerFilter('');
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wider">
                  Client Directory & Governance
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-gray-100 tracking-tight">
                Client Management Dashboard
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5">
            Manage client organizations, operational packages, dedicated managers, brand assets, and client workspace portals.
          </p>
        </div>

        {isManagerOrOwner && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Client</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        
        {/* Total Clients */}
        <div className="p-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Clients
            </span>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-gray-100">
              {metrics.total}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Registered Organizations
            </div>
          </div>
        </div>

        {/* Active Retainers */}
        <div className="p-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Active
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.active}
            </div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-semibold mt-0.5">
              In Active Service
            </div>
          </div>
        </div>

        {/* Onboarding */}
        <div className="p-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Onboarding
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {metrics.onboarding}
            </div>
            <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-semibold mt-0.5">
              Setup & Provisioning
            </div>
          </div>
        </div>

        {/* Paused */}
        <div className="p-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Paused
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <PauseCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {metrics.paused}
            </div>
            <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-semibold mt-0.5">
              Operational Hold
            </div>
          </div>
        </div>

        {/* Service Package Distribution */}
        <div className="p-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-2 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Packages
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-100 text-slate-700 dark:text-slate-300 text-[10px] font-bold" title="Basic Tier">
              B: {metrics.basic}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold" title="Intermediate Tier">
              I: {metrics.intermediate}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold" title="Advanced Tier">
              A: {metrics.advanced}
            </span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, client, manager, or package..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Package Filter */}
          <select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="">All Packages</option>
            <option value="Basic">Basic Package</option>
            <option value="Intermediate">Intermediate Package</option>
            <option value="Advanced">Advanced Package</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Onboarding">Onboarding</option>
            <option value="Paused">Paused</option>
          </select>

          {/* Operational Manager Filter */}
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="">All Managers</option>
            {uniqueManagers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active Filter Indicators */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-dark-border text-xs text-slate-500 dark:text-gray-400">
            <span>
              Showing {filteredClients.length} of {activeClientsList.length} clients
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Clients Directory Table */}
      <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-dark-border bg-slate-50/70 dark:bg-dark-sidebar/70 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-6">Company & Brand</th>
                <th className="py-3.5 px-6">Client / Owner</th>
                <th className="py-3.5 px-6">Package</th>
                <th className="py-3.5 px-6">Operational Manager</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const pkgBadgeClass =
                    PACKAGE_BADGE_STYLES[client.package] || PACKAGE_BADGE_STYLES.Basic;
                  const statusBadgeClass =
                    STATUS_BADGE_STYLES[client.status] || STATUS_BADGE_STYLES.Active;

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-dark-100/60 transition-colors group"
                    >
                      {/* Company & Brand */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <ClientLogoAvatar
                            logoUrl={client.logoUrl}
                            companyName={client.companyName}
                            sizeClass="w-9 h-9 rounded-xl"
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-gray-100 text-sm">
                              {client.companyName}
                            </div>
                            {client.links?.website && (
                              <a
                                href={client.links.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 flex items-center gap-1 transition-colors mt-0.5"
                              >
                                <span>{client.links.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Client / Primary Contact */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{client.clientName}</span>
                        </div>
                      </td>

                      {/* Package */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold border ${pkgBadgeClass}`}
                        >
                          {client.package}
                        </span>
                      </td>

                      {/* Operational Manager */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                          <Shield className="w-3.5 h-3.5 text-slate-400" />
                          <span>{client.operationalManagerName || 'Executive Manager'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadgeClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              client.status === 'Active'
                                ? 'bg-emerald-500'
                                : client.status === 'Onboarding'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span>{client.status}</span>
                        </span>
                        {client.status === 'Paused' && client.pauseReason && (
                          <div className="text-[9px] text-rose-500 dark:text-rose-400 font-medium mt-0.5">
                            Reason: {client.pauseReason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenClientWorkspace(client)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-100 dark:hover:bg-dark-200 text-slate-700 dark:text-gray-200 font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Workspace</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        {currentUserProfile?.role === 'owner' && (
                          <button
                            type="button"
                            onClick={() => {
                              setClientToArchive(client);
                              setArchiveReason('');
                              setArchiveError(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-bold transition-colors border border-amber-200 dark:border-amber-800 cursor-pointer"
                          >
                            Archive
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-gray-500">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-dark-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-slate-700 dark:text-gray-300">
                        {hasActiveFilters ? 'No clients match your filter criteria' : 'No clients registered yet'}
                      </div>
                      <p className="text-xs text-slate-400">
                        {hasActiveFilters
                          ? 'Try resetting your search query or filters to view all client organizations.'
                          : 'Register a new client organization to get started with dedicated workspaces and task operations.'}
                      </p>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/25"
                        >
                          Reset Filters
                        </button>
                      ) : isManagerOrOwner ? (
                        <button
                          type="button"
                          onClick={() => setIsCreateModalOpen(true)}
                          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/25 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Register New Client</span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Client Modal */}
      {isCreateModalOpen && (
        <CreateClientModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleClientCreated}
          currentUserProfile={currentUserProfile}
          eligibleManagers={eligibleManagers}
        />
      )}

      {/* Archive Client Modal */}
      {clientToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-gray-100">
                  Archive Client: {clientToArchive.companyName}
                </h3>
                <p className="text-xs text-slate-400">
                  Mandatory reason required for recoverable archiving.
                </p>
              </div>
            </div>

            {archiveError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900">
                {archiveError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">
                Reason for Archiving <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g. Contract completed, business offboarding..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-dark-100 border border-slate-200 dark:border-dark-border text-xs text-slate-900 dark:text-gray-100 outline-none resize-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setClientToArchive(null)}
                disabled={isArchiving}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-dark-border text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-dark-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveClient}
                disabled={isArchiving || !archiveReason.trim()}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isArchiving ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
