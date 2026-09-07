// ==============================================================================
// COMPONENT: ClientWorkPlanView
// Location: src/components/workplans/ClientWorkPlanView.tsx
// Phase: 3D — Client 90-Calendar-Day Work Plans Overview & Builder Launcher
// Restrained Palette: Brand Red (#D32F2F), Black, White, Neutral Grayscale
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { 
  Calendar, Layers, Plus, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, Edit3, Trash2, 
  Rocket, Archive, Loader2, Building2, Eye
} from 'lucide-react';
import { ClientRecord, ClientWorkPlan, Department, UserProfile } from '../../types';
import { workPlanService } from '../../lib/workPlanService';
import { WorkPlanBuilderModal } from './WorkPlanBuilderModal';

interface ClientWorkPlanViewProps {
  client: ClientRecord;
  currentUserProfile?: UserProfile | null;
  departments: Department[];
  onSelectWeek?: (weekNumber: number) => void;
}

export const ClientWorkPlanView: React.FC<ClientWorkPlanViewProps> = ({
  client,
  currentUserProfile,
  departments,
  onSelectWeek
}) => {
  const [plans, setPlans] = useState<ClientWorkPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Builder Modal State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<ClientWorkPlan | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const isOwnerOrManager = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';

  const loadPlans = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await workPlanService.fetchClientPlans(client.id);
      if (res.isUnavailable) {
        setIsUnavailable(true);
        setPlans([]);
      } else if (res.error) {
        setErrorMessage(res.error);
      } else {
        setPlans(res.data);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load work plans.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [client.id]);

  const handleOpenNewBuilder = () => {
    setSelectedPlanForEdit(null);
    setIsBuilderOpen(true);
  };

  const handleOpenEditPlan = (plan: ClientWorkPlan) => {
    setSelectedPlanForEdit(plan);
    setIsBuilderOpen(true);
  };

  const handleDeleteDraft = async (plan: ClientWorkPlan) => {
    if (!window.confirm(`Are you sure you want to delete the draft plan "${plan.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await workPlanService.deleteDraftPlan(plan.id);
      if (res.error) {
        alert(`Failed to delete draft: ${res.error}`);
      } else {
        setActionSuccessMessage(`Draft plan "${plan.name}" deleted.`);
        setTimeout(() => setActionSuccessMessage(null), 3000);
        loadPlans();
      }
    } catch (err: any) {
      alert(`Error deleting draft: ${err?.message}`);
    }
  };

  const handleBuilderSuccess = () => {
    setIsBuilderOpen(false);
    setSelectedPlanForEdit(null);
    setActionSuccessMessage('Work plan saved successfully.');
    setTimeout(() => setActionSuccessMessage(null), 4000);
    loadPlans();
  };

  // Compute plan statistics helper
  const getPlanStats = (plan: ClientWorkPlan) => {
    let totalOccurrences = 0;
    let totalTasks = 0;
    const deptDistribution: Record<string, number> = {};

    (plan.weeks || []).forEach((w) => {
      (w.occurrences || []).forEach((occ) => {
        totalOccurrences += 1;
        (occ.tasks || []).forEach((t) => {
          totalTasks += 1;
          const deptName = t.departmentName || 'General';
          deptDistribution[deptName] = (deptDistribution[deptName] || 0) + 1;
        });
      });
    });

    return { totalOccurrences, totalTasks, deptDistribution };
  };

  return (
    <div className="p-3.5 sm:p-6 max-w-6xl mx-auto space-y-6 select-none">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-500" />
              <span>90-Calendar-Day Work Plans</span>
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase">
              13 Weeks
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Structured 90-day operational roadmap for {client.companyName}. Weeks 1–12 (7 days), Week 13 (6 days).
          </p>
        </div>

        {isOwnerOrManager && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenNewBuilder}
              disabled={client.status === 'Paused'}
              className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Build 90-Day Plan</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Success Toast */}
      {actionSuccessMessage && (
        <div className="p-3 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Backend Migration Notice Banner */}
      {isUnavailable && (
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-card border border-gray-200 dark:border-dark-border text-xs text-gray-700 dark:text-gray-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-gray-900 dark:text-gray-100">
              Phase 3D Work Plan System Initialized
            </div>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
              The 90-Day Work Plan engine is fully compiled in the application shell. Persistent database records will sync when the Phase 3D migration is applied to the production database. You can still test plan building and validation directly.
            </p>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <span className="text-xs text-gray-400 font-medium">Loading 90-day work plans...</span>
        </div>
      ) : plans.length > 0 ? (
        /* Work Plans List */
        <div className="space-y-4">
          {plans.map((plan) => {
            const stats = getPlanStats(plan);
            const isDraft = plan.status === 'Draft';
            const isLaunched = plan.status === 'Launched';

            return (
              <div
                key={plan.id}
                className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl p-5 shadow-sm space-y-4 hover:border-gray-300 dark:hover:border-dark-border/80 transition-all"
              >
                {/* Plan Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        {plan.name}
                      </h3>
                      
                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          isDraft
                            ? 'bg-gray-100 dark:bg-dark-100 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-dark-border'
                            : isLaunched
                            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30 font-black'
                            : 'bg-gray-100 dark:bg-dark-200 text-gray-400 border-gray-200 dark:border-dark-border'
                        }`}
                      >
                        {plan.status}
                      </span>

                      {/* Revision */}
                      <span className="text-[10px] font-mono text-gray-400">
                        Rev {plan.revision}
                      </span>
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {plan.startDate} – {plan.endDate} (90 Calendar Days, 13 Weeks)
                      </span>
                    </div>
                  </div>

                  {/* Top Action Buttons */}
                  <div className="flex items-center gap-2">
                    {isDraft && isOwnerOrManager && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditPlan(plan)}
                          className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] bg-brand-500 text-white hover:bg-brand-600 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Resume Draft</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(plan)}
                          className="p-2 min-h-[36px] text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                          title="Delete Draft"
                          aria-label="Delete Draft"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isLaunched && (
                      <div className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 font-bold bg-brand-500/5 dark:bg-brand-500/10 px-3 py-1.5 rounded-lg border border-brand-500/20">
                        <Rocket className="w-3.5 h-3.5 text-brand-500" />
                        <span>Launched {plan.launchedAt ? new Date(plan.launchedAt).toLocaleDateString() : 'Active'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 dark:border-dark-border/60 text-xs">
                  <div className="bg-gray-50 dark:bg-dark-100/50 p-2.5 rounded-xl">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">Service Occurrences</span>
                    <span className="text-sm font-black text-gray-800 dark:text-gray-200">{stats.totalOccurrences}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-100/50 p-2.5 rounded-xl">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">Total Child Tasks</span>
                    <span className="text-sm font-black text-gray-800 dark:text-gray-200">{stats.totalTasks}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-100/50 p-2.5 rounded-xl col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">Department Distribution</span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {Object.keys(stats.deptDistribution).length > 0 ? (
                        Object.entries(stats.deptDistribution).map(([dept, count]) => (
                          <span key={dept} className="px-1.5 py-0.2 rounded bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border font-mono text-[10px] text-gray-700 dark:text-gray-300">
                            {dept}: {count}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-[11px]">No tasks allocated</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 13-Week Timeline Grid */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    13-Week Schedule Map
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-13 gap-1.5 overflow-x-auto pb-1">
                    {(plan.weeks || []).map((week) => {
                      const weekTaskCount = (week.occurrences || []).reduce(
                        (sum, o) => sum + (o.tasks || []).length,
                        0
                      );

                      return (
                        <div
                          key={week.weekNumber}
                          className={`p-2 rounded-xl border text-center flex flex-col justify-between transition-colors min-w-[64px] ${
                            weekTaskCount > 0
                              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent shadow-xs'
                              : 'bg-gray-50 dark:bg-dark-100/50 border-gray-200 dark:border-dark-border text-gray-500'
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase">
                            W{week.weekNumber}
                          </div>
                          <div className="text-xs font-black my-1">
                            {weekTaskCount}
                          </div>
                          <div className="text-[9px] opacity-75 font-medium truncate">
                            {week.weekNumber === 13 ? '6 days' : '7 days'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-12 shadow-sm min-h-[260px] flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/20">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              No 90-Day Work Plans Defined
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Design a 13-week operational schedule by assembling Service Templates and custom tasks. Plans persist as drafts until launched atomically into Draft tasks.
            </p>
          </div>

          {isOwnerOrManager && (
            <button
              type="button"
              onClick={handleOpenNewBuilder}
              disabled={client.status === 'Paused'}
              className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create First 90-Day Work Plan</span>
            </button>
          )}
        </div>
      )}

      {/* Work Plan Builder Modal */}
      {isBuilderOpen && (
        <WorkPlanBuilderModal
          isOpen={isBuilderOpen}
          onClose={() => {
            setIsBuilderOpen(false);
            setSelectedPlanForEdit(null);
          }}
          onSuccess={handleBuilderSuccess}
          client={client}
          departments={departments}
          existingPlan={selectedPlanForEdit}
        />
      )}
    </div>
  );
};