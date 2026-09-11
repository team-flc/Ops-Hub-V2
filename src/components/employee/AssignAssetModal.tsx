import React, { useState, useEffect } from 'react';
import { Laptop, AlertCircle, CheckCircle2, X, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { CompanyAsset, TeamMemberRecord, UserProfile, AssetStatus } from '../../types';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { getPKTTodayDateString } from '../../lib/pktDateUtils';

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
  // Base primary fields
  const [itemName, setItemName] = useState('');
  const [issueDate, setIssueDate] = useState(getPKTTodayDateString());
  const [replacementValue, setReplacementValue] = useState<number | ''>('');
  const [assignedTo, setAssignedTo] = useState('');

  // Advanced collapsible fields
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [assetTag, setAssetTag] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState<string>('laptop');
  const [condition, setCondition] = useState<string>('good');
  const [status, setStatus] = useState<AssetStatus>('assigned');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (existingAsset) {
      setItemName(existingAsset.itemName || existingAsset.assetName || '');
      setIssueDate(existingAsset.issueDate || getPKTTodayDateString());
      setReplacementValue(existingAsset.replacementValue ?? existingAsset.price ?? '');
      setAssignedTo(existingAsset.assignedTo || existingAsset.employeeId || '');

      setAssetTag(existingAsset.assetTag || '');
      setSerialNumber(existingAsset.serialNumber || '');
      setCategory(existingAsset.category || 'laptop');
      setCondition(existingAsset.condition || 'good');
      setStatus(existingAsset.status || (existingAsset.assignedTo || existingAsset.employeeId ? 'assigned' : 'available'));
      setNotes(existingAsset.notes || '');
      setIsAdvancedOpen(true);
    } else {
      setItemName('');
      setIssueDate(getPKTTodayDateString());
      setReplacementValue('');
      setAssignedTo('');

      setAssetTag(`FLC-${Math.floor(1000 + Math.random() * 9000)}`);
      setSerialNumber('');
      setCategory('laptop');
      setCondition('good');
      setStatus('assigned');
      setNotes('');
      setIsAdvancedOpen(false);
    }
    setErrorMessage(null);
  }, [existingAsset, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setErrorMessage('Item Name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const computedTag = assetTag.trim() || `FLC-${Math.floor(1000 + Math.random() * 9000)}`;
      const computedStatus: AssetStatus = status || (assignedTo ? 'assigned' : 'available');

      const res = await employeeOperationsService.upsertAsset({
        id: existingAsset?.id,
        assetTag: computedTag,
        assetName: itemName.trim(),
        issueDate,
        category,
        serialNumber: serialNumber.trim() || undefined,
        assignedTo: assignedTo || null,
        condition,
        replacementValue: replacementValue ? Number(replacementValue) : 0,
        notes: notes.trim() || undefined,
        status: computedStatus
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
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
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
                Company hardware & equipment governance
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PRIMARY BASE FIELDS */}
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Item Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. MacBook Air M2 16GB / Dell UltraSharp 27"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Issue Date (PKT) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Price / Replacement Value (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={replacementValue}
                  onChange={(e) => setReplacementValue(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 185000"
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
          </div>

          {/* ADVANCED IDENTIFIERS (COLLAPSIBLE) */}
          <div className="pt-2 border-t border-slate-100 dark:border-dark-border">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-brand-500" />
                <span>Advanced Identifiers & Lifecycle Governance</span>
              </span>
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isAdvancedOpen && (
              <div className="space-y-3.5 pt-2 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Asset Tag (System ID)
                    </label>
                    <input
                      type="text"
                      value={assetTag}
                      onChange={(e) => setAssetTag(e.target.value)}
                      placeholder="e.g. FLC-LAP-042"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="e.g. C02G901ABCDE"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="laptop">Laptop</option>
                      <option value="monitor">Monitor</option>
                      <option value="phone">Company Phone / SIM</option>
                      <option value="peripherals">Peripherals / Audio</option>
                      <option value="access_card">Access Card / Key</option>
                      <option value="other">Other Asset</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="new">Brand New</option>
                      <option value="good">Good Condition</option>
                      <option value="fair">Fair (Minor Wear)</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Status Lifecycle
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as AssetStatus)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
                    >
                      <option value="assigned">Assigned</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="returned">Returned</option>
                      <option value="damaged">Damaged</option>
                      <option value="lost">Lost</option>
                      <option value="under_review">Under Review</option>
                      <option value="closed">Closed / Cleared</option>
                      <option value="available">Available (Pool)</option>
                    </select>
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
              </div>
            )}
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
