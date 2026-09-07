// ==============================================================================
// SERVICE: taskLaunchEngine
// Location: src/lib/taskLaunchEngine.ts
// Phase: 3D — Transactional Bulk Task Launch Engine (RPC-Authoritative)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { TaskLaunchBatchResult } from '../types';

export interface LaunchBatchTaskPayload {
  title: string;
  description?: string | null;
  department_id: string;
  priority?: string;
  approval_mode?: string;
  planned_date?: string | null;
  due_date?: string | null;
  week_number?: number;
  source_template_id?: string | null;
  source_template_version?: number;
  plan_week?: number;
  occurrence_id?: string;
}

export interface LaunchServiceTemplateParams {
  clientId: string;
  templateId: string;
  templateVersion: number;
  targetWeek: number; // 1..4
  tasks: Array<{
    title: string;
    description?: string | null;
    departmentId: string;
    priority?: string;
    approvalMode?: string;
    plannedDate?: string;
    dueDate?: string;
  }>;
  requestId?: string;
}

export interface LaunchWorkPlanParams {
  clientId: string;
  planId: string;
  expectedRevision: number;
  tasks: Array<{
    title: string;
    description?: string | null;
    departmentId: string;
    priority?: string;
    approvalMode?: string;
    plannedDate?: string;
    dueDate?: string;
    planWeek: number;
    occurrenceId?: string;
    sourceTemplateId?: string;
    sourceTemplateVersion?: number;
  }>;
  requestId?: string;
}

export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const taskLaunchEngine = {
  /**
   * Check if a template has already been applied to a specific client and week
   */
  async checkExistingTemplateApplication(clientId: string, templateId: string, weekNumber: number): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { data, error } = await supabase
        .from('task_launch_batches')
        .select('id')
        .eq('client_id', clientId)
        .eq('source_template_id', templateId)
        .eq('target_week', weekNumber)
        .limit(1);

      if (error) return false;
      return (data && data.length > 0) || false;
    } catch {
      return false;
    }
  },

  /**
   * Launch a Service Template into client operational tasks via Authoritative RPC (fn_launch_task_batch)
   */
  async launchServiceTemplate(params: LaunchServiceTemplateParams): Promise<TaskLaunchBatchResult> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Database client not initialized.' };
    }

    const requestId = params.requestId || generateRequestId();

    const taskPayloads: LaunchBatchTaskPayload[] = params.tasks.map((t) => ({
      title: t.title.trim(),
      description: t.description?.trim() || null,
      department_id: t.departmentId,
      priority: t.priority || 'Normal',
      approval_mode: t.approvalMode || 'Internal Only',
      planned_date: t.plannedDate || null,
      due_date: t.dueDate || null,
      week_number: params.targetWeek,
      source_template_id: params.templateId,
      source_template_version: params.templateVersion
    }));

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_launch_task_batch', {
        p_request_id: requestId,
        p_client_id: params.clientId,
        p_launch_type: 'service_template',
        p_source_id: params.templateId,
        p_target_week: params.targetWeek,
        p_tasks: taskPayloads,
        p_metadata: {
          template_id: params.templateId,
          template_version: params.templateVersion,
          target_week: params.targetWeek
        }
      });

      if (rpcErr) {
        return { success: false, error: rpcErr.message };
      }

      if (rpcRes) {
        if (rpcRes.error) {
          return { success: false, error: rpcRes.error };
        }
        return {
          success: true,
          batchId: rpcRes.batch_id,
          taskCount: rpcRes.task_count,
          taskIds: rpcRes.task_ids,
          idempotentReplay: rpcRes.idempotent_replay || false
        };
      }

      return { success: false, error: 'Failed to launch service template tasks.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error executing task launch.' };
    }
  },

  /**
   * Launch a 90-Day Work Plan into client operational tasks via Authoritative RPC (fn_launch_task_batch)
   */
  async launchWorkPlan(params: LaunchWorkPlanParams): Promise<TaskLaunchBatchResult> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Database client not initialized.' };
    }

    const requestId = params.requestId || generateRequestId();

    const taskPayloads: LaunchBatchTaskPayload[] = params.tasks.map((t) => ({
      title: t.title.trim(),
      description: t.description?.trim() || null,
      department_id: t.departmentId,
      priority: t.priority || 'Normal',
      approval_mode: t.approvalMode || 'Internal Only',
      planned_date: t.plannedDate || null,
      due_date: t.dueDate || null,
      week_number: ((t.planWeek - 1) % 4) + 1,
      plan_week: t.planWeek,
      occurrence_id: t.occurrenceId,
      source_template_id: t.sourceTemplateId || null,
      source_template_version: t.sourceTemplateVersion || 1
    }));

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_launch_task_batch', {
        p_request_id: requestId,
        p_client_id: params.clientId,
        p_launch_type: 'work_plan',
        p_source_id: params.planId,
        p_target_week: null,
        p_tasks: taskPayloads,
        p_metadata: {
          plan_id: params.planId,
          expected_revision: params.expectedRevision
        }
      });

      if (rpcErr) {
        return { success: false, error: rpcErr.message };
      }

      if (rpcRes) {
        if (rpcRes.error) {
          return { success: false, error: rpcRes.error };
        }
        return {
          success: true,
          batchId: rpcRes.batch_id,
          taskCount: rpcRes.task_count,
          taskIds: rpcRes.task_ids,
          idempotentReplay: rpcRes.idempotent_replay || false
        };
      }

      return { success: false, error: 'Failed to launch work plan.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error executing work plan launch.' };
    }
  }
};
