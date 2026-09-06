import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Filter, Calendar, User, Building2, 
  Eye, RefreshCw, X, Shield, Activity, Loader2, AlertCircle 
} from 'lucide-react';
import { SystemAuditEvent } from '../../types';
import { auditService } from '../../lib/auditService';
import { useAuth } from '../../context/AuthContext';

export const AuditLogView: React.FC = () => {
  const { profile } = useAuth();
  const [events, setEvents] = useState<SystemAuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchAction, setSearchAction] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<SystemAuditEvent | null>(null);

  const loadAuditEvents = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const res = await auditService.fetchAuditEvents({
      action: searchAction || undefined,
      entityType: selectedEntityType || undefined
    });
    setIsLoading(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setEvents(res.data);
    }
  };

  useEffect(() => {
    loadAuditEvents();

    // Subscribe to realtime audit event stream
    const unsubscribe = auditService.subscribeToAuditStream((newEvent) => {
      setEvents((prev) => [newEvent, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedEntityType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAuditEvents();
  };

  const formatActionName = (action: string) => {
    return action
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase">
              System Audit
            </span>
            <span className="text-xs text-gray-400 font-bold">• Append-Only Immutability</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-indigo-500" />
            <span>Global Audit Log</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl">
            Real-time, immutable audit trail of all governance and operational mutations across clients, staff, tasks, and settings.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAuditEvents}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-dark-100 dark:hover:bg-dark-200 border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-200 text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-500' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchAction}
              onChange={(e) => setSearchAction(e.target.value)}
              placeholder="Filter by action keyword (e.g. client_created, task_assigned)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
            />
          </div>

          <select
            value={selectedEntityType}
            onChange={(e) => setSelectedEntityType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 outline-none font-medium"
          >
            <option value="">All Entity Types</option>
            <option value="client">Clients</option>
            <option value="team_member">Team Members</option>
            <option value="task">Tasks</option>
            <option value="profile">Profiles</option>
            <option value="linkedin_profile">LinkedIn Profiles</option>
          </select>
        </div>

        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-colors"
        >
          Search
        </button>
      </form>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <span className="text-xs text-gray-400 font-semibold">Loading audit events...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-dark-100 text-gray-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No Audit Events Found
            </h3>
            <p className="text-xs text-gray-400 max-w-sm">
              System mutations will automatically stream here in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/50 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                  <th className="py-3.5 px-6">Timestamp</th>
                  <th className="py-3.5 px-6">Actor</th>
                  <th className="py-3.5 px-6">Action</th>
                  <th className="py-3.5 px-6">Entity</th>
                  <th className="py-3.5 px-6">Client Scope</th>
                  <th className="py-3.5 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-100/50 transition-colors">
                    <td className="py-4 px-6 font-mono text-gray-500 whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900 dark:text-gray-100">{evt.actorName || 'System'}</div>
                      <div className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">{evt.actorRole || 'system'}</div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-gray-800 dark:text-gray-200">
                      <span className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-[11px] font-bold">
                        {formatActionName(evt.action)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-700 dark:text-gray-300">
                      <div className="font-bold">{evt.entityName || evt.entityId}</div>
                      <div className="text-[10px] text-gray-400 capitalize">{evt.entityType}</div>
                    </td>
                    <td className="py-4 px-6 text-gray-600 dark:text-gray-300">
                      {evt.clientName || 'Global / Staff'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(evt)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-100 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-200 font-bold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-brand-500" />
                  <span>Audit Event Details</span>
                </h3>
                <span className="text-[11px] font-mono text-gray-400">{selectedEvent.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border">
                <div>
                  <span className="text-gray-400 font-bold text-[10px] uppercase">Actor</span>
                  <div className="font-bold text-gray-900 dark:text-gray-100">{selectedEvent.actorName} ({selectedEvent.actorRole})</div>
                </div>
                <div>
                  <span className="text-gray-400 font-bold text-[10px] uppercase">Timestamp</span>
                  <div className="font-mono text-gray-700 dark:text-gray-300">{new Date(selectedEvent.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-gray-400 font-bold text-[10px] uppercase">Action</span>
                  <div className="font-bold text-brand-600 dark:text-brand-400">{formatActionName(selectedEvent.action)}</div>
                </div>
                <div>
                  <span className="text-gray-400 font-bold text-[10px] uppercase">Entity</span>
                  <div className="font-bold text-gray-800 dark:text-gray-200">{selectedEvent.entityName || selectedEvent.entityId}</div>
                </div>
              </div>

              {selectedEvent.reason && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-amber-800 dark:text-amber-300">
                  <span className="font-bold text-[10px] uppercase block mb-0.5">Stated Reason</span>
                  <p className="italic">{selectedEvent.reason}</p>
                </div>
              )}

              {/* State Diff */}
              {(selectedEvent.previousState || selectedEvent.newState) && (
                <div className="space-y-2">
                  <span className="font-bold text-gray-700 dark:text-gray-300">Sanitized State Mutation</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 font-mono text-[11px] overflow-x-auto">
                      <span className="text-rose-600 dark:text-rose-400 font-bold block mb-1">Previous State</span>
                      <pre>{JSON.stringify(selectedEvent.previousState || {}, null, 2)}</pre>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 font-mono text-[11px] overflow-x-auto">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold block mb-1">New State</span>
                      <pre>{JSON.stringify(selectedEvent.newState || {}, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-dark-border flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-100 text-gray-800 dark:text-gray-200 text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};