import React, { useState } from 'react';
import { 
  CheckCircle2, Clock, AlertTriangle, ArrowRight, 
  TrendingUp, Award, Calendar, Check, MessageSquare,
  Sparkles, ShieldCheck, HelpCircle
} from 'lucide-react';
import { 
  ClientRecord,
  ClientTask,
  ClientPortalOverviewData,
  ClientRoadmapMilestone,
  ClientDeliverableItem,
  UserProfile
} from '../../../types';


export function getFriendlyTaskStatus(status: string): 'Action Needed' | 'In Progress' | 'Completed' | 'Upcoming' {
  if (status === 'Client Review') return 'Action Needed';
  if (status === 'Completed') return 'Completed';
  if (status === 'Assigned' || status === 'Team Review' || status === 'Blocked') return 'In Progress';
  return 'Upcoming';
}


interface PortalOverviewTabProps {
  client: ClientRecord;
  overview: ClientPortalOverviewData | null;
  tasks: ClientTask[];
  milestones: ClientRoadmapMilestone[];
  deliverables: ClientDeliverableItem[];
  isReadOnlyPreview: boolean;
  currentUserProfile: UserProfile | null;
  onSelectTab: (tabId: 'overview' | 'tasks' | 'roadmap' | 'deliverables') => void;
  onApproveTask: (taskId: string) => Promise<void>;
  onRequestChanges: (taskId: string, feedback: string) => Promise<void>;
  onSelectTask: (task: ClientTask) => void;
}

