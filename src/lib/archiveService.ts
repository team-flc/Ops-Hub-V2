import { supabase } from './supabase';
import { ArchivedRecord } from '../types';

export const archiveService = {
  /**
   * Check if a team member has open tasks
   * (Assigned, In Progress, Blocked, Team Review)
   */
  async checkTeamMemberOpenTasks(profileId: string): Promise<{
    hasOpenTasks: boolean;
    openTaskCount: number;
    tasks: { id: string; title: string; clientId: string; status: string }[];
    error: string | null;
  }> {
    if (!supabase) return { hasOpenTasks: false, openTaskCount: 0, tasks: [], error: 'Database is not configured.' };
    try {
      const { data, error } = await supabase
        .from('client_tasks')
        .select('id, title, client_id, status')
        .eq('assignee_id', profileId)
        .in('status', ['Assigned', 'In Progress', 'Blocked', 'Team Review'])
        .is('archived_at', null);

      if (error) {
        return { hasOpenTasks: false, openTaskCount: 0, tasks: [], error: error.message };
      }

      const tasks = (data || []).map((t) => ({
        id: t.id,
        title: t.title,
        clientId: t.client_id,
        status: t.status
      }));

      return {
        hasOpenTasks: tasks.length > 0,
        openTaskCount: tasks.length,
        tasks,
        error: null
      };
    } catch (err: any) {
      return { hasOpenTasks: false, openTaskCount: 0, tasks: [], error: err?.message || 'Error checking tasks' };
    }
  },

  /**
   * Check if a team member has open tasks for a SPECIFIC client
   * (used when revoking client access)
   */
  async checkTeamMemberClientOpenTasks(profileId: string, clientId: string): Promise<{
    hasOpenTasks: boolean;
    openTaskCount: number;
    tasks: { id: string; title: string; status: string }[];
    error: string | null;
  }> {
    if (!supabase) return { hasOpenTasks: false, openTaskCount: 0, tasks: [], error: 'Database is not configured.' };
    try {
      const { data, error } = await supabase
        .from('client_tasks')
        .select('id, title, status')
        .eq('assignee_id', profileId)
        .eq('client_id', clientId)
        .in('status', ['Assigned', 'In Progress', 'Blocked', 'Team Review'])
        .is('archived_at', null);

      if (error) {
        return { hasOpenTasks: false, openTaskCount: 0, tasks: [], error: error.message };
      }

      const tasks = (data || []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status
      }));

      return {
        hasOpenTasks: tasks.length > 0,
        openTaskCount: tasks.length,
        tasks,
        error: null
      };
    } catch (err: any) {
      return { hasOpenTasks: false, openTaskCount: 0, tasks: [], error: err?.message || 'Error checking client tasks' };
    }
  },

  /**
   * Fetch archived entities
   */
  async fetchArchivedEntities(tab: 'client' | 'team_member' | 'task'): Promise<{
    data: ArchivedRecord[];
    error: string | null;
  }> {
    if (!supabase) return { data: [], error: 'Database is not configured.' };
    try {
      if (tab === 'client') {
        const { data, error } = await supabase
          .from('clients')
          .select(`
            id,
            company_name,
            status,
            previous_status,
            archived_at,
            archived_by,
            archive_reason,
            archived_by_profile:archived_by(full_name)
          `)
          .eq('status', 'Archived')
          .order('archived_at', { ascending: false });

        if (error) return { data: [], error: error.message };

        const mapped: ArchivedRecord[] = (data || []).map((c: any) => ({
          id: c.id,
          entityType: 'client',
          entityName: c.company_name,
          archivedBy: c.archived_by,
          archivedByName: c.archived_by_profile?.full_name || 'System Admin',
          archivedAt: c.archived_at || new Date().toISOString(),
          archiveReason: c.archive_reason || 'Archived by administrator',
          previousStatus: c.previous_status || 'Active'
        }));

        return { data: mapped, error: null };
      }

      if (tab === 'team_member') {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            status,
            previous_status,
            archived_at,
            archived_by,
            archive_reason,
            archived_by_profile:archived_by(full_name)
          `)
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false });

        if (error) return { data: [], error: error.message };

        const mapped: ArchivedRecord[] = (data || []).map((p: any) => ({
          id: p.id,
          entityType: 'team_member',
          entityName: p.full_name,
          archivedBy: p.archived_by,
          archivedByName: p.archived_by_profile?.full_name || 'System Admin',
          archivedAt: p.archived_at || new Date().toISOString(),
          archiveReason: p.archive_reason || 'Archived staff member',
          previousStatus: p.previous_status || p.status
        }));

        return { data: mapped, error: null };
      }

      if (tab === 'task') {
        const { data, error } = await supabase
          .from('client_tasks')
          .select(`
            id,
            title,
            client_id,
            client:client_id(company_name, status),
            status,
            archived_at,
            archived_by,
            archive_reason,
            archived_by_profile:archived_by(full_name)
          `)
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false });

        if (error) return { data: [], error: error.message };

        const mapped: ArchivedRecord[] = (data || []).map((t: any) => ({
          id: t.id,
          entityType: 'task',
          entityName: t.title,
          clientId: t.client_id,
          clientName: t.client?.company_name || 'Unknown Client',
          archivedBy: t.archived_by,
          archivedByName: t.archived_by_profile?.full_name || 'System Admin',
          archivedAt: t.archived_at || new Date().toISOString(),
          archiveReason: t.archive_reason || 'Archived task',
          previousStatus: t.status,
          metadata: {
            isClientArchived: t.client?.status === 'Archived'
          }
        }));

        return { data: mapped, error: null };
      }

      return { data: [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch archived records.' };
    }
  },

  /**
   * Authoritative execution via manage-archive Edge Function
   * Strictly server-enforced, zero direct frontend fallback mutations
   */
  async invokeManageArchive(body: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database service unconfigured.' };
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { success: false, error: 'Your session has expired. Please sign in again.' };

      const { data, error } = await supabase.functions.invoke('manage-archive', {
        body,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) {
        return { success: false, error: error.message || 'Edge function error' };
      }
      if (data?.error) {
        return { success: false, error: data.error };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error calling manage-archive' };
    }
  },

  /**
   * Archive a Client - Authoritatively executed by manage-archive
   */
  async archiveClient(clientId: string, reason: string): Promise<{ success: boolean; error: string | null }> {
    if (!reason?.trim()) {
      return { success: false, error: 'Mandatory archive reason is required.' };
    }
    return this.invokeManageArchive({
      action: 'archive',
      entityType: 'client',
      entityId: clientId,
      reason: reason.trim()
    });
  },

  /**
   * Restore an Archived Client - Authoritatively executed by manage-archive
   */
  async restoreClient(clientId: string): Promise<{ success: boolean; error: string | null }> {
    return this.invokeManageArchive({
      action: 'restore',
      entityType: 'client',
      entityId: clientId
    });
  },

  /**
   * Archive a Team Member - Authoritatively executed by manage-archive
   */
  async archiveTeamMember(profileId: string, reason: string): Promise<{ success: boolean; error: string | null }> {
    if (!reason?.trim()) {
      return { success: false, error: 'Mandatory archive reason is required.' };
    }
    return this.invokeManageArchive({
      action: 'archive',
      entityType: 'team_member',
      entityId: profileId,
      reason: reason.trim()
    });
  },

  /**
   * Restore a Team Member - Authoritatively executed by manage-archive
   */
  async restoreTeamMember(profileId: string): Promise<{ success: boolean; error: string | null }> {
    return this.invokeManageArchive({
      action: 'restore',
      entityType: 'team_member',
      entityId: profileId
    });
  },

  /**
   * Archive a Task - Authoritatively executed by manage-archive
   */
  async archiveTask(taskId: string, reason: string): Promise<{ success: boolean; error: string | null }> {
    if (!reason?.trim()) {
      return { success: false, error: 'Mandatory archive reason is required.' };
    }
    return this.invokeManageArchive({
      action: 'archive',
      entityType: 'task',
      entityId: taskId,
      reason: reason.trim()
    });
  },

  /**
   * Restore an Archived Task - Authoritatively executed by manage-archive
   */
  async restoreTask(taskId: string, newAssigneeId?: string): Promise<{ success: boolean; error: string | null }> {
    return this.invokeManageArchive({
      action: 'restore',
      entityType: 'task',
      entityId: taskId,
      newAssigneeId: newAssigneeId || undefined
    });
  }
};