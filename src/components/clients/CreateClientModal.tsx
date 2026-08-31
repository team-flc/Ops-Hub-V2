import React, { useState, useEffect } from 'react';
import { 
  Building2, User, Package, Calendar, Activity, 
  Link2, Check, AlertCircle, X, Loader2, Plus, 
  Trash2, Globe, ShieldCheck 
} from 'lucide-react';

const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.762-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);
import { 
  ClientPackage, 
  ClientStatus, 
  ClientPauseReason, 
  ClientLinkType, 
  UserProfile, 
  ClientRecord 
} from '../../types';
import { 
  clientManagementService, 
  sanitizeUrl, 
  isValidLinkedInUrl,
  LinkedInProfileInput 
} from '../../lib/clientManagementService';

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

interface ProfileRowState {
  id: string;
  profileLabel: string;
  profileUrl: string;
  salesNavigatorActive: boolean;
  salesNavigatorActivatedOn: string;
}

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

  // Expanded Links
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [linkedinPageUrl, setLinkedinPageUrl] = useState('');
  const [slackUrl, setSlackUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');

  // LinkedIn Lead Generation Profiles
  const [requiredCount, setRequiredCount] = useState(3);
  const [profileRows, setProfileRows] = useState<ProfileRowState[]>([
    { id: '1', profileLabel: 'LinkedIn ID 1', profileUrl: '', salesNavigatorActive: false, salesNavigatorActivatedOn: '' },
    { id: '2', profileLabel: 'LinkedIn ID 2', profileUrl: '', salesNavigatorActive: false, salesNavigatorActivatedOn: '' },
    { id: '3', profileLabel: 'LinkedIn ID 3', profileUrl: '', salesNavigatorActive: false, salesNavigatorActivatedOn: '' }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Default manager selection
  useEffect(() => {
    if (currentUserProfile?.id && (currentUserProfile.role === 'owner' || currentUserProfile.role === 'operational_manager')) {
      setManagerId(currentUserProfile.id);
    } else if (eligibleManagers.length > 0) {
      setManagerId(eligibleManagers[0].id);
    }
  }, [currentUserProfile, eligibleManagers]);

  if (!isOpen) return null;

  const handleAddProfileRow = () => {
    const nextNum = profileRows.length + 1;
    setProfileRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${nextNum}`,
        profileLabel: `LinkedIn ID ${nextNum}`,
        profileUrl: '',
        salesNavigatorActive: false,
        salesNavigatorActivatedOn: ''
      }
    ]);
  };

  const handleRemoveProfileRow = (id: string) => {
    setProfileRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleProfileChange = (id: string, field: keyof ProfileRowState, value: any) => {
    setProfileRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'salesNavigatorActive' && value && !updated.salesNavigatorActivatedOn) {
          updated.salesNavigatorActivatedOn = new Date().toISOString().split('T')[0];
        }
        return updated;
      })
    );
  };

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

    // Validate provided general URLs
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

    // Validate non-blank LinkedIn profile rows
    const nonBlankProfiles: LinkedInProfileInput[] = [];
    const seenUrls = new Set<string>();

    for (let i = 0; i < profileRows.length; i++) {
      const row = profileRows[i];
      if (row.profileUrl && row.profileUrl.trim()) {
        const cleanUrl = sanitizeUrl(row.profileUrl);
        if (!cleanUrl || !isValidLinkedInUrl(cleanUrl)) {
          setErrorMsg(`LinkedIn Profile row ${i + 1}: Must be a valid http/https LinkedIn URL.`);
          return;
        }
        const lowerUrl = cleanUrl.toLowerCase();
        if (seenUrls.has(lowerUrl)) {
          setErrorMsg(`LinkedIn Profile row ${i + 1}: Duplicate URL entered.`);
          return;
        }
        seenUrls.add(lowerUrl);

        if (row.salesNavigatorActive && !row.salesNavigatorActivatedOn) {
          setErrorMsg(`LinkedIn Profile row ${i + 1}: Sales Navigator Activation Date is required.`);
          return;
        }

        nonBlankProfiles.push({
          profileLabel: row.profileLabel.trim() || `LinkedIn ID ${i + 1}`,
          profileUrl: cleanUrl,
          salesNavigatorActive: row.salesNavigatorActive,
          salesNavigatorActivatedOn: row.salesNavigatorActive ? row.salesNavigatorActivatedOn : null,
          sortOrder: i
        });
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
          requiredLinkedinProfileCount: Math.max(1, requiredCount),
          links: rawLinks,
          linkedinProfiles: nonBlankProfiles
        },
        currentUserProfile?.id
      );

      if (result.error || !result.data) {
        setErrorMsg(result.error || 'Failed to create client.');
        setIsSubmitting(false);
        return;
      }

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
        className="relative w-full max-w-3xl bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden animate-scale-up max-h-[90vh] flex flex-col"
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
                Configure primary client details, communication channels, and LinkedIn lead generation tracking.
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
              <div>
                <label htmlFor="create-company-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label htmlFor="create-client-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Client / Owner Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-client-name"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label htmlFor="create-package" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Service Package <span className="text-rose-500">*</span>
                </label>
                <select
                  id="create-package"
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value as ClientPackage)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {PACKAGES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="create-manager" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Operational Manager <span className="text-rose-500">*</span>
                </label>
                <select
                  id="create-manager"
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

              <div>
                <label htmlFor="create-activation-date" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Activation Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-activation-date"
                  type="date"
                  value={activationDate}
                  onChange={(e) => setActivationDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label htmlFor="create-status" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Lifecycle Status <span className="text-rose-500">*</span>
                </label>
                <select
                  id="create-status"
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

            {status === 'Paused' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 animate-fade-in">
                <label htmlFor="create-pause-reason" className="block text-xs font-bold text-amber-700 dark:text-amber-300">
                  Pause Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  id="create-pause-reason"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="link-website" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Website / Landing Page URL
                </label>
                <input
                  id="link-website"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://clientwebsite.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label htmlFor="link-linkedin-page" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  LinkedIn Company Page URL
                </label>
                <input
                  id="link-linkedin-page"
                  type="url"
                  value={linkedinPageUrl}
                  onChange={(e) => setLinkedinPageUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label htmlFor="link-drive" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Google Drive Folder URL
                </label>
                <input
                  id="link-drive"
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label htmlFor="link-facebook" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Facebook Page URL
                </label>
                <input
                  id="link-facebook"
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label htmlFor="link-instagram" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instagram Page URL
                </label>
                <input
                  id="link-instagram"
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div>
                <label htmlFor="link-slack" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Slack Channel URL
                </label>
                <input
                  id="link-slack"
                  type="url"
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                  placeholder="https://app.slack.com/client/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="link-whatsapp" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  WhatsApp Group URL
                </label>
                <input
                  id="link-whatsapp"
                  type="url"
                  value={whatsappUrl}
                  onChange={(e) => setWhatsappUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
          </div>

          {/* Section 3: LinkedIn Lead Generation Profiles */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <LinkedInIcon className="w-3.5 h-3.5" />
                <span>LinkedIn Lead Generation Profiles</span>
              </div>

              {/* Required Count Customizer */}
              <div className="flex items-center gap-2">
                <label htmlFor="req-linkedin-count" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                  Required Profiles:
                </label>
                <input
                  id="req-linkedin-count"
                  type="number"
                  min="1"
                  max="20"
                  value={requiredCount}
                  onChange={(e) => setRequiredCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2.5 py-1 text-xs font-bold rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Profiles are optional during setup and can be completed later. Blank rows will be ignored.
            </p>

            {/* Profile Rows */}
            <div className="space-y-3">
              {profileRows.map((row, index) => (
                <div 
                  key={row.id} 
                  className="p-3.5 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-200/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Profile #{index + 1}
                    </span>
                    {profileRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProfileRow(row.id)}
                        className="text-gray-400 hover:text-rose-500 p-1 rounded transition-colors"
                        title="Remove Profile Slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Profile Label
                      </label>
                      <input
                        type="text"
                        value={row.profileLabel}
                        onChange={(e) => handleProfileChange(row.id, 'profileLabel', e.target.value)}
                        placeholder={`e.g. LinkedIn ID ${index + 1} or CEO Profile`}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                        LinkedIn Profile URL
                      </label>
                      <input
                        type="url"
                        value={row.profileUrl}
                        onChange={(e) => handleProfileChange(row.id, 'profileUrl', e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>

                  {/* Sales Navigator Active Toggle & Date */}
                  <div className="pt-2 border-t border-gray-100 dark:border-dark-border/60 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={row.salesNavigatorActive}
                        onChange={(e) => handleProfileChange(row.id, 'salesNavigatorActive', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Sales Navigator Active
                      </span>
                    </label>

                    {row.salesNavigatorActive && (
                      <div className="flex items-center gap-2 animate-fade-in">
                        <span className="text-[11px] font-medium text-gray-500">Activated On:</span>
                        <input
                          type="date"
                          value={row.salesNavigatorActivatedOn}
                          onChange={(e) => handleProfileChange(row.id, 'salesNavigatorActivatedOn', e.target.value)}
                          required={row.salesNavigatorActive}
                          className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddProfileRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add LinkedIn Profile</span>
            </button>
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
