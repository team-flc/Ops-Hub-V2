import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, User, AlertTriangle,
  CheckCircle2, Clock, Archive,
  X, ChevronDown, ChevronUp, Link2, Eye,
  Calendar, Edit3, Loader2, Check
} from 'lucide-react';
import { ClientRecord, ClientStatus, UserProfile } from '../../types';
import { calculateLinkedInReadiness, clientManagementService } from '../../lib/clientManagementService';
import { useAuth } from '../../context/AuthContext';
import { ClientLinkSharingModal } from '../portal/ClientLinkSharingModal';
import { useDaysSinceOnboarding, formatOnboardingDate } from '../../lib/pktDateUtils';
import { useOpsStore } from '../../store/opsStore';

const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.762-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

interface SelectedClientHeaderProps {
  client: ClientRecord;
  currentUserProfile?: UserProfile | null;
  currentUserRole?: string;
  onClientUpdated?: (updated: ClientRecord) => void;
}

// Restrained Color Palette: Brand Red, Black, White, Neutral Grayscale
const STATUS_CONFIGS: Record<ClientStatus, { label: string; style: string; icon: any }> = {
  Onboarding: {
    label: 'Onboarding',
    style: 'bg-gray-100 text-gray-800 dark:bg-dark-100 dark:text-gray-200 border-gray-300 dark:border-dark-border',
    icon: Clock
  },
  Active: {
    label: 'Active',
    style: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent',
    icon: CheckCircle2
  },
  Paused: {
    label: 'Paused',
    style: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30',
    icon: AlertTriangle
  },
  Archived: {
    label: 'Archived',
    style: 'bg-gray-100 text-gray-500 dark:bg-dark-200 dark:text-gray-400 border-gray-200 dark:border-dark-border',
    icon: Archive
  }
};

const PACKAGE_STYLES: Record<string, string> = {
  Basic: 'bg-gray-100 text-gray-700 dark:bg-dark-100 dark:text-gray-300 border-gray-300 dark:border-dark-border',
  Intermediate: 'bg-gray-100 text-gray-900 dark:bg-dark-100 dark:text-gray-100 border-gray-400 dark:border-dark-border font-extrabold',
  Advanced: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent'
};

