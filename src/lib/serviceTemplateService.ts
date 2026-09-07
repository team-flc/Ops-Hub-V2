// ==============================================================================
// SERVICE: serviceTemplateService
// Location: src/lib/serviceTemplateService.ts
// Phase: 3D — Multi-Task Service Templates Management
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

      // Graceful fallback if service_templates table does not exist yet (e.g. un-migrated preview)
      if (error && (error.code === '42P01' || error.message?.includes('service_templates'))) {
        // Fall back to legacy taskTemplateService and map single-task templates into ServiceTemplate format
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
          return { data: mapped, error: null, isUnavailable: false };
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
   * Create a new Service Template with ordered child tasks
   */
  async createTemplate(input: CreateServiceTemplateInput): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized' };
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

    for (let i = 0; i < input.tasks.length; i++) {
      const t = input.tasks[i];
      if (!t.title?.trim()) {
        return { data: null, error: `Task #${i + 1} must have a title.` };
      }
      if (!t.departmentId) {
        return { data: null, error: `Task "${t.title}" must have a department assigned.` };
      }
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id || null;

      // 1. Insert master template row
      const { data: tplRow, error: tplErr } = await supabase
        .from('service_templates')
        .insert({
          name: input.name.trim(),
          service_label: input.serviceLabel.trim(),
          description: input.description?.trim() || null,
          status: 'Active',
          version: 1,
          created_by: currentUserId,
          updated_by: currentUserId
        })
        .select()
        .single();

      if (tplErr || !tplRow) {
        return { data: null, error: tplErr?.message || 'Failed to insert service template.' };
      }

      // 2. Insert child tasks
      const taskInserts = input.tasks.map((t, idx) => ({
        template_id: tplRow.id,
        definition_id: t.definitionId || crypto.randomUUID(),
        title: t.title.trim(),
        description: t.description?.trim() || null,
        department_id: t.departmentId,
        priority: t.priority || 'Normal',
        approval_mode: t.approvalMode || 'Internal Only',
        planned_offset_days: t.plannedOffsetDays || 0,
        duration_business_days: t.durationBusinessDays || 1,
        display_order: idx
      }));

      const { data: insertedTasks, error: taskErr } = await supabase
        .from('service_template_tasks')
        .insert(taskInserts)
        .select(`
          id, definition_id, title, description, department_id,
          priority, approval_mode, planned_offset_days, duration_business_days, display_order,
          departments(id, name)
        `);

      if (taskErr) {
        // Rollback template row if tasks fail
        await supabase.from('service_templates').delete().eq('id', tplRow.id);
        return { data: null, error: taskErr.message };
      }

      // 3. Create version 1 snapshot
      await supabase.from('service_template_versions').insert({
        template_id: tplRow.id,
        version: 1,
        snapshot: {
          id: tplRow.id,
          name: tplRow.name,
          service_label: tplRow.service_label,
          tasks: taskInserts
        },
        created_by: currentUserId
      });

      const fullTemplate = mapTemplateRow({
        ...tplRow,
        tasks: insertedTasks || taskInserts
      });

      return { data: fullTemplate, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to create service template.' };
    }
  },

  /**
   * Update an existing Service Template and bump its version
   */
  async updateTemplate(id: string, input: UpdateServiceTemplateInput): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized' };
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id || null;

      // 1. Fetch current template
      const { data: current, error: fetchErr } = await supabase
        .from('service_templates')
        .select('id, version, status')
        .eq('id', id)
        .single();

      if (fetchErr || !current) {
        return { data: null, error: 'Template not found.' };
      }

      if (input.expectedVersion && current.version !== input.expectedVersion) {
        return { data: null, error: 'Conflict: Template has been modified by another user. Please reload.' };
      }

      const nextVersion = current.version + 1;

      // 2. Update master template row
      const updates: Record<string, any> = {
        version: nextVersion,
        updated_by: currentUserId,
        updated_at: new Date().toISOString()
      };
      if (input.name?.trim()) updates.name = input.name.trim();
      if (input.serviceLabel?.trim()) updates.service_label = input.serviceLabel.trim();
      if (input.description !== undefined) updates.description = input.description?.trim() || null;

      const { data: updatedTpl, error: updateErr } = await supabase
        .from('service_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateErr || !updatedTpl) {
        return { data: null, error: updateErr?.message || 'Failed to update template.' };
      }

      // 3. Update child tasks if provided
      let finalTasks: any[] = [];
      if (Array.isArray(input.tasks)) {
        if (input.tasks.length === 0) {
          return { data: null, error: 'A Service Template must contain at least one task.' };
        }
        if (input.tasks.length > 100) {
          return { data: null, error: 'A Service Template can contain at most 100 tasks.' };
        }

        // Delete old tasks and insert new tasks
        await supabase.from('service_template_tasks').delete().eq('template_id', id);

        const taskInserts = input.tasks.map((t, idx) => ({
          template_id: id,
          definition_id: t.definitionId || crypto.randomUUID(),
          title: t.title.trim(),
          description: t.description?.trim() || null,
          department_id: t.departmentId,
          priority: t.priority || 'Normal',
          approval_mode: t.approvalMode || 'Internal Only',
          planned_offset_days: t.plannedOffsetDays || 0,
          duration_business_days: t.durationBusinessDays || 1,
          display_order: idx
        }));

        const { data: inserted, error: taskErr } = await supabase
          .from('service_template_tasks')
          .insert(taskInserts)
          .select(`
            id, definition_id, title, description, department_id,
            priority, approval_mode, planned_offset_days, duration_business_days, display_order,
            departments(id, name)
          `);

        if (taskErr) {
          return { data: null, error: taskErr.message };
        }
        finalTasks = inserted || taskInserts;

        // Record version snapshot
        await supabase.from('service_template_versions').insert({
          template_id: id,
          version: nextVersion,
          snapshot: {
            id,
            name: updatedTpl.name,
            service_label: updatedTpl.service_label,
            tasks: taskInserts
          },
          created_by: currentUserId
        });
      }

      const fullTemplate = mapTemplateRow({
        ...updatedTpl,
        tasks: finalTasks
      });

      return { data: fullTemplate, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to update service template.' };
    }
  },

  /**
   * Duplicate a Service Template with all child tasks
   */
  async duplicateTemplate(id: string): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized' };
    }

    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('service_templates')
        .select(`
          name, service_label, description,
          tasks:service_template_tasks(
            title, description, department_id, priority, approval_mode,
            planned_offset_days, duration_business_days, display_order
          )
        `)
        .eq('id', id)
        .single();

      if (fetchErr || !existing) {
        return { data: null, error: 'Template to duplicate was not found.' };
      }

      const tasksToClone = (existing.tasks || []).map((t: any) => ({
        definitionId: crypto.randomUUID(),
        title: t.title,
        description: t.description,
        departmentId: t.department_id,
        priority: t.priority,
        approvalMode: t.approval_mode,
        plannedOffsetDays: t.planned_offset_days,
        durationBusinessDays: t.duration_business_days,
        displayOrder: t.display_order
      }));

      return this.createTemplate({
        name: `Copy of ${existing.name}`,
        serviceLabel: existing.service_label,
        description: existing.description,
        tasks: tasksToClone
      });
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to duplicate service template.' };
    }
  },

  /**
   * Archive a Service Template
   */
  async archiveTemplate(id: string, reason: string): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized' };
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id || null;

      const { data, error } = await supabase
        .from('service_templates')
        .update({
          status: 'Archived',
          archived_at: new Date().toISOString(),
          archived_by: currentUserId,
          archive_reason: reason.trim() || 'Archived by owner'
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return { data: null, error: error?.message || 'Failed to archive template.' };
      }

      return { data: mapTemplateRow(data), error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to archive service template.' };
    }
  },

  /**
   * Restore an archived Service Template
   */
  async restoreTemplate(id: string): Promise<{ data: ServiceTemplate | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: 'Database not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('service_templates')
        .update({
          status: 'Active',
          archived_at: null,
          archived_by: null,
          archive_reason: null
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return { data: null, error: error?.message || 'Failed to restore template.' };
      }

      return { data: mapTemplateRow(data), error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to restore service template.' };
    }
  }
};
