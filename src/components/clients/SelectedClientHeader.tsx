import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, User, ExternalLink, AlertTriangle,
  CheckCircle2, Clock, Archive, Globe, HardDrive,
  X, ChevronDown, ChevronUp
} from 'lucide-react';
import { ClientRecord, ClientStatus } from '../../types';
import { calculateLinkedInReadiness } from '../../lib/clientManagementService';

const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.762-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

interface SelectedClientHeaderProps {
  client: ClientRecord;
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

export const SelectedClientHeader: React.FC<SelectedClientHeaderProps> = ({ client }) => {
  const [isLinkedInPopoverOpen, setIsLinkedInPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const links = client.links || {};
  const readiness = calculateLinkedInReadiness(
    client.requiredLinkedinProfileCount,
    client.linkedinProfiles
  );

  const activeProfiles = (client.linkedinProfiles || []).filter((p) => p.status === 'active');

  const linkButtons = [
    {
      key: 'website',
      label: 'Website / Landing Page',
      url: links.website,
      icon: <Globe className="w-4 h-4" />
    },
    {
      key: 'linkedin_company_page',
      label: 'LinkedIn Company Page',
      url: links.linkedin_company_page,
      icon: <LinkedInIcon className="w-4 h-4" />
    },
    {
      key: 'google_drive',
      label: 'Google Drive Folder',
      url: links.google_drive,
      icon: <HardDrive className="w-4 h-4" />
    },
    {
      key: 'slack_channel',
      label: 'Slack Channel',
      url: links.slack_channel,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      )
    }
  ];

  const activeLinks = linkButtons.filter((b) => Boolean(b.url && b.url.trim()));

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

          <div>
            <span>Activated: <strong className="text-gray-700 dark:text-gray-300 font-semibold">{client.activationDate}</strong></span>
          </div>
        </div>
      </div>

      {/* Right Area: LinkedIn Readiness Tracker Popover & Quick Links */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {/* Quick-Access Communication & Workspace Links */}
        {activeLinks.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeLinks.map((link) => (
              <a
                key={link.key}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 p-2 px-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-card hover:bg-gray-100 dark:hover:bg-dark-100 hover:text-gray-900 dark:hover:text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title={`Open ${link.label}`}
              >
                {link.icon}
                <span className="text-xs">{link.label.split(' ')[0]}</span>
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};