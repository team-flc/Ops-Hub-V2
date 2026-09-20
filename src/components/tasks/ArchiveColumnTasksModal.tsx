import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, AlertCircle, Loader2, X } from 'lucide-react';
import { ClientRecord, ClientTask } from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';

export interface ArchiveColumnTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientRecord;
  weekNumber: 1 | 2 | 3 | 4;
  weekName?: string;
  columnName: string;
  tasks: ClientTask[];
  onSuccess: (archivedTaskIds: string[]) => void;
}

export const ArchiveColumnTasksModal: React.FC<ArchiveColumnTasksModalProps> = ({
  isOpen,
  onClose,
  client,
  weekNumber,
  weekName,
  columnName,
  tasks,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setReasonError(null);
    setArchiveError(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError('A mandatory reason is required to archive these tasks.');
      return;
    }

    if (tasks.length === 0) {
      onClose();
      return;
    }

    setIsArchiving(true);
    try {
      const taskIds = tasks.map((t) => t.id);
      const res = await taskManagementService.archiveMultipleTasks(taskIds, trimmedReason);

      if (res.successfulIds.length > 0) {
        onSuccess(res.successfulIds);
      }

      if (res.failedIds.length > 0) {
        setArchiveError(
          `Failed to archive ${res.failedIds.length} task(s): ${res.errors.join('; ')}`
        );
      } else {
        onClose();
      }
    } catch (err: any) {
      setArchiveError(err?.message || 'Failed to archive column tasks.');
    } finally {
      setIsArchiving(false);
    }
  };

  const modalContent = (
    <div
      data-testid="archive-column-modal"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl p-5 sm:p-6 max-w-lg w-full space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Archive All {columnName} Tasks
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Batch archive tasks in this column with complete history preserved
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isArchiving}
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scope Summary Badge Box */}
        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-200/50 border border-gray-200 dark:border-dark-border/60 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Target Client
              </span>
              <span className="font-bold text-gray-900 dark:text-gray-100 truncate block">
                {client.companyName || client.clientName}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Target Week
              </span>
              <span className="font-bold text-gray-900 dark:text-gray-100 truncate block">
                Week {weekNumber}{weekName ? `: ${weekName}` : ''}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Column Scope
              </span>
              <span className="font-bold text-brand-600 dark:text-brand-400">
                {columnName}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Tasks to Archive
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>
          </div>
        </div>

        {/* Informational Safety Notice */}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          Archived tasks will be removed from this board and safely preserved in the{' '}
          <strong className="text-gray-700 dark:text-gray-300">Archive Center</strong>. All time logs,
          conversation messages, approvals, and history will remain intact and can be restored at any time.
        </p>

        {/* Error Displays */}
        {archiveError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{archiveError}</span>
          </div>
        )}

        {reasonError && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {reasonError}
          </div>
        )}

        {/* Mandatory Reason Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
            <span>
              Archive Reason <span className="text-rose-500">*</span>
            </span>
            <span className="text-[10px] text-gray-400 font-normal">Required for audit logs</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
            disabled={isArchiving}
            data-testid="archive-reason-input"
            placeholder={`Enter reason for archiving all ${tasks.length} ${columnName} tasks...`}
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none disabled:opacity-60 transition-all"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-dark-border">
          <button
            type="button"
            disabled={isArchiving}
            onClick={onClose}
            data-testid="cancel-archive-btn"
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isArchiving || !reason.trim() || tasks.length === 0}
            onClick={handleConfirm}
            data-testid="confirm-archive-btn"
            className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {isArchiving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Archiving {tasks.length} Tasks...</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>Archive {tasks.length} Tasks</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
