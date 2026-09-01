import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, Building2, Archive, Activity, ShieldAlert 
} from 'lucide-react';
import { TeamManagementView } from '../views/TeamManagementView';
import { ArchiveCenterView } from '../archive/ArchiveCenterView';
import { AuditLogView } from '../audit/AuditLogView';
import { SettingsTab, ClientRecord } from '../../types';
import { useOpsStore } from '../../store/opsStore';
import { ClientDetailsTab } from '../clients/ClientDetailsTab';
import { archiveService } from '../../lib/archiveService';

export const SettingsLayout: React.FC<{ initialTab?: SettingsTab }> = ({ initialTab = 'team' }) => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const clients = useOpsStore((state) => state.clients);
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setSelectedClientId = useOpsStore((state) => state.setSelectedClientId);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const updateClientRecord = useOpsStore((state) => state.updateClientRecord);

  // Archive Client Dialog State
  const [clientToArchive, setClientToArchive] = useState<ClientRecord | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

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
    { id: 'archive', label: 'Archive Center', icon: Archive },
    { id: 'audit', label: 'Audit Log', icon: Activity }
  ];

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

  const handleOpenClientWorkspace = (client: ClientRecord) => {
    setSelectedClientId(client.id);
    setViewMode('client_workspace');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-dark-400 select-none">
      {/* Settings Navigation Sub-Header */}
      <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Tab Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'team' && <TeamManagementView />}

        {activeTab === 'clients' && (
          <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase">
                    Client Governance
                  </span>
                </div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2.5">
                  <Building2 className="w-6 h-6 text-brand-500" />
                  <span>Client Management Directory</span>
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Manage active client organizations, operational packages, managers, and brand profiles.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/50 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                      <th className="py-3.5 px-6">Company</th>
                      <th className="py-3.5 px-6">Client / Owner</th>
                      <th className="py-3.5 px-6">Package</th>
                      <th className="py-3.5 px-6">Operational Manager</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                    {clients.filter(c => c.status !== 'Archived').map((client) => {
                      const logoInitials = client.companyName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase() || 'CL';

                      return (
                        <tr key={client.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-100/50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {client.logoUrl ? (
                                <img
                                  src={client.logoUrl}
                                  alt={client.companyName}
                                  className="w-8 h-8 rounded-xl object-contain border border-gray-200 dark:border-dark-border p-0.5 bg-white"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0">
                                  {logoInitials}
                                </div>
                              )}
                              <div className="font-bold text-gray-900 dark:text-gray-100">
                                {client.companyName}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-700 dark:text-gray-300 font-medium">
                            {client.clientName}
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                              {client.package}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-700 dark:text-gray-300">
                            {client.operationalManagerName || 'Executive Manager'}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              client.status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : client.status === 'Onboarding'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}>
                              {client.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleOpenClientWorkspace(client)}
                              className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-100 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-200 font-bold transition-colors"
                            >
                              Workspace
                            </button>
                            {profile?.role === 'owner' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClientToArchive(client);
                                  setArchiveReason('');
                                  setArchiveError(null);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-bold transition-colors border border-amber-200 dark:border-amber-800"
                              >
                                Archive
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Archive Client Modal */}
            {clientToArchive && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        Archive Client: {clientToArchive.companyName}
                      </h3>
                      <p className="text-xs text-gray-400">
                        Mandatory reason required for recoverable archiving.
                      </p>
                    </div>
                  </div>

                  {archiveError && (
                    <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold">
                      {archiveError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Reason for Archiving <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      placeholder="e.g. Contract completed, business offboarding..."
                      className="w-full p-3 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setClientToArchive(null)}
                      disabled={isArchiving}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleArchiveClient}
                      disabled={isArchiving || !archiveReason.trim()}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md disabled:opacity-50"
                    >
                      {isArchiving ? 'Archiving...' : 'Confirm Archive'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'archive' && <ArchiveCenterView />}

        {activeTab === 'audit' && <AuditLogView />}
      </div>
    </div>
  );
};