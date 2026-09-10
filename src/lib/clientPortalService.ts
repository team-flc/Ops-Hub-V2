// ==============================================================================
// SERVICE: clientPortalService
// Location: src/lib/clientPortalService.ts
// Phase: Client Experience Portal Core Services
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  ClientRecord, 
  ClientTask, 
  ClientPublishedResult, 
  ClientPortalRecipient, 
  ClientDeliverableItem, 
  ClientRoadmapMilestone, 
  ClientPortalOverviewData, 
  UserProfile,
  PortalDateRange
} from '../types';
import { taskManagementService } from './taskManagementService';

export interface PortalDataResult {
  client: ClientRecord | null;
  tasks: ClientTask[];
  overview: ClientPortalOverviewData | null;
  deliverables: ClientDeliverableItem[];
  roadmapMilestones: ClientRoadmapMilestone[];
  error: string | null;
}

export const clientPortalService = {
  /**
   * Determine whether a user can preview a client portal in read-only mode
   */
  canUserPreviewPortal(callerProfile: UserProfile | null, client: ClientRecord | null): boolean {
    if (!callerProfile || !client) return false;
    if (callerProfile.status !== 'active') return false;
    if (callerProfile.role === 'owner') return true;
    if (callerProfile.role === 'operational_manager') {
      return client.operationalManagerId === callerProfile.id;
    }
    return false;
  },

  /**
   * Authoritatively fetch all client-safe portal data within strict publication boundaries
   */
  async fetchClientPortalData(
    clientId: string,
    callerProfile: UserProfile | null,
    isPreview: boolean = false,
    dateRange?: PortalDateRange
  ): Promise<PortalDataResult> {
    if (!clientId) {
      return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'Client ID is required.' };
    }

    // Immediate multi-tenant check: fail closed if unauthenticated
    if (!callerProfile) {
      return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'AUTH_DENIED: Authentication required.' };
    }

    // Immediate multi-tenant check: client role cannot access another client's workspace
    if (!isPreview && callerProfile.role === 'client' && callerProfile.organizationId !== clientId) {
      return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'AUTH_DENIED: Forbidden' };
    }

    if (!isSupabaseConfigured || !supabase) {
      return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'DATABASE_ERROR: Database service unconfigured.' };
    }

    try {
      // 1. Fetch Client Entity using confirmed production schema columns
      let cData: any = null;
      const { data: rawClient, error: cErr } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          client_name,
          package,
          status,
          pause_reason,
          activation_date,
          required_linkedin_profile_count,
          operational_manager_id,
          created_at,
          updated_at,
          manager:operational_manager_id (
            id,
            full_name
          )
        `)
        .eq('id', clientId)
        .maybeSingle();

      if (cErr) {
        // Fallback query with basic core columns in case foreign key join fails
        const { data: fallbackClient, error: fallbackErr } = await supabase
          .from('clients')
          .select('id, company_name, client_name, package, status, operational_manager_id, activation_date, created_at, updated_at')
          .eq('id', clientId)
          .maybeSingle();

        if (fallbackErr) {
          return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: `DATABASE_ERROR: ${fallbackErr.message}` };
        }
        if (!fallbackClient) {
          return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'CLIENT_NOT_FOUND' };
        }
        cData = fallbackClient;
      } else {
        if (!rawClient) {
          return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'CLIENT_NOT_FOUND' };
        }
        cData = rawClient;
      }

      const clientRecord: ClientRecord = {
        id: cData.id,
        companyName: cData.company_name || 'Client Workspace',
        clientName: cData.client_name || 'Client',
        package: cData.package || 'Basic',
        status: cData.status || 'Active',
        pauseReason: cData.pause_reason,
        activationDate: cData.activation_date || cData.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        requiredLinkedinProfileCount: cData.required_linkedin_profile_count || 3,
        operationalManagerId: cData.operational_manager_id || '',
        operationalManagerName: cData.manager?.full_name || undefined,
        links: {},
        createdAt: cData.created_at || new Date().toISOString(),
        updatedAt: cData.updated_at || new Date().toISOString()
      };

      // 2. Access Authorization Check
      if (isPreview) {
        if (!this.canUserPreviewPortal(callerProfile, clientRecord)) {
          return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'AUTH_DENIED' };
        }
      } else {
        // Authenticated client check: caller must be client role and mapped to this clientId
        if (!callerProfile || callerProfile.role !== 'client' || callerProfile.organizationId !== clientId) {
          return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'AUTH_DENIED' };
        }
      }

      // If client workspace is archived, portal is disabled
      if (clientRecord.status === 'Archived') {
        return { client: clientRecord, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: 'WORKSPACE_ARCHIVED' };
      }

      // 3. Fetch Tasks within Publication Boundary
      // Excludes internal-only draft tasks before data reaches presentation
      let allTasks: ClientTask[] = [];
      try {
        const { data: rawTasks, error: tErr } = await supabase
          .from('client_tasks')
          .select(`
            id, client_id, week_number, title, details, department_id,
            assignee_id, priority, planned_start, due_date, status,
            approval_mode, completed_at, completed_by, reopened_at, reopened_by,
            reopen_reason, blocked_reason, sort_order, created_at, updated_at,
            archived_at, is_client_visible,
            departments(id, name)
          `)
          .eq('client_id', clientId)
          .is('archived_at', null)
          .order('week_number', { ascending: true })
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (tErr) {
          // Fallback query if additive column or join not yet migrated
          const { data: fallbackTasks } = await supabase
            .from('client_tasks')
            .select('*')
            .eq('client_id', clientId)
            .is('archived_at', null);

          if (fallbackTasks) {
            allTasks = fallbackTasks.map((t: any) => ({
              id: t.id,
              clientId: t.client_id,
              weekNumber: (t.week_number || 1) as 1 | 2 | 3 | 4,
              title: t.title,
              details: t.details || t.description || '',
              departmentId: t.department_id,
              assigneeId: t.assignee_id,
              priority: t.priority || 'Normal',
              plannedStart: t.planned_start,
              dueDate: t.due_date,
              status: t.status || 'Assigned',
              approvalMode: t.approval_mode,
              completedAt: t.completed_at,
              completedBy: t.completed_by,
              reopenedAt: t.reopened_at,
              reopenedBy: t.reopened_by,
              reopenReason: t.reopen_reason,
              blockedReason: t.blocked_reason,
              sortOrder: t.sort_order || 0,
              createdAt: t.created_at,
              updatedAt: t.updated_at,
              isClientVisible: t.is_client_visible ?? true
            }));
          }
        } else if (rawTasks) {
          allTasks = rawTasks.map((t: any) => ({
            id: t.id,
            clientId: t.client_id,
            weekNumber: t.week_number as 1 | 2 | 3 | 4,
            title: t.title,
            details: t.details || '',
            departmentId: t.department_id,
            departmentName: t.departments?.name,
            assigneeId: t.assignee_id,
            priority: t.priority,
            plannedStart: t.planned_start,
            dueDate: t.due_date,
            status: t.status,
            approvalMode: t.approval_mode,
            completedAt: t.completed_at,
            completedBy: t.completed_by,
            reopenedAt: t.reopened_at,
            reopenedBy: t.reopened_by,
            reopenReason: t.reopen_reason,
            blockedReason: t.blocked_reason,
            sortOrder: t.sort_order,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            isClientVisible: t.is_client_visible
          }));
        }
      } catch (tEx) {
        console.warn('client_tasks query fallback caught:', tEx);
        allTasks = [];
      }

      // Filter tasks by publication boundary:
      // A client sees a task IF:
      // a) is_client_visible is true, OR
      // b) status is in ('Client Review', 'Completed'), OR
      // c) approvalMode is 'Client Approval Required' AND task has started work
      const publishedTasks = allTasks.filter((t: any) => {
        if (t.isClientVisible) return true;
        if (t.status === 'Client Review' || t.status === 'Completed') return true;
        if (t.approvalMode === 'Client Approval Required' && t.status !== 'Draft') return true;
        return false;
      });

      // 4. Fetch Verified Published Results
      let publishedResults: ClientPublishedResult[] = [];
      try {
        const { data: pRes } = await supabase
          .from('client_published_results')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'published')
          .order('published_at', { ascending: false });

        if (pRes) {
          publishedResults = pRes.map((r: any) => ({
            id: r.id,
            clientId: r.client_id,
            metricName: r.metric_name,
            metricValue: r.metric_value,
            metricDefinition: r.metric_definition,
            reportingPeriod: r.reporting_period,
            periodStartDate: r.period_start_date,
            periodEndDate: r.period_end_date,
            source: r.source,
            publishedAt: r.published_at,
            publishedBy: r.published_by,
            status: r.status
          }));
        }
      } catch {
        // Fallback gracefully if table not yet migrated
        publishedResults = [];
      }

      // 5. Fetch Deliverables from Client-Shared Messages
      const publishedTaskIds = publishedTasks.map((t) => t.id);
      let deliverables: ClientDeliverableItem[] = [];

      if (publishedTaskIds.length > 0) {
        try {
          const { data: messages } = await supabase
            .from('client_task_messages')
            .select('id, task_id, content, links, created_at')
            .in('task_id', publishedTaskIds)
            .eq('visibility', 'shared_with_client')
            .order('created_at', { ascending: false });

          const taskMap = new Map(publishedTasks.map((t) => [t.id, t]));

          (messages || []).forEach((m: any) => {
            const t = taskMap.get(m.task_id);
            if (!t) return;
            const links = Array.isArray(m.links) ? m.links : [];
            links.forEach((l: any, idx: number) => {
              if (l.url && typeof l.url === 'string' && l.url.startsWith('https://')) {
                deliverables.push({
                  id: `${m.id}_${idx}`,
                  title: l.title || t.title || 'Deliverable Document',
                  url: l.url,
                  taskId: t.id,
                  taskTitle: t.title,
                  departmentName: t.departmentName || 'Operations',
                  sharedAt: m.created_at
                });
              }
            });
          });
        } catch {
          deliverables = [];
        }
      }

      // 6. Fetch Published Roadmap Milestones (Phase 3D Launched Work Plans)
      let roadmapMilestones: ClientRoadmapMilestone[] = [];
      try {
        const { data: launchedPlans } = await supabase
          .from('client_work_plans')
          .select('id, name, status, start_date, end_date, launch_snapshot')
          .eq('client_id', clientId)
          .eq('status', 'Launched')
          .order('start_date', { ascending: true });

        if (launchedPlans && launchedPlans.length > 0) {
          const currentPlan = launchedPlans[0];
          const weeksMap = new Map<number, { tasks: ClientTask[] }>();
          for (let w = 1; w <= 13; w++) {
            weeksMap.set(w, { tasks: [] });
          }

          allTasks.forEach((t) => {
            const w = t.weekNumber || 1;
            const bucket = weeksMap.get(w);
            if (bucket) bucket.tasks.push(t);
          });

          // Group into 4 primary milestones:
          // Milestone 1: Weeks 1-2 (Foundation & Setup)
          // Milestone 2: Weeks 3-5 (Campaign Launch & Outreach)
          // Milestone 3: Weeks 6-9 (Scale & Channel Growth)
          // Milestone 4: Weeks 10-13 (Optimization & Quarterly Review)
          const milestoneConfigs = [
            { id: 'm1', weekNumber: 1, title: 'Phase 1: Foundation & Setup (Weeks 1-2)', startWeek: 1, endWeek: 2 },
            { id: 'm2', weekNumber: 3, title: 'Phase 2: Outreach Launch & Active Execution (Weeks 3-5)', startWeek: 3, endWeek: 5 },
            { id: 'm3', weekNumber: 6, title: 'Phase 3: Scale & Multi-Channel Expansion (Weeks 6-9)', startWeek: 6, endWeek: 9 },
            { id: 'm4', weekNumber: 10, title: 'Phase 4: Optimization, Performance & Review (Weeks 10-13)', startWeek: 10, endWeek: 13 }
          ];

          roadmapMilestones = milestoneConfigs.map((cfg) => {
            const milestoneTasks = publishedTasks.filter((t) => t.weekNumber >= cfg.startWeek && t.weekNumber <= cfg.endWeek);
            const completedMilestoneTasks = milestoneTasks.filter((t) => t.status === 'Completed');
            const inProgressMilestoneTasks = milestoneTasks.filter((t) => t.status === 'In Progress' || t.status === 'Client Review' || t.status === 'Team Review');

            let status: 'completed' | 'in_progress' | 'upcoming' = 'upcoming';
            if (milestoneTasks.length > 0 && completedMilestoneTasks.length === milestoneTasks.length) {
              status = 'completed';
            } else if (inProgressMilestoneTasks.length > 0 || completedMilestoneTasks.length > 0) {
              status = 'in_progress';
            }

            const plannedStart = currentPlan.start_date;
            const dueDate = currentPlan.end_date;
            const completedAt = status === 'completed' && completedMilestoneTasks.length > 0
              ? completedMilestoneTasks[completedMilestoneTasks.length - 1].completedAt
              : null;

            return {
              id: cfg.id,
              title: cfg.title,
              weekNumber: cfg.weekNumber,
              status,
              plannedStart,
              dueDate,
              completedAt,
              taskCount: milestoneTasks.length,
              completedTaskCount: completedMilestoneTasks.length
            };
          });
        }
      } catch {
        roadmapMilestones = [];
      }

      // 7. Calculate Date-Filtered Delivery Indicators & 30-Second Summary
      let filterStart = dateRange?.startDate;
      let filterEnd = dateRange?.endDate;

      if (!filterStart || !filterEnd) {
        // Default to current week
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay() + 1); // Monday
        const end = new Date(start);
        end.setDate(start.getDate() + 6); // Sunday
        filterStart = start.toISOString().split('T')[0];
        filterEnd = end.toISOString().split('T')[0];
      }

      // Completed in Period (Checked against completed_at date)
      const completedInPeriod = publishedTasks.filter((t) => {
        if (t.status !== 'Completed' || !t.completedAt) return false;
        const compDate = t.completedAt.split('T')[0];
        return compDate >= filterStart! && compDate <= filterEnd!;
      });

      // Current State Counts
      const inProgressTasks = publishedTasks.filter((t) => t.status === 'In Progress' || t.status === 'Team Review');
      const needsInputTasks = publishedTasks.filter((t) => t.status === 'Client Review');
      const upcomingTasks = publishedTasks.filter((t) => {
        if (t.status === 'Completed' || t.status === 'In Progress' || t.status === 'Client Review') return false;
        if (!t.plannedStart) return false;
        const startDate = t.plannedStart.split('T')[0];
        return startDate > new Date().toISOString().split('T')[0];
      });

      // Next scheduled milestone
      const nextMilestone = roadmapMilestones.find((m) => m.status === 'in_progress' || m.status === 'upcoming');
      const nextMilestoneName = nextMilestone ? nextMilestone.title : 'Ongoing delivery review';

      const factualSummary = `${completedInPeriod.length} ${completedInPeriod.length === 1 ? 'deliverable' : 'deliverables'} completed during this period. ${needsInputTasks.length} ${needsInputTasks.length === 1 ? 'item requires' : 'items require'} your input. The next scheduled milestone is ${nextMilestoneName}.`;

      const overview: ClientPortalOverviewData = {
        client: clientRecord,
        factualSummary,
        completedInPeriodCount: completedInPeriod.length,
        inProgressCount: inProgressTasks.length,
        needsInputCount: needsInputTasks.length,
        upcomingCount: upcomingTasks.length,
        publishedResults,
        publishedDeliverablesRatio: {
          completed: publishedTasks.filter((t) => t.status === 'Completed').length,
          total: publishedTasks.length
        }
      };

      return {
        client: clientRecord,
        tasks: publishedTasks,
        overview,
        deliverables,
        roadmapMilestones,
        error: null
      };
    } catch (err: any) {
      console.error('Failed to load client portal data:', err);
      return { client: null, tasks: [], overview: null, deliverables: [], roadmapMilestones: [], error: `DATABASE_ERROR: ${err?.message || 'Failed to load client portal data.'}` };
    }
  },

  /**
   * Fetch approved recipients for a client (Owner & Manager access)
   */
  async fetchApprovedRecipients(clientId: string): Promise<ClientPortalRecipient[]> {
    if (!isSupabaseConfigured || !supabase || !clientId) return [];

    try {
      // 1. Check client_portal_recipients table
      const { data: recs, error: rErr } = await supabase
        .from('client_portal_recipients')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (!rErr && recs && recs.length > 0) {
        return recs.map((r: any) => ({
          id: r.id,
          clientId: r.client_id,
          profileId: r.profile_id,
          email: r.email,
          fullName: r.full_name,
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
      }

      // 2. Fallback to profiles table for client accounts
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, work_email, contact_email, status, created_at, updated_at')
        .eq('organization_id', clientId)
        .eq('role', 'client');

      if (profs && profs.length > 0) {
        return profs.map((p: any) => ({
          id: p.id,
          clientId,
          profileId: p.id,
          email: p.work_email || p.contact_email || '',
          fullName: p.full_name,
          status: p.status === 'suspended' ? 'revoked' : 'active',
          createdAt: p.created_at,
          updatedAt: p.updated_at
        }));
      }

      return [];
    } catch {
      return [];
    }
  },

  /**
   * Add a new approved client recipient (Owner only)
   */
  async addPortalRecipient(
    clientId: string,
    email: string,
    fullName: string,
    callerProfile: UserProfile | null
  ): Promise<{ recipient?: ClientPortalRecipient; error?: string }> {
    if (!callerProfile || callerProfile.role !== 'owner') {
      return { error: 'Forbidden: Only the Owner can configure client portal recipients.' };
    }

    const cleanEmail = email?.trim().toLowerCase();
    const cleanName = fullName?.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { error: 'A valid email address is required.' };
    }

    if (!cleanName) {
      return { error: 'Recipient full name is required.' };
    }

    if (!supabase) return { error: 'Database service unconfigured.' };

    try {
      const { data, error } = await supabase
        .from('client_portal_recipients')
        .insert({
          client_id: clientId,
          email: cleanEmail,
          full_name: cleanName,
          status: 'active',
          created_by: callerProfile.id
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { error: 'A recipient with this email already exists for this client.' };
        }
        return { error: error.message };
      }

      return {
        recipient: {
          id: data.id,
          clientId: data.client_id,
          profileId: data.profile_id,
          email: data.email,
          fullName: data.full_name,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (err: any) {
      return { error: err?.message || 'Failed to add recipient.' };
    }
  },

  /**
   * Revoke client portal recipient access (Owner only)
   */
  async revokePortalRecipient(
    recipientId: string,
    callerProfile: UserProfile | null
  ): Promise<{ error?: string }> {
    if (!callerProfile || callerProfile.role !== 'owner') {
      return { error: 'Forbidden: Only the Owner can revoke client portal access.' };
    }

    if (!supabase) return { error: 'Database service unconfigured.' };

    try {
      const { error } = await supabase
        .from('client_portal_recipients')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', recipientId);

      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to revoke recipient.' };
    }
  },

  /**
   * Submit Client Review decision (Approve or Request Changes)
   */
  async submitClientTaskDecision(
    taskId: string,
    decision: 'approve' | 'request_changes',
    reason: string | undefined,
    callerProfile: UserProfile | null,
    isPreview: boolean
  ): Promise<{ error?: string }> {
    if (isPreview) {
      return { error: 'Client mutations are disabled in read-only staff preview mode.' };
    }

    if (!callerProfile) {
      return { error: 'Authentication required.' };
    }

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : ('dec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));

    if (decision === 'approve') {
      const res = await taskManagementService.updateStatus(
        taskId,
        'Completed',
        undefined,
        'Client Review',
        { idempotencyKey }
      );
      return res.error ? { error: res.error } : {};
    } else {
      if (!reason || !reason.trim()) {
        return { error: 'Please provide details explaining the changes requested.' };
      }
      const res = await taskManagementService.updateStatus(
        taskId,
        'In Progress',
        reason.trim(),
        'Client Review',
        { idempotencyKey }
      );
      return res.error ? { error: res.error } : {};
    }
  }
};
