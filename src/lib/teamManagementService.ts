import { supabase } from './supabase';
import { mapDbTaskToTask } from './supabaseService';
import { 
  Department, 
  Designation, 
  TeamMemberRecord, 
  UserProfile, 
  UserRole, 
  Task 
} from '../types';

export interface CreateTeamMemberPayload {
  fullName: string;
  workEmail: string;
  role?: 'operational_manager' | 'team_member';
  phone?: string;
  backupPhone?: string;
  contactEmail?: string;
  linkedinUrl?: string;
  bio?: string;
  avatarUrl?: string | null;
  startDate: string;
  departmentIds: string[];
  designationId: string;
  reportingManagerId?: string;
  clientIds?: string[];
  password: string;
}

export interface UpdateTeamMemberPayload {
  id: string;
  fullName: string;
  phone?: string;
  backupPhone?: string;
  contactEmail?: string;
  linkedinUrl?: string;
  bio?: string;
  avatarUrl?: string | null;
  startDate: string;
  departmentIds: string[];
  designationId: string;
  reportingManagerId?: string;
  clientIds?: string[];
}

export const teamManagementService = {
  /**
   * Fetch all visible team members scoped to caller's role
   */
  async fetchTeamMembers(callerRole: UserRole, callerId: string): Promise<TeamMemberRecord[]> {
    if (!supabase) return [];

    try {
      let query = supabase
        .from('profiles')
        .select(`
          id, full_name, work_email, phone, role, status,
          designation_id, reporting_manager_id, start_date,
          suspended_at, suspended_by, created_at, updated_at
        `)
        .eq('role', 'team_member');

      // Scoped permissions: Operational Manager can only view their direct reports
      if (callerRole === 'operational_manager') {
        query = query.eq('reporting_manager_id', callerId);
      }

      const { data: profiles, error: profError } = await query.order('created_at', { ascending: false });
      if (profError || !profiles) {
        console.error('Error fetching team profiles:', profError?.message);
        return [];
      }

      // Fetch all departments, designations, profile-departments, client-access to join in-memory
      const [
        { data: allDepts },
        { data: allDesignations },
        { data: allProfDepts },
        { data: allProfClients },
        { data: allClientTeamAccess },
        { data: allManagers }
      ] = await Promise.all([
        supabase.from('departments').select('*'),
        supabase.from('designations').select('*'),
        supabase.from('profile_departments').select('*'),
        supabase.from('profile_client_access').select('*'),
        supabase.from('client_team_access').select('*'),
        supabase.from('profiles').select('id, full_name').in('role', ['owner', 'operational_manager'])
      ]);

      const deptMap = new Map((allDepts || []).map((d) => [d.id, d]));
      const designationMap = new Map((allDesignations || []).map((d) => [d.id, d.name]));
      const managerMap = new Map((allManagers || []).map((m) => [m.id, m.full_name]));

      const profDeptsMap = new Map<string, Department[]>();
      (allProfDepts || []).forEach((pd) => {
        const dept = deptMap.get(pd.department_id);
        if (dept) {
          const list = profDeptsMap.get(pd.profile_id) || [];
          list.push({
            id: dept.id,
            name: dept.name,
            slug: dept.slug,
            status: dept.status,
            sortOrder: dept.sort_order,
            createdAt: dept.created_at,
            updatedAt: dept.updated_at
          });
          profDeptsMap.set(pd.profile_id, list);
        }
      });

      const profClientsMap = new Map<string, Set<string>>();
      (allProfClients || []).forEach((pc) => {
        const set = profClientsMap.get(pc.profile_id) || new Set<string>();
        set.add(pc.client_id);
        profClientsMap.set(pc.profile_id, set);
      });
      (allClientTeamAccess || []).forEach((cta) => {
        const set = profClientsMap.get(cta.profile_id) || new Set<string>();
        set.add(cta.client_id);
        profClientsMap.set(cta.profile_id, set);
      });

      return profiles.map((p) => {
        const userClientIds = Array.from(profClientsMap.get(p.id) || []);
        return {
          id: p.id,
          fullName: p.full_name,
          workEmail: p.work_email || '',
          phone: p.phone,
          role: p.role,
          status: p.status,
          designationId: p.designation_id,
          designationName: p.designation_id ? designationMap.get(p.designation_id) || 'Unassigned' : 'Unassigned',
          reportingManagerId: p.reporting_manager_id,
          reportingManagerName: p.reporting_manager_id ? managerMap.get(p.reporting_manager_id) || 'Unassigned' : 'Unassigned',
          startDate: p.start_date || p.created_at.split('T')[0],
          suspendedAt: p.suspended_at,
          suspendedBy: p.suspended_by,
          departments: profDeptsMap.get(p.id) || [],
          clientAccessCount: userClientIds.length,
          clientIds: userClientIds,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        };
      });
    } catch (err) {
      console.error('Failed to load team members:', err);
      return [];
    }
  },

  /**
   * Fetch all locked production departments
   */
  async fetchDepartments(): Promise<Department[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error || !data) return [];
      return data.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        status: d.status,
        sortOrder: d.sort_order,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));
    } catch {
      return [];
    }
  },

  /**
   * Fetch all designations
   */
  async fetchDesignations(): Promise<Designation[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('designations')
        .select('*')
        .order('name', { ascending: true });

      if (error || !data) return [];
      return data.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        createdBy: d.created_by,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));
    } catch {
      return [];
    }
  },

  /**
   * Create a new custom designation
   */
  async createDesignation(name: string, callerId: string): Promise<{ designation?: Designation; error?: string }> {
    if (!supabase) return { error: 'Database service unconfigured.' };
    const cleanName = name.trim();
    if (!cleanName) return { error: 'Designation name cannot be empty.' };

    try {
      const { data, error } = await supabase
        .from('designations')
        .insert({
          name: cleanName,
          status: 'active',
          created_by: callerId
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { error: 'A designation with this name already exists.' };
        }
        return { error: error.message };
      }

      return {
        designation: {
          id: data.id,
          name: data.name,
          status: data.status,
          createdBy: data.created_by,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch {
      return { error: 'Failed to create designation.' };
    }
  },

  /**
   * Archive unused or active designation
   */
  async setDesignationStatus(id: string, status: 'active' | 'archived'): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database service unconfigured.' };
    try {
      const { error } = await supabase
        .from('designations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) return { error: error.message };
      return {};
    } catch {
      return { error: 'Failed to update designation status.' };
    }
  },

  /**
   * Fetch active Owners and Operational Managers for reporting manager dropdown
   */
  async fetchEligibleManagers(): Promise<UserProfile[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, status')
        .in('role', ['owner', 'operational_manager'])
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      if (error || !data) return [];
      return data.map((m) => ({
        id: m.id,
        fullName: m.full_name,
        role: m.role,
        status: m.status,
        createdAt: '',
        updatedAt: ''
      }));
    } catch {
      return [];
    }
  },

  /**
   * Invoke Supabase Edge Function to securely create a new Team Member
   */
  async createTeamMember(payload: CreateTeamMemberPayload): Promise<{ user?: any; error?: string }> {
    if (!supabase) return { error: 'Authentication service unconfigured.' };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { error: 'Your session has expired. Please sign in again.' };

      const { data, error } = await supabase.functions.invoke('manage-team-member', {
        body: { action: 'create', ...payload },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) {
        return { error: error.message || 'Failed to create team member.' };
      }

      if (data?.error) {
        return { error: data.error };
      }

      return { user: data.user };
    } catch (err: any) {
      return { error: err.message || 'Network error while creating team member.' };
    }
  },

  /**
   * Update an existing Team Member's profile, departments, and client access
   * Authoritatively enforced by manage-team-member Edge Function
   */
  async updateTeamMember(
    payload: UpdateTeamMemberPayload,
    _callerId?: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Database service unconfigured.' };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { error: 'Your session has expired. Please sign in again.' };

      const { data, error } = await supabase.functions.invoke('manage-team-member', {
        body: { action: 'update', ...payload },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) {
        return { error: error.message || 'Failed to update team member.' };
      }

      if (data?.error) {
        return { error: data.error };
      }

      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to update team member.' };
    }
  },

  /**
   * Reset a Team Member's password via Edge Function
   */
  async resetPassword(targetUserId: string, newPassword: string): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Authentication service unconfigured.' };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { error: 'Session expired.' };

      const { data, error } = await supabase.functions.invoke('manage-team-member', {
        body: { action: 'reset_password', targetUserId, newPassword },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) return { error: error.message };
      if (data?.error) return { error: data.error };

      return {};
    } catch {
      return { error: 'Failed to reset password.' };
    }
  },

  /**
   * Fetch all open tasks assigned to a specific user (for offboarding check)
   */
  async fetchOpenTasksForUser(userId: string): Promise<Task[]> {
    if (!supabase) return [];
    try {
      // 1. Check real client_tasks table first
      const { data: clientTasks, error: ctError } = await supabase
        .from('client_tasks')
        .select('*')
        .eq('assignee_id', userId)
        .neq('status', 'Completed');

      if (!ctError && clientTasks && clientTasks.length > 0) {
        return clientTasks.map((ct: any) => mapDbTaskToTask({
          id: ct.id,
          task_number: ct.task_number || `TSK-${ct.id.slice(0, 6)}`,
          title: ct.title,
          description: ct.details || ct.description || '',
          status: ct.status === 'Completed' ? 'completed' : 'in_progress',
          priority: ct.priority?.toLowerCase() || 'normal',
          assignee_ids: ct.assignee_id ? [ct.assignee_id] : [],
          due_date: ct.due_date,
          created_at: ct.created_at,
          updated_at: ct.updated_at
        }));
      }

      // 2. Fallback to prototype tasks table if present/mocked
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .contains('assignee_ids', [userId])
        .neq('status', 'completed');

      if (error || !data) return [];
      return data.map(mapDbTaskToTask);
    } catch {
      return [];
    }
  },

  /**
   * Suspend a Team Member after open task reassignment
   */
  async suspendTeamMember(
    targetUserId: string,
    reassignments: { taskId: string; newAssigneeId: string }[],
    callerId: string
  ): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Authentication service unconfigured.' };

    try {
      // 1. Execute task reassignments
      for (const reassignment of reassignments) {
        const { data: task } = await supabase
          .from('tasks')
          .select('assignee_ids')
          .eq('id', reassignment.taskId)
          .single();

        if (task) {
          const currentAssignees: string[] = task.assignee_ids || [];
          const updatedAssignees = currentAssignees
            .filter((id) => id !== targetUserId)
            .concat(reassignment.newAssigneeId);

          await supabase
            .from('tasks')
            .update({ assignee_ids: Array.from(new Set(updatedAssignees)), updated_at: new Date().toISOString() })
            .eq('id', reassignment.taskId);
        }
      }

      if (reassignments.length > 0) {
        await supabase.from('user_management_audit_log').insert({
          actor_id: callerId,
          target_user_id: targetUserId,
          action: 'tasks_reassigned_for_suspension',
          safe_changes: { reassignedCount: reassignments.length }
        });
      }

      // 2. Invoke Edge Function for Auth ban and Profile suspension
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { error: 'Session expired.' };

      const { data, error } = await supabase.functions.invoke('manage-team-member', {
        body: { action: 'suspend', targetUserId },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) return { error: error.message };
      if (data?.error) return { error: data.error };

      return {};
    } catch {
      return { error: 'Failed to suspend team member.' };
    }
  },

  /**
   * Reactivate a suspended Team Member
   */
  async reactivateTeamMember(targetUserId: string): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Authentication service unconfigured.' };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { error: 'Session expired.' };

      const { data, error } = await supabase.functions.invoke('manage-team-member', {
        body: { action: 'reactivate', targetUserId },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) return { error: error.message };
      if (data?.error) return { error: data.error };

      return {};
    } catch {
      return { error: 'Failed to reactivate team member.' };
    }
  }
};
