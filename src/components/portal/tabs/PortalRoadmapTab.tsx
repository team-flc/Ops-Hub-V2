import React from 'react';
import { CheckCircle2, Clock, Calendar, ShieldCheck, Flag } from 'lucide-react';
import { ClientRoadmapMilestone } from '../../../types';

interface PortalRoadmapTabProps {
  milestones: ClientRoadmapMilestone[];
}

export const PortalRoadmapTab: React.FC<PortalRoadmapTabProps> = ({ milestones }) => {
  const completedCount = milestones.filter((m) => m.status === 'completed').length;
  const progressPercent = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Roadmap Headline */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Strategic Roadmap
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              Work Plan & Delivery Milestones
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 max-w-xl">
              Published stages from your 90-day operational blueprint.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-200/50 border border-gray-100 dark:border-dark-border text-right sm:min-w-[160px]">
            <span className="text-[11px] font-bold text-gray-400 block">Overall Execution</span>
            <div className="text-2xl font-black text-gray-900 dark:text-gray-100">
              {progressPercent}%
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              {completedCount} of {milestones.length} Stages Complete
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-dark-200 overflow-hidden">
          <div 
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Milestones List */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl shadow-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-border">
          <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Published Roadmap Stages
          </span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-dark-border">
          {milestones.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">
              No milestones published yet for this roadmap.
            </div>
          ) : (
            milestones.map((m, idx) => {
              const isCompleted = m.status === 'completed';
              const isInProgress = m.status === 'in_progress';

              return (
                <div key={m.id} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isCompleted 
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                        : isInProgress 
                        ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                        : 'bg-gray-100 dark:bg-dark-200 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isInProgress ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <Flag className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-200 text-gray-600 dark:text-gray-300">
                          Week {m.weekNumber}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {m.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-1">
                        {m.dueDate && <span>Target: {new Date(m.dueDate).toLocaleDateString()}</span>}
                        {m.taskCount > 0 && <span>{m.completedTaskCount} of {m.taskCount} tasks finished</span>}
                      </div>
                    </div>
                  </div>

                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border self-start flex-shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : isInProgress
                      ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                      : 'bg-gray-100 text-gray-600 dark:bg-dark-200 dark:text-gray-400 border-gray-200 dark:border-dark-border'
                  }`}>
                    {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Planned'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
