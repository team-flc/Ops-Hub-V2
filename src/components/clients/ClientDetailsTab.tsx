import React, { useState, useEffect } from 'react';
import { 
  Building2, User, Package, Calendar, Activity, 
  Link2, Check, AlertCircle, Save, Loader2, Plus, 
  Trash2, Globe, ShieldCheck, ExternalLink, RefreshCw 
} from 'lucide-react';

const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.762-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);
import { 
  ClientRecord, 
  ClientPackage, 
  ClientStatus, 
  ClientPauseReason, 
  ClientLinkType, 
  UserProfile,
  ClientLinkedInProfile 
} from '../../types';
import { 
  clientManagementService, 
  sanitizeUrl, 
  isValidLinkedInUrl, 
  calculateLinkedInReadiness,
  LinkedInProfileInput 
} from '../../lib/clientManagementService';

interface ClientDetailsTabProps {
  client: ClientRecord;
  currentUserProfile?: UserProfile | null;
  eligibleManagers: UserProfile[];
  onClientUpdated: (updated: ClientRecord) => void;
}

const PACKAGES: ClientPackage[] = ['Basic', 'Intermediate', 'Advanced'];
const STATUSES: ClientStatus[] = ['Onboarding', 'Active', 'Paused', 'Archived'];
const PAUSE_REASONS: ClientPauseReason[] = [
  'Payment overdue',
  'Client request',
  'Operational reason',
  'Other'
];

