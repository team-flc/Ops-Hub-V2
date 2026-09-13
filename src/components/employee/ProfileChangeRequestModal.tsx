import React, { useState } from 'react';
import { UserCog, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface ProfileChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onSuccess: () => void;
}

export const ProfileChangeRequestModal: React.FC<ProfileChangeRequestModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  onSuccess
}) => {
  const [requestType, setRequestType] = useState<'contact_info' | 'emergency_contact' | 'bank_info' | 'tax_info'>('contact_info');
  const [fieldName, setFieldName] = useState('phone');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) {
      setErrorMessage('Requested New Value is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.requestProfileChange({
        employeeId,
        requestType,
        requestedChanges: {
          field: fieldName,
          value: newValue.trim()
        },
        reason: reason.trim() || undefined
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit change request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center border border-brand-500/20">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                Request Profile / Contact Update
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Submit verified changes for Operations Management approval
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Update Category
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="contact_info">Phone / Contact Email</option>
              <option value="emergency_contact">Emergency Contact Details</option>
              <option value="bank_info">Bank Information Change</option>
              <option value="tax_info">CNIC / Tax Documentation</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Field to Update
            </label>
            <select
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="phone">Primary Phone Number</option>
              <option value="backup_phone">Backup / WhatsApp Number</option>
              <option value="contact_email">Personal Gmail / Contact Email</option>
              <option value="emergency_contact_name">Emergency Contact Person</option>
              <option value="emergency_contact_phone">Emergency Contact Phone</option>
              <option value="residential_address">Residential Address</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              New Requested Value <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Enter new verified contact info..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Reason for Change
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Changed primary SIM provider / Relocated address..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
