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
  UserProfile,
  TaskApprovalMode,
  TaskExternalLink,
  TaskMessage,
  TaskMessageVisibility,
  TaskReadState
} from '../types';

export function isSunday(dateInput: string | Date): boolean {
  if (!dateInput) return false;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Standard YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCDay() === 0;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;

  // Check UTC day
  if (d.getUTCDay() === 0) return true;

  // Check Asia/Karachi (PKT UTC+5) day
  try {
    const pktDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      weekday: 'short'
    }).format(d);
    if (pktDay === 'Sun') return true;
  } catch {
    // Fallback if Intl timeZone unavailable
  }

  return false;
}

export function isSaturday(dateInput: string | Date): boolean {
  if (!dateInput) return false;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCDay() === 6;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  if (d.getUTCDay() === 6) return true;

  try {
    const pktDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      weekday: 'short'
    }).format(d);
    if (pktDay === 'Sat') return true;
  } catch {
    // Fallback
  }

  return false;
}

export function isWeekend(dateInput: string | Date): boolean {
  return isSunday(dateInput) || isSaturday(dateInput);
}

export function rollForwardToNextMonday(dateInput: string | Date): string {
  let d: Date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, day] = dateInput.trim().split('-').map(Number);
    d = new Date(Date.UTC(y, m - 1, day));
  } else {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) return '';

  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function validateHttpsLink(urlStr: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }
  const trimmed = urlStr.trim();
  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL exceeds maximum length of 2,048 characters.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
  if (parsed.protocol.toLowerCase() !== 'https:') {
    return { valid: false, error: 'Only HTTPS links are permitted.' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with embedded credentials are not permitted.' };
  }
  return { valid: true, sanitized: parsed.href };
}

export function validateMessageLinks(links: any[]): { valid: boolean; error?: string; validatedLinks?: TaskExternalLink[] } {
  if (!Array.isArray(links)) {
    return { valid: true, validatedLinks: [] };
  }
  if (links.length > 5) {
    return { valid: false, error: 'Maximum of 5 external links per item.' };
  }
  const validatedLinks: TaskExternalLink[] = [];
  for (const item of links) {
    const rawUrl = typeof item === 'string' ? item : item?.url;
    const rawTitle = typeof item === 'object' ? item?.title : undefined;
    const res = validateHttpsLink(rawUrl);
    if (!res.valid) {
      return { valid: false, error: res.error };
    }
    validatedLinks.push({
      url: res.sanitized!,
      title: rawTitle && typeof rawTitle === 'string' ? rawTitle.trim().slice(0, 100) : undefined
    });
  }
  return { valid: true, validatedLinks };
}

export function isTaskOverdue(task: { dueDate: string; status: ClientTaskStatus; archivedAt?: string | null }): boolean {
  if (task.archivedAt) return false;
  if (task.status === 'Team Review' || task.status === 'Client Review' || task.status === 'Completed') return false;
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
  if (isSaturday(plannedStart)) {
    return { valid: false, error: 'Planned start date cannot fall on a Saturday.' };
  }
  if (isSunday(dueDate)) {
    return { valid: false, error: 'Due date cannot fall on a Sunday.' };
  }
  if (isSaturday(dueDate)) {
    return { valid: false, error: 'Due date cannot fall on a Saturday.' };
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
  approvalMode?: TaskApprovalMode;
  plannedStart: string;
  dueDate: string;
  sourceTemplateId?: string | null;
  sourceTemplateVersion?: number | null;
}

export interface UpdateTaskParams {
  taskId: string;
  title?: string;
  details?: string;
  departmentId?: string;
  priority?: ClientTaskPriority;
  approvalMode?: TaskApprovalMode;
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
  async fetchEligibleAssignees(clientId: string, departmentId?: string, currentUser?: UserProfile | null): Promise<UserProfile[]> {
    if (!isSupabaseConfigured || !supabase || !clientId) return [];
    try {
      // 1. Fetch team members with explicit access to this client
      const { data: grants } = await supabase
        .from('client_team_access')
        .select('profile_id')
        .eq('client_id', clientId);

      const permittedProfileIds = new Set<string>((grants || []).map((g: any) => g.profile_id));

      // 2. Fetch all profile department memberships
      const { data: profileDepts } = await supabase
        .from('profile_departments')
        .select('profile_id, department_id');

      const userDeptsMap = new Map<string, string[]>();
      (profileDepts || []).forEach((pd: any) => {
        const list = userDeptsMap.get(pd.profile_id) || [];
        list.push(pd.department_id);
        userDeptsMap.set(pd.profile_id, list);
      });

      // 3. Fetch all active profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, role, status, work_email, designation_id, reporting_manager_id, archived_at, created_at, updated_at')
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      if (pErr || !profiles) return [];

      // Filter:
      // - No client users
      // - Team members require explicit client access grant
      // - Owners & Operational Managers have client access
      // - If departmentId provided: team members MUST belong to that department (owners & managers exempt)
      // - If currentUser is operational_manager: must be within their reporting hierarchy or self
      const eligible = profiles.filter((p: any) => {
        if (p.archived_at) return false;
        if (p.role === 'client') return false;

        const hasClientAccess = (p.role === 'owner' || p.role === 'operational_manager') || permittedProfileIds.has(p.id);
        if (!hasClientAccess) return false;

        const depts = userDeptsMap.get(p.id) || [];

        if (departmentId && p.role === 'team_member') {
          if (!depts.includes(departmentId)) return false;
        }

        if (currentUser?.role === 'operational_manager') {
          const inScope = p.role === 'owner' || p.id === currentUser.id || p.reporting_manager_id === currentUser.id;
          if (!inScope) return false;
        }

        return true;
      });

      return eligible.map((p: any) => ({
        id: p.id,
        fullName: p.full_name,
        role: p.role,
        status: p.status,
        workEmail: p.work_email,
        designationId: p.designation_id,
        reportingManagerId: p.reporting_manager_id,
        departmentIds: userDeptsMap.get(p.id) || [],
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
      const selectFieldsWithTemplate = `
        id, client_id, week_number, title, details, department_id,
        assignee_id, priority, planned_start, due_date, status,
        approval_mode, completed_at, completed_by, reopened_at, reopened_by, reopen_reason,
        blocked_reason, sort_order, created_by, created_at,
        updated_by, updated_at, archived_at, archived_by, archive_reason,
        source_template_id, source_template_version,
        departments(id, name),
        assignee:profiles!assignee_id(id, full_name, role, status),
        creator:profiles!created_by(id, full_name)
      `;

      let query = supabase
        .from('client_tasks')
        .select(selectFieldsWithTemplate)
        .eq('client_id', clientId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (weekNumber) {
        query = query.eq('week_number', weekNumber);
      }

      let data: any[] | null = null;
      let error: any = null;
      const res = await query;
      data = res.data;
      error = res.error;

      // Graceful fallback if source_template columns do not exist in database yet (e.g. on un-migrated preview)
      if (error && (error.message?.includes('source_template') || error.code === 'PGRST204')) {
        const fallbackFields = `
          id, client_id, week_number, title, details, department_id,
          assignee_id, priority, planned_start, due_date, status,
          approval_mode, completed_at, completed_by, reopened_at, reopened_by, reopen_reason,
          blocked_reason, sort_order, created_by, created_at,
          updated_by, updated_at, archived_at, archived_by, archive_reason,
          departments(id, name),
          assignee:profiles!assignee_id(id, full_name, role, status),
          creator:profiles!created_by(id, full_name)
        `;
        let fallbackQuery = supabase
          .from('client_tasks')
          .select(fallbackFields)
          .eq('client_id', clientId)
          .is('archived_at', null)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (weekNumber) {
          fallbackQuery = fallbackQuery.eq('week_number', weekNumber);
        }
        const fallbackRes = await fallbackQuery;
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

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
          approvalMode: (row.approval_mode as TaskApprovalMode) || 'Internal Only',
          completedAt: row.completed_at || null,
          completedBy: row.completed_by || null,
          reopenedAt: row.reopened_at || null,
          reopenedBy: row.reopened_by || null,
          reopenReason: row.reopen_reason || null,
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
          sourceTemplateId: row.source_template_id || null,
          sourceTemplateVersion: row.source_template_version || null,
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
   * Fetch Task Conversation Feed (combines human messages and system lifecycle events)
   * Supports composite cursor pagination (created_at, id) returning the newest 30 combined items.
   */
  async fetchTaskFeed(
    taskId: string,
    beforeTimestamp?: string,
    limit = 30,
    beforeId?: string
  ): Promise<{
    messages: TaskMessage[];
    events: ClientTaskEvent[];
    combinedFeed: Array<{ type: 'message' | 'event'; data: TaskMessage | ClientTaskEvent; timestamp: string; id?: string }>;
    nextCursor: { timestamp: string; id: string } | null;
    hasMore: boolean;
  }> {
    if (!isSupabaseConfigured || !supabase || !taskId) {
      return { messages: [], events: [], combinedFeed: [], nextCursor: null, hasMore: false };
    }

    try {
      // 1. Attempt authoritative Edge Function feed query
      const edgeRes = await this.invokeEdgeFunction('fetch_feed', {
        task_id: taskId,
        before_timestamp: beforeTimestamp,
        before_id: beforeId,
        limit
      });

      if (!edgeRes.error && edgeRes.data?.success) {
        return {
          messages: edgeRes.data.messages || [],
          events: edgeRes.data.events || [],
          combinedFeed: edgeRes.data.combinedFeed || [],
          nextCursor: edgeRes.data.nextCursor || null,
          hasMore: Boolean(edgeRes.data.hasMore)
        };
      }

      // 2. Fallback to direct client query with composite cursor
      let msgQuery = supabase
        .from('client_task_messages')
        .select(`
          id, task_id, client_id, author_id, visibility, content, links, created_at,
          author:profiles!author_id(id, full_name, role)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      if (beforeTimestamp && beforeId) {
        msgQuery = msgQuery.or(`created_at.lt.${beforeTimestamp},and(created_at.eq.${beforeTimestamp},id.lt.${beforeId})`);
      } else if (beforeTimestamp) {
        msgQuery = msgQuery.lt('created_at', beforeTimestamp);
      }

      let evtQuery = supabase
        .from('client_task_events')
        .select(`
          id, task_id, client_id, actor_id, event_type,
          previous_state, new_state, notes, created_at,
          actor:profiles!actor_id(id, full_name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      if (beforeTimestamp && beforeId) {
        evtQuery = evtQuery.or(`created_at.lt.${beforeTimestamp},and(created_at.eq.${beforeTimestamp},id.lt.${beforeId})`);
      } else if (beforeTimestamp) {
        evtQuery = evtQuery.lt('created_at', beforeTimestamp);
      }

      const [msgRes, evtRes] = await Promise.all([msgQuery, evtQuery]);
      const rawMsgs = msgRes.data || [];
      const rawEvts = evtRes.data || [];

      const messages: TaskMessage[] = rawMsgs.map((m: any) => ({
        id: m.id,
        taskId: m.task_id,
        clientId: m.client_id,
        authorId: m.author_id,
        authorName: m.author?.full_name || 'Staff Member',
        authorRole: m.author?.role || 'team_member',
        visibility: m.visibility,
        content: m.content,
        links: Array.isArray(m.links) ? m.links : [],
        createdAt: m.created_at
      }));

      const events: ClientTaskEvent[] = rawEvts.map((e: any) => ({
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

      const combined: Array<{ type: 'message' | 'event'; data: TaskMessage | ClientTaskEvent; timestamp: string; id: string }> = [
        ...messages.map((m) => ({ type: 'message' as const, data: m, timestamp: m.createdAt, id: m.id })),
        ...events.map((e) => ({ type: 'event' as const, data: e, timestamp: e.createdAt, id: e.id }))
      ];

      // Sort descending [timestamp DESC, id DESC]
      combined.sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id.localeCompare(a.id);
      });

      // Slice top limit combined items
      const pageItems = combined.slice(0, limit);
      const hasMore = combined.length > limit;
      const lastItem = pageItems[pageItems.length - 1];
      const nextCursor = (hasMore && lastItem) ? { timestamp: lastItem.timestamp, id: lastItem.id } : null;

      // Sort ascending for chronological display in feed UI
      pageItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        messages: pageItems.filter(i => i.type === 'message').map(i => i.data as TaskMessage),
        events: pageItems.filter(i => i.type === 'event').map(i => i.data as ClientTaskEvent),
        combinedFeed: pageItems,
        nextCursor,
        hasMore
      };
    } catch (err: any) {
      console.warn('Exception loading task feed:', err?.message);
      return { messages: [], events: [], combinedFeed: [], nextCursor: null, hasMore: false };
    }
  },

  /**
   * Subscribe to single Realtime channel for currently open task feed
   */
  subscribeToTaskFeed(taskId: string, onUpdate: (payload: any) => void): () => void {
    if (!isSupabaseConfigured || !supabase || !taskId) {
      return () => {};
    }

    const channel = supabase.channel(`task-feed-${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_task_messages', filter: `task_id=eq.${taskId}` },
        (payload) => onUpdate(payload)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_task_events', filter: `task_id=eq.${taskId}` },
        (payload) => onUpdate(payload)
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  },

  /**
   * Post human comment + HTTPS external links (Append-only)
   */
  async createTaskMessage(params: {
    taskId: string;
    clientId: string;
    visibility: TaskMessageVisibility;
    content: string;
    links?: TaskExternalLink[];
    idempotencyKey?: string;
  }): Promise<{ data: TaskMessage | null; error: string | null }> {
    if (!params.content || !params.content.trim()) {
      return { data: null, error: 'Message content cannot be empty.' };
    }
    if (params.content.length > 5000) {
      return { data: null, error: 'Message content cannot exceed 5,000 characters.' };
    }
    const linkValidation = validateMessageLinks(params.links || []);
    if (!linkValidation.valid) {
      return { data: null, error: linkValidation.error || 'Invalid links.' };
    }

    const edgeRes = await this.invokeEdgeFunction('create_message', {
      task_id: params.taskId,
      client_id: params.clientId,
      visibility: params.visibility,
      content: params.content.trim(),
      links: linkValidation.validatedLinks || [],
      idempotency_key: params.idempotencyKey
    });

    if (edgeRes.error || !edgeRes.data?.message) {
      return { data: null, error: edgeRes.error || 'Failed to post message.' };
    }

    return { data: edgeRes.data.message, error: null };
  },

  /**
   * Mark task as read (one row per user/task)
   */
  async markTaskRead(taskId: string, profileId?: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !taskId) return;
    try {
      const user = profileId ? { id: profileId } : (await supabase.auth.getUser()).data.user;
      if (!user) return;
      await supabase.from('client_task_read_states').upsert({
        task_id: taskId,
        profile_id: user.id,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'task_id,profile_id' });
    } catch {
      // Non-blocking
    }
  },

  /**
   * Fetch task read state for current user
   */
  async fetchTaskReadState(taskId: string): Promise<TaskReadState | null> {
    if (!isSupabaseConfigured || !supabase || !taskId) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('client_task_read_states')
        .select('*')
        .eq('task_id', taskId)
        .eq('profile_id', user.id)
        .maybeSingle();
      return (data as TaskReadState) || null;
    } catch {
      return null;
    }
  },

  /**
   * Invoke Edge Function `manage-client-task` with caller auth token
   */
  async invokeEdgeFunction(action: string, payload: Record<string, any>): Promise<{ data?: any; error?: string }> {
    if (!supabase) return { error: 'Supabase client not initialized' };
    try {
      const { data, error } = await supabase.functions.invoke('manage-client-task', {
        body: { action, ...payload }
      });

      if (error) {
        return { error: error.message || 'Edge function execution error' };
      }
      if (data?.error) {
        return { error: data.error };
      }

      return { data };
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

    // Verify client is not paused
    if (supabase) {
      try {
        const { data: clientRec } = await supabase
          .from('clients')
          .select('status')
          .eq('id', params.clientId)
          .single();
        if (clientRec && clientRec.status === 'Paused') {
          return { data: null, error: 'Cannot create tasks for a paused client.' };
        }
      } catch (err) {
        // Continue if unable to query
      }
    }

    // Authoritative Edge Function execution
    const edgeRes = await this.invokeEdgeFunction('create', {
      client_id: params.clientId,
      week_number: params.weekNumber,
      title: params.title,
      details: params.details,
      department_id: params.departmentId,
      assignee_id: params.assigneeId,
      priority: params.priority || 'Normal',
      approval_mode: params.approvalMode || 'Internal Only',
      planned_start: params.plannedStart,
      due_date: params.dueDate,
      source_template_id: params.sourceTemplateId || undefined,
      source_template_version: params.sourceTemplateVersion || undefined
    });

    if (edgeRes.error || !edgeRes.data?.task) {
      return { data: null, error: edgeRes.error || 'Failed to create task.' };
    }

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
        approvalMode: t.approval_mode || 'Internal Only',
        plannedStart: t.planned_start,
        dueDate: t.due_date,
        status: t.status,
        blockedReason: t.blocked_reason,
        sortOrder: t.sort_order || 0,
        createdBy: t.created_by,
        createdAt: t.created_at,
        updatedBy: t.updated_by,
        updatedAt: t.updated_at,
        sourceTemplateId: t.source_template_id || null,
        sourceTemplateVersion: t.source_template_version || null,
        isOverdue: false
      },
      error: null
    };
  },

  /**
   * Update Task Fields (Management only) - Strictly Edge-Function Authoritative
   */
  async updateTask(params: UpdateTaskParams): Promise<{ data: ClientTask | null; error: string | null }> {
    if (params.plannedStart && params.dueDate) {
      const dateValidation = validateTaskDates(params.plannedStart, params.dueDate);
      if (!dateValidation.valid) {
        return { data: null, error: dateValidation.error || 'Invalid task dates.' };
      }
    } else if (params.plannedStart && (isSunday(params.plannedStart) || isSaturday(params.plannedStart))) {
      return { data: null, error: isSunday(params.plannedStart) ? 'Planned start date cannot fall on a Sunday.' : 'Planned start date cannot fall on a Saturday.' };
    } else if (params.dueDate && (isSunday(params.dueDate) || isSaturday(params.dueDate))) {
      return { data: null, error: isSunday(params.dueDate) ? 'Due date cannot fall on a Sunday.' : 'Due date cannot fall on a Saturday.' };
    }

    const edgeRes = await this.invokeEdgeFunction('update', {
      task_id: params.taskId,
      title: params.title,
      details: params.details,
      department_id: params.departmentId,
      priority: params.priority,
      approval_mode: params.approvalMode,
      planned_start: params.plannedStart,
      due_date: params.dueDate
    });

    if (edgeRes.error || !edgeRes.data?.task) {
      return { data: null, error: edgeRes.error || 'Failed to update task.' };
    }

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
        approvalMode: t.approval_mode || 'Internal Only',
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
  },

  /**
   * Assign or Reassign Task - Strictly Edge-Function Authoritative
   */
  async assignTask(taskId: string, assigneeId: string | null): Promise<{ error: string | null }> {
    const edgeRes = await this.invokeEdgeFunction('assign', {
      task_id: taskId,
      assignee_id: assigneeId
    });

    if (edgeRes.error) {
      return { error: edgeRes.error };
    }

    return { error: null };
  },

  /**
   * Update Status - Strictly Edge-Function Authoritative
   */
  async updateStatus(
    taskId: string,
    status: ClientTaskStatus,
    reason?: string,
    currentStatus?: ClientTaskStatus,
    options?: {
      idempotencyKey?: string;
      isOverride?: boolean;
      overrideReason?: string;
    }
  ): Promise<{ error: string | null; task?: ClientTask }> {
    if (status === 'Blocked' && (!reason || !reason.trim())) {
      return { error: 'A reason is required when marking a task as Blocked.' };
    }
    if (status === 'In Progress' && (currentStatus === 'Team Review' || currentStatus === 'Client Review') && (!reason || !reason.trim())) {
      return { error: 'A reason is required when returning a task for changes.' };
    }

    const edgeRes = await this.invokeEdgeFunction('update_status', {
      task_id: taskId,
      status,
      reason,
      current_status: currentStatus,
      idempotency_key: options?.idempotencyKey,
      is_override: options?.isOverride,
      override_reason: options?.overrideReason
    });

    if (edgeRes.error) {
      return { error: edgeRes.error };
    }

    return { error: null, task: edgeRes.data?.task };
  },

  /**
   * Client / Management approves Client Review deliverable -> moves to Completed
   */
  async approveClientReview(
    taskId: string,
    currentStatus = 'Client Review' as ClientTaskStatus,
    options?: {
      isOverride?: boolean;
      overrideReason?: string;
      idempotencyKey?: string;
    }
  ): Promise<{ error: string | null; task?: ClientTask }> {
    return this.updateStatus(taskId, 'Completed', undefined, currentStatus, options);
  },

  /**
   * Client / Management requests changes on Client Review -> returns to In Progress with mandatory feedback
   */
  async requestClientChanges(taskId: string, reason: string, currentStatus = 'Client Review' as ClientTaskStatus): Promise<{ error: string | null; task?: ClientTask }> {
    if (!reason || !reason.trim()) {
      return { error: 'A reason is mandatory when requesting changes.' };
    }
    return this.updateStatus(taskId, 'In Progress', reason.trim(), currentStatus);
  },

  /**
   * Reopen Completed Task (Management only, requires mandatory reason)
   */
  async reopenTask(
    taskId: string,
    reason: string,
    currentStatus = 'Completed' as ClientTaskStatus,
    options?: { idempotencyKey?: string }
  ): Promise<{ error: string | null; task?: ClientTask }> {
    if (!reason || !reason.trim()) {
      return { error: 'A reason is mandatory to reopen a completed task.' };
    }
    return this.updateStatus(taskId, 'In Progress', reason.trim(), currentStatus, options);
  },

  /**
   * Archive Task (Requires mandatory reason) - Strictly Edge-Function Authoritative
   */
  async archiveTask(taskId: string, reason: string): Promise<{ error: string | null }> {
    if (!reason || !reason.trim()) {
      return { error: 'A reason is mandatory to archive a task.' };
    }

    const edgeRes = await this.invokeEdgeFunction('archive', {
      task_id: taskId,
      reason
    });

    if (edgeRes.error) {
      return { error: edgeRes.error };
    }

    return { error: null };
  }
};
