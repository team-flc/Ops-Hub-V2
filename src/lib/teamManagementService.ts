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
  facebookUrl?: string;
  instagramUrl?: string;
  bio?: string;
  avatarUrl?: string | null;
  cnic?: string;
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
  role?: 'operational_manager' | 'team_member';
  phone?: string;
  backupPhone?: string;
  contactEmail?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  bio?: string;
  avatarUrl?: string | null;
  cnic?: string;
  startDate: string;
  departmentIds: string[];
  designationId: string;
  reportingManagerId?: string;
  clientIds?: string[];
}

async function extractFunctionsError(error: any, fallbackMessage: string): Promise<string> {
  if (!error) return fallbackMessage;
  try {
    if (error.context && typeof error.context.json === 'function') {
      const errorBody = await error.context.json();
      if (errorBody?.error) {
        return errorBody.error;
      }
    }
  } catch (_) {
    // Ignore JSON parsing errors and fallback to error.message
  }
  return error.message || fallbackMessage;
}

export const teamManagementService = {
  /**
   * Fetch all visible team members scoped to caller's role with multi-tier resilient fallbacks
   */
  async fetchTeamMembers(callerRole: UserRole, callerId: string): Promise<TeamMemberRecord[]> {
    if (!supabase) return [];

    try {
      let profiles: any[] | null = null;
      let profError: any = null;

      // Tier 1: Full select('*')
      const res1 = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!res1.error && res1.data && res1.data.length > 0) {
        profiles = res1.data;
      } else if (!res1.error && res1.data && res1.data.length === 0) {
        // Table queried cleanly but has 0 rows
        profiles = [];
      } else {
        profError = res1.error;
        console.warn('Tier 1 profiles select(*) encountered issue, attempting Tier 2 fallback:', res1.error?.message);

        // Tier 2: Core fields fallback
        const res2 = await supabase
          .from('profiles')
          .select('id, full_name, role, status, work_email, avatar_url, phone, bio, designation_id, reporting_manager_id, start_date, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (!res2.error && res2.data) {
          profiles = res2.data;
          profError = null;
        } else {
          // Tier 3: Minimal fields fallback
          const res3 = await supabase
            .from('profiles')
            .select('id, full_name, role, status');

          if (!res3.error && res3.data) {
            profiles = res3.data;
            profError = null;
          }
        }
      }

      if (profError || !profiles) {
        console.error('Error fetching team profiles after all query tiers:', profError?.message);
        return [];
      }

      // Filter roles in-memory for maximum resilience against PostgREST URL encoding or case variations
      const filteredProfiles = profiles.filter((p: any) => {
        const r = (p.role || '').toLowerCase();
        // Exclude pure client roles
        if (r.includes('client')) return false;

        if (callerRole === 'operational_manager') {
          return p.reporting_manager_id === callerId || p.id === callerId;
        } else if (callerRole === 'team_member') {
          return p.id === callerId;
        }
        // Owner or unassigned gets all internal staff
        return true;
      });

      // Resilient auxiliary joins: an error in any auxiliary table will never fail the profiles list
      const [
        deptsRes,
        designationsRes,
        profDeptsRes,
        profClientsRes,
        clientTeamAccessRes,
        managersRes
      ] = await Promise.allSettled([
        supabase.from('departments').select('*'),
        supabase.from('designations').select('*'),
        supabase.from('profile_departments').select('*'),
        supabase.from('profile_client_access').select('*'),
        supabase.from('client_team_access').select('*'),
        supabase.from('profiles').select('id, full_name, role')
      ]);

      const allDepts = deptsRes.status === 'fulfilled' && deptsRes.value?.data ? deptsRes.value.data : [];
      const allDesignations = designationsRes.status === 'fulfilled' && designationsRes.value?.data ? designationsRes.value.data : [];
      const allProfDepts = profDeptsRes.status === 'fulfilled' && profDeptsRes.value?.data ? profDeptsRes.value.data : [];
      const allProfClients = profClientsRes.status === 'fulfilled' && profClientsRes.value?.data ? profClientsRes.value.data : [];
      const allClientTeamAccess = clientTeamAccessRes.status === 'fulfilled' && clientTeamAccessRes.value?.data ? clientTeamAccessRes.value.data : [];
      const allManagers = managersRes.status === 'fulfilled' && managersRes.value?.data ? managersRes.value.data : [];

      const deptMap = new Map((allDepts || []).map((d: any) => [d.id, d]));
      const designationMap = new Map((allDesignations || []).map((d: any) => [d.id, d.name]));
      const managerMap = new Map(
        (allManagers || [])
          .filter((m: any) => m.role === 'owner' || m.role === 'operational_manager')
          .map((m: any) => [m.id, m.full_name])
      );

      const profDeptsMap = new Map<string, Department[]>();
      (allProfDepts || []).forEach((pd: any) => {
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
      (allProfClients || []).forEach((pc: any) => {
        const set = profClientsMap.get(pc.profile_id) || new Set<string>();
        set.add(pc.client_id);
        profClientsMap.set(pc.profile_id, set);
      });
      (allClientTeamAccess || []).forEach((cta: any) => {
        const set = profClientsMap.get(cta.profile_id) || new Set<string>();
        set.add(cta.client_id);
        profClientsMap.set(cta.profile_id, set);
      });

      return filteredProfiles.map((p: any) => {
        const userClientIds = Array.from(profClientsMap.get(p.id) || []);
        return {
          id: p.id,
          fullName: p.full_name || 'Team Member',
          workEmail: p.work_email || '',
          phone: p.phone,
          cnic: p.cnic || null,
          avatarUrl: p.avatar_url || null,
          role: p.role || 'team_member',
          status: p.status || 'active',
          designationId: p.designation_id,
          designationName: p.designation_id ? designationMap.get(p.designation_id) || 'Unassigned' : 'Unassigned',
          reportingManagerId: p.reporting_manager_id,
          reportingManagerName: p.role === 'owner' ? '—' : (p.reporting_manager_id ? managerMap.get(p.reporting_manager_id) || 'Unassigned' : 'Unassigned'),
          startDate: p.start_date || (p.created_at ? p.created_at.split('T')[0] : ''),
          suspendedAt: p.suspended_at,
          suspendedBy: p.suspended_by,
          departments: profDeptsMap.get(p.id) || [],
          clientAccessCount: userClientIds.length,
          clientIds: userClientIds,
          createdAt: p.created_at || new Date().toISOString(),
          updatedAt: p.updated_at || new Date().toISOString()
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
        .select('*')
        .order('full_name', { ascending: true });

      if (error || !data) return [];
      return data
        .filter((m: any) => (m.role === 'owner' || m.role === 'operational_manager') && m.status === 'active')
        .map((m: any) => ({
          id: m.id,
          fullName: m.full_name || 'Manager',
          role: m.role,
          status: m.status,
          createdAt: m.created_at || '',
          updatedAt: m.updated_at || ''
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
        const errorMsg = await extractFunctionsError(error, 'Failed to create team member.');
        return { error: errorMsg };
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
        const errorMsg = await extractFunctionsError(error, 'Failed to update team member.');
        return { error: errorMsg };
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

      if (error) {
        const errorMsg = await extractFunctionsError(error, 'Failed to reset password.');
        return { error: errorMsg };
      }
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

      if (error) {
        const errorMsg = await extractFunctionsError(error, 'Failed to suspend team member.');
        return { error: errorMsg };
      }
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

      if (error) {
        const errorMsg = await extractFunctionsError(error, 'Failed to reactivate team member.');
        return { error: errorMsg };
      }
      if (data?.error) return { error: data.error };

      return {};
    } catch {
      return { error: 'Failed to reactivate team member.' };
    }
  }
};
