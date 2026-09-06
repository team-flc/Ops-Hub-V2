// ==============================================================================
// SERVICE: taskTemplateService
// Location: src/lib/taskTemplateService.ts
// Phase 3C: Task Templates System
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import {
  TaskTemplate,
  CreateTaskTemplateInput,
  UpdateTaskTemplateInput
} from '../types';
import { rollForwardToNextMonday } from './taskManagementService';

/**
 * Calculates a due date based on a starting date and duration in business days.
 * Guarantees that neither Saturday nor Sunday will ever be selected as the due date.
 */
export function calculateDueDateFromDuration(startDateStr: string, durationDays: number): string {
  if (!startDateStr) return '';
  const businessDays = Math.max(1, Math.min(30, Math.floor(durationDays || 1)));

  // If start date is a weekend, roll forward to Monday
  const validStart = rollForwardToNextMonday(startDateStr);
  const [y, m, d] = validStart.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));

  // Add (businessDays - 1) working days
  let remaining = businessDays - 1;
  while (remaining > 0) {
    dt.setUTCDate(dt.getUTCDate() + 1);
    const day = dt.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }

  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function mapTemplateRow(row: any): TaskTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id || row.organizationId || undefined,
    name: row.name,
    description: row.description || undefined,
    departmentId: row.department_id || row.departmentId,
    departmentName: row.departments?.name || row.departmentName || undefined,
    defaultTaskTitle: row.default_task_title || row.defaultTaskTitle,
    taskDetails: row.task_details || row.taskDetails || undefined,
    defaultPriority: row.default_priority || row.defaultPriority || 'Normal',
    defaultApprovalMode: row.default_approval_mode || row.defaultApprovalMode || 'Internal Only',
    suggestedDurationDays: row.suggested_duration_days ?? row.suggestedDurationDays ?? 3,
    status: row.status,
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    version: row.version ?? row.version ?? 1,
    createdBy: row.created_by || row.createdBy,
    createdByName: row.creator?.full_name || row.createdByName || undefined,
    updatedBy: row.updated_by || row.updatedBy,
    archivedAt: row.archived_at || row.archivedAt,
    archivedBy: row.archived_by || row.archivedBy,
    archiveReason: row.archive_reason || row.archiveReason,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

