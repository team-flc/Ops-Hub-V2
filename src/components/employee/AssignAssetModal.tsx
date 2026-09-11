import React, { useState, useEffect } from 'react';
import { Laptop, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { CompanyAsset, TeamMemberRecord, UserProfile } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';

interface AssignAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: (TeamMemberRecord | UserProfile)[];
  callerId: string;
  existingAsset?: CompanyAsset | null;
  onSuccess: () => void;
}

export const AssignAssetModal: React.FC<AssignAssetModalProps> = ({
  isOpen,
  onClose,
  staffList,
  callerId,
  existingAsset,
  onSuccess
}) => {
  const [assetName, setAssetName] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState<CompanyAsset['category']>('laptop');
  const [assignedTo, setAssignedTo] = useState('');
  const [condition, setCondition] = useState<CompanyAsset['condition']>('good');
  const [replacementValue, setReplacementValue] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (existingAsset) {
      setAssetName(existingAsset.assetName || existingAsset.itemName || '');
      setAssetTag(existingAsset.assetTag || '');
      setSerialNumber(existingAsset.serialNumber || '');
      setCategory(existingAsset.category || 'laptop');
      setAssignedTo(existingAsset.assignedTo || existingAsset.employeeId || '');
      setCondition(existingAsset.condition || 'good');
      setReplacementValue(existingAsset.replacementValue || existingAsset.price || '');
      setNotes(existingAsset.notes || '');
    } else {
      setAssetName('');
      setAssetTag(`FLC-${Math.floor(1000 + Math.random() * 9000)}`);
      setSerialNumber('');
      setCategory('laptop');
      setAssignedTo('');
      setCondition('good');
      setReplacementValue('');
      setNotes('');
    }
    setErrorMessage(null);
  }, [existingAsset, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim() || !assetTag.trim()) {
      setErrorMessage('Asset Name and Asset Tag are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await employeeOperationsService.upsertAsset({
        id: existingAsset?.id,
        assetTag: assetTag.trim(),
        assetName: assetName.trim(),
        category,
        serialNumber: serialNumber.trim() || undefined,
        assignedTo: assignedTo || null,
        condition,
        replacementValue: replacementValue ? Number(replacementValue) : 0,
        notes: notes.trim() || undefined,
        status: assignedTo ? 'assigned' : 'available'
      }, callerId);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save company asset.');
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
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                {existingAsset ? 'Update Company Asset' : 'Assign / Register Asset'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Hardware, equipment, and company property governance
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Asset Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. MacBook Air M2 16GB"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Asset Tag <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                placeholder="e.g. FLC-LAP-042"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="laptop">Laptop</option>
                <option value="monitor">External Monitor</option>
                <option value="phone">Company Phone / SIM</option>
                <option value="peripherals">Peripherals / Accessories</option>
                <option value="access_card">Access Card / Key</option>
                <option value="other">Other Asset</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Serial Number
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. C02G901..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Assign To Employee (Custodian)
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">-- Unassigned (Company Pool) --</option>
              {staffList.map((s) => {
                const name = 'fullName' in s ? s.fullName : (s as any).full_name || 'Staff';
                const email = 'workEmail' in s ? s.workEmail : (s as any).email || '';
                return (
                  <option key={s.id} value={s.id}>
                    {name} ({email})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Current Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="new">Brand New</option>
                <option value="good">Good Condition</option>
                <option value="fair">Fair (Minor Wear)</option>
                <option value="damaged">Damaged (Needs Repair)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Replacement Value (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={replacementValue}
                onChange={(e) => setReplacementValue(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 180000"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
              Notes & Inclusions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Issued with 67W Charger, USB-C Cable, and Sleeve..."
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
                <span>Saving...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{existingAsset ? 'Update Asset' : 'Assign Asset'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
