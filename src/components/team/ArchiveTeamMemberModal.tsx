import React, { useState, useEffect } from 'react';
import { 
  X, Archive, AlertCircle, Loader2, 
  CheckCircle2, ShieldAlert 
} from 'lucide-react';
import { TeamMemberRecord, UserProfile } from '../../types';
import { archiveService } from '../../lib/archiveService';

interface ArchiveTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: TeamMemberRecord | null;
  currentUserProfile?: UserProfile | null;
}

export const ArchiveTeamMemberModal: React.FC<ArchiveTeamMemberModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  member,
  currentUserProfile: _currentUserProfile
}) => {
  const [isLoadingCheck, setIsLoadingCheck] = useState(false);
  const [hasOpenTasks, setHasOpenTasks] = useState(false);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [openTasks, setOpenTasks] = useState<any[]>([]);
  const [archiveReason, setArchiveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (member && isOpen) {
      setIsLoadingCheck(true);
      setErrorMessage(null);
      setArchiveReason('');
      archiveService
        .checkTeamMemberOpenTasks(member.id)
        .then((res) => {
          setHasOpenTasks(res.hasOpenTasks);
          setOpenTaskCount(res.openTaskCount);
          setOpenTasks(res.tasks || []);
          setIsLoadingCheck(false);
        })
        .catch((err) => {
          setIsLoadingCheck(false);
          setErrorMessage(err?.message || 'Failed to verify open tasks for team member.');
        });
    }
  }, [member, isOpen]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveReason.trim()) {
      setErrorMessage('Mandatory archive reason is required.');
      return;
    }

    if (hasOpenTasks) {
      setErrorMessage('Cannot archive a team member with open tasks. Reassign all open tasks first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await archiveService.archiveTeamMember(member.id, archiveReason.trim());
      if (res.error || !res.success) {
        setErrorMessage(res.error || 'Failed to archive team member.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-gray-100 tracking-tight">
                Archive Team Member
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                {member.fullName} ({member.workEmail})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-rose-600 dark:text-rose-400 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoadingCheck ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              <span className="text-xs font-semibold">Verifying open task assignments...</span>
            </div>
          ) : hasOpenTasks ? (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 text-xs">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>Archive Blocked: Active Open Tasks</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>{member.fullName}</strong> is currently assigned to <strong>{openTaskCount}</strong> open task(s). 
                  To protect operational continuity, you must reassign all open tasks before archiving this member.
                </p>
              </div>

              {openTasks.length > 0 && (
                <div className="border border-slate-200 dark:border-dark-border rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-dark-border">
                  {openTasks.map((t) => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800 dark:text-gray-200 truncate mr-2">
                        {t.title}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex-shrink-0">
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Zero open tasks found. Safe to archive.</span>
              </div>

              <p className="text-slate-600 dark:text-gray-300">
                Archiving will suspend active access, remove this team member from assignee pickers, and preserve all historical audit logs and records.
              </p>

              <div>
                <label htmlFor="archive-user-reason" className="block font-bold text-slate-700 dark:text-gray-300 mb-1.5">
                  Mandatory Archive Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="archive-user-reason"
                  rows={3}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Contract ended, resigned, or reallocated to other business unit..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-sidebar text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 font-medium"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-300 font-semibold hover:bg-slate-50 dark:hover:bg-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingCheck || hasOpenTasks || !archiveReason.trim()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              <span>Archive Team Member</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
