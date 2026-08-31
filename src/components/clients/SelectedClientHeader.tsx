import React from 'react';
import { 
  Building2, User, HardDrive, MessageSquare, 
  MessageCircle, ExternalLink, AlertTriangle, 
  CheckCircle2, Clock, Archive 
} from 'lucide-react';
import { ClientRecord, ClientStatus } from '../../types';

interface SelectedClientHeaderProps {
  client: ClientRecord;
}

const STATUS_CONFIGS: Record<ClientStatus, { label: string; style: string; icon: any }> = {
  Onboarding: {
    label: 'Onboarding',
    style: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    icon: Clock
  },
  Active: {
    label: 'Active',
    style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: CheckCircle2
  },
  Paused: {
    label: 'Paused',
    style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: AlertTriangle
  },
  Archived: {
    label: 'Archived',
    style: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
    icon: Archive
  }
};

const PACKAGE_STYLES: Record<string, string> = {
  Basic: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Intermediate: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  Advanced: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
};

export const SelectedClientHeader: React.FC<SelectedClientHeaderProps> = ({ client }) => {
  const statusCfg = STATUS_CONFIGS[client.status] || STATUS_CONFIGS.Active;
  const StatusIcon = statusCfg.icon;
  const packageStyle = PACKAGE_STYLES[client.package] || PACKAGE_STYLES.Basic;

  const links = client.links || {};

  // Clean links definition
  const linkButtons = [
    {
      key: 'google_drive',
      label: 'Google Drive Folder',
      url: links.google_drive,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5M9.73 15L6.3 21h13.13l3.42-6M22.85 15l-6.57-11.5H9.72L16.29 15" />
        </svg>
      ),
      colorClass: 'hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30'
    },
    {
      key: 'facebook',
      label: 'Facebook Page',
      url: links.facebook,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      colorClass: 'hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/30'
    },
    {
      key: 'instagram',
      label: 'Instagram Page',
      url: links.instagram,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
      colorClass: 'hover:bg-pink-500/10 hover:text-pink-600 hover:border-pink-500/30'
    },
    {
      key: 'slack_channel',
      label: 'Slack Channel',
      url: links.slack_channel,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      ),
      colorClass: 'hover:bg-purple-500/10 hover:text-purple-600 hover:border-purple-500/30'
    },
    {
      key: 'whatsapp_group',
      label: 'WhatsApp Group',
      url: links.whatsapp_group,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.476-.15-.676.15-.2.301-.776.978-.952 1.179-.176.2-.351.226-.652.076-.301-.15-1.27-.468-2.42-1.493-.895-.798-1.5-1.784-1.676-2.085-.175-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.15-.175.201-.301.301-.501.1-.2.05-.376-.025-.526-.075-.15-.677-1.632-.927-2.235-.244-.587-.492-.507-.676-.516-.175-.008-.376-.01-.577-.01-.2 0-.526.075-.802.376-.276.301-1.052 1.028-1.052 2.508 0 1.48 1.077 2.909 1.228 3.109.15.2 2.12 3.237 5.136 4.54.717.31 1.277.496 1.713.635.72.229 1.375.197 1.893.12.577-.087 1.78-.727 2.031-1.43.25-.702.25-1.304.175-1.43-.075-.125-.276-.201-.577-.351zm-5.467 7.618a9.92 9.92 0 0 1-5.064-1.385l-.363-.216-3.766.988 1.006-3.67-.236-.375a9.92 9.92 0 0 1-1.521-5.275c0-5.496 4.471-9.967 9.97-9.967 2.664 0 5.168 1.038 7.051 2.923a9.92 9.92 0 0 1 2.918 7.045c0 5.498-4.471 9.97-9.97 9.97zm8.46-18.43A11.905 11.905 0 0 0 12.005 0C5.385 0 .005 5.38.005 12c0 2.112.551 4.174 1.597 5.987L0 24l6.19-1.624A11.942 11.942 0 0 0 12.005 24c6.623 0 12.003-5.38 12.003-12 0-3.207-1.25-6.222-3.52-8.494z" />
        </svg>
      ),
      colorClass: 'hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30'
    }
  ];

  // Filter only links that have a valid URL saved
  const activeLinks = linkButtons.filter((b) => Boolean(b.url && b.url.trim()));

  return (
    <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
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

      {/* Quick-Access Communication & Workspace Links */}
      {activeLinks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1 hidden sm:inline">
            Channels:
          </span>
          {activeLinks.map((link) => (
            <a
              key={link.key}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 p-2 px-3 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-200 text-xs font-semibold shadow-sm transition-all ${link.colorClass}`}
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
  );
};