export const SelectedClientHeader: React.FC<SelectedClientHeaderProps> = ({ 
  client,
  currentUserProfile,
  currentUserRole,
  onClientUpdated
}) => {
  const auth = useAuth();
  const profile = currentUserProfile ?? auth?.profile;
  const role = currentUserRole ?? profile?.role;
  const [isLinkedInPopoverOpen, setIsLinkedInPopoverOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isEditStartDateOpen, setIsEditStartDateOpen] = useState(false);
  const [editDateValue, setEditDateValue] = useState(client.activationDate || '');
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const isManagerOrOwner = role === 'owner' || role === 'operational_manager';
  const popoverRef = useRef<HTMLDivElement>(null);

  const onboardingInfo = useDaysSinceOnboarding(client.activationDate);

  // Sync date input with client prop
  useEffect(() => {
    setEditDateValue(client.activationDate || '');
  }, [client.activationDate]);

  // Close LinkedIn popover on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsLinkedInPopoverOpen(false);
      }
    };
    if (isLinkedInPopoverOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isLinkedInPopoverOpen]);

  const statusCfg = STATUS_CONFIGS[client.status] || STATUS_CONFIGS.Active;
  const StatusIcon = statusCfg.icon;
  const packageStyle = PACKAGE_STYLES[client.package] || PACKAGE_STYLES.Basic;

  const readiness = calculateLinkedInReadiness(
    client.requiredLinkedinProfileCount,
    client.linkedinProfiles
  );

  const activeProfiles = (client.linkedinProfiles || []).filter((p) => p.status === 'active');

  const handleSaveStartDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDateValue) {
      setDateError('Please select a valid start date.');
      return;
    }
    setIsSavingDate(true);
    setDateError(null);
    try {
      const res = await clientManagementService.updateClient(
        client.id,
        { activationDate: editDateValue },
        profile?.id
      );
      if (res.error || !res.data) {
        setDateError(res.error || 'Failed to update start date.');
      } else {
        useOpsStore.getState().updateClientRecord(res.data);
        if (onClientUpdated) {
          onClientUpdated(res.data);
        }
        setIsEditStartDateOpen(false);
      }
    } catch (err: any) {
      setDateError(err.message || 'Error updating start date.');
    } finally {
      setIsSavingDate(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
      {/* Client Identity & Badges */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-500" />
            <span>{client.companyName}</span>
          </h1>

          {/* Package Badge */}
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${packageStyle}`}>
            {client.package}
          </span>

          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusCfg.style}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            <span>
              {client.status === 'Paused' && client.pauseReason
                ? `Paused — ${client.pauseReason}`
                : statusCfg.label}
            </span>
          </div>

          {/* Days Since Onboarding Counter Badge */}
          <div
            data-testid="onboarding-days-badge"
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              onboardingInfo.isMissing
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                : onboardingInfo.isFuture
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                : 'bg-gray-100 text-gray-800 dark:bg-dark-100 dark:text-gray-200 border-gray-300 dark:border-dark-border'
            }`}
            title={
              onboardingInfo.isMissing
                ? isManagerOrOwner
                  ? 'Click to set project start date'
                  : 'Start date required (Management action needed)'
                : onboardingInfo.formattedBadge
            }
          >
            <Calendar className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
            <span>{onboardingInfo.formattedBadge}</span>
            {isManagerOrOwner && (
              <button
                type="button"
                data-testid="edit-start-date-btn"
                onClick={() => {
                  setEditDateValue(client.activationDate || '');
                  setDateError(null);
                  setIsEditStartDateOpen(true);
                }}
                className="ml-0.5 p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
                title="Edit Project Start Date"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span>Owner: <strong className="text-gray-700 dark:text-gray-300 font-semibold">{client.clientName}</strong></span>
          </div>

          <span className="text-gray-300 dark:text-gray-600">•</span>

          <div>
            <span>Manager: <strong className="text-gray-700 dark:text-gray-300 font-semibold">{client.operationalManagerName}</strong></span>
          </div>

          <span className="text-gray-300 dark:text-gray-600">•</span>

          <div className="flex items-center gap-1">
            <span>Started: <strong className="text-gray-700 dark:text-gray-300 font-semibold">{client.activationDate ? formatOnboardingDate(client.activationDate) : 'Not set'}</strong></span>
          </div>
        </div>
      </div>

      {/* Right Area: LinkedIn Readiness Tracker Popover & Quick Links */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Owner & Manager Portal Entry Points */}
        {isManagerOrOwner && (
          <>
            {/* Client Link Sharing Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsLinkModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 hover:bg-gray-100 dark:bg-dark-100 dark:hover:bg-dark-200 text-xs font-bold text-gray-800 dark:text-gray-200 transition-all shadow-xs cursor-pointer"
              title="Share Client Portal Link & Manage Authorized Recipients"
            >
              <Link2 className="w-3.5 h-3.5 text-brand-500" />
              <span>Client Link</span>
            </button>

            {/* View as Client (Read-Only Preview) */}
            <a
              href={`/portal/${client.id}?preview=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-xs font-bold transition-all shadow-xs"
              title="View Client Experience Portal in Read-Only Preview Mode"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View as Client</span>
            </a>
          </>
        )}

        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setIsLinkedInPopoverOpen(!isLinkedInPopoverOpen)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              readiness.isComplete
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent hover:opacity-90'
                : 'bg-gray-100 text-gray-800 dark:bg-dark-100 dark:text-gray-200 border-gray-300 dark:border-dark-border hover:bg-gray-200/60'
            }`}
            title="LinkedIn Profiles & Lead Generation Tracker"
          >
            <LinkedInIcon className="w-4 h-4 shrink-0" />
            <span>LinkedIn Profiles ({readiness.totalAdded}/{readiness.requiredCount})</span>
            {readiness.isComplete ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-500 text-white font-black">
                Ready
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-200 dark:bg-dark-200 text-gray-700 dark:text-gray-300 font-bold">
                Pending
              </span>
            )}
            {isLinkedInPopoverOpen ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
          </button>

          {/* LinkedIn Details Popover */}
          {isLinkedInPopoverOpen && (
            <div className="fixed inset-x-3 top-20 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full mt-2 w-auto sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border z-50 overflow-hidden animate-scale-up p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-dark-border">
                <div className="flex items-center gap-2">
                  <LinkedInIcon className="w-4 h-4 text-brand-500" />
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    LinkedIn Access Readiness
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLinkedInPopoverOpen(false)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Summary Banner */}
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                readiness.isComplete
                  ? 'bg-gray-100 dark:bg-dark-100 border-gray-300 dark:border-dark-border text-gray-800 dark:text-gray-200'
                  : 'bg-brand-500/10 border-brand-500/20 text-brand-700 dark:text-brand-300'
              }`}>
                {readiness.isComplete ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-800 dark:text-gray-200" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-500" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold">{readiness.statusText}</div>
                  <div className="text-[11px] opacity-90 font-normal">
                    {readiness.salesNavActiveCount} of {readiness.requiredCount} profiles have active Sales Navigator with activation dates.
                  </div>
                </div>
              </div>

              {/* Profile Rows List */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {activeProfiles.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No LinkedIn profiles added yet. Add profiles in the Client Details tab.
                  </p>
                ) : (
                  activeProfiles.map((p, idx) => (
                    <div 
                      key={p.id}
                      className="p-2.5 rounded-xl border border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-200/50 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-gray-800 dark:text-gray-200 truncate">
                          {p.profileLabel || `Profile #${idx + 1}`}
                        </div>
                        <a
                          href={p.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline truncate block"
                        >
                          {p.profileUrl}
                        </a>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        {p.salesNavigatorActive && p.salesNavigatorActivatedOn ? (
                          <div className="text-[10px] font-bold text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-dark-300 px-2 py-0.5 rounded-full border border-gray-300 dark:border-dark-border">
                            Nav Active ({p.salesNavigatorActivatedOn})
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-dark-300 px-2 py-0.5 rounded-full">
                            Nav Inactive
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client Link Sharing & Recipient Governance Modal */}
      {isLinkModalOpen && (
        <ClientLinkSharingModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          clientId={client.id}
          clientName={client.clientName}
          companyName={client.companyName}
          currentUserRole={role}
        />
      )}

      {/* Quick Edit Start Date Modal (Owner / Operational Manager only) */}
      {isEditStartDateOpen && isManagerOrOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border p-6 space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Update Project Start Date
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditStartDateOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Set the authoritative client onboarding start date for <strong>{client.companyName}</strong>. This date determines the active Days Since Onboarding counter in company timezone (PKT).
            </p>

            {dateError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {dateError}
              </div>
            )}

            <form onSubmit={handleSaveStartDate} className="space-y-4">
              <div>
                <label htmlFor="quick-start-date-input" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Project Start Date (Asia/Karachi)
                </label>
                <input
                  id="quick-start-date-input"
                  data-testid="quick-start-date-input"
                  type="date"
                  value={editDateValue}
                  onChange={(e) => setEditDateValue(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditStartDateOpen(false)}
                  disabled={isSavingDate}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="save-start-date-btn"
                  disabled={isSavingDate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSavingDate ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Date</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};