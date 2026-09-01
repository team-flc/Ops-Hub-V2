import { supabase } from './supabase';
import { ArchivedRecord, ClientRecord, ClientTask, UserProfile } from '../types';
import { auditService } from './auditService';

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
   * Archive a Client
   */
  async archiveClient(clientId: string, reason: string): Promise<{ success: boolean; error: string | null }> {
    if (!reason?.trim()) {
      return { success: false, error: 'Mandatory archive reason is required.' };
    }
    if (!supabase) return { success: false, error: 'Database is not configured.' };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: client, error: fetchErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (fetchErr || !client) {
        return { success: false, error: 'Client not found.' };
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          status: 'Archived',
          previous_status: client.status,
          archived_at: now,
          archived_by: user?.id || null,
          archive_reason: reason.trim(),
          updated_at: now
        })
        .eq('id', clientId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      await auditService.logAuditEvent({
        action: 'client_archived',
        entityType: 'client',
        entityId: clientId,
        entityName: client.company_name,
        clientId: clientId,
        clientName: client.company_name,
        previousState: { status: client.status },
        newState: { status: 'Archived', previous_status: client.status },
        reason: reason.trim()
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to archive client.' };
    }
  },

  /**
   * Restore an Archived Client
   */
  async restoreClient(clientId: string): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database is not configured.' };
    try {
      const { data: client, error: fetchErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (fetchErr || !client) {
        return { success: false, error: 'Client not found.' };
      }

      const restoreStatus = client.previous_status && client.previous_status !== 'Archived' 
        ? client.previous_status 
        : 'Active';

      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          status: restoreStatus,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
          updated_at: now
        })
        .eq('id', clientId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      await auditService.logAuditEvent({
        action: 'client_restored',
        entityType: 'client',
        entityId: clientId,
        entityName: client.company_name,
        clientId: clientId,
        clientName: client.company_name,
        previousState: { status: 'Archived' },
        newState: { status: restoreStatus },
        reason: 'Restored from Archive Center'
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to restore client.' };
    }
  },

  /**
   * Archive a Team Member
   */
  async archiveTeamMember(profileId: string, reason: string): Promise<{ success: boolean; error: string | null }> {
    if (!reason?.trim()) {
      return { success: false, error: 'Mandatory archive reason is required.' };
    }
    if (!supabase) return { success: false, error: 'Database is not configured.' };

    try {
      // 1. Verify open tasks
      const openCheck = await this.checkTeamMemberOpenTasks(profileId);
      if (openCheck.hasOpenTasks) {
        return {
          success: false,
          error: `Cannot archive team member: User has ${openCheck.openTaskCount} open task(s). Reassign all open tasks before archiving.`
        };
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (fetchErr || !profile) {
        return { success: false, error: 'User profile not found.' };
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          status: 'suspended',
          previous_status: profile.status,
          archived_at: now,
          archived_by: user?.id || null,
          archive_reason: reason.trim(),
          suspended_at: now,
          suspended_by: user?.id || null,
          updated_at: now
        })
        .eq('id', profileId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      await auditService.logAuditEvent({
        action: 'user_archived',
        entityType: 'team_member',
        entityId: profileId,
        entityName: profile.full_name,
        previousState: { status: profile.status },
        newState: { status: 'suspended', archived_at: now },
        reason: reason.trim()
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to archive team member.' };
    }
  },

  /**
   * Restore a Team Member (restores to Suspended status for safety)
   */
  async restoreTeamMember(profileId: string): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database is not configured.' };
    try {
      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (fetchErr || !profile) {
        return { success: false, error: 'User profile not found.' };
      }

      const now = new Date().toISOString();
      // Restore strictly to 'suspended' status first
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          status: 'suspended',
          archived_at: null,
          archived_by: null,
          archive_reason: null,
          updated_at: now
        })
        .eq('id', profileId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      await auditService.logAuditEvent({
        action: 'user_restored',
        entityType: 'team_member',
        entityId: profileId,
        entityName: profile.full_name,
        previousState: { status: 'archived' },
        newState: { status: 'suspended' },
        reason: 'Restored from Archive Center to Suspended status (awaiting explicit reactivation)'
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to restore team member.' };
    }
  },

  /**
   * Restore an Archived Task
   */
  async restoreTask(taskId: string, newAssigneeId?: string): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) return { success: false, error: 'Database is not configured.' };
    try {
      const { data: task, error: fetchErr } = await supabase
        .from('client_tasks')
        .select('*, client:client_id(status, company_name)')
        .eq('id', taskId)
        .single();

      if (fetchErr || !task) {
        return { success: false, error: 'Task not found.' };
      }

      // Check if client is archived
      if (task.client?.status === 'Archived') {
        return {
          success: false,
          error: `Cannot restore task: Parent client "${task.client.company_name}" is archived. Please restore the client first.`
        };
      }

      const now = new Date().toISOString();
      const updatePayload: Record<string, any> = {
        archived_at: null,
        archived_by: null,
        archive_reason: null,
        updated_at: now
      };

      if (newAssigneeId) {
        updatePayload.assignee_id = newAssigneeId;
        if (task.status === 'Draft') {
          updatePayload.status = 'Assigned';
        }
      }

      const { error: updateErr } = await supabase
        .from('client_tasks')
        .update(updatePayload)
        .eq('id', taskId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      // Append task event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('client_task_events').insert({
        task_id: taskId,
        client_id: task.client_id,
        actor_id: user?.id || null,
        event_type: 'restored',
        notes: 'Task restored from Archive Center'
      });

      await auditService.logAuditEvent({
        action: 'task_restored',
        entityType: 'task',
        entityId: taskId,
        entityName: task.title,
        clientId: task.client_id,
        clientName: task.client?.company_name,
        reason: 'Restored from Archive Center'
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to restore task.' };
    }
  }
};