// ==============================================================================
// SERVICE: taskManagementService
// Location: src/lib/taskManagementService.ts
// Phase 3A: Operational Task Management Core
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  ClientTask, 
  ClientTaskEvent, 
  ClientTaskPriority, 
  ClientTaskStatus, 
  Department, 
  UserProfile 
} from '../types';

export function isSunday(dateInput: string | Date): boolean {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  return d.getUTCDay() === 0;
}

export function isTaskOverdue(task: { dueDate: string; status: ClientTaskStatus; archivedAt?: string | null }): boolean {
  if (task.archivedAt) return false;
  if (task.status === 'Team Review') return false; // In internal review, not overdue in Phase 3A
  if (!['Draft', 'Assigned', 'In Progress', 'Blocked'].includes(task.status)) return false;
  
  const due = new Date(task.dueDate).getTime();
  if (isNaN(due)) return false;
  return Date.now() > due;
}

export function validateTaskDates(plannedStart: string, dueDate: string): { valid: boolean; error?: string } {
  if (!plannedStart) {
    return { valid: false, error: 'Planned start date/time is required.' };
  }
  if (!dueDate) {
    return { valid: false, error: 'Due date/time is required.' };
  }

  const startTime = new Date(plannedStart).getTime();
  const dueTime = new Date(dueDate).getTime();

  if (isNaN(startTime)) {
    return { valid: false, error: 'Invalid planned start date.' };
  }
  if (isNaN(dueTime)) {
    return { valid: false, error: 'Invalid due date.' };
  }

  if (isSunday(plannedStart)) {
    return { valid: false, error: 'Planned start date cannot fall on a Sunday.' };
  }
  if (isSunday(dueDate)) {
    return { valid: false, error: 'Due date cannot fall on a Sunday.' };
  }

  if (dueTime <= startTime) {
    return { valid: false, error: 'Due date/time must be strictly later than planned start date/time.' };
  }

  return { valid: true };
}

export interface CreateTaskParams {
  clientId: string;
  weekNumber: 1 | 2 | 3 | 4;
  title: string;
  details?: string;
  departmentId: string;
  assigneeId?: string;
  priority?: ClientTaskPriority;
  plannedStart: string;
  dueDate: string;
}

export interface UpdateTaskParams {
  taskId: string;
  title?: string;
  details?: string;
  departmentId?: string;
  priority?: ClientTaskPriority;
  plannedStart?: string;
  dueDate?: string;
}

export const taskManagementService = {
  /**
   * Fetch all active production departments
   */
  async fetchDepartments(): Promise<Department[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true });

      if (error || !data) {
        console.warn('Failed to load departments from Supabase:', error?.message);
        return [];
      }

      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        status: d.status,
        sortOrder: d.sort_order,
        createdAt: d.created_at || new Date().toISOString(),
        updatedAt: d.updated_at || new Date().toISOString()
      }));
    } catch (err: any) {
      console.warn('Exception loading departments:', err?.message);
      return [];
    }
  },

  /**
   * Fetch active assignees eligible for the selected client and department
   */
  async fetchEligibleAssignees(clientId: string, _departmentId?: string): Promise<UserProfile[]> {
    if (!isSupabaseConfigured || !supabase || !clientId) return [];
    try {
      // 1. Fetch team members with explicit access to this client
      const { data: grants } = await supabase
        .from('client_team_access')
        .select('profile_id')
        .eq('client_id', clientId);

      const permittedProfileIds = new Set<string>((grants || []).map((g: any) => g.profile_id));

      // 2. Fetch all active profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, role, status, work_email, designation_id, created_at, updated_at')
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      if (pErr || !profiles) return [];

      // Filter: owners and operational managers have client access, team members need explicit grant
      const eligible = profiles.filter((p: any) => {
        if (p.role === 'client') return false;
        if (p.role === 'owner' || p.role === 'operational_manager') return true;
        return permittedProfileIds.has(p.id);
      });

      return eligible.map((p: any) => ({
        id: p.id,
        fullName: p.full_name,
        role: p.role,
        status: p.status,
        workEmail: p.work_email,
        designationId: p.designation_id,
        createdAt: p.created_at || new Date().toISOString(),
        updatedAt: p.updated_at || new Date().toISOString()
      }));
    } catch (err: any) {
      console.warn('Exception loading eligible assignees:', err?.message);
      return [];
    }
  },

  /**
   * Fetch tasks for a client and week
   */
  async fetchClientTasks(clientId: string, weekNumber?: number): Promise<{ data: ClientTask[]; error: string | null }> {
    if (!isSupabaseConfigured || !supabase || !clientId) {
      return { data: [], error: null };
    }

    try {
      let query = supabase
        .from('client_tasks')
        .select(`
          id, client_id, week_number, title, details, department_id,
          assignee_id, priority, planned_start, due_date, status,
          blocked_reason, sort_order, created_by, created_at,
          updated_by, updated_at, archived_at, archived_by, archive_reason,
          departments(id, name),
          assignee:profiles!assignee_id(id, full_name, role, status),
          creator:profiles!created_by(id, full_name)
        `)
        .eq('client_id', clientId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (weekNumber) {
        query = query.eq('week_number', weekNumber);
      }

      const { data, error } = await query;

      if (error) {
        return { data: [], error: error.message };
      }

      const tasks: ClientTask[] = (data || []).map((row: any) => {
        const isOverdue = isTaskOverdue({
          dueDate: row.due_date,
          status: row.status,
          archivedAt: row.archived_at
        });

        const isAssigneeEligible = row.assignee 
          ? row.assignee.status === 'active' && row.assignee.role !== 'client'
          : true;

        return {
          id: row.id,
          clientId: row.client_id,
          weekNumber: row.week_number,
          title: row.title,
          details: row.details,
          departmentId: row.department_id,
          departmentName: row.departments?.name || 'Department',
          assigneeId: row.assignee_id,
          assigneeName: row.assignee?.full_name || null,
          assigneeRole: row.assignee?.role || null,
          isAssigneeEligible,
          priority: row.priority,
          plannedStart: row.planned_start,
          dueDate: row.due_date,
          status: row.status,
          blockedReason: row.blocked_reason,
          sortOrder: row.sort_order || 0,
          createdBy: row.created_by,
          createdByName: row.creator?.full_name || null,
          createdAt: row.created_at,
          updatedBy: row.updated_by,
          updatedAt: row.updated_at,
          archivedAt: row.archived_at,
          archivedBy: row.archived_by,
          archiveReason: row.archive_reason,
          isOverdue
        };
      });

      return { data: tasks, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch client tasks.' };
    }
  },

  /**
   * Fetch audit events for a task
   */
  async fetchTaskEvents(taskId: string): Promise<ClientTaskEvent[]> {
    if (!isSupabaseConfigured || !supabase || !taskId) return [];
    try {
      const { data, error } = await supabase
        .from('client_task_events')
        .select(`
          id, task_id, client_id, actor_id, event_type,
          previous_state, new_state, notes, created_at,
          actor:profiles!actor_id(id, full_name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((e: any) => ({
        id: e.id,
        taskId: e.task_id,
        clientId: e.client_id,
        actorId: e.actor_id,
        actorName: e.actor?.full_name || 'System / Staff',
        eventType: e.event_type,
        previousState: e.previous_state,
        newState: e.new_state,
        notes: e.notes,
        createdAt: e.created_at
      }));
    } catch (err: any) {
      console.warn('Exception loading task events:', err?.message);
      return [];
    }
  },

  /**
   * Invoke Edge Function `manage-client-task` with caller auth token
   */
  async invokeEdgeFunction(action: string, payload: Record<string, any>): Promise<{ data?: any; error?: string }> {
    if (!supabase) return { error: 'Supabase client not initialized' };
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data?.session?.access_token;

      if (!token) {
        return { error: 'Authentication session expired. Please sign in again.' };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://jcaptlqenwmpfchjyipw.supabase.co'}/functions/v1/manage-client-task`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action, ...payload })
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { error: result?.error || `Server error (${response.status})` };
      }

      return { data: result };
    } catch (err: any) {
      return { error: err?.message || 'Network error calling task management service.' };
    }
  },

  /**
   * Create Task
   */
  async createTask(params: CreateTaskParams): Promise<{ data: ClientTask | null; error: string | null }> {
    const dateValidation = validateTaskDates(params.plannedStart, params.dueDate);
    if (!dateValidation.valid) {
      return { data: null, error: dateValidation.error || 'Invalid task dates.' };
    }

    // Try edge function first
    const edgeRes = await this.invokeEdgeFunction('create', {
      client_id: params.clientId,
      week_number: params.weekNumber,
      title: params.title,
      details: params.details,
      department_id: params.departmentId,
      assignee_id: params.assigneeId,
      priority: params.priority || 'Normal',
      planned_start: params.plannedStart,
      due_date: params.dueDate
    });

    if (!edgeRes.error && edgeRes.data?.task) {
      const t = edgeRes.data.task;
      return {
        data: {
          id: t.id,
          clientId: t.client_id,
          weekNumber: t.week_number,
          title: t.title,
          details: t.details,
          departmentId: t.department_id,
          assigneeId: t.assignee_id,
          priority: t.priority,
          plannedStart: t.planned_start,
          dueDate: t.due_date,
          status: t.status,
          blockedReason: t.blocked_reason,
          sortOrder: t.sort_order || 0,
          createdBy: t.created_by,
          createdAt: t.created_at,
          updatedBy: t.updated_by,
          updatedAt: t.updated_at,
          isOverdue: false
        },
        error: null
      };
    }

    // Direct Supabase fallback for offline / test environments
    if (!supabase) return { data: null, error: edgeRes.error || 'Supabase not configured' };
    try {
      const userRes = await supabase.auth.getUser();
      const currentUserId = userRes.data?.user?.id || null;
      const initialStatus: ClientTaskStatus = params.assigneeId ? 'Assigned' : 'Draft';

      const { data: inserted, error: iErr } = await supabase
        .from('client_tasks')
        .insert({
          client_id: params.clientId,
          week_number: params.weekNumber,
          title: params.title.trim(),
          details: params.details?.trim() || null,
          department_id: params.departmentId,
          assignee_id: params.assigneeId || null,
          priority: params.priority || 'Normal',
          planned_start: params.plannedStart,
          due_date: params.dueDate,
          status: initialStatus,
          created_by: currentUserId,
          updated_by: currentUserId
        })
        .select()
        .single();

      if (iErr || !inserted) {
        return { data: null, error: edgeRes.error || iErr?.message || 'Failed to create task.' };
      }

      await supabase.from('client_task_events').insert({
        task_id: inserted.id,
        client_id: params.clientId,
        actor_id: currentUserId,
        event_type: 'created',
        new_state: inserted,
        notes: `Task created in ${initialStatus} status`
      });

      return {
        data: {
          id: inserted.id,
          clientId: inserted.client_id,
          weekNumber: inserted.week_number,
          title: inserted.title,
          details: inserted.details,
          departmentId: inserted.department_id,
          assigneeId: inserted.assignee_id,
          priority: inserted.priority,
          plannedStart: inserted.planned_start,
          dueDate: inserted.due_date,
          status: inserted.status,
          blockedReason: inserted.blocked_reason,
          sortOrder: inserted.sort_order || 0,
          createdBy: inserted.created_by,
          createdAt: inserted.created_at,
          updatedBy: inserted.updated_by,
          updatedAt: inserted.updated_at,
          isOverdue: false
        },
        error: null
      };
    } catch (fallbackErr: any) {
      return { data: null, error: edgeRes.error || fallbackErr?.message || 'Failed to create task.' };
    }
  },

  /**
   * Update Task Fields (Management only)
   */
  async updateTask(params: UpdateTaskParams): Promise<{ data: ClientTask | null; error: string | null }> {
    if (params.plannedStart && params.dueDate) {
      const dateValidation = validateTaskDates(params.plannedStart, params.dueDate);
      if (!dateValidation.valid) {
        return { data: null, error: dateValidation.error || 'Invalid task dates.' };
      }
    } else if (params.plannedStart && isSunday(params.plannedStart)) {
      return { data: null, error: 'Planned start date cannot fall on a Sunday.' };
    } else if (params.dueDate && isSunday(params.dueDate)) {
      return { data: null, error: 'Due date cannot fall on a Sunday.' };
    }

    const edgeRes = await this.invokeEdgeFunction('update', {
      task_id: params.taskId,
      title: params.title,
      details: params.details,
      department_id: params.departmentId,
      priority: params.priority,
      planned_start: params.plannedStart,
      due_date: params.dueDate
    });

    if (!edgeRes.error && edgeRes.data?.task) {
      const t = edgeRes.data.task;
      return {
        data: {
          id: t.id,
          clientId: t.client_id,
          weekNumber: t.week_number,
          title: t.title,
          details: t.details,
          departmentId: t.department_id,
          assigneeId: t.assignee_id,
          priority: t.priority,
          plannedStart: t.planned_start,
          dueDate: t.due_date,
          status: t.status,
          blockedReason: t.blocked_reason,
          sortOrder: t.sort_order || 0,
          createdBy: t.created_by,
          createdAt: t.created_at,
          updatedBy: t.updated_by,
          updatedAt: t.updated_at,
          isOverdue: isTaskOverdue({ dueDate: t.due_date, status: t.status, archivedAt: t.archived_at })
        },
        error: null
      };
    }

    // Direct Supabase fallback
    if (!supabase) return { data: null, error: edgeRes.error || 'Supabase not configured' };
    try {
      const updates: any = {};
      if (params.title !== undefined) updates.title = params.title.trim();
      if (params.details !== undefined) updates.details = params.details ? params.details.trim() : null;
      if (params.departmentId !== undefined) updates.department_id = params.departmentId;
      if (params.priority !== undefined) updates.priority = params.priority;
      if (params.plannedStart !== undefined) updates.planned_start = params.plannedStart;
      if (params.dueDate !== undefined) updates.due_date = params.dueDate;

      const { data: updated, error: uErr } = await supabase
        .from('client_tasks')
        .update(updates)
        .eq('id', params.taskId)
        .select()
        .single();

      if (uErr || !updated) {
        return { data: null, error: edgeRes.error || uErr?.message || 'Failed to update task.' };
      }

      return {
        data: {
          id: updated.id,
          clientId: updated.client_id,
          weekNumber: updated.week_number,
          title: updated.title,
          details: updated.details,
          departmentId: updated.department_id,
          assigneeId: updated.assignee_id,
          priority: updated.priority,
          plannedStart: updated.planned_start,
          dueDate: updated.due_date,
          status: updated.status,
          blockedReason: updated.blocked_reason,
          sortOrder: updated.sort_order || 0,
          createdBy: updated.created_by,
          createdAt: updated.created_at,
          updatedBy: updated.updated_by,
          updatedAt: updated.updated_at,
          isOverdue: isTaskOverdue({ dueDate: updated.due_date, status: updated.status, archivedAt: updated.archived_at })
        },
        error: null
      };
    } catch (fallbackErr: any) {
      return { data: null, error: edgeRes.error || fallbackErr?.message || 'Failed to update task.' };
    }
  },

  /**
   * Assign or Reassign Task
   */
  async assignTask(taskId: string, assigneeId: string | null): Promise<{ error: string | null }> {
    const edgeRes = await this.invokeEdgeFunction('assign', {
      task_id: taskId,
      assignee_id: assigneeId
    });

    if (!edgeRes.error) return { error: null };

    // Fallback
    if (!supabase) return { error: edgeRes.error || 'Supabase not configured' };
    try {
      const { data: current } = await supabase
        .from('client_tasks')
        .select('status')
        .eq('id', taskId)
        .single();

      let newStatus = current?.status || 'Draft';
      if (assigneeId && newStatus === 'Draft') {
        newStatus = 'Assigned';
      } else if (!assigneeId) {
        newStatus = 'Draft';
      }

      const { error: uErr } = await supabase
        .from('client_tasks')
        .update({
          assignee_id: assigneeId,
          status: newStatus
        })
        .eq('id', taskId);

      return { error: uErr ? uErr.message : null };
    } catch (err: any) {
      return { error: edgeRes.error || err?.message || 'Failed to assign task.' };
    }
  },

  /**
   * Update Status
   */
  async updateStatus(taskId: string, status: ClientTaskStatus, reason?: string): Promise<{ error: string | null }> {
    if (status === 'Blocked' && (!reason || !reason.trim())) {
      return { error: 'A reason is required when marking a task as Blocked.' };
    }

    const edgeRes = await this.invokeEdgeFunction('update_status', {
      task_id: taskId,
      status,
      reason
    });

    if (!edgeRes.error) return { error: null };

    // Fallback
    if (!supabase) return { error: edgeRes.error || 'Supabase not configured' };
    try {
      const updates: any = {
        status,
        blocked_reason: status === 'Blocked' ? reason?.trim() : null
      };

      const { error: uErr } = await supabase
        .from('client_tasks')
        .update(updates)
        .eq('id', taskId);

      return { error: uErr ? uErr.message : null };
    } catch (err: any) {
      return { error: edgeRes.error || err?.message || 'Failed to update task status.' };
    }
  },

  /**
   * Archive Task (Requires mandatory reason)
   */
  async archiveTask(taskId: string, reason: string): Promise<{ error: string | null }> {
    if (!reason || !reason.trim()) {
      return { error: 'A reason is mandatory to archive a task.' };
    }

    const edgeRes = await this.invokeEdgeFunction('archive', {
      task_id: taskId,
      reason
    });

    if (!edgeRes.error) return { error: null };

    // Fallback
    if (!supabase) return { error: edgeRes.error || 'Supabase not configured' };
    try {
      const { error: uErr } = await supabase
        .from('client_tasks')
        .update({
          archived_at: new Date().toISOString(),
          archive_reason: reason.trim()
        })
        .eq('id', taskId);

      return { error: uErr ? uErr.message : null };
    } catch (err: any) {
      return { error: edgeRes.error || err?.message || 'Failed to archive task.' };
    }
  }
};