export const ClientDetailsTab: React.FC<ClientDetailsTabProps> = ({
  client,
  currentUserProfile,
  eligibleManagers,
  onClientUpdated
}) => {
  const [companyName, setCompanyName] = useState(client.companyName);
  const [clientName, setClientName] = useState(client.clientName);
  const [pkg, setPkg] = useState<ClientPackage>(client.package);
  const [managerId, setManagerId] = useState(client.operationalManagerId);
  const [activationDate, setActivationDate] = useState(client.activationDate);
  const [status, setStatus] = useState<ClientStatus>(client.status);
  const [pauseReason, setPauseReason] = useState<ClientPauseReason>(
    client.pauseReason || 'Operational reason'
  );
  const [requiredLinkedInCount, setRequiredLinkedInCount] = useState<number>(
    client.requiredLinkedinProfileCount || 3
  );

  // Links
  const [websiteUrl, setWebsiteUrl] = useState(client.links?.website || '');
  const [driveUrl, setDriveUrl] = useState(client.links?.google_drive || '');
  const [facebookUrl, setFacebookUrl] = useState(client.links?.facebook || '');
  const [instagramUrl, setInstagramUrl] = useState(client.links?.instagram || '');
  const [linkedinPageUrl, setLinkedinPageUrl] = useState(client.links?.linkedin_company_page || '');
  const [slackUrl, setSlackUrl] = useState(client.links?.slack_channel || '');
  const [whatsappUrl, setWhatsappUrl] = useState(client.links?.whatsapp_group || '');

  // Dynamic LinkedIn Profiles State
  const [profiles, setProfiles] = useState<ClientLinkedInProfile[]>(
    client.linkedinProfiles || []
  );

  // New Profile Form Drawer/Row State
  const [newProfileLabel, setNewProfileLabel] = useState('');
  const [newProfileUrl, setNewProfileUrl] = useState('');
  const [newSalesNavActive, setNewSalesNavActive] = useState(false);
  const [newSalesNavDate, setNewSalesNavDate] = useState('');
  const [isAddingProfile, setIsAddingProfile] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setCompanyName(client.companyName);
    setClientName(client.clientName);
    setPkg(client.package);
    setManagerId(client.operationalManagerId);
    setActivationDate(client.activationDate);
    setStatus(client.status);
    setPauseReason(client.pauseReason || 'Operational reason');
    setRequiredLinkedInCount(client.requiredLinkedinProfileCount || 3);
    setWebsiteUrl(client.links?.website || '');
    setDriveUrl(client.links?.google_drive || '');
    setFacebookUrl(client.links?.facebook || '');
    setInstagramUrl(client.links?.instagram || '');
    setLinkedinPageUrl(client.links?.linkedin_company_page || '');
    setSlackUrl(client.links?.slack_channel || '');
    setWhatsappUrl(client.links?.whatsapp_group || '');
    setProfiles(client.linkedinProfiles || []);
  }, [client]);

  const isTeamMember = currentUserProfile?.role === 'team_member';
  const readiness = calculateLinkedInReadiness(requiredLinkedInCount, profiles);

  // Save Core Client Details and Workspace Links
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!companyName.trim()) {
      setErrorMsg('Company Name is required.');
      return;
    }
    if (!clientName.trim()) {
      setErrorMsg('Client/Owner Name is required.');
      return;
    }

    const rawLinks: Partial<Record<ClientLinkType, string>> = {
      website: websiteUrl,
      google_drive: driveUrl,
      facebook: facebookUrl,
      instagram: instagramUrl,
      linkedin_company_page: linkedinPageUrl,
      slack_channel: slackUrl,
      whatsapp_group: whatsappUrl
    };

    for (const [key, raw] of Object.entries(rawLinks)) {
      if (raw && raw.trim()) {
        const sanitized = sanitizeUrl(raw);
        if (!sanitized) {
          setErrorMsg(`Invalid URL for ${key.replace(/_/g, ' ')}. Only http:// and https:// URLs are allowed.`);
          return;
        }
      }
    }

    setIsSaving(true);

    try {
      const result = await clientManagementService.updateClient(
        client.id,
        {
          companyName: companyName.trim(),
          clientName: clientName.trim(),
          package: pkg,
          operationalManagerId: managerId,
          activationDate,
          status,
          pauseReason: status === 'Paused' ? pauseReason : null,
          requiredLinkedinProfileCount: Math.max(1, requiredLinkedInCount),
          links: rawLinks
        },
        currentUserProfile?.id
      );

      if (result.error || !result.data) {
        setErrorMsg(result.error || 'Failed to update client details.');
        setIsSaving(false);
        return;
      }

      setSuccessMsg('Client configuration updated successfully.');
      onClientUpdated(result.data);
      setIsSaving(false);

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setIsSaving(false);
    }
  };

  // Add a new LinkedIn Profile
  const handleAddNewProfile = async () => {
    setErrorMsg(null);

    if (!newProfileUrl.trim()) {
      setErrorMsg('LinkedIn Profile URL is required.');
      return;
    }

    const cleanUrl = sanitizeUrl(newProfileUrl);
    if (!cleanUrl || !isValidLinkedInUrl(cleanUrl)) {
      setErrorMsg('Invalid LinkedIn Profile URL. Must be a valid http/https LinkedIn URL.');
      return;
    }

    if (newSalesNavActive && !newSalesNavDate) {
      setErrorMsg('Sales Navigator Activation Date is required when Sales Navigator is active.');
      return;
    }

    setIsAddingProfile(true);

    try {
      const res = await clientManagementService.addLinkedInProfile(
        client.id,
        {
          profileLabel: newProfileLabel.trim() || `LinkedIn ID ${profiles.length + 1}`,
          profileUrl: cleanUrl,
          salesNavigatorActive: newSalesNavActive,
          salesNavigatorActivatedOn: newSalesNavActive ? newSalesNavDate : null,
          sortOrder: profiles.length
        },
        currentUserProfile?.id
      );

      if (res.error || !res.data) {
        setErrorMsg(res.error || 'Failed to add LinkedIn profile.');
        setIsAddingProfile(false);
        return;
      }

      const updatedProfiles = [...profiles, res.data];
      setProfiles(updatedProfiles);
      onClientUpdated({
        ...client,
        linkedinProfiles: updatedProfiles
      });

      setNewProfileLabel('');
      setNewProfileUrl('');
      setNewSalesNavActive(false);
      setNewSalesNavDate('');
      setIsAddingProfile(false);
      setSuccessMsg('LinkedIn profile added successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error adding profile.');
      setIsAddingProfile(false);
    }
  };

  // Toggle or update existing LinkedIn profile
  const handleUpdateProfile = async (profileId: string, updates: Partial<LinkedInProfileInput>) => {
    try {
      const res = await clientManagementService.updateLinkedInProfile(
        profileId,
        updates,
        currentUserProfile?.id
      );

      if (res.data) {
        const updatedProfiles = profiles.map((p) => (p.id === profileId ? res.data! : p));
        setProfiles(updatedProfiles);
        onClientUpdated({
          ...client,
          linkedinProfiles: updatedProfiles
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update LinkedIn profile.');
    }
  };

  // Archive LinkedIn profile
  const handleArchiveProfile = async (profileId: string) => {
    try {
      const res = await clientManagementService.archiveLinkedInProfile(
        profileId,
        currentUserProfile?.id
      );
      if (res.success) {
        const updatedProfiles = profiles.filter((p) => p.id !== profileId);
        setProfiles(updatedProfiles);
        onClientUpdated({
          ...client,
          linkedinProfiles: updatedProfiles
        });
        setSuccessMsg('Profile archived.');
        setTimeout(() => setSuccessMsg(null), 2000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to archive profile.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pb-16">
      {/* Alert Notices */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Core Information & Communication Channels Form */}
      <form onSubmit={handleSaveDetails} className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Client Details & Configuration
            </h3>
            <p className="text-xs text-gray-500">
              Manage client workspace information, assigned managers, and communication channels.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>

        {/* Section 1: Core Client Information */}
        <div className="space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>Account Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="detail-company-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="detail-company-name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="detail-client-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Client / Owner Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="detail-client-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="detail-package" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Service Package <span className="text-rose-500">*</span>
              </label>
              <select
                id="detail-package"
                value={pkg}
                onChange={(e) => setPkg(e.target.value as ClientPackage)}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              >
                {PACKAGES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="detail-manager" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Operational Manager <span className="text-rose-500">*</span>
              </label>
              <select
                id="detail-manager"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              >
                {eligibleManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.role === 'owner' ? 'Owner' : 'Operational Manager'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="detail-activation-date" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Activation Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="detail-activation-date"
                type="date"
                value={activationDate}
                onChange={(e) => setActivationDate(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="detail-status" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Lifecycle Status <span className="text-rose-500">*</span>
              </label>
              <select
                id="detail-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Required LinkedIn Count */}
            <div>
              <label htmlFor="detail-req-count" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Required LinkedIn Profiles Count <span className="text-rose-500">*</span>
              </label>
              <input
                id="detail-req-count"
                type="number"
                min="1"
                max="20"
                value={requiredLinkedInCount}
                onChange={(e) => setRequiredLinkedInCount(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              />
            </div>
          </div>

          {status === 'Paused' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 animate-fade-in">
              <label htmlFor="detail-pause-reason" className="block text-xs font-bold text-amber-700 dark:text-amber-300">
                Pause Reason <span className="text-rose-500">*</span>
              </label>
              <select
                id="detail-pause-reason"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value as ClientPauseReason)}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700/50 bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none disabled:opacity-60"
              >
                {PAUSE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section 2: Expanded Workspace & Communication Links */}
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-dark-border">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            <span>Workspace & Communication Channels</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-website" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website / Landing Page URL
              </label>
              <input
                id="edit-website"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://clientwebsite.com"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div>
              <label htmlFor="edit-linkedin-page" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                LinkedIn Company Page URL
              </label>
              <input
                id="edit-linkedin-page"
                type="url"
                value={linkedinPageUrl}
                onChange={(e) => setLinkedinPageUrl(e.target.value)}
                placeholder="https://linkedin.com/company/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div>
              <label htmlFor="edit-drive" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Google Drive Folder URL
              </label>
              <input
                id="edit-drive"
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div>
              <label htmlFor="edit-facebook" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Facebook Page URL
              </label>
              <input
                id="edit-facebook"
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div>
              <label htmlFor="edit-instagram" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Instagram Page URL
              </label>
              <input
                id="edit-instagram"
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div>
              <label htmlFor="edit-slack" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slack Channel URL
              </label>
              <input
                id="edit-slack"
                type="url"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://app.slack.com/client/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="edit-whatsapp" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                WhatsApp Group URL
              </label>
              <input
                id="edit-whatsapp"
                type="url"
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>
        </div>
      </form>

      {/* 2. Dynamic LinkedIn Lead Generation Profiles Section */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
          <div>
            <div className="flex items-center gap-2">
              <LinkedInIcon className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                LinkedIn Lead Generation Profiles
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Track client LinkedIn sender accounts, Sales Navigator subscriptions, and activation timelines.
            </p>
          </div>

          <div className="text-right">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              readiness.isComplete 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
            }`}>
              {readiness.statusText}
            </span>
          </div>
        </div>

        {/* List of Existing Active Profiles */}
        <div className="space-y-3">
          {profiles.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-gray-200 dark:border-dark-border text-center text-xs text-gray-400">
              No active LinkedIn profiles added yet for this client workspace.
            </div>
          ) : (
            profiles.map((p, idx) => (
              <div 
                key={p.id}
                className="p-4 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-200/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {p.profileLabel || `Profile #${idx + 1}`}
                    </span>
                    <a
                      href={p.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600 p-0.5"
                      title="Open Profile URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleArchiveProfile(p.id)}
                    className="text-gray-400 hover:text-rose-500 p-1 rounded transition-colors text-xs flex items-center gap-1"
                    title="Archive Profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={p.profileLabel}
                      onChange={(e) => handleUpdateProfile(p.id, { profileLabel: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={p.profileUrl}
                      onChange={(e) => handleUpdateProfile(p.id, { profileUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sales Navigator Active & Date */}
                <div className="pt-2 border-t border-gray-100 dark:border-dark-border/60 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.salesNavigatorActive}
                      onChange={(e) => handleUpdateProfile(p.id, { salesNavigatorActive: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Sales Navigator Active
                    </span>
                  </label>

                  {p.salesNavigatorActive && (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <span className="text-[11px] font-medium text-gray-500">Activated On:</span>
                      <input
                        type="date"
                        value={p.salesNavigatorActivatedOn || ''}
                        onChange={(e) => handleUpdateProfile(p.id, { salesNavigatorActivatedOn: e.target.value })}
                        className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add New Profile Drawer */}
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
          <div className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Add Additional LinkedIn Profile</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                Profile Label
              </label>
              <input
                type="text"
                value={newProfileLabel}
                onChange={(e) => setNewProfileLabel(e.target.value)}
                placeholder={`e.g. LinkedIn ID ${profiles.length + 1} or Sales Director`}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                LinkedIn Profile URL
              </label>
              <input
                type="url"
                value={newProfileUrl}
                onChange={(e) => setNewProfileUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newSalesNavActive}
                  onChange={(e) => {
                    setNewSalesNavActive(e.target.checked);
                    if (e.target.checked && !newSalesNavDate) {
                      setNewSalesNavDate(new Date().toISOString().split('T')[0]);
                    }
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Sales Navigator Active
                </span>
              </label>

              {newSalesNavActive && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-gray-500">Activated On:</span>
                  <input
                    type="date"
                    value={newSalesNavDate}
                    onChange={(e) => setNewSalesNavDate(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleAddNewProfile}
              disabled={isAddingProfile}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {isAddingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add Profile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