export const PortalOverviewTab: React.FC<PortalOverviewTabProps> = ({
  client,
  overview,
  tasks,
  milestones,
  deliverables,
  isReadOnlyPreview,
  onSelectTab,
  onApproveTask,
  onRequestChanges,
  onSelectTask
}) => {
  const [feedbackTaskId, setFeedbackTaskId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Review Tasks (Action Needed)
  const reviewTasks = tasks.filter((t) => t.status === 'Client Review');
  // In Progress Tasks
  const inProgressTasks = tasks.filter((t) => t.status === 'Assigned' || t.status === 'Team Review' || t.status === 'Blocked').slice(0, 4);
  // Upcoming Roadmap Milestones
  const upcomingMilestones = milestones.filter((m) => m.status !== 'completed').slice(0, 3);
  // Verified Results
  const publishedResults = overview?.publishedResults || [];

  const handleApprove = async (taskId: string) => {
    if (isReadOnlyPreview) return;
    setIsSubmitting(true);
    try {
      await onApproveTask(taskId);
    } catch {
      // Error handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestChangesSubmit = async (taskId: string) => {
    if (isReadOnlyPreview) return;
    if (!feedbackText.trim()) {
      setFeedbackError('Please specify the revisions required.');
      return;
    }
    setFeedbackError(null);
    setIsSubmitting(true);
    try {
      await onRequestChanges(taskId, feedbackText);
      setFeedbackTaskId(null);
      setFeedbackText('');
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to submit revisions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 30-Second Rule: Executive Headline Banner */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Executive Snapshot
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {client.companyName} Growth Engine
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 max-w-xl">
              {overview?.factualSummary || 'Real-time progress, verified business outcomes, and items requiring your direct authorization.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{client.status === 'Paused' ? 'Workspace Paused' : 'Workspace Active'}</span>
            </span>
          </div>
        </div>

        {/* 4 Delivery Indicator Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-dark-border">
          {/* 1. Delivered */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-200/50 border border-gray-100 dark:border-dark-border space-y-2">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Delivered</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {overview?.completedInPeriodCount ?? tasks.filter((t) => t.status === 'Completed').length}
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {deliverables.length} assets published
            </p>
          </div>

          {/* 2. In Progress */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-200/50 border border-gray-100 dark:border-dark-border space-y-2">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {overview?.inProgressCount ?? inProgressTasks.length}
            </div>
            <p className="text-[11px] text-gray-400 truncate">Deliverables in motion</p>
          </div>

          {/* 3. Action Needed */}
          <div className={`p-4 rounded-2xl border space-y-2 transition-all ${
            reviewTasks.length > 0
              ? 'bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400'
              : 'bg-gray-50 dark:bg-dark-200/50 border-gray-100 dark:border-dark-border text-gray-400'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider">Action Needed</span>
              <AlertTriangle className={`w-4 h-4 ${
                reviewTasks.length > 0 ? 'text-brand-500 animate-bounce' : 'text-gray-400'
              }`} />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {reviewTasks.length}
            </div>
            <p className="text-[11px] opacity-80 truncate">
              {reviewTasks.length > 0 ? 'Awaiting your review' : 'All caught up'}
            </p>
          </div>

          {/* 4. Next Milestone */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-200/50 border border-gray-100 dark:border-dark-border space-y-2">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Next Target</span>
              <Calendar className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-sm font-black text-gray-900 dark:text-gray-100 truncate pt-1">
              {upcomingMilestones[0]?.title || 'Roadmap Stage'}
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {upcomingMilestones[0]?.dueDate ? `Due: ${new Date(upcomingMilestones[0].dueDate).toLocaleDateString()}` : 'On Schedule'}
            </p>
          </div>
        </div>
      </div>

      {/* 30-Second Rule Question 3: WHAT NEEDS MY INPUT? (Client Approvals Queue) */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${
              reviewTasks.length > 0 ? 'bg-brand-500 animate-pulse' : 'bg-emerald-500'
            }`} />
            <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-gray-100 tracking-tight">
              Items Awaiting Your Approval ({reviewTasks.length})
            </h3>
          </div>
          {reviewTasks.length > 0 && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Action Required
            </span>
          )}
        </div>

        {reviewTasks.length === 0 ? (
          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-dark-200/30 border border-dashed border-gray-200 dark:border-dark-border text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
              You are completely up to date!
            </p>
            <p className="text-[11px] text-gray-400">
              No deliverables or assets currently require your input or approval.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviewTasks.map((t) => {
              const isPromptOpen = feedbackTaskId === t.id;

              return (
                <div 
                  key={t.id}
                  className="p-4 sm:p-5 rounded-2xl border border-brand-500/30 bg-brand-500/5 dark:bg-brand-500/5 space-y-4 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-gray-900 dark:text-gray-100">
                          {t.title}
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-500 text-white">
                          Action Needed
                        </span>
                      </div>
                      {t.details && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                          {t.details}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-1">
                        {t.dueDate && <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>}
                        {t.assigneeName && <span>Operations Lead: {t.assigneeName}</span>}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isReadOnlyPreview || isSubmitting}
                        onClick={() => handleApprove(t.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                        title={isReadOnlyPreview ? 'Disabled in Staff Preview' : 'Approve deliverable'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        disabled={isReadOnlyPreview || isSubmitting}
                        onClick={() => {
                          setFeedbackTaskId(isPromptOpen ? null : t.id);
                          setFeedbackText('');
                          setFeedbackError(null);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-100 dark:hover:bg-dark-200 text-gray-800 dark:text-gray-200 text-xs font-bold transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
                        title={isReadOnlyPreview ? 'Disabled in Staff Preview' : 'Request changes'}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Request Changes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectTask(t)}
                        className="px-2.5 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-dark-200 text-gray-500 dark:text-gray-400 text-xs font-medium transition-colors"
                        title="View Deliverable Details"
                      >
                        Details
                      </button>
                    </div>
                  </div>

                  {/* Feedback Reason Prompt Drawer */}
                  {isPromptOpen && (
                    <div className="pt-3 border-t border-brand-500/20 space-y-2.5 animate-scale-up">
                      <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                        Describe what changes or clarifications you need:
                      </label>
                      {feedbackError && (
                        <p className="text-xs text-rose-500 font-semibold">{feedbackError}</p>
                      )}
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="e.g. Please revise the executive summary to highlight demo bookings..."
                        rows={2}
                        className="w-full p-3 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFeedbackTaskId(null);
                            setFeedbackText('');
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!feedbackText.trim() || isSubmitting}
                          onClick={() => handleRequestChangesSubmit(t.id)}
                          className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          Submit Revisions
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 30-Second Rule Question 5: VERIFIED BUSINESS RESULTS */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-500" />
              <span className="text-[11px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Performance Outcomes
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-gray-100 tracking-tight">
              Verified Business Results
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Enterprise Verified
          </span>
        </div>

        {publishedResults.length === 0 ? (
          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-dark-200/30 border border-dashed border-gray-200 dark:border-dark-border text-center space-y-1">
            <Sparkles className="w-6 h-6 text-gray-400 mx-auto" />
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
              Verified results will appear here
            </p>
            <p className="text-[11px] text-gray-400">
              Your account manager will publish verified conversion, meeting, and outreach outcomes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedResults.map((res) => (
              <div 
                key={res.id}
                className="p-4 rounded-2xl border border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-200/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {res.metricName}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                    {res.metricValue}
                  </span>
                </div>

                <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-100 dark:border-dark-border">
                  <span>{res.reportingPeriod || 'Cycle'}</span>
                  {res.source && <span>Source: {res.source}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 30-Second Rule Questions 2 & 4: WHAT IS HAPPENING NOW & WHAT HAPPENS NEXT? */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* What is happening now? */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>What Is Happening Now</span>
            </h4>
            <button
              type="button"
              onClick={() => onSelectTab('tasks')}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              <span>View all ({tasks.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {inProgressTasks.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                No tasks currently in progress. All active sprints are up to date.
              </p>
            ) : (
              inProgressTasks.map((t) => (
                <div 
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-dark-200/50 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                      {t.title}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {t.dueDate ? `Target: ${new Date(t.dueDate).toLocaleDateString()}` : 'Sprint Active'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex-shrink-0">
                    In Progress
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* What happens next? */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              <span>What Happens Next (Roadmap)</span>
            </h4>
            <button
              type="button"
              onClick={() => onSelectTab('roadmap')}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              <span>View roadmap</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {upcomingMilestones.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                All scheduled roadmap milestones have been completed!
              </p>
            ) : (
              upcomingMilestones.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3 px-2">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                      {m.title}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {m.dueDate ? `Target: ${new Date(m.dueDate).toLocaleDateString()}` : 'Planned'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    m.status === 'in_progress'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      : 'bg-gray-100 dark:bg-dark-200 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-dark-border'
                  }`}>
                    {m.status === 'in_progress' ? 'In Progress' : 'Planned'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
