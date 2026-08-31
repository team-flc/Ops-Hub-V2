import React, { useState } from 'react';
import { 
  X, Briefcase, Plus, Archive, RefreshCw, AlertCircle, 
  Loader2, Check, Tag 
} from 'lucide-react';
import { Designation, UserProfile } from '../../types';
import { teamManagementService } from '../../lib/teamManagementService';

interface DesignationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  designations: Designation[];
  onRefresh: () => void;
  currentUserProfile: UserProfile | null;
}

export const DesignationManagerModal: React.FC<DesignationManagerModalProps> = ({
  isOpen,
  onClose,
  designations,
  onRefresh,
  currentUserProfile
}) => {
  const [newDesignationName, setNewDesignationName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile) return;
    setErrorMessage(null);

    const cleanName = newDesignationName.trim();
    if (!cleanName) {
      setErrorMessage('Please enter a designation name.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await teamManagementService.createDesignation(cleanName, currentUserProfile.id);
      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
      } else {
        setNewDesignationName('');
        setIsSubmitting(false);
        onRefresh();
      }
    } catch {
      setErrorMessage('Failed to create designation.');
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: 'active' | 'archived') => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    try {
      await teamManagementService.setDesignationStatus(id, newStatus);
      onRefresh();
    } catch {
      setErrorMessage('Failed to update designation status.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-sm">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                Designation Directory
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Create and manage official roles across departments
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Create New Designation */}
          <form onSubmit={handleCreate} className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Add New Designation
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={newDesignationName}
                  onChange={(e) => setNewDesignationName(e.target.value)}
                  placeholder="e.g. Senior Copywriter, Growth Specialist"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !newDesignationName.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add</span>
              </button>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </form>

          {/* List of Designations */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-dark-border">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
              Existing Designations ({designations.length})
            </span>
            <div className="divide-y divide-slate-100 dark:divide-dark-border rounded-2xl border border-slate-200 dark:border-dark-border overflow-hidden bg-slate-50/50 dark:bg-dark-sidebar max-h-60 overflow-y-auto">
              {designations.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No designations created yet.
                </div>
              ) : (
                designations.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 text-xs bg-white dark:bg-dark-200">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-gray-200">{d.name}</span>
                      {d.status === 'archived' && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                          Archived
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(d.id, d.status)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        d.status === 'active'
                          ? 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {d.status === 'active' ? (
                        <>
                          <Archive className="w-3 h-3" />
                          <span>Archive</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          <span>Restore</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-dark-sidebar border-t border-slate-100 dark:border-dark-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
