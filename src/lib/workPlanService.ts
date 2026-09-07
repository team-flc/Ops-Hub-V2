// ==============================================================================
// SERVICE: workPlanService
// Location: src/lib/workPlanService.ts
// Phase: 3D — Client 90-Day Work Plans Management & Draft Persistence
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { ClientWorkPlan, WorkPlanWeek, TaskLaunchBatchResult } from '../types';
import { compute90DayPlanRange, generate13PlanWeeks } from './workPlanCalendar';
import { taskLaunchEngine } from './taskLaunchEngine';

function mapPlanRow(row: any): ClientWorkPlan {
  const planData = row.plan_data || {};
  const weeks: WorkPlanWeek[] = planData.weeks || [];

  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    revision: row.revision || 1,
    weeks,
    launchSnapshot: row.launch_snapshot || null,
    launchedAt: row.launched_at || null,
    launchedBy: row.launched_by || null,
    launchBatchId: row.launch_batch_id || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const workPlanService = {
  /**
   * Fetch all 90-Day Work Plans for a client
   */
  async fetchClientPlans(clientId: string): Promise<{ data: ClientWorkPlan[]; error: string | null; isUnavailable?: boolean }> {
    if (!isSupabaseConfigured || !supabase || !clientId) {
      return { data: [], error: null, isUnavailable: true };
    }

    try {
      const { data, error } = await supabase
        .from('client_work_plans')
        .select(`
          id, client_id, name, status, start_date, end_date, revision,
          plan_data, launch_snapshot, launched_at, launched_by, launch_batch_id,
          created_by, updated_by, created_at, updated_at
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error && (error.code === '42P01' || error.message?.includes('client_work_plans'))) {
        return { data: [], error: null, isUnavailable: true };
      }

      if (error) {
        return { data: [], error: error.message };
      }

      const plans = (data || []).map(mapPlanRow);
      return { data: plans, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch work plans.' };
    }
  },

  /**
   * Save or update a Draft Work Plan in the database
   * Survives browser refreshes!
   */
  async saveDraftPlan(input: {
    id?: string;
    clientId: string;
    name: string;
    startDate: string;
    weeks: WorkPlanWeek[];
    expectedRevision?: number;
  }): Promise<{ data: ClientWorkPlan | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized.' };
    }

    if (!input.name?.trim()) {
      return { data: null, error: 'Work plan name is required.' };
    }
    if (!input.startDate) {
      return { data: null, error: 'Plan start date is required.' };
    }

    const { startDate, endDate } = compute90DayPlanRange(input.startDate);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id || null;

      if (input.id) {
        // Update existing draft plan
        const { data: current, error: fetchErr } = await supabase
          .from('client_work_plans')
          .select('id, status, revision')
          .eq('id', input.id)
          .single();

        if (fetchErr || !current) {
          return { data: null, error: 'Plan not found.' };
        }
        if (current.status !== 'Draft') {
          return { data: null, error: 'Cannot modify a plan that is already launched or archived.' };
        }
        if (input.expectedRevision && current.revision !== input.expectedRevision) {
          return { data: null, error: 'Conflict: Plan was updated in another session. Please reload.' };
        }

        const { data: updated, error: updateErr } = await supabase
          .from('client_work_plans')
          .update({
            name: input.name.trim(),
            start_date: startDate,
            end_date: endDate,
            revision: current.revision + 1,
            plan_data: { weeks: input.weeks },
            updated_by: currentUserId,
            updated_at: new Date().toISOString()
          })
          .eq('id', input.id)
          .select()
          .single();

        if (updateErr || !updated) {
          return { data: null, error: updateErr?.message || 'Failed to update draft plan.' };
        }

        return { data: mapPlanRow(updated), error: null };
      } else {
        // Insert new draft plan
        const { data: inserted, error: insertErr } = await supabase
          .from('client_work_plans')
          .insert({
            client_id: input.clientId,
            name: input.name.trim(),
            status: 'Draft',
            start_date: startDate,
            end_date: endDate,
            revision: 1,
            plan_data: { weeks: input.weeks },
            created_by: currentUserId,
            updated_by: currentUserId
          })
          .select()
          .single();

        if (insertErr || !inserted) {
          return { data: null, error: insertErr?.message || 'Failed to create draft plan.' };
        }

        return { data: mapPlanRow(inserted), error: null };
      }
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to save draft plan.' };
    }
  },

  /**
   * Delete a Draft Work Plan
   */
  async deleteDraftPlan(planId: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Database not initialized.' };
    }

    try {
      const { error } = await supabase
        .from('client_work_plans')
        .delete()
        .eq('id', planId)
        .eq('status', 'Draft');

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete draft plan.' };
    }
  },

  /**
   * Launch a 90-Day Work Plan
   */
  async launchPlan(params: {
    planId: string;
    clientId: string;
    expectedRevision: number;
    allTasks: any[];
  }): Promise<TaskLaunchBatchResult> {
    return taskLaunchEngine.launchWorkPlan({
      planId: params.planId,
      clientId: params.clientId,
      expectedRevision: params.expectedRevision,
      tasks: params.allTasks
    });
  }
};
