import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, ChevronDown, ChevronUp, Search, 
  Plus, Copy, Check, AlertCircle, RefreshCw, Loader2 
} from 'lucide-react';
import { ClientRecord } from '../../types';

interface ClientSwitcherProps {
  clients: ClientRecord[];
  selectedClient: ClientRecord | null;
  isLoading?: boolean;
  fetchError?: string | null;
  onRetry?: () => void;
  onSelectClient: (client: ClientRecord) => void;
  onOpenCreateModal: () => void;
  onOpenDuplicateModal: (client: ClientRecord) => void;
}

const PACKAGE_BADGE_STYLES: Record<string, string> = {
  Basic: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Intermediate: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  Advanced: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
};

export const ClientSwitcher: React.FC<ClientSwitcherProps> = ({
  clients,
  selectedClient,
  isLoading = false,
  fetchError = null,
  onRetry,
  onSelectClient,
  onOpenCreateModal,
  onOpenDuplicateModal
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.companyName.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q) ||
      c.package.toLowerCase().includes(q)
    );
  });

  const getClientInitials = (name: string) => {
    if (!name) return 'CL';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="relative w-full" ref={popoverRef}>
      {/* Collapsed GoHighLevel-Style Client Switcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Switch Client Workspace"
        className="w-full flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-dark-card/80 hover:bg-gray-100 dark:hover:bg-dark-100 border border-gray-200 dark:border-dark-border transition-all text-left group"
        title="Switch Client Workspace"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-brand-500 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
            {selectedClient ? getClientInitials(selectedClient.companyName) : <Building2 className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block leading-tight">
              Client Workspace
            </span>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate block">
              {selectedClient ? selectedClient.companyName : (isLoading ? 'Loading...' : 'Select Client...')}
            </span>
          </div>
        </div>

        <div className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors ml-1 flex-shrink-0">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border z-50 overflow-hidden animate-scale-up">
          {/* Popover Header */}
          <div className="p-3 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Switch Client
            </span>
            {!isLoading && !fetchError && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
                {clients.length} Total
              </span>
            )}
          </div>

          {/* Search Bar - only when not errored and clients exist */}
          {!fetchError && clients.length > 0 && (
            <div className="p-2.5 border-b border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-300/30">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clients..."
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
          )}

          {/* Body Content with 4 Distinct States */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
            {/* State 1: Loading */}
            {isLoading && (
              <div className="p-6 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                <span>Loading clients...</span>
              </div>
            )}

            {/* State 2: Error State (Not disguised as empty list) */}
            {!isLoading && fetchError && (
              <div className="p-4 space-y-3">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold">Unable to load clients</p>
                    <p className="text-[11px] opacity-90 truncate">{fetchError}</p>
                  </div>
                </div>

                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 hover:bg-gray-100 dark:bg-dark-200 dark:hover:bg-dark-100 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}

            {/* State 3: Empty State (Successful query with 0 clients) */}
            {!isLoading && !fetchError && clients.length === 0 && (
              <div className="p-6 text-center text-xs text-gray-400">
                <Building2 className="w-6 h-6 mx-auto mb-1 text-gray-300 dark:text-gray-600" />
                <span>No accessible clients found</span>
              </div>
            )}

            {/* State 4: Loaded List (Filtered) */}
            {!isLoading && !fetchError && clients.length > 0 && (
              filteredClients.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No matching clients found.
                </div>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = selectedClient?.id === client.id;
                  const badgeStyle = PACKAGE_BADGE_STYLES[client.package] || PACKAGE_BADGE_STYLES.Basic;

                  return (
                    <div
                      key={client.id}
                      onClick={() => {
                        onSelectClient(client);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-brand-500/10 border border-brand-500/30'
                          : 'hover:bg-gray-100 dark:hover:bg-dark-100 border border-transparent'
                      }`}
                    >
                      {/* Left: Initials + Company Name */}
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-brand-500 text-white shadow-sm'
                            : 'bg-gray-200 dark:bg-dark-200 text-gray-700 dark:text-gray-300'
                        }`}>
                          {getClientInitials(client.companyName)}
                        </div>
                        <div className="min-w-0">
                          <span className={`text-xs font-bold truncate block ${
                            isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {client.companyName}
                          </span>
                          <span className="text-[10px] text-gray-400 truncate block">
                            {client.clientName}
                          </span>
                        </div>
                      </div>

                      {/* Right: Small Duplicate Icon + Package Label */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onOpenDuplicateModal(client);
                          }}
                          className="p-1 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-500/10 transition-colors"
                          title={`Duplicate Client: ${client.companyName}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                          {client.package}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>

          {/* Bottom Footer: Single Create Client Button */}
          <div className="p-2 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-300/30">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCreateModal();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Client</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
