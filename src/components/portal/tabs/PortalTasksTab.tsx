import React, { useState } from 'react';
import { 
  CheckCircle2, Clock, AlertTriangle, Calendar, 
  Search, Filter, Check, MessageSquare, ExternalLink, X
} from 'lucide-react';
import { ClientTask } from '../../../types';


export function getFriendlyTaskStatus(status: string): 'Action Needed' | 'In Progress' | 'Completed' | 'Upcoming' {
  if (status === 'Client Review') return 'Action Needed';
  if (status === 'Completed') return 'Completed';
  if (status === 'Assigned' || status === 'Team Review' || status === 'Blocked') return 'In Progress';
  return 'Upcoming';
}


interface PortalTasksTabProps {
  tasks: ClientTask[];
  isReadOnlyPreview: boolean;
  onApproveTask: (taskId: string) => Promise<void>;
  onRequestChanges: (taskId: string, feedback: string) => Promise<void>;
  selectedTask: ClientTask | null;
  onSelectTask: (task: ClientTask | null) => void;
}

export const PortalTasksTab: React.FC<PortalTasksTabProps> = ({
  tasks,
  isReadOnlyPreview,
  onApproveTask,
  onRequestChanges,
  selectedTask,
  onSelectTask
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'Action Needed' | 'In Progress' | 'Completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackPrompt, setFeedbackPrompt] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const filteredTasks = tasks.filter((t) => {
    const fStatus = getFriendlyTaskStatus(t.status);
    if (activeFilter !== 'all' && fStatus !== activeFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.details && t.details.toLowerCase().includes(q))
    );
  });

  const handleApprove = async (taskId: string) => {
    if (isReadOnlyPreview) {
      setActionMsg('Approvals are disabled in Staff Preview Mode.');
      setTimeout(() => setActionMsg(null), 4000);
      return;
    }
    setActionLoading(true);
    try {
      await onApproveTask(taskId);
      setActionMsg('Approved successfully!');
      setTimeout(() => setActionMsg(null), 4000);
    } catch {
      setActionMsg('Failed to approve. Please try again.');
      setTimeout(() => setActionMsg(null), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async (taskId: string) => {
    if (isReadOnlyPreview) {
      setActionMsg('Actions are disabled in Staff Preview Mode.');
      setTimeout(() => setActionMsg(null), 4000);
      return;
    }
    if (!feedbackText.trim()) return;
    setActionLoading(true);
    try {
      await onRequestChanges(taskId, feedbackText);
      setFeedbackPrompt(false);
      setFeedbackText('');
      setActionMsg('Changes requested. Team has been notified.');
      setTimeout(() => setActionMsg(null), 4000);
    } catch {
      setActionMsg('Failed to submit feedback. Please try again.');
      setTimeout(() => setActionMsg(null), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeStyle = (friendlyStatus: string) => {
    switch (friendlyStatus) {
      case 'Action Needed':
        return 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20 font-black';
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-dark-100 dark:text-gray-300 border-gray-200 dark:border-dark-border';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Action Notification */}
      {actionMsg && (
        <div className="p-3.5 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold shadow-lg flex items-center justify-between">
          <span>{actionMsg}</span>
          <button type="button" onClick={() => setActionMsg(null)}>×</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-4 sm:p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['all', 'Action Needed', 'In Progress', 'Completed'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeFilter === filter
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-100'
              }`}
            >
              {filter === 'all' ? 'All Deliverables' : filter}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deliverables..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Tasks Feed Table / List */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl shadow-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Client Deliverable Feed ({filteredTasks.length})
          </span>
          <span className="text-[11px] text-gray-400">
            Internal drafts and private operational notes are excluded
          </span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-dark-border">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">
              No deliverables matching the current filter.
            </div>
          ) : (
            filteredTasks.map((t) => {
              const friendly = getFriendlyTaskStatus(t.status);

              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/80 dark:hover:bg-dark-200/40 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 transition-colors">
                        {t.title}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeStyle(friendly)}`}>
                        {friendly}
                      </span>
                    </div>

                    {t.details && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {t.details}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      {t.dueDate && <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>}
                      {t.completedAt && <span>Completed: {new Date(t.completedAt).toLocaleDateString()}</span>}
                      {t.assigneeName && <span>Lead: {t.assigneeName}</span>}
                    </div>
                  </div>

                  {/* Quick Actions if Action Needed */}
                  {friendly === 'Action Needed' && (
                    <div 
                      className="flex items-center gap-2 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={isReadOnlyPreview}
                        onClick={() => handleApprove(t.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectTask(t)}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-100 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Task Details Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-end animate-fade-in">
          <div className="bg-white dark:bg-dark-card w-full max-w-lg h-full p-6 sm:p-8 overflow-y-auto shadow-2xl border-l border-gray-200 dark:border-dark-border flex flex-col justify-between animate-slide-left">
            <div className="space-y-6">
              {/* Top Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${getStatusBadgeStyle(getFriendlyTaskStatus(selectedTask.status))}`}>
                  {getFriendlyTaskStatus(selectedTask.status)}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectTask(null)}
                  className="p-1 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Details */}
              <div className="space-y-3">
                <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                  {selectedTask.title}
                </h3>
                {selectedTask.details ? (
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {selectedTask.details}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">No additional description provided.</p>
                )}
              </div>

              {/* Meta information */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-200/50 border border-gray-100 dark:border-dark-border space-y-2 text-xs">
                {selectedTask.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Target Date:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {new Date(selectedTask.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedTask.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Completed On:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {new Date(selectedTask.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedTask.assigneeName && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Specialist:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {selectedTask.assigneeName}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Needed Authorization Box */}
              {selectedTask.status === 'Client Review' && (
                <div className="p-4 rounded-2xl border border-brand-500/30 bg-brand-500/5 space-y-3">
                  <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-black">Client Authorization Required</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Review this deliverable. You can approve it directly or request modifications.
                  </p>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isReadOnlyPreview || actionLoading}
                      onClick={() => handleApprove(selectedTask.id)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      Approve Deliverable
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnlyPreview || actionLoading}
                      onClick={() => setFeedbackPrompt(!feedbackPrompt)}
                      className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      Request Changes
                    </button>
                  </div>

                  {feedbackPrompt && (
                    <div className="pt-3 space-y-2">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Detail the revisions required..."
                        rows={3}
                        className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-xs text-gray-900 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        disabled={!feedbackText.trim() || actionLoading}
                        onClick={() => handleRequestChanges(selectedTask.id)}
                        className="w-full py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Submit Revisions
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-dark-border">
              <button
                type="button"
                onClick={() => onSelectTask(null)}
                className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 hover:bg-gray-100 dark:bg-dark-200 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
