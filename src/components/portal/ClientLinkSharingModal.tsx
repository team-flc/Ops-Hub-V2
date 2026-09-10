import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Link2, Copy, Check, Eye, AlertTriangle, Shield
} from 'lucide-react';
import { ClientPortalRecipient } from '../../types';
import { clientPortalService } from '../../lib/clientPortalService';
import { useAuth } from '../../context/AuthContext';

export const PRODUCTION_PORTAL_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PUBLIC_APP_URL)
    ? import.meta.env.VITE_PUBLIC_APP_URL.replace(/\/+$/, '')
    : 'https://obshub2.pages.dev';

export function getProductionPortalUrl(clientId: string): string {
  return `${PRODUCTION_PORTAL_BASE}/portal/${clientId}`;
}

export function getPreviewPortalUrl(clientId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : PRODUCTION_PORTAL_BASE;
  return `${origin}/portal/${clientId}?preview=true`;
}

interface ClientLinkSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  companyName: string;
  currentUserRole?: string;
  initialTab?: 'links' | 'recipients';
}

export const ClientLinkSharingModal: React.FC<ClientLinkSharingModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientName,
  companyName,
  currentUserRole: _currentUserRole,
  initialTab
}) => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'links' | 'recipients'>(initialTab || 'recipients');
  const [copiedProd, setCopiedProd] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [recipients, setRecipients] = useState<ClientPortalRecipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);

  // New recipient form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const productionUrl = getProductionPortalUrl(clientId);
  const previewUrl = getPreviewPortalUrl(clientId);

  const activeRecipients = recipients.filter((r) => r.status === 'active');
  const activeRecipientCount = activeRecipients.length;
  const hasActiveRecipients = activeRecipientCount > 0;

  const loadRecipients = useCallback(async () => {
    setIsLoadingRecipients(true);
    try {
      const recs = await clientPortalService.fetchApprovedRecipients(clientId);
      setRecipients(recs);
      const activeCount = recs.filter((r) => r.status === 'active').length;
      if (!initialTab && activeCount === 0) {
        setActiveTab('recipients');
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsLoadingRecipients(false);
    }
  }, [clientId, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    loadRecipients();
  }, [isOpen, loadRecipients]);

  const handleCopyProd = async () => {
    try {
      await navigator.clipboard.writeText(productionUrl);
      setCopiedProd(true);
      setTimeout(() => setCopiedProd(false), 2500);
    } catch {
      const el = document.getElementById('prod-url-input') as HTMLInputElement;
      if (el) {
        el.select();
        document.execCommand('copy');
        setCopiedProd(true);
        setTimeout(() => setCopiedProd(false), 2500);
      }
    }
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2500);
    } catch {
      const el = document.getElementById('preview-url-input') as HTMLInputElement;
      if (el) {
        el.select();
        document.execCommand('copy');
        setCopiedPreview(true);
        setTimeout(() => setCopiedPreview(false), 2500);
      }
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setFormError('Please enter both full name and a valid email address.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      const res = await clientPortalService.addPortalRecipient(
        clientId,
        newEmail.trim().toLowerCase(),
        newName.trim(),
        profile
      );
      if (res.error) {
        setFormError(res.error);
      } else {
        setNewName('');
        setNewEmail('');
        await loadRecipients();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to add recipient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeRecipient = async (recipientId: string) => {
    try {
      await clientPortalService.revokePortalRecipient(recipientId, profile);
      await loadRecipients();
    } catch {
      // Fail closed
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-brand-500" />
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-gray-100 tracking-tight">
                Client Portal Access & Links
              </h3>
            </div>
            <p className="text-xs text-gray-500">
              {companyName} ({clientName})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-gray-100 dark:border-dark-border px-6 pt-2 gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'links'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Quick Link Sharing
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recipients')}
            className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'recipients'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <span>Authorized Recipients</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300">
              {activeRecipientCount}
            </span>
          </button>
        </div>

        {/* Tab 1: Links */}
        {activeTab === 'links' && (
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Set up access alert if 0 active recipients */}
            {!hasActiveRecipients && !isLoadingRecipients && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Set up client access before sharing</p>
                  <p className="text-[11px] opacity-90">
                    No active authorized client contacts have been registered yet. The portal link alone does not grant access; at least one authorized recipient is required. Switch to the <strong className="underline cursor-pointer" onClick={() => setActiveTab('recipients')}>Authorized Recipients</strong> tab to register client contacts before sharing.
                  </p>
                </div>
              </div>
            )}

            {/* Production Link */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-black">
                    [PRODUCTION LINK]
                  </span>
                  <span>Client Production Link</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="prod-url-input"
                  type="text"
                  readOnly
                  value={productionUrl}
                  className="flex-1 p-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-200 text-xs text-gray-700 dark:text-gray-300 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyProd}
                  disabled={!hasActiveRecipients}
                  title={!hasActiveRecipients ? 'Set up client access before sharing. Add at least one authorized recipient to enable client link copying.' : 'Copy Client Link'}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-xs font-bold transition-all flex-shrink-0 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900 dark:disabled:hover:bg-white"
                >
                  {copiedProd ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Client Link</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-gray-400">
                {!hasActiveRecipients ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Set up client access before sharing. Clients must have an active authorized account in Authorized Recipients to access this link.
                  </span>
                ) : (
                  <span>
                    Share this link with authorized contacts. Clients authenticate with their registered credentials. Link possession alone does not grant access.
                  </span>
                )}
              </p>
            </div>

            {/* Staff Preview Link */}
            <div className="space-y-2.5 pt-4 border-t border-gray-100 dark:border-dark-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-black">
                    [PREVIEW LINK]
                  </span>
                  <span>Owner Read-Only Preview</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="preview-url-input"
                  type="text"
                  readOnly
                  value={previewUrl}
                  className="flex-1 p-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-200 text-xs text-gray-700 dark:text-gray-300 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-dark-200 text-xs font-bold text-gray-700 dark:text-gray-300 transition-all flex-shrink-0 cursor-pointer"
                >
                  {copiedPreview ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all flex-shrink-0 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open Preview</span>
                </a>
              </div>

              <p className="text-[11px] text-gray-400">
                Staff preview displays a persistent banner and blocks any approval/change-request mutations.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Recipients */}
        {activeTab === 'recipients' && (
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Add Recipient Form */}
            {profile?.role === 'owner' ? (
              <form onSubmit={handleAddRecipient} className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-200/50 border border-gray-100 dark:border-dark-border space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 block">
                  Authorize New Client Recipient
                </span>

                {formError && (
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-semibold">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="p-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Client Email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="p-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Add Recipient
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Only the Owner can configure authorized client recipients.
              </p>
            )}

            {/* Recipient List */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 block">
                Registered Recipients ({recipients.length})
              </span>

              <div className="divide-y divide-gray-100 dark:divide-dark-border border border-gray-100 dark:border-dark-border rounded-2xl overflow-hidden bg-white dark:bg-dark-card">
                {recipients.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    No recipients registered yet. Add authorized contacts above.
                  </div>
                ) : (
                  recipients.map((rec) => (
                    <div key={rec.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                            {rec.fullName}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                            rec.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">
                          {rec.email}
                        </div>
                      </div>

                      {profile?.role === 'owner' && rec.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeRecipient(rec.id)}
                          className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-dark-border text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-300/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Shield className="w-3.5 h-3.5 text-brand-500" />
            <span>Multi-Tenant Access Hardened</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-200 dark:hover:bg-dark-100 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
