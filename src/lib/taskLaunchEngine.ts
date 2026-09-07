// ==============================================================================
// SERVICE: taskLaunchEngine
// Location: src/lib/taskLaunchEngine.ts
// Phase: 3D — Transactional Bulk Task Launch Engine (Service Templates & Work Plans)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { TaskLaunchBatchResult, ServiceTemplateTask } from '../types';

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
  targetWeek: number; // 1..4 (or 1..13 in plan context)
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
   * Launch a Service Template into client operational tasks (Draft, Unassigned)
   */
  async launchServiceTemplate(params: LaunchServiceTemplateParams): Promise<TaskLaunchBatchResult> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Database client not initialized.' };
    }

    const requestId = params.requestId || generateRequestId();

    // Prepare task payloads enforcing Draft and Unassigned
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
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      if (!currentUserId) {
        return { success: false, error: 'Unauthorized: Missing active user session.' };
      }

      // Invoke server-side RPC for atomic transactional batch creation
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_launch_task_batch', {
        p_actor_id: currentUserId,
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

      if (!rpcErr && rpcRes) {
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

      // Graceful fallback if RPC does not exist yet (e.g. un-migrated preview environment)
      if (rpcErr && (rpcErr.code === '42883' || rpcErr.message?.includes('fn_launch_task_batch'))) {
        return this.clientFallbackLaunch({
          actorId: currentUserId,
          requestId,
          clientId: params.clientId,
          launchType: 'service_template',
          sourceId: params.templateId,
          targetWeek: params.targetWeek,
          tasks: taskPayloads
        });
      }

      return { success: false, error: rpcErr?.message || 'Failed to launch service template tasks.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error executing task launch.' };
    }
  },

  /**
   * Launch a 90-Day Work Plan into client operational tasks (Draft, Unassigned)
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
      week_number: t.planWeek <= 4 ? t.planWeek : 1, // Fallback legacy week_number
      plan_week: t.planWeek,
      occurrence_id: t.occurrenceId,
      source_template_id: t.sourceTemplateId || null,
      source_template_version: t.sourceTemplateVersion || 1
    }));

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      if (!currentUserId) {
        return { success: false, error: 'Unauthorized: Missing active user session.' };
      }

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_launch_task_batch', {
        p_actor_id: currentUserId,
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

      if (!rpcErr && rpcRes) {
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

      // Graceful fallback for unmigrated preview backend
      if (rpcErr && (rpcErr.code === '42883' || rpcErr.message?.includes('fn_launch_task_batch'))) {
        return this.clientFallbackLaunch({
          actorId: currentUserId,
          requestId,
          clientId: params.clientId,
          launchType: 'work_plan',
          sourceId: params.planId,
          targetWeek: 1,
          tasks: taskPayloads
        });
      }

      return { success: false, error: rpcErr?.message || 'Failed to launch work plan.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error executing work plan launch.' };
    }
  },

  /**
   * Fallback client-side batch creation for environments where RPC is not yet applied
   */
  async clientFallbackLaunch(options: {
    actorId: string;
    requestId: string;
    clientId: string;
    launchType: 'service_template' | 'work_plan';
    sourceId: string;
    targetWeek: number;
    tasks: LaunchBatchTaskPayload[];
  }): Promise<TaskLaunchBatchResult> {
    if (!supabase) return { success: false, error: 'Database not initialized.' };

    try {
      // 1. Check client status
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('id, status')
        .eq('id', options.clientId)
        .single();

      if (clientErr || !client) {
        return { success: false, error: 'Target client does not exist.' };
      }
      if (client.status === 'Archived') {
        return { success: false, error: 'Cannot launch tasks for an archived client.' };
      }
      if (client.status === 'Paused') {
        return { success: false, error: 'Cannot launch tasks for a paused client.' };
      }

      // 2. Prepare task rows with strict Draft and Unassigned defaults
      const rows = options.tasks.map((t) => ({
        client_id: options.clientId,
        title: t.title,
        details: t.description || null,
        department_id: t.department_id,
        status: 'Draft',
        priority: t.priority || 'Normal',
        approval_mode: t.approval_mode || 'Internal Only',
        assignee_id: null,
        week_number: t.week_number || (options.targetWeek <= 4 ? options.targetWeek : 1),
        planned_start: t.planned_date || null,
        due_date: t.due_date || null,
        source_template_id: t.source_template_id || null,
        source_template_version: t.source_template_version || 1,
        created_by: options.actorId
      }));

      const { data: created, error: insertErr } = await supabase
        .from('client_tasks')
        .insert(rows)
        .select('id');

      if (insertErr || !created) {
        return { success: false, error: insertErr?.message || 'Failed to create task batch.' };
      }

      const taskIds = created.map((c) => c.id);

      // Attempt to record launch batch
      try {
        await supabase.from('task_launch_batches').insert({
          request_id: options.requestId,
          actor_id: options.actorId,
          client_id: options.clientId,
          launch_type: options.launchType,
          source_template_id: options.launchType === 'service_template' ? options.sourceId : null,
          source_plan_id: options.launchType === 'work_plan' ? options.sourceId : null,
          target_week: options.targetWeek,
          task_count: taskIds.length,
          task_ids: taskIds
        });
      } catch {
        // Non-fatal on fallback
      }

      return {
        success: true,
        taskCount: taskIds.length,
        taskIds
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Fallback launch error.' };
    }
  }
};
