// ==============================================================================
// UTILITY: Autosave & Form Draft Recovery Engine
// Location: src/lib/autosaveUtils.ts
// Secure, debounced persistence for existing records and draft recovery
// ==============================================================================

import React from 'react';
import { Loader2, Check, AlertCircle, Sparkles, X } from 'lucide-react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * STRICT SECURITY BLACKLIST
 * These sensitive fields MUST NEVER be stored in browser storage (localStorage/sessionStorage).
 */
export const SENSITIVE_DRAFT_KEYS = new Set([
  'password',
  'confirmpassword',
  'confirm_password',
  'bankname',
  'bank_name',
  'accounttitle',
  'account_title',
  'accountnumber',
  'account_number',
  'iban',
  'cnic',
  'salary',
  'dob',
  'token',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'secret',
  'apikey',
  'api_key',
  'ssn'
]);

/**
 * Filter out sensitive keys from a draft object recursively.
 */
export function sanitizeDraftPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object') return {};
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' && item !== null ? sanitizeDraftPayload(item) : item)) as any;
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_DRAFT_KEYS.has(lowerKey)) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeDraftPayload(value);
    } else if (Array.isArray(value)) {
      clean[key] = value.map((item) => (typeof item === 'object' && item !== null ? sanitizeDraftPayload(item) : item));
    } else {
      clean[key] = value;
    }
  }
  return clean as Partial<T>;
}

export const stripSensitiveFields = sanitizeDraftPayload;

/**
 * Save form draft into browser storage safely.
 */
export function saveFormDraft(formKey: string, data: Record<string, any>): void {
  if (typeof window === 'undefined' || !formKey) return;
  try {
    const sanitized = sanitizeDraftPayload(data);
    const payload = {
      ...sanitized,
      _draftTimestamp: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(payload);
    window.localStorage.setItem(formKey, jsonStr);
  } catch (err) {
    try {
      // Fallback to sessionStorage if localStorage is full or disabled
      const sanitized = sanitizeDraftPayload(data);
      window.sessionStorage.setItem(formKey, JSON.stringify({ ...sanitized, _draftTimestamp: new Date().toISOString() }));
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Load draft from browser storage if present.
 */
export function loadFormDraft<T = Record<string, any>>(formKey: string): T | null {
  if (typeof window === 'undefined' || !formKey) return null;
  try {
    let raw = window.localStorage.getItem(formKey);
    if (!raw) {
      raw = window.sessionStorage.getItem(formKey);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      delete parsed._draftTimestamp;
      return parsed as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear form draft from both localStorage and sessionStorage.
 */
export function clearFormDraft(formKey: string): void {
  if (typeof window === 'undefined' || !formKey) return;
  try {
    window.localStorage.removeItem(formKey);
  } catch {}
  try {
    window.sessionStorage.removeItem(formKey);
  } catch {}
}

/**
 * Check if a non-empty draft exists.
 */
export function hasFormDraft(formKey: string): boolean {
  if (typeof window === 'undefined' || !formKey) return false;
  try {
    return Boolean(window.localStorage.getItem(formKey) || window.sessionStorage.getItem(formKey));
  } catch {
    return false;
  }
}

/**
 * Autosave Status Badge component.
 * Displays Saving..., Saved, or Failed indicator with accessible styling.
 */
export const AutosaveBadge: React.FC<{
  status: AutosaveStatus;
  error?: string | null;
  className?: string;
  savedText?: string;
}> = ({ status, error, className = '', savedText = 'All changes saved' }) => {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span
        data-testid="autosave-status-saving"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[11px] font-semibold text-blue-700 dark:text-blue-300 animate-pulse ${className}`}
      >
        <Loader2 className="w-3 h-3 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
        <span>Saving...</span>
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span
        data-testid="autosave-status-saved"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 ${className}`}
      >
        <Check className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>{savedText}</span>
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        data-testid="autosave-status-failed"
        title={error || 'Failed to save changes automatically'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] font-semibold text-rose-700 dark:text-rose-300 ${className}`}
      >
        <AlertCircle className="w-3 h-3 shrink-0 text-rose-600 dark:text-rose-400" />
        <span>Save failed</span>
      </span>
    );
  }

  return null;
};

/**
 * Draft Restored Banner component.
 * Informs the user when an unfinished draft was safely restored from their previous session.
 */
export const DraftRestoredBanner: React.FC<{
  onClear: () => void;
  className?: string;
  message?: string;
}> = ({
  onClear,
  className = '',
  message = 'Restored unfinished draft from your previous session.'
}) => {
  return (
    <div
      data-testid="draft-restored-banner"
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 ${className}`}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      <button
        type="button"
        onClick={onClear}
        data-testid="draft-clear-btn"
        className="px-2 py-0.5 rounded text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 underline transition-colors cursor-pointer"
        title="Discard restored draft"
      >
        Clear draft
      </button>
    </div>
  );
};
