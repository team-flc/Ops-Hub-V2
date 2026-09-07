// ==============================================================================
// SERVICE: serviceTemplateService
// Location: src/lib/serviceTemplateService.ts
// Phase: 3D — Multi-Task Service Templates Management (RPC-Authoritative)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import {
  ServiceTemplate,
  ServiceTemplateTask,
  CreateServiceTemplateInput,
  UpdateServiceTemplateInput
} from '../types';
import { taskTemplateService } from './taskTemplateService';

function mapTemplateRow(row: any): ServiceTemplate {
  const rawTasks = row.tasks || row.service_template_tasks || [];
  const tasks: ServiceTemplateTask[] = rawTasks.map((t: any) => ({
    id: t.id,
    definitionId: t.definition_id || t.definitionId || t.id,
    title: t.title,
    description: t.description || null,
    departmentId: t.department_id || t.departmentId,
    departmentName: t.departments?.name || t.departmentName || 'Department',
    priority: t.priority || 'Normal',
    approvalMode: t.approval_mode || t.approvalMode || 'Internal Only',
    plannedOffsetDays: t.planned_offset_days ?? t.plannedOffsetDays ?? 0,
    durationBusinessDays: t.duration_business_days ?? t.durationBusinessDays ?? 1,
    displayOrder: t.display_order ?? t.displayOrder ?? 0
  })).sort((a: ServiceTemplateTask, b: ServiceTemplateTask) => a.displayOrder - b.displayOrder);

  return {
    id: row.id,
    name: row.name,
    serviceLabel: row.service_label || row.serviceLabel || 'General Service',
    description: row.description || null,
    status: row.status,
    version: row.version || 1,
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    tasks,
    createdBy: row.created_by || row.createdBy,
    createdByName: row.creator?.full_name || row.createdByName || null,
    updatedBy: row.updated_by || row.updatedBy,
    archivedAt: row.archived_at || row.archivedAt,
    archivedBy: row.archived_by || row.archivedBy,
    archiveReason: row.archive_reason || row.archiveReason,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

export const serviceTemplateService = {
  /**
   * Fetch all Service Templates
   * Owner gets all (including archived if requested); Operational Manager gets active only.
   */
  async fetchTemplates(includeArchived = false): Promise<{ data: ServiceTemplate[]; error: string | null; isUnavailable?: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [], error: null, isUnavailable: true };
    }

    try {
      let query = supabase
        .from('service_templates')
        .select(`
          id, name, service_label, description, status, version, sort_order,
          created_by, updated_by, archived_at, archived_by, archive_reason,
          created_at, updated_at,
          tasks:service_template_tasks(
            id, definition_id, title, description, department_id,
            priority, approval_mode, planned_offset_days, duration_business_days, display_order,
            departments(id, name)
          )
        `)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (!includeArchived) {
        query = query.eq('status', 'Active');
      }

      const { data, error } = await query;

      // Graceful read-only fallback if service_templates table does not exist yet
      if (error && (error.code === '42P01' || error.message?.includes('service_templates'))) {
        const legacyRes = await taskTemplateService.fetchTemplates(includeArchived);
        if (legacyRes.data) {
          const mapped: ServiceTemplate[] = legacyRes.data.map((tpl) => ({
            id: tpl.id,
            name: tpl.name,
            serviceLabel: tpl.departmentName || 'General Service',
            description: tpl.description || null,
            status: tpl.status,
            version: tpl.version,
            sortOrder: tpl.sortOrder,
            tasks: [
              {
                definitionId: tpl.id,
                title: tpl.defaultTaskTitle,
                description: tpl.taskDetails || null,
                departmentId: tpl.departmentId,
                departmentName: tpl.departmentName,
                priority: tpl.defaultPriority,
                approvalMode: tpl.defaultApprovalMode,
                plannedOffsetDays: 0,
                durationBusinessDays: tpl.suggestedDurationDays,
                displayOrder: 0
              }
            ],
            createdBy: tpl.createdBy,
            createdByName: tpl.createdByName,
            createdAt: tpl.createdAt,
            updatedAt: tpl.updatedAt
          }));
          return { data: mapped, error: null, isUnavailable: true };
        }
        return { data: [], error: null, isUnavailable: true };
      }

      if (error) {
        return { data: [], error: error.message };
      }

      const templates = (data || []).map(mapTemplateRow);
      return { data: templates, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch service templates.' };
    }
  },

  /**
   * Fetch a single Service Template by ID
   */
  async fetchTemplateById(id: string): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase || !id) {
      return { data: null, error: 'Database not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('service_templates')
        .select(`
          id, name, service_label, description, status, version, sort_order,
          created_by, updated_by, archived_at, archived_by, archive_reason,
          created_at, updated_at,
          tasks:service_template_tasks(
            id, definition_id, title, description, department_id,
            priority, approval_mode, planned_offset_days, duration_business_days, display_order,
            departments(id, name)
          )
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return { data: null, error: error?.message || 'Template not found.' };
      }

      return { data: mapTemplateRow(data), error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to fetch service template.' };
    }
  },

  /**
   * Create a new Service Template via Authoritative RPC (fn_manage_service_template)
   */
  async createTemplate(input: CreateServiceTemplateInput): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized.' };
    }

    if (!input.name?.trim()) {
      return { data: null, error: 'Template name is required.' };
    }
    if (!input.serviceLabel?.trim()) {
      return { data: null, error: 'Service category label is required.' };
    }
    if (!Array.isArray(input.tasks) || input.tasks.length === 0) {
      return { data: null, error: 'At least one child task is required for a Service Template.' };
    }
    if (input.tasks.length > 100) {
      return { data: null, error: 'A Service Template can contain at most 100 tasks.' };
    }

    const taskPayloads = input.tasks.map((t, idx) => ({
      definition_id: t.definitionId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined),
      title: t.title.trim(),
      description: t.description?.trim() || null,
      department_id: t.departmentId,
      priority: t.priority || 'Normal',
      approval_mode: t.approvalMode || 'Internal Only',
      planned_offset_days: t.plannedOffsetDays || 0,
      duration_business_days: t.durationBusinessDays || 1,
      display_order: idx
    }));

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_manage_service_template', {
        p_action: 'create',
        p_template_id: null,
        p_name: input.name.trim(),
        p_service_label: input.serviceLabel.trim(),
        p_description: input.description?.trim() || null,
        p_tasks: taskPayloads,
        p_sort_order: 0,
        p_archive_reason: null,
        p_expected_version: null
      });

      if (rpcErr) {
        return { data: null, error: rpcErr.message };
      }
      if (rpcRes?.error) {
        return { data: null, error: rpcRes.error };
      }

      if (rpcRes?.template_id) {
        return this.fetchTemplateById(rpcRes.template_id);
      }

      return { data: null, error: 'Failed to create template via server authority.' };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to create service template.' };
    }
  },

  /**
   * Update an existing Service Template via Authoritative RPC (fn_manage_service_template)
   */
  async updateTemplate(id: string, input: UpdateServiceTemplateInput): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized.' };
    }

    const taskPayloads = input.tasks ? input.tasks.map((t, idx) => ({
      definition_id: t.definitionId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined),
      title: t.title.trim(),
      description: t.description?.trim() || null,
      department_id: t.departmentId,
      priority: t.priority || 'Normal',
      approval_mode: t.approvalMode || 'Internal Only',
      planned_offset_days: t.plannedOffsetDays || 0,
      duration_business_days: t.durationBusinessDays || 1,
      display_order: idx
    })) : undefined;

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_manage_service_template', {
        p_action: 'update',
        p_template_id: id,
        p_name: input.name?.trim() || null,
        p_service_label: input.serviceLabel?.trim() || null,
        p_description: input.description !== undefined ? (input.description?.trim() || null) : null,
        p_tasks: taskPayloads || [],
        p_sort_order: 0,
        p_archive_reason: null,
        p_expected_version: input.expectedVersion || 1
      });

      if (rpcErr) {
        return { data: null, error: rpcErr.message };
      }
      if (rpcRes?.error) {
        return { data: null, error: rpcRes.error };
      }

      return this.fetchTemplateById(id);
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to update service template.' };
    }
  },

  /**
   * Duplicate a Service Template via Authoritative RPC
   */
  async duplicateTemplate(id: string): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized.' };
    }

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_manage_service_template', {
        p_action: 'duplicate',
        p_template_id: id,
        p_name: null,
        p_service_label: null,
        p_description: null,
        p_tasks: [],
        p_sort_order: 0,
        p_archive_reason: null,
        p_expected_version: null
      });

      if (rpcErr) {
        return { data: null, error: rpcErr.message };
      }
      if (rpcRes?.error) {
        return { data: null, error: rpcRes.error };
      }

      if (rpcRes?.template_id) {
        return this.fetchTemplateById(rpcRes.template_id);
      }

      return { data: null, error: 'Failed to duplicate template.' };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to duplicate service template.' };
    }
  },

  /**
   * Archive a Service Template via Authoritative RPC
   */
  async archiveTemplate(id: string, reason: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Database not initialized.' };
    }

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_manage_service_template', {
        p_action: 'archive',
        p_template_id: id,
        p_name: null,
        p_service_label: null,
        p_description: null,
        p_tasks: [],
        p_sort_order: 0,
        p_archive_reason: reason.trim(),
        p_expected_version: null
      });

      if (rpcErr) {
        return { success: false, error: rpcErr.message };
      }
      if (rpcRes?.error) {
        return { success: false, error: rpcRes.error };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to archive service template.' };
    }
  },

  /**
   * Restore an Archived Service Template via Authoritative RPC
   */
  async restoreTemplate(id: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Database not initialized.' };
    }

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_manage_service_template', {
        p_action: 'restore',
        p_template_id: id,
        p_name: null,
        p_service_label: null,
        p_description: null,
        p_tasks: [],
        p_sort_order: 0,
        p_archive_reason: null,
        p_expected_version: null
      });

      if (rpcErr) {
        return { success: false, error: rpcErr.message };
      }
      if (rpcRes?.error) {
        return { success: false, error: rpcRes.error };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to restore service template.' };
    }
  }
};
