// ==============================================================================
// SERVICE: workPlanService
// Location: src/lib/workPlanService.ts
// Phase: 3D — Client 90-Day Work Plans Management (RPC-Authoritative)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { ClientWorkPlan, WorkPlanWeek, TaskLaunchBatchResult } from '../types';
import { compute90DayPlanRange } from './workPlanCalendar';
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
   * Fetch a single Work Plan by ID
   */
  async fetchPlanById(id: string): Promise<{ data: ClientWorkPlan | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase || !id) {
      return { data: null, error: 'Database not initialized.' };
    }

    try {
      const { data, error } = await supabase
        .from('client_work_plans')
        .select(`
          id, client_id, name, status, start_date, end_date, revision,
          plan_data, launch_snapshot, launched_at, launched_by, launch_batch_id,
          created_by, updated_by, created_at, updated_at
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return { data: null, error: error?.message || 'Work plan not found.' };
      }

      return { data: mapPlanRow(data), error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to fetch work plan.' };
    }
  },

  /**
   * Save or update a Draft Work Plan via Authoritative RPC (fn_save_draft_work_plan)
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
    if (!Array.isArray(input.weeks) || input.weeks.length !== 13) {
      return { data: null, error: 'A 90-day work plan must contain exactly 13 weeks.' };
    }

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_save_draft_work_plan', {
        p_plan_id: input.id || null,
        p_client_id: input.clientId,
        p_name: input.name.trim(),
        p_start_date: input.startDate,
        p_weeks: input.weeks,
        p_expected_revision: input.expectedRevision || null
      });

      if (rpcErr) {
        return { data: null, error: rpcErr.message };
      }
      if (rpcRes?.error) {
        return { data: null, error: rpcRes.error };
      }

      if (rpcRes?.plan_id) {
        return this.fetchPlanById(rpcRes.plan_id);
      }

      return { data: null, error: 'Failed to save draft plan via server authority.' };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to save draft plan.' };
    }
  },

  /**
   * Delete a Draft Work Plan via Authoritative RPC (fn_delete_draft_work_plan)
   */
  async deleteDraftPlan(planId: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured || !supabase || !planId) {
      return { success: false, error: 'Database not initialized.' };
    }

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_delete_draft_work_plan', {
        p_plan_id: planId
      });

      if (rpcErr) {
        return { success: false, error: rpcErr.message };
      }
      if (rpcRes?.error) {
        return { success: false, error: rpcRes.error };
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
