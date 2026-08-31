import React, { useState, useEffect } from 'react';
import { 
  Building2, User, Package, Calendar, Activity, 
  Link2, Check, AlertCircle, Save, Loader2 
} from 'lucide-react';
import { 
  ClientRecord, 
  ClientPackage, 
  ClientStatus, 
  ClientPauseReason, 
  ClientLinkType, 
  UserProfile 
} from '../../types';
import { clientManagementService, sanitizeUrl } from '../../lib/clientManagementService';

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

  // Links
  const [driveUrl, setDriveUrl] = useState(client.links?.google_drive || '');
  const [facebookUrl, setFacebookUrl] = useState(client.links?.facebook || '');
  const [instagramUrl, setInstagramUrl] = useState(client.links?.instagram || '');
  const [slackUrl, setSlackUrl] = useState(client.links?.slack_channel || '');
  const [whatsappUrl, setWhatsappUrl] = useState(client.links?.whatsapp_group || '');

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
    setDriveUrl(client.links?.google_drive || '');
    setFacebookUrl(client.links?.facebook || '');
    setInstagramUrl(client.links?.instagram || '');
    setSlackUrl(client.links?.slack_channel || '');
    setWhatsappUrl(client.links?.whatsapp_group || '');
  }, [client]);

  const isTeamMember = currentUserProfile?.role === 'team_member';

  const handleSave = async (e: React.FormEvent) => {
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
      google_drive: driveUrl,
      facebook: facebookUrl,
      instagram: instagramUrl,
      slack_channel: slackUrl,
      whatsapp_group: whatsappUrl
    };

    for (const [key, raw] of Object.entries(rawLinks)) {
      if (raw && raw.trim()) {
        const sanitized = sanitizeUrl(raw);
        if (!sanitized) {
          setErrorMsg(`Invalid URL for ${key.replace('_', ' ')}. Only http:// and https:// URLs are allowed.`);
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
          links: rawLinks
        },
        currentUserProfile?.id
      );

      if (result.error || !result.data) {
        setErrorMsg(result.error || 'Failed to update client details.');
        setIsSaving(false);
        return;
      }

      setSuccessMsg('Client details updated successfully.');
      onClientUpdated(result.data);
      setIsSaving(false);

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <form onSubmit={handleSave} className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-6 shadow-sm space-y-6">
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

        {/* Section 1: Core Client Information */}
        <div className="space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>Account Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Client / Owner Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Service Package <span className="text-rose-500">*</span>
              </label>
              <select
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
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Operational Manager <span className="text-rose-500">*</span>
              </label>
              <select
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
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Activation Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={activationDate}
                onChange={(e) => setActivationDate(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Lifecycle Status <span className="text-rose-500">*</span>
              </label>
              <select
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
          </div>

          {status === 'Paused' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 animate-fade-in">
              <label className="block text-xs font-bold text-amber-700 dark:text-amber-300">
                Pause Reason <span className="text-rose-500">*</span>
              </label>
              <select
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

        {/* Section 2: Workspace & Communication Links */}
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-dark-border">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            <span>Workspace & Communication Channels</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Google Drive Folder URL
              </label>
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Facebook Page URL
                </label>
                <input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instagram Page URL
                </label>
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Slack Channel URL
                </label>
                <input
                  type="url"
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                  placeholder="https://app.slack.com/client/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  WhatsApp Group URL
                </label>
                <input
                  type="url"
                  value={whatsappUrl}
                  onChange={(e) => setWhatsappUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
