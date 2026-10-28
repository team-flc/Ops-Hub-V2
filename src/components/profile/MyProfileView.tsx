import React, { useState, useEffect, useCallback } from 'react';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import { useAuth } from '../../context/AuthContext';
import { 
  User, Shield, Check, AlertCircle, Loader2, Camera, ArrowLeft,
  KeyRound, Copy, Download, RefreshCw, X, Eye, EyeOff, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { ROLE_DISPLAY_NAMES, EmployeeBankDetails } from '../../types';
import { profileService } from '../../lib/profileService';
import { storageService, useSignedUrl } from '../../lib/storageService';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { useOpsStore } from '../../store/opsStore';
import { twoFactorService, TwoFactorStatus } from '../../lib/twoFactorService';

export const MyProfileView: React.FC = () => {
  const navigate = useSafeNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setViewMode = useOpsStore((state) => state.setViewMode);

  // Self-editable state
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [backupPhone, setBackupPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<EmployeeBankDetails | null>(null);

  // 2FA State
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [isLoading2FA, setIsLoading2FA] = useState(false);

  // 2FA Enrollment Modal
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollStep, setEnrollStep] = useState<'verify' | 'recovery_codes'>('verify');
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qrCodeUrl: string;
    secret: string;
  } | null>(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollRecoveryCodes, setEnrollRecoveryCodes] = useState<string[]>([]);
  const [hasConfirmedCodesSaved, setHasConfirmedCodesSaved] = useState(false);
  const [isActivating2FA, setIsActivating2FA] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // 2FA Regenerate Codes Modal
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [showRegenPassword, setShowRegenPassword] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [newRegenCodes, setNewRegenCodes] = useState<string[] | null>(null);
  const [hasConfirmedNewCodes, setHasConfirmedNewCodes] = useState(false);

  // 2FA Disable Modal
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Status & Feedback
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetch2FAStatus = useCallback(async () => {
    if (!user) return;
    setIsLoading2FA(true);
    const res = await twoFactorService.get2FAStatus(user.id);
    if (res.data) {
      setTwoFactorStatus(res.data);
    }
    setIsLoading2FA(false);
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setBio(profile.bio || '');
      setLinkedinUrl(profile.linkedinUrl || '');
      setFacebookUrl(profile.facebookUrl || '');
      setInstagramUrl(profile.instagramUrl || '');
      setContactEmail(profile.contactEmail || '');
      setPhone(profile.phone || '');
      setBackupPhone(profile.backupPhone || '');
      setAvatarUrl(profile.avatarUrl || null);

      if (profile.id) {
        employeeOperationsService.fetchBankDetails(profile.id).then((b) => {
          if (b) setBankDetails(b);
        });
      }
    }
  }, [profile]);

  useEffect(() => {
    fetch2FAStatus();
  }, [fetch2FAStatus]);

  const displayName = fullName || profile?.fullName || user?.email?.split('@')[0] || 'Staff Member';
  const displayRole = profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'Team Member';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'FL';

  const [imageError, setImageError] = useState(false);
  const displayAvatarUrl = useSignedUrl('profile-avatars', avatarUrl);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl, displayAvatarUrl]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUploading(true);

    const res = await storageService.uploadAvatar(file, user.id);
    setIsUploading(false);

    if (res.error || !res.path) {
      setErrorMessage(res.error || 'Failed to upload image.');
    } else {
      setAvatarUrl(res.path);
      setSuccessMessage('Avatar uploaded successfully! Click Save Changes to apply.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    setIsSaving(true);
    const res = await profileService.updateSelfProfile({
      fullName,
      bio,
      linkedinUrl,
      facebookUrl,
      instagramUrl,
      contactEmail,
      phone,
      backupPhone,
      avatarUrl
    });
    setIsSaving(false);

    if (res.error || !res.data) {
      setErrorMessage(res.error || 'Failed to update profile.');
    } else {
      setSuccessMessage('Your profile details have been saved successfully.');
      if (refreshProfile) {
        await refreshProfile();
      }
    }
  };

  // --- 2FA Enrollment Handlers ---
  const handleStartEnroll = async () => {
    setEnrollError(null);
    setEnrollCode('');
    setHasConfirmedCodesSaved(false);
    setCopiedKey(false);
    setCopiedCodes(false);
    setIsActivating2FA(true);

    const res = await twoFactorService.enrollTOTP();
    setIsActivating2FA(false);

    if (res.error || !res.data) {
      setErrorMessage(res.error || 'Failed to start 2FA enrollment.');
      return;
    }

    // Generate 10 single-use recovery codes
    const codes = twoFactorService.generateRecoveryCodes(10);
    setEnrollRecoveryCodes(codes);
    setEnrollData({
      factorId: res.data.factorId,
      qrCodeUrl: res.data.qrCodeUrl,
      secret: res.data.secret
    });
    setEnrollStep('verify');
    setIsEnrollModalOpen(true);
  };

  const handleVerifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData || !user || isActivating2FA) return;

    if (!enrollCode || enrollCode.length !== 6) {
      setEnrollError('Please enter a valid 6-digit code from your authenticator app.');
      return;
    }

    setEnrollError(null);
    setIsActivating2FA(true);

    const res = await twoFactorService.verifyAndActivateTOTP({
      factorId: enrollData.factorId,
      code: enrollCode,
      plainRecoveryCodes: enrollRecoveryCodes,
      userId: user.id
    });

    setIsActivating2FA(false);

    if (!res.success) {
      setEnrollError(res.error || 'Verification failed. Please check your code and try again.');
      return;
    }

    // Move to recovery codes step (shown ONCE)
    setEnrollStep('recovery_codes');
  };

  const handleCompleteEnrollment = () => {
    setIsEnrollModalOpen(false);
    setEnrollData(null);
    setEnrollCode('');
    setEnrollRecoveryCodes([]);
    setHasConfirmedCodesSaved(false);
    setSuccessMessage('Two-Factor Authentication is now active on your account!');
    fetch2FAStatus();
  };

  const handleCopyCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  const handleDownloadCodes = (codes: string[]) => {
    const text = `Ops Hub Two-Factor Authentication Recovery Codes\nAccount: ${user?.email}\nGenerated: ${new Date().toISOString()}\n\nEach code can only be used once.\n\n` + codes.join('\n') + '\n';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ops-hub-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- 2FA Regenerate Codes Handlers ---
  const handleRegenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !twoFactorStatus?.factorId || isRegenerating) return;

    if (!regenPassword || !regenCode || regenCode.length !== 6) {
      setRegenError('Please enter both your password and a valid 6-digit code.');
      return;
    }

    setRegenError(null);
    setIsRegenerating(true);

    const res = await twoFactorService.regenerateRecoveryCodes({
      userId: user.id,
      email: user.email || profile?.workEmail || '',
      passwordVerify: regenPassword,
      code: regenCode,
      factorId: twoFactorStatus.factorId
    });

    setIsRegenerating(false);

    if (!res.success || !res.codes) {
      setRegenError(res.error || 'Failed to regenerate recovery codes.');
      return;
    }

    setNewRegenCodes(res.codes);
    fetch2FAStatus();
  };

  // --- 2FA Disable Handlers ---
  const handleDisableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !twoFactorStatus?.factorId || isDisabling) return;

    if (!disablePassword || !disableCode || disableCode.length !== 6) {
      setDisableError('Please enter both your password and a valid 6-digit code.');
      return;
    }

    setDisableError(null);
    setIsDisabling(true);

    const res = await twoFactorService.disable2FA({
      userId: user.id,
      email: user.email || profile?.workEmail || '',
      passwordVerify: disablePassword,
      code: disableCode,
      factorId: twoFactorStatus.factorId
    });

    setIsDisabling(false);

    if (!res.success) {
      setDisableError(res.error || 'Failed to disable 2FA. Check your credentials.');
      return;
    }

    setIsDisableModalOpen(false);
    setDisablePassword('');
    setDisableCode('');
    setSuccessMessage('Two-Factor Authentication has been disabled.');
    fetch2FAStatus();
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Top Return Action */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            navigate(selectedClientId ? `/clients/${selectedClientId}` : '/');
            setViewMode('client_workspace');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-card transition-colors shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Workspace</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Avatar Upload Container */}
        <div className="relative group">
          {displayAvatarUrl && !imageError ? (
            <img
              src={displayAvatarUrl}
              alt={displayName}
              onError={() => setImageError(true)}
              className="w-24 h-24 md:w-28 md:h-28 rounded-3xl object-cover border-2 border-brand-500 shadow-md transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-brand-500 text-white flex items-center justify-center font-bold text-3xl shadow-md border-2 border-brand-400">
              {initials}
            </div>
          )}

          <label
            htmlFor="avatar-upload"
            className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border rounded-2xl shadow-md hover:bg-brand-50 dark:hover:bg-dark-sidebar cursor-pointer text-gray-700 dark:text-gray-200 transition-colors"
            title="Change Profile Picture"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            ) : (
              <Camera className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            )}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            className="hidden"
            disabled={isUploading}
            onChange={handleAvatarFileChange}
          />
        </div>

        {/* User Identity Details */}
        <div className="flex-1 text-center md:text-left space-y-1">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {displayName}
            </h1>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 self-center md:self-auto">
              {displayRole}
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {profile?.workEmail || user?.email}
          </p>

          <p className="text-xs text-gray-600 dark:text-gray-300 pt-2 line-clamp-2 max-w-xl">
            {bio || 'No professional bio provided yet. Add an introduction below.'}
          </p>
        </div>
      </div>

      {/* Inline Feedback Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Section 1: Self-Editable Identity Details */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <div className="border-b border-gray-200 dark:border-dark-border pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 text-sm">
              <User className="w-4 h-4 text-brand-600" />
              <span>Personal Profile Information</span>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">Self-Managed Details</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Personal Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="personal.email@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Primary Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Emergency / Backup Phone Number
              </label>
              <input
                type="tel"
                value={backupPhone}
                onChange={(e) => setBackupPhone(e.target.value)}
                placeholder="+92 300 7654321"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                LinkedIn Profile URL
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Facebook Profile URL
              </label>
              <input
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/yourprofile"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Instagram Profile URL
              </label>
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/yourprofile"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Professional Bio / Introduction
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the team about your operational skills and experience..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Two-Factor Authentication (2FA) Security */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <div className="border-b border-gray-200 dark:border-dark-border pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 text-sm">
              <KeyRound className="w-4 h-4 text-brand-600" />
              <span>Two-Factor Authentication (2FA)</span>
            </div>
            {isLoading2FA ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : twoFactorStatus?.isEnabled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Disabled</span>
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs">
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Two-Factor Authentication adds a critical layer of protection to your Ops Hub account.
              When enabled, signing in requires your password and a 6-digit code generated by your
              authenticator app (such as Google Authenticator or Authy).
            </p>

            {twoFactorStatus?.isEnabled ? (
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">
                      Two-factor protection is enabled.
                    </span>
                    <p className="text-emerald-700 dark:text-emerald-400 text-[11px] mt-0.5">
                      {twoFactorStatus.remainingRecoveryCodes} single-use recovery{' '}
                      {twoFactorStatus.remainingRecoveryCodes === 1 ? 'code' : 'codes'} remaining.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRegenPassword('');
                      setRegenCode('');
                      setRegenError(null);
                      setNewRegenCodes(null);
                      setHasConfirmedNewCodes(false);
                      setIsRegenModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-dark-100 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-semibold hover:bg-emerald-50 transition-colors shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerate Recovery Codes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDisablePassword('');
                      setDisableCode('');
                      setDisableError(null);
                      setIsDisableModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 transition-colors shadow-sm"
                  >
                    <span>Disable 2FA</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-100 border border-slate-200 dark:border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Protect your account and client workspaces
                  </span>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Recommended for all agency staff and administrators.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStartEnroll}
                  disabled={isActivating2FA}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition-all self-start sm:self-auto disabled:opacity-60"
                >
                  {isActivating2FA ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  <span>Enable 2FA</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Protected Governance & Employment Fields (Read-Only) */}
        <div className="bg-gray-50 dark:bg-dark-card/50 border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <div className="border-b border-gray-200 dark:border-dark-border pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 text-sm">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>System & Organizational Governance (Protected)</span>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">Managed by Administrator</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
              <span className="text-gray-400 font-bold text-[10px] uppercase">Login Email</span>
              <div className="font-mono font-bold text-gray-800 dark:text-gray-200 truncate">
                {profile?.workEmail || user?.email}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
              <span className="text-gray-400 font-bold text-[10px] uppercase">System Role</span>
              <div className="font-bold text-brand-600 dark:text-brand-400">
                {displayRole}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
              <span className="text-gray-400 font-bold text-[10px] uppercase">Account Status</span>
              <div className="font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                {profile?.status || 'Active'}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
              <span className="text-gray-400 font-bold text-[10px] uppercase">Designation</span>
              <div className="font-bold text-gray-800 dark:text-gray-200">
                {profile?.designationName || 'Staff Specialist'}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
              <span className="text-gray-400 font-bold text-[10px] uppercase">Reporting Manager</span>
              <div className="font-bold text-gray-800 dark:text-gray-200">
                {profile?.reportingManagerName || 'Executive Management'}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
              <span className="text-gray-400 font-bold text-[10px] uppercase">Start Date</span>
              <div className="font-bold text-gray-800 dark:text-gray-200">
                {profile?.startDate || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Financial & Bank Disbursement Details (Self Read-Only) */}
        {bankDetails && (
          <div className="bg-gray-50 dark:bg-dark-card/50 border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="border-b border-gray-200 dark:border-dark-border pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 text-sm">
                <Shield className="w-4 h-4 text-brand-500" />
                <span>Financial & Payroll Disbursement Details</span>
              </div>
              <span className="text-[11px] text-gray-400 font-medium">Verified by Management</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
                <span className="text-gray-400 font-bold text-[10px] uppercase">Bank Name</span>
                <div className="font-bold text-gray-800 dark:text-gray-200 truncate">
                  {bankDetails.bankName || 'Not Provided'}
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
                <span className="text-gray-400 font-bold text-[10px] uppercase">Account Title</span>
                <div className="font-bold text-gray-800 dark:text-gray-200 truncate">
                  {bankDetails.accountTitle || 'Not Provided'}
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
                <span className="text-gray-400 font-bold text-[10px] uppercase">Account / IBAN</span>
                <div className="font-mono font-bold text-gray-800 dark:text-gray-200 truncate">
                  {bankDetails.iban || bankDetails.accountNumber || 'Not Provided'}
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-dark-100 rounded-2xl border border-gray-200 dark:border-dark-border space-y-1">
                <span className="text-gray-400 font-bold text-[10px] uppercase">Verification</span>
                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                  {bankDetails.status === 'active' ? 'Verified' : 'Pending'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{isSaving ? 'Saving Profile...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>

      {/* ============================================================== */}
      {/* 2FA ENROLLMENT MODAL */}
      {/* ============================================================== */}
      {isEnrollModalOpen && enrollData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {enrollStep === 'verify' ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-border pb-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-brand-600" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Set Up Two-Factor Authentication
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEnrollModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {enrollError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{enrollError}</span>
                  </div>
                )}

                <div className="space-y-4 text-xs">
                  <p className="text-slate-600 dark:text-slate-400">
                    Scan this QR code using Google Authenticator, Authy, or any TOTP authenticator app.
                  </p>

                  {/* QR Code */}
                  <div className="flex justify-center p-4 bg-white border border-slate-200 rounded-2xl">
                    <img
                      src={enrollData.qrCodeUrl}
                      alt="Authenticator QR Code"
                      className="w-44 h-44 object-contain"
                    />
                  </div>

                  {/* Manual Secret Key */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Can't scan the code? Enter this key manually:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={enrollData.secret}
                        className="flex-1 font-mono text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(enrollData.secret);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 6-Digit Verification Code Input */}
                  <form onSubmit={handleVerifyEnrollment} className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                        Enter 6-Digit Code from App
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        inputMode="numeric"
                        autoFocus
                        value={enrollCode}
                        onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        disabled={isActivating2FA}
                        className="w-full text-center text-xl font-mono font-bold tracking-widest py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEnrollModalOpen(false)}
                        disabled={isActivating2FA}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isActivating2FA || enrollCode.length !== 6}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold disabled:opacity-50"
                      >
                        {isActivating2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>Verify & Continue</span>
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              /* Step 2: Show 10 Single-Use Recovery Codes (ONCE) */
              <>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-border pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Save Your Recovery Codes
                    </h2>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                    <strong className="block font-bold">Important: Save these codes now!</strong>
                    <p className="text-[11px] leading-relaxed">
                      If you lose access to your authenticator app, these 10 single-use codes are
                      the ONLY way to sign into your account. Each code can be used once. They will
                      NOT be shown again after closing this window.
                    </p>
                  </div>

                  {/* 10 Codes Display */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-center font-bold text-slate-800">
                    {enrollRecoveryCodes.map((code, idx) => (
                      <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 tracking-wider">
                        {code}
                      </div>
                    ))}
                  </div>

                  {/* Copy & Download Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCodes(enrollRecoveryCodes)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                    >
                      {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCodes ? 'Codes Copied!' : 'Copy All Codes'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadCodes(enrollRecoveryCodes)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download (.txt)</span>
                    </button>
                  </div>

                  {/* Confirmation Checkbox */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasConfirmedCodesSaved}
                      onChange={(e) => setHasConfirmedCodesSaved(e.target.checked)}
                      className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-[11px] text-slate-700 font-medium leading-snug">
                      I have saved these recovery codes in a secure location and understand they will not be shown again.
                    </span>
                  </label>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={!hasConfirmedCodesSaved}
                      onClick={handleCompleteEnrollment}
                      className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>Complete Setup</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2FA REGENERATE RECOVERY CODES MODAL */}
      {/* ============================================================== */}
      {isRegenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-border pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Regenerate Recovery Codes
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRegenModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {regenError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{regenError}</span>
              </div>
            )}

            {!newRegenCodes ? (
              <form onSubmit={handleRegenerateSubmit} className="space-y-4 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Generating new recovery codes will immediately invalidate all existing recovery
                  codes. To proceed, please confirm your account password and the current 6-digit
                  code from your authenticator app.
                </p>

                {/* Password confirmation */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Account Password</label>
                  <div className="relative">
                    <input
                      type={showRegenPassword ? 'text' : 'password'}
                      required
                      value={regenPassword}
                      onChange={(e) => setRegenPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl pr-10 focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegenPassword(!showRegenPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showRegenPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Current 6-digit code */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Current 6-Digit Authenticator Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    inputMode="numeric"
                    value={regenCode}
                    onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center text-lg font-mono font-bold tracking-widest py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegenModalOpen(false)}
                    disabled={isRegenerating}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegenerating || !regenPassword || regenCode.length !== 6}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold disabled:opacity-50"
                  >
                    {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Generate New Codes</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Display newly regenerated codes */
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                  <strong className="block font-bold">New codes generated successfully!</strong>
                  <p className="text-[11px]">
                    Your previous recovery codes are now void. Please save these 10 new codes immediately.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-center font-bold text-slate-800">
                  {newRegenCodes.map((code, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 tracking-wider">
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCodes(newRegenCodes)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                  >
                    {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodes ? 'Codes Copied!' : 'Copy All Codes'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadCodes(newRegenCodes)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download (.txt)</span>
                  </button>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasConfirmedNewCodes}
                    onChange={(e) => setHasConfirmedNewCodes(e.target.checked)}
                    className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-[11px] text-slate-700 font-medium leading-snug">
                    I have saved these 10 new recovery codes in a secure place.
                  </span>
                </label>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={!hasConfirmedNewCodes}
                    onClick={() => {
                      setIsRegenModalOpen(false);
                      setNewRegenCodes(null);
                      setHasConfirmedNewCodes(false);
                      setSuccessMessage('New recovery codes saved successfully.');
                    }}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2FA DISABLE CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {isDisableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-border pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Disable Two-Factor Authentication
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDisableModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {disableError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{disableError}</span>
              </div>
            )}

            <form onSubmit={handleDisableSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                <strong className="block font-bold">Warning</strong>
                <p className="text-[11px] leading-relaxed mt-0.5">
                  Disabling 2FA makes your account and workspaces vulnerable to single-factor attacks.
                  All recovery codes will be erased immediately.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Account Password</label>
                <div className="relative">
                  <input
                    type={showDisablePassword ? 'text' : 'password'}
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl pr-10 focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDisablePassword(!showDisablePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showDisablePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Current 6-Digit Authenticator Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full text-center text-lg font-mono font-bold tracking-widest py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisableModalOpen(false)}
                  disabled={isDisabling}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisabling || !disablePassword || disableCode.length !== 6}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50"
                >
                  {isDisabling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Confirm & Disable 2FA</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
