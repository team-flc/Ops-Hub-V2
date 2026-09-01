import React, { useState, useEffect } from 'react';
import { 
  Archive, RotateCcw, AlertTriangle, Building2, Users, 
  CheckSquare, Loader2, AlertCircle, Check, Info, ShieldAlert 
} from 'lucide-react';
import { ArchivedRecord } from '../../types';
import { archiveService } from '../../lib/archiveService';
import { useAuth } from '../../context/AuthContext';

export const ArchiveCenterView: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'client' | 'team_member' | 'task'>('client');
  const [records, setRecords] = useState<ArchivedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Restore Modal State
  const [itemToRestore, setItemToRestore] = useState<ArchivedRecord | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadArchivedRecords = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const res = await archiveService.fetchArchivedEntities(activeTab);
    setIsLoading(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setRecords(res.data);
    }
  };

  useEffect(() => {
    loadArchivedRecords();
  }, [activeTab]);

  const handleConfirmRestore = async () => {
    if (!itemToRestore) return;
    setIsRestoring(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let res: { success: boolean; error: string | null } = { success: false, error: null };

    if (itemToRestore.entityType === 'client') {
      res = await archiveService.restoreClient(itemToRestore.id);
    } else if (itemToRestore.entityType === 'team_member') {
      res = await archiveService.restoreTeamMember(itemToRestore.id);
    } else if (itemToRestore.entityType === 'task') {
      res = await archiveService.restoreTask(itemToRestore.id);
    }

    setIsRestoring(false);

    if (res.error || !res.success) {
      setErrorMessage(res.error || 'Failed to restore record.');
    } else {
      setSuccessMessage(`Successfully restored "${itemToRestore.entityName}".`);
      setItemToRestore(null);
      loadArchivedRecords();
    }
  };

  const tabs: { id: 'client' | 'team_member' | 'task'; label: string; icon: any }[] = [
    { id: 'client', label: 'Archived Clients', icon: Building2 },
    { id: 'team_member', label: 'Archived Team Members', icon: Users },
    { id: 'task', label: 'Archived Tasks', icon: CheckSquare }
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">
              System Governance
            </span>
            <span className="text-xs text-gray-400 font-bold">• Zero Permanent Delete</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2.5">
            <Archive className="w-6 h-6 text-amber-500" />
            <span>Archive Center</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl">
            Safely inspect and restore archived clients, staff members, and tasks with full audit history and dependency protection.
          </p>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-dark-border pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Records Table */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <span className="text-xs text-gray-400 font-semibold">Loading archive records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-dark-100 text-gray-400 flex items-center justify-center">
              <Archive className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No Archived {activeTab === 'client' ? 'Clients' : activeTab === 'team_member' ? 'Team Members' : 'Tasks'}
            </h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Archived items will appear here with complete reasons, metadata, and restore capabilities.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/50 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                  <th className="py-3.5 px-6">Entity Name</th>
                  {activeTab === 'task' && <th className="py-3.5 px-6">Client</th>}
                  <th className="py-3.5 px-6">Archived By</th>
                  <th className="py-3.5 px-6">Archived Date</th>
                  <th className="py-3.5 px-6">Archive Reason</th>
                  <th className="py-3.5 px-6">Previous Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-100/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-gray-900 dark:text-gray-100">
                      {r.entityName}
                    </td>
                    {activeTab === 'task' && (
                      <td className="py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">
                        {r.clientName}
                      </td>
                    )}
                    <td className="py-4 px-6 text-gray-600 dark:text-gray-300">
                      {r.archivedByName}
                    </td>
                    <td className="py-4 px-6 font-mono text-gray-500">
                      {new Date(r.archivedAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-gray-600 dark:text-gray-300 max-w-xs truncate" title={r.archiveReason}>
                      {r.archiveReason}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border">
                        {r.previousStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => setItemToRestore(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-bold transition-all border border-brand-200 dark:border-brand-800"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore Confirmation Dialog */}
      {itemToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Restore Archived {itemToRestore.entityType === 'client' ? 'Client' : itemToRestore.entityType === 'team_member' ? 'Team Member' : 'Task'}
                </h3>
                <p className="text-xs text-gray-400">
                  Confirm recovery of this record.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1 text-xs">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Record Name</span>
              <div className="font-bold text-gray-900 dark:text-gray-100">{itemToRestore.entityName}</div>
            </div>

            {itemToRestore.entityType === 'team_member' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Safety Notice:</strong> Restoring this team member will place them in <em>Suspended</em> status. An administrator must explicitly Reactivate the user to allow login.
                </span>
              </div>
            )}

            {itemToRestore.entityType === 'task' && itemToRestore.metadata?.isClientArchived && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-400 text-[11px] flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Dependency Blocker:</strong> The client "{itemToRestore.clientName}" is currently archived. You must restore the client before this task can be restored.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToRestore(null)}
                disabled={isRestoring}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring || (itemToRestore.entityType === 'task' && Boolean(itemToRestore.metadata?.isClientArchived))}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-colors disabled:opacity-50"
              >
                {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>{isRestoring ? 'Restoring...' : 'Confirm Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};