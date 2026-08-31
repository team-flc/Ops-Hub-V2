import React, { useState } from 'react';
import { 
  X, Key, Eye, EyeOff, Sparkles, Check, AlertCircle, 
  Loader2, CheckCircle2, Copy 
} from 'lucide-react';
import { TeamMemberRecord } from '../../types';
import { teamManagementService } from '../../lib/teamManagementService';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMemberRecord | null;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  member
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPassword, setSuccessPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !member) return null;

  const generateStrongPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const special = '!@#$%^&*()_+~|}{[]:;?><,./-=';
    const all = upper + lower + numbers + special;

    let pwd = '';
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < 16; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    const finalPwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');
    setPassword(finalPwd);
    setConfirmPassword(finalPwd);
  };

  const validatePasswordRequirements = (pwd: string) => {
    const hasMinLen = pwd.length >= 12;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
    return { hasMinLen, hasUpper, hasLower, hasNumber, hasSpecial, isValid: hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial };
  };

  const pwdValidation = validatePasswordRequirements(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!pwdValidation.isValid) {
      setErrorMessage('Password must be at least 12 characters and contain uppercase, lowercase, numbers, and special symbols.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await teamManagementService.resetPassword(member.id, password);
      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
      } else {
        setSuccessPassword(password);
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage('Failed to reset password.');
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!successPassword) return;
    const text = `FLC Ops Hub Password Reset:\nName: ${member.fullName}\nWork Email: ${member.workEmail}\nNew Password: ${successPassword}\nPortal URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setSuccessPassword(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-sm">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                {successPassword ? 'Password Reset Complete' : 'Reset Password'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-mono truncate max-w-[200px]">
                {member.workEmail}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {successPassword ? (
            <div className="space-y-5 animate-fade-in">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Password updated successfully. Share credentials securely with <strong>{member.fullName}</strong>.</span>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-2xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">New Permanent Password</span>
                <div className="p-2.5 rounded-xl bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-border font-mono text-sm font-bold text-slate-900 dark:text-gray-100 select-all">
                  {successPassword}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy Credentials'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-dark-100 hover:bg-slate-200 text-slate-700 dark:text-gray-300 text-xs font-bold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">{errorMessage}</div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={generateStrongPassword}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pr-9 pl-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Strength Indicators */}
              <div className="grid grid-cols-2 gap-1 text-[10px] pt-1">
                <div className={`flex items-center gap-1 ${pwdValidation.hasMinLen ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> 12+ Characters
                </div>
                <div className={`flex items-center gap-1 ${pwdValidation.hasUpper && pwdValidation.hasLower ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Upper & Lower
                </div>
                <div className={`flex items-center gap-1 ${pwdValidation.hasNumber ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Number
                </div>
                <div className={`flex items-center gap-1 ${pwdValidation.hasSpecial ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Special Character
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-border">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-300 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
