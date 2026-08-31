import React, { useState, useEffect } from 'react';
import { 
  Building2, User, Package, Calendar, Activity, 
  Link2, Check, AlertCircle, X, Loader2 
} from 'lucide-react';
import { 
  ClientPackage, 
  ClientStatus, 
  ClientPauseReason, 
  ClientLinkType, 
  UserProfile, 
  ClientRecord 
} from '../../types';
import { clientManagementService, sanitizeUrl } from '../../lib/clientManagementService';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newClient: ClientRecord) => void;
  currentUserProfile?: UserProfile | null;
  eligibleManagers: UserProfile[];
}

const PACKAGES: ClientPackage[] = ['Basic', 'Intermediate', 'Advanced'];
const STATUSES: ClientStatus[] = ['Onboarding', 'Active', 'Paused', 'Archived'];
const PAUSE_REASONS: ClientPauseReason[] = [
  'Payment overdue',
  'Client request',
  'Operational reason',
  'Other'
];

export const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUserProfile,
  eligibleManagers
}) => {
  const [companyName, setCompanyName] = useState('');
  const [clientName, setClientName] = useState('');
  const [pkg, setPkg] = useState<ClientPackage>('Basic');
  const [managerId, setManagerId] = useState('');
  const [activationDate, setActivationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<ClientStatus>('Onboarding');
  const [pauseReason, setPauseReason] = useState<ClientPauseReason>('Operational reason');

  // Link fields
  const [driveUrl, setDriveUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [slackUrl, setSlackUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Default manager selection to current user if manager/owner, or first available manager
  useEffect(() => {
    if (currentUserProfile?.id && (currentUserProfile.role === 'owner' || currentUserProfile.role === 'operational_manager')) {
      setManagerId(currentUserProfile.id);
    } else if (eligibleManagers.length > 0) {
      setManagerId(eligibleManagers[0].id);
    }
  }, [currentUserProfile, eligibleManagers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!companyName.trim()) {
      setErrorMsg('Company Name is required.');
      return;
    }
    if (!clientName.trim()) {
      setErrorMsg('Client/Owner Name is required.');
      return;
    }
    if (!managerId) {
      setErrorMsg('Please select an Operational Manager.');
      return;
    }

    // Validate provided URLs
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

    setIsSubmitting(true);

    try {
      const result = await clientManagementService.createClient(
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
        setErrorMsg(result.error || 'Failed to create client.');
        setIsSubmitting(false);
        return;
      }

      // Success
      setIsSubmitting(false);
      onSuccess(result.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden animate-scale-up max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-border flex items-center justify-between bg-gray-50/50 dark:bg-dark-300/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Create New Client Workspace
              </h3>
              <p className="text-xs text-gray-500">
                Configure primary client details and workspace communication channels.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Core Client Information */}
          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Client Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              {/* Client/Owner Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Client / Owner Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              {/* Package Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Service Package <span className="text-rose-500">*</span>
                </label>
                <select
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value as ClientPackage)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {PACKAGES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Operational Manager Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Operational Manager <span className="text-rose-500">*</span>
                </label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {eligibleManagers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.role === 'owner' ? 'Owner' : 'Operational Manager'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Activation Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Activation Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={activationDate}
                  onChange={(e) => setActivationDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              {/* Lifecycle Status */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Lifecycle Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ClientStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pause Reason (Conditional on Paused Status) */}
            {status === 'Paused' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 animate-fade-in">
                <label className="block text-xs font-bold text-amber-700 dark:text-amber-300">
                  Pause Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value as ClientPauseReason)}
                  className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700/50 bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
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
              <span>Workspace & Communication Channels (Optional)</span>
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

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Workspace...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Client Workspace</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
