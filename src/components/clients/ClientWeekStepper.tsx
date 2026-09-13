import React, { useState } from 'react';
import { Edit2, Check, X, CheckCircle2, Clock } from 'lucide-react';
import { ClientRecord, ClientTask, UserProfile, DEFAULT_WEEK_NAMES } from '../../types';

interface ClientWeekStepperProps {
  client: ClientRecord;
  activeWeekNum: 1 | 2 | 3 | 4;
  onSelectWeek: (weekNum: 1 | 2 | 3 | 4) => void;
  weekNames: Record<1 | 2 | 3 | 4, string>;
  onRenameWeek?: (weekNum: 1 | 2 | 3 | 4, newName: string) => Promise<void>;
  tasksByWeek: Record<1 | 2 | 3 | 4, ClientTask[]>;
  currentUserProfile?: UserProfile | null;
}

export const ClientWeekStepper: React.FC<ClientWeekStepperProps> = ({
  client,
  activeWeekNum,
  onSelectWeek,
  weekNames,
  onRenameWeek,
  tasksByWeek,
  currentUserProfile
}) => {
  const [editingWeek, setEditingWeek] = useState<1 | 2 | 3 | 4 | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isOwnerOrManager =
    currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';

  const weeks: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];

  const handleStartEditing = (weekNum: 1 | 2 | 3 | 4, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwnerOrManager || client.status === 'Paused') return;
    setEditingWeek(weekNum);
    setEditNameValue(weekNames[weekNum] || DEFAULT_WEEK_NAMES[weekNum]);
  };

  const handleCancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWeek(null);
    setEditNameValue('');
  };

  const handleSaveRename = async (weekNum: 1 | 2 | 3 | 4, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editNameValue.trim() || !onRenameWeek) {
      setEditingWeek(null);
      return;
    }
    setIsSaving(true);
    try {
      await onRenameWeek(weekNum, editNameValue.trim());
      setEditingWeek(null);
    } catch {
      // Handled in parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-3 shadow-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {weeks.map((weekNum) => {
          const isActive = activeWeekNum === weekNum;
          const name = weekNames[weekNum] || DEFAULT_WEEK_NAMES[weekNum];
          const weekTasks = tasksByWeek[weekNum] || [];
          const totalTasks = weekTasks.length;
          const doneTasks = weekTasks.filter(
            (t) => t.status === 'Done' || t.status === 'Completed'
          ).length;
          const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
          const isEditingThisWeek = editingWeek === weekNum;

          return (
            <div
              key={weekNum}
              data-testid={`week-step-${weekNum}`}
              className={`group relative p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 select-none ${
                isActive
                  ? 'bg-brand-500/10 border-brand-500/50 shadow-sm ring-1 ring-brand-500/20'
                  : 'bg-gray-50/50 dark:bg-dark-200/50 border-gray-200 dark:border-dark-border hover:bg-gray-100/70 dark:hover:bg-dark-200'
              }`}
            >
              {/* Header: Week Label & Rename Controls */}
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => !isEditingThisWeek && onSelectWeek(weekNum)}
                  className="flex items-center gap-1.5 cursor-pointer text-left focus:outline-none"
                >
                  <span
                    className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-200 dark:bg-dark-100 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Week {weekNum}
                  </span>
                  {doneTasks === totalTasks && totalTasks > 0 && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  )}
                </button>

                {/* Rename button for Owner / Operational Manager */}
                {isOwnerOrManager && client.status !== 'Paused' && !isEditingThisWeek && (
                  <button
                    type="button"
                    data-testid={`rename-week-btn-${weekNum}`}
                    onClick={(e) => handleStartEditing(weekNum, e)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-dark-card transition-all cursor-pointer"
                    title="Rename week (client-specific)"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Week Name Display or Inline Edit Input */}
              {isEditingThisWeek ? (
                <div className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    data-testid={`week-name-input-${weekNum}`}
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(weekNum, e as any);
                      if (e.key === 'Escape') handleCancelEditing(e as any);
                    }}
                    autoFocus
                    maxLength={100}
                    disabled={isSaving}
                    className="w-full text-xs font-bold px-2 py-1 rounded-lg border border-brand-500 bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Week Name"
                  />
                  <button
                    type="button"
                    data-testid={`save-week-name-${weekNum}`}
                    onClick={(e) => handleSaveRename(weekNum, e)}
                    disabled={isSaving || !editNameValue.trim()}
                    className="p-1 rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 cursor-pointer"
                    title="Save"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={isSaving}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => onSelectWeek(weekNum)}
                  className="cursor-pointer"
                >
                  <h4
                    className={`text-xs font-bold truncate ${
                      isActive
                        ? 'text-brand-900 dark:text-brand-300'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}
                    title={name}
                  >
                    {name}
                  </h4>
                </div>
              )}

              {/* Progress & Task Count Pill */}
              <div 
                onClick={() => onSelectWeek(weekNum)}
                className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200/50 dark:border-dark-border/50 cursor-pointer"
              >
                <span className="font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
                </span>
                <span className="font-bold text-gray-700 dark:text-gray-300">
                  {doneTasks}/{totalTasks} ({percent}%)
                </span>
              </div>

              {/* Mini progress bar */}
              <div 
                onClick={() => onSelectWeek(weekNum)}
                className="w-full bg-gray-200 dark:bg-dark-border h-1 rounded-full overflow-hidden cursor-pointer"
              >
                <div
                  className={`h-full transition-all duration-300 ${
                    percent === 100 ? 'bg-emerald-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