export const taskTemplateService = {
  /**
   * Invoke `manage-task-template` Edge Function
   */
  async invokeEdgeFunction(action: string, payload: Record<string, any> = {}): Promise<{ data?: any; error?: string; status?: number }> {
    if (!supabase) return { error: 'Supabase client not initialized' };
    try {
      const { data, error } = await supabase.functions.invoke('manage-task-template', {
        body: { action, ...payload }
      });

      if (error) {
        return { error: typeof error === 'string' ? error : (error.message || 'Edge function execution error') };
      }
      if (data?.error) {
        return { error: data.error };
      }

      return { data };
    } catch (err: any) {
      return { error: err?.message || 'Network error calling task template service.' };
    }
  },

  /**
   * Fetch templates with graceful fallback if table or function is unavailable (e.g. Preview before migration)
   */
  async fetchTemplates(includeArchived = false): Promise<{ data: TaskTemplate[]; error: string | null; isUnavailable?: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [], error: null, isUnavailable: true };
    }

    try {
      // First attempt authoritative Edge Function
      const edgeRes = await this.invokeEdgeFunction('list', { include_archived: includeArchived });

      if (edgeRes.data?.templates) {
        const templates = (edgeRes.data.templates as any[]).map(mapTemplateRow);
        return { data: templates, error: null, isUnavailable: false };
      }

      // If edge function returned an error, attempt direct client query as fallback
      let query = supabase
        .from('task_templates')
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days,
          status, sort_order, version, created_by, updated_by,
          archived_at, archived_by, archive_reason, created_at, updated_at,
          departments(id, name),
          creator:profiles!created_by(id, full_name)
        `)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!includeArchived) {
        query = query.eq('status', 'Active');
      }

      const { data, error } = await query;

      if (error) {
        // Table does not exist yet on remote Supabase or permissions denied
        const isTableMissing = error.message?.includes('task_templates') ||
                               error.code === '42P01' ||
                               error.code === 'PGRST204' ||
                               error.code === 'PGRST200';
        return {
          data: [],
          error: isTableMissing ? null : error.message,
          isUnavailable: true
        };
      }

      const mapped = (data || []).map(mapTemplateRow);
      return { data: mapped, error: null, isUnavailable: false };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch templates.', isUnavailable: true };
    }
  },

  /**
   * Create a new template (Owner only)
   */
  async createTemplate(input: CreateTaskTemplateInput): Promise<{ data: TaskTemplate | null; error: string | null }> {
    const edgeRes = await this.invokeEdgeFunction('create', {
      name: input.name,
      description: input.description,
      department_id: input.departmentId,
      default_task_title: input.defaultTaskTitle,
      task_details: input.taskDetails,
      default_priority: input.defaultPriority || 'Normal',
      default_approval_mode: input.defaultApprovalMode || 'Internal Only',
      suggested_duration_days: input.suggestedDurationDays || 3,
      sort_order: input.sortOrder || 0
    });

    if (edgeRes.error || !edgeRes.data?.template) {
      return { data: null, error: edgeRes.error || 'Failed to create template.' };
    }

    return { data: mapTemplateRow(edgeRes.data.template), error: null };
  },

  /**
   * Update an existing template (Owner only)
   */
  async updateTemplate(id: string, input: UpdateTaskTemplateInput): Promise<{ data: TaskTemplate | null; error: string | null }> {
    const edgeRes = await this.invokeEdgeFunction('update', {
      template_id: id,
      name: input.name,
      description: input.description,
      department_id: input.departmentId,
      default_task_title: input.defaultTaskTitle,
      task_details: input.taskDetails,
      default_priority: input.defaultPriority,
      default_approval_mode: input.defaultApprovalMode,
      suggested_duration_days: input.suggestedDurationDays,
      sort_order: input.sortOrder,
      expected_version: input.expectedVersion
    });

    if (edgeRes.error || !edgeRes.data?.template) {
      return { data: null, error: edgeRes.error || 'Failed to update template.' };
    }

    return { data: mapTemplateRow(edgeRes.data.template), error: null };
  },

  /**
   * Duplicate a template (Owner only)
   */
  async duplicateTemplate(id: string): Promise<{ data: TaskTemplate | null; error: string | null }> {
    const edgeRes = await this.invokeEdgeFunction('duplicate', { template_id: id });

    if (edgeRes.error || !edgeRes.data?.template) {
      return { data: null, error: edgeRes.error || 'Failed to duplicate template.' };
    }

    return { data: mapTemplateRow(edgeRes.data.template), error: null };
  },

  /**
   * Archive a template (Owner only, requires mandatory reason)
   */
  async archiveTemplate(id: string, reason: string, expectedStatus = 'Active'): Promise<{ data: TaskTemplate | null; error: string | null }> {
    if (!reason || !reason.trim()) {
      return { data: null, error: 'A mandatory reason is required to archive a template.' };
    }

    const edgeRes = await this.invokeEdgeFunction('archive', {
      template_id: id,
      archive_reason: reason.trim(),
      expected_status: expectedStatus
    });

    if (edgeRes.error || !edgeRes.data?.template) {
      return { data: null, error: edgeRes.error || 'Failed to archive template.' };
    }

    return { data: mapTemplateRow(edgeRes.data.template), error: null };
  },

  /**
   * Restore an archived template (Owner only)
   */
  async restoreTemplate(id: string, expectedStatus = 'Archived'): Promise<{ data: TaskTemplate | null; error: string | null }> {
    const edgeRes = await this.invokeEdgeFunction('restore', {
      template_id: id,
      expected_status: expectedStatus
    });

    if (edgeRes.error || !edgeRes.data?.template) {
      return { data: null, error: edgeRes.error || 'Failed to restore template.' };
    }

    return { data: mapTemplateRow(edgeRes.data.template), error: null };
  }
};
