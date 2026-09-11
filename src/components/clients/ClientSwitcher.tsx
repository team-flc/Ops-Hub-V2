import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, ChevronDown, ChevronUp, Search, 
  Plus, Copy, AlertCircle, RefreshCw, Loader2, X, Link2
} from 'lucide-react';
import { ClientRecord } from '../../types';
import { useSignedUrl } from '../../lib/storageService';
import { ClientLinkSharingModal } from '../portal/ClientLinkSharingModal';

interface ClientSwitcherProps {
  clients: ClientRecord[];
  selectedClient: ClientRecord | null;
  currentUserRole?: string;
  isLoading?: boolean;
  fetchError?: string | null;
  onRetry?: () => void;
  onSelectClient: (client: ClientRecord) => void;
  onOpenCreateModal: () => void;
  onOpenDuplicateModal: (client: ClientRecord) => void;
}

const PACKAGE_BADGE_STYLES: Record<string, string> = {
  Basic: 'bg-slate-100 text-slate-700 dark:bg-dark-100 dark:text-slate-300 border-slate-200 dark:border-dark-border',
  Intermediate: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Advanced: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
};

const ClientLogoAvatar: React.FC<{
  logoUrl?: string | null;
  companyName: string;
  sizeClass?: string;
  isSelected?: boolean;
}> = ({
  logoUrl,
  companyName,
  sizeClass = 'w-8 h-8 rounded-xl',
  isSelected = false
}) => {
  const displayUrl = useSignedUrl('client-logos', logoUrl);
  const initials = companyName
    ? companyName.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()
    : 'CL';

  if (displayUrl) {
    return (
      <img
        src={displayUrl}
        alt={companyName}
        className={`${sizeClass} object-contain border border-gray-200 dark:border-dark-border p-0.5 bg-white flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${
        isSelected
          ? 'bg-brand-500 text-white shadow-sm'
          : 'bg-slate-700 dark:bg-slate-600 text-white shadow-sm'
      } font-black text-xs flex items-center justify-center flex-shrink-0`}
    >
      {initials}
    </div>
  );
};

export const ClientSwitcher: React.FC<ClientSwitcherProps> = ({
  clients,
  selectedClient,
  currentUserRole,
  isLoading = false,
  fetchError = null,
  onRetry,
  onSelectClient,
  onOpenCreateModal,
  onOpenDuplicateModal
}) => {
  const isManagerOrOwner = currentUserRole ? (currentUserRole === 'owner' || currentUserRole === 'operational_manager') : true;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sharingClient, setSharingClient] = useState<ClientRecord | null>(null);
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
          <ClientLogoAvatar
            logoUrl={selectedClient?.logoUrl}
            companyName={selectedClient?.companyName || 'FL'}
            sizeClass="w-8 h-8 rounded-xl"
          />

          <div className="min-w-0 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 block truncate">
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

      {/* Popover Dropdown (Desktop) / Mobile Bottom Sheet (Mobile) */}
      {isOpen && (
        <>
          {/* Mobile Sheet Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 sm:hidden animate-fade-in"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:absolute sm:left-0 sm:top-full sm:mt-2 w-full sm:w-[360px] max-h-[85dvh] sm:max-h-none bg-white dark:bg-dark-card rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border z-50 overflow-hidden flex flex-col animate-scale-up pb-safe sm:pb-0">
            {/* Sheet Handle for Mobile */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-dark-border" />
            </div>

            {/* Popover Header */}
            <div className="p-3.5 sm:p-3 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Switch Client
              </span>
              <div className="flex items-center gap-2">
                {!isLoading && !fetchError && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    {clients.length} Total
                  </span>
                )}
                {/* Mobile Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 touch-target flex items-center justify-center"
                  aria-label="Close client switcher"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
                    className="w-full pl-8 pr-3 py-2 sm:py-1.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
              </div>
            )}

            {/* Body Content with 4 Distinct States */}
            <div className="max-h-60 sm:max-h-64 overflow-y-auto p-2 sm:p-1.5 space-y-1">
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
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 hover:bg-gray-100 dark:bg-dark-200 dark:hover:bg-dark-100 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors min-h-[44px]"
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
                        className={`w-full flex items-center justify-between p-2.5 sm:p-2 rounded-xl text-left transition-all cursor-pointer group min-h-[48px] ${
                          isSelected
                            ? 'bg-brand-500/10 border border-brand-500/30'
                            : 'hover:bg-gray-100 dark:hover:bg-dark-100 border border-transparent'
                        }`}
                      >
                        {/* Left: Logo/Initials + Company Name + Client Name + Status */}
                        <div className="flex items-start gap-2.5 min-w-0 pr-2 flex-1">
                          <ClientLogoAvatar
                            logoUrl={client.logoUrl}
                            companyName={client.companyName}
                            sizeClass="w-8 h-8 sm:w-7 sm:h-7 rounded-lg mt-0.5"
                            isSelected={isSelected}
                          />
                          <div className="min-w-0 flex-1">
                            <span className={`text-xs font-bold truncate block ${
                              isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'
                            }`}>
                              {client.companyName}
                            </span>
                            {client.clientName && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate block mt-0.5">
                                {client.clientName}
                              </span>
                            )}
                            <div className="mt-1 flex items-center">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center ${
                                client.status === 'Active'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : client.status === 'Onboarding'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                  : client.status === 'Paused'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}>
                                {client.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Small Duplicate & Link Icons + Package Label */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isManagerOrOwner && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsOpen(false);
                                  setSharingClient(client);
                                }}
                                className="p-2 sm:p-1 rounded-md text-gray-400 hover:text-brand-600 hover:bg-brand-500/10 transition-colors touch-target sm:touch-auto flex items-center justify-center"
                                title={`Client Portal Link & Access: ${client.companyName}`}
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsOpen(false);
                                  onOpenDuplicateModal(client);
                                }}
                                className="p-2 sm:p-1 rounded-md text-gray-400 hover:text-brand-600 hover:bg-brand-500/10 transition-colors touch-target sm:touch-auto flex items-center justify-center"
                                title={`Duplicate Client: ${client.companyName}`}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

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
            <div className="p-3 sm:p-2 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-300/30">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateModal();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all min-h-[44px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Client</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Client Link Sharing & Recipient Governance Modal */}
      {sharingClient && (
        <ClientLinkSharingModal
          isOpen={Boolean(sharingClient)}
          onClose={() => setSharingClient(null)}
          clientId={sharingClient.id}
          clientName={sharingClient.clientName}
          companyName={sharingClient.companyName}
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  );
};
