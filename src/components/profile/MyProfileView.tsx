import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  User, Mail, Phone, Building2, Briefcase, 
  Shield, Check, AlertCircle, Loader2, Upload, Camera, Link2 
} from 'lucide-react';
import { ROLE_DISPLAY_NAMES } from '../../types';
import { profileService } from '../../lib/profileService';
import { storageService } from '../../lib/storageService';

const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.762-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

export const MyProfileView: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();

  // Self-editable state
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [backupPhone, setBackupPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Status & Feedback
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setBio(profile.bio || '');
      setLinkedinUrl(profile.linkedinUrl || '');
      setContactEmail(profile.contactEmail || '');
      setPhone(profile.phone || '');
      setBackupPhone(profile.backupPhone || '');
      setAvatarUrl(profile.avatarUrl || null);
    }
  }, [profile]);

  const displayName = fullName || profile?.fullName || user?.email?.split('@')[0] || 'Staff Member';
  const displayRole = profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'Team Member';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'FL';

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUploading(true);

    const res = await storageService.uploadAvatar(file, user.id);
    setIsUploading(false);

    if (res.error || !res.url) {
      setErrorMessage(res.error || 'Failed to upload image.');
    } else {
      setAvatarUrl(res.url);
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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Avatar Upload Container */}
        <div className="relative group">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-24 h-24 md:w-28 md:h-28 rounded-3xl object-cover border-2 border-brand-500/30 shadow-md"
            />
          ) : (
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
              {initials}
            </div>
          )}

          <label
            htmlFor="profile-avatar-input"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-all duration-200"
          >
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">Change</span>
              </>
            )}
          </label>
          <input
            id="profile-avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarFileChange}
            className="hidden"
            disabled={isUploading || isSaving}
          />
        </div>

        {/* User Info Overview */}
        <div className="text-center md:text-left space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {displayName}
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              {displayRole}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {profile?.workEmail || user?.email}
          </p>
          {profile?.bio && (
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 max-w-xl italic">
              "{profile.bio}"
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Section 1: Self-Editable Personal Profile */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
          <div className="border-b border-gray-100 dark:border-dark-border pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 text-sm">
              <User className="w-4 h-4 text-brand-500" />
              <span>Personal Profile Information</span>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">Editable by you</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Full Display Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Zaid Khan"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Connected Contact Gmail (Optional)
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. yourname@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +92 300 1234567"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                Backup Phone Number
              </label>
              <input
                type="tel"
                value={backupPhone}
                onChange={(e) => setBackupPhone(e.target.value)}
                placeholder="e.g. +92 321 7654321"
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

        {/* Section 2: Protected Governance Fields (Read-Only) */}
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
    </div>
  );
};