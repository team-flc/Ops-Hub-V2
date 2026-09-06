// ==============================================================================
// SUPABASE EDGE FUNCTION: manage-client-task
// Location: supabase/functions/manage-client-task/index.ts
// Environment: Deno Runtime / Supabase Functions
// Phase: 3B — Task Conversation Feed, Review & Approval
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/obshub2\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.obshub2\.pages\.dev$/,
  /^http:\/\/localhost:(5173|3000|4173)$/
];

const getCorsHeaders = (origin: string | null) => {
  let matchedOrigin = 'https://obshub2.pages.dev';
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    matchedOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': matchedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
};

// Date Validation Helpers (Timezone: Asia/Karachi / UTC)
function isSunday(dateStr: string): boolean {
  if (!dateStr) return false;
  const trimmed = typeof dateStr === 'string' ? dateStr.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-').map(Number);
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return dt.getUTCDay() === 0;
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (d.getUTCDay() === 0) return true;

  try {
    const pktDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      weekday: 'short'
    }).format(d);
    if (pktDay === 'Sun') return true;
  } catch {
    // fallback
  }

  return false;
}

function isSaturday(dateStr: string): boolean {
  if (!dateStr) return false;
  const trimmed = typeof dateStr === 'string' ? dateStr.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-').map(Number);
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return dt.getUTCDay() === 6;
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (d.getUTCDay() === 6) return true;

  try {
    const pktDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      weekday: 'short'
    }).format(d);
    if (pktDay === 'Sat') return true;
  } catch {
    // fallback
  }

  return false;
}

function validateHttpsLink(urlStr: string): { valid: boolean; error?: string; sanitized?: string } {
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

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error: Service role credentials missing.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Extract Caller's JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Missing authorization header.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user: callerUser }, error: userAuthError } = await supabaseAdmin.auth.getUser(jwt);

  if (userAuthError || !callerUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid authentication session.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  // Load Caller Profile
  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, status, organization_id')
    .eq('id', callerUser.id)
    .single();

  if (profileError || !callerProfile || callerProfile.status !== 'active') {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Caller profile is inactive or unauthorized.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request body.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { action } = body;
  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Missing required field: action' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Helper: Verify Manager/Owner Permissions for Client (Operational Manager strictly assigned)
  async function checkCanManageClient(clientId: string): Promise<boolean> {
    if (callerProfile.role === 'owner') return true;
    if (callerProfile.role === 'operational_manager') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, operational_manager_id')
        .eq('id', clientId)
        .single();
      return Boolean(client && client.operational_manager_id === callerProfile.id);
    }
    return false;
  }

  // Helper: Verify Client Access for Team Member or Client
  async function checkCanAccessClient(clientId: string): Promise<boolean> {
    if (callerProfile.role === 'owner') return true;
    if (callerProfile.role === 'operational_manager') {
      return checkCanManageClient(clientId);
    }
    if (callerProfile.role === 'team_member') {
      const { data: grant } = await supabaseAdmin
        .from('client_team_access')
        .select('client_id')
        .eq('client_id', clientId)
        .eq('profile_id', callerProfile.id)
        .single();
      return Boolean(grant);
    }
    if (callerProfile.role === 'client') {
      return callerProfile.organization_id === clientId;
    }
    return false;
  }

  // Helper: Verify Assignee Eligibility
  async function checkAssigneeEligibility(assigneeId: string, clientId: string, departmentId?: string): Promise<{ valid: boolean; error?: string }> {
    const { data: assignee, error: aErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, status, archived_at')
      .eq('id', assigneeId)
      .single();

    if (aErr || !assignee || assignee.status !== 'active' || assignee.archived_at) {
      return { valid: false, error: 'Assignee profile is not active or is archived.' };
    }

    if (assignee.role === 'client') {
      return { valid: false, error: 'Client role users cannot be assigned to tasks.' };
    }

    if (assignee.role === 'team_member') {
      const { data: access } = await supabaseAdmin
        .from('client_team_access')
        .select('client_id')
        .eq('client_id', clientId)
        .eq('profile_id', assigneeId)
        .single();

      if (!access) {
        return { valid: false, error: 'Assignee does not have explicit access to this client.' };
      }

      if (departmentId) {
        const { data: deptMembership } = await supabaseAdmin
          .from('profile_departments')
          .select('profile_id')
          .eq('profile_id', assigneeId)
          .eq('department_id', departmentId)
          .single();

        if (!deptMembership) {
          return { valid: false, error: 'Assignee does not belong to the responsible department for this task.' };
        }
      }
    }

    return { valid: true };
  }

  try {
    // --------------------------------------------------------------------------
    // ACTION: create
    // --------------------------------------------------------------------------
    if (action === 'create') {
      const {
        client_id, week_number, title, details, department_id,
        assignee_id, priority = 'Normal', approval_mode = 'Internal Only', planned_start, due_date,
        source_template_id, source_template_version
      } = body;

      if (!client_id || !week_number || !title || !department_id || !planned_start || !due_date) {
        return new Response(
          JSON.stringify({ error: 'Missing required task fields: client_id, week_number, title, department_id, planned_start, due_date.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const canManage = await checkCanManageClient(client_id);
      if (!canManage) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only management can create operational tasks.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Check client active status
      const { data: clientRec } = await supabaseAdmin
        .from('clients')
        .select('id, status')
        .eq('id', client_id)
        .single();

      if (!clientRec || clientRec.status === 'Archived') {
        return new Response(
          JSON.stringify({ error: 'Cannot create tasks for an archived client.' }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (clientRec.status === 'Paused') {
        return new Response(
          JSON.stringify({ error: 'Cannot create tasks for a paused client.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Template provenance validation if provided
      let resolvedSourceTemplateId: string | null = null;
      let resolvedSourceTemplateVersion: number | null = null;
      if (source_template_id) {
        const { data: templateRec, error: tErr } = await supabaseAdmin
          .from('task_templates')
          .select('id, version, status')
          .eq('id', source_template_id)
          .single();

        if (tErr || !templateRec) {
          return new Response(JSON.stringify({ error: 'Referenced task template does not exist.' }), { status: 400, headers: corsHeaders });
        }
        if (templateRec.status === 'Archived') {
          return new Response(JSON.stringify({ error: 'Cannot create task from an archived template.' }), { status: 400, headers: corsHeaders });
        }
        resolvedSourceTemplateId = templateRec.id;
        resolvedSourceTemplateVersion = source_template_version || templateRec.version || 1;
      }

      // Date validations (Sat/Sun rejection)
      if (isSunday(planned_start)) {
        return new Response(JSON.stringify({ error: 'Planned start date cannot fall on a Sunday.' }), { status: 400, headers: corsHeaders });
      }
      if (isSaturday(planned_start)) {
        return new Response(JSON.stringify({ error: 'Planned start date cannot fall on a Saturday.' }), { status: 400, headers: corsHeaders });
      }
      if (isSunday(due_date)) {
        return new Response(JSON.stringify({ error: 'Due date cannot fall on a Sunday.' }), { status: 400, headers: corsHeaders });
      }
      if (isSaturday(due_date)) {
        return new Response(JSON.stringify({ error: 'Due date cannot fall on a Saturday.' }), { status: 400, headers: corsHeaders });
      }

      if (new Date(due_date).getTime() < new Date(planned_start).getTime()) {
        return new Response(JSON.stringify({ error: 'Due date cannot be earlier than planned start date.' }), { status: 400, headers: corsHeaders });
      }

      if (!['Low', 'Normal', 'High', 'Urgent'].includes(priority)) {
        return new Response(JSON.stringify({ error: 'Invalid priority level.' }), { status: 400, headers: corsHeaders });
      }

      if (!['Internal Only', 'Client Approval Required'].includes(approval_mode)) {
        return new Response(JSON.stringify({ error: 'Invalid approval_mode value.' }), { status: 400, headers: corsHeaders });
      }

      // Assignee eligibility check
      if (assignee_id) {
        const eligibility = await checkAssigneeEligibility(assignee_id, client_id, department_id);
        if (!eligibility.valid) {
          return new Response(JSON.stringify({ error: eligibility.error }), { status: 400, headers: corsHeaders });
        }
      }

      const initialStatus = assignee_id ? 'Assigned' : 'Draft';

      const { data: newTask, error: insertError } = await supabaseAdmin
        .from('client_tasks')
        .insert({
          client_id,
          week_number: Number(week_number),
          title: title.trim(),
          details: details ? details.trim() : null,
          department_id,
          assignee_id: assignee_id || null,
          priority,
          approval_mode,
          planned_start,
          due_date,
          status: initialStatus,
          source_template_id: resolvedSourceTemplateId,
          source_template_version: resolvedSourceTemplateVersion,
          created_by: callerProfile.id,
          updated_by: callerProfile.id
        })
        .select()
        .single();

      if (insertError || !newTask) {
        return new Response(
          JSON.stringify({ error: insertError?.message || 'Failed to create task record.' }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Record Created Event
      await supabaseAdmin.from('client_task_events').insert({
        task_id: newTask.id,
        client_id,
        actor_id: callerProfile.id,
        event_type: 'created',
        new_state: newTask,
        notes: resolvedSourceTemplateId
          ? `Task created in ${initialStatus} status from template (${resolvedSourceTemplateId} v${resolvedSourceTemplateVersion})`
          : `Task created in ${initialStatus} status`
      });

      // Record audit event in system_audit_events if created from template
      if (resolvedSourceTemplateId) {
        await supabaseAdmin.from('system_audit_events').insert({
          actor_id: callerProfile.id,
          actor_name: callerProfile.full_name,
          actor_role: callerProfile.role,
          action: 'task_created_from_template',
          entity_type: 'task_template',
          entity_id: resolvedSourceTemplateId,
          client_id: newTask.client_id,
          metadata: {
            task_id: newTask.id,
            task_title: newTask.title,
            client_id: newTask.client_id,
            template_version: resolvedSourceTemplateVersion
          }
        });
      }

      return new Response(
        JSON.stringify({ success: true, task: newTask }),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: update
    // --------------------------------------------------------------------------
    if (action === 'update') {
      const { task_id, title, details, department_id, priority, approval_mode, planned_start, due_date } = body;
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'Missing task_id' }), { status: 400, headers: corsHeaders });
      }

      const { data: existingTask } = await supabaseAdmin
        .from('client_tasks')
        .select('*')
        .eq('id', task_id)
        .single();

      if (!existingTask || existingTask.archived_at) {
        return new Response(JSON.stringify({ error: 'Task not found or is archived.' }), { status: 404, headers: corsHeaders });
      }

      const canManage = await checkCanManageClient(existingTask.client_id);
      if (!canManage) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot edit task fields.' }), { status: 403, headers: corsHeaders });
      }

      // Check if client is paused or archived
      const { data: targetClient } = await supabaseAdmin
        .from('clients')
        .select('status')
        .eq('id', existingTask.client_id)
        .single();

      if (targetClient?.status === 'Paused' || targetClient?.status === 'Archived') {
        return new Response(
          JSON.stringify({ error: `Cannot modify tasks for a ${targetClient.status.toLowerCase()} client.` }),
          { status: 400, headers: corsHeaders }
        );
      }

      const updates: any = { updated_by: callerProfile.id };
      if (title !== undefined) updates.title = title.trim();
      if (details !== undefined) updates.details = details ? details.trim() : null;
      if (department_id !== undefined) updates.department_id = department_id;
      if (priority !== undefined) {
        if (!['Low', 'Normal', 'High', 'Urgent'].includes(priority)) {
          return new Response(JSON.stringify({ error: 'Invalid priority value.' }), { status: 400, headers: corsHeaders });
        }
        updates.priority = priority;
      }
      if (approval_mode !== undefined) {
        if (!['Internal Only', 'Client Approval Required'].includes(approval_mode)) {
          return new Response(JSON.stringify({ error: 'Invalid approval_mode value.' }), { status: 400, headers: corsHeaders });
        }
        updates.approval_mode = approval_mode;
      }

      const checkStart = planned_start || existingTask.planned_start;
      const checkDue = due_date || existingTask.due_date;

      if (planned_start && isSunday(planned_start)) {
        return new Response(JSON.stringify({ error: 'Planned start date cannot fall on a Sunday.' }), { status: 400, headers: corsHeaders });
      }
      if (planned_start && isSaturday(planned_start)) {
        return new Response(JSON.stringify({ error: 'Planned start date cannot fall on a Saturday.' }), { status: 400, headers: corsHeaders });
      }
      if (due_date && isSunday(due_date)) {
        return new Response(JSON.stringify({ error: 'Due date cannot fall on a Sunday.' }), { status: 400, headers: corsHeaders });
      }
      if (due_date && isSaturday(due_date)) {
        return new Response(JSON.stringify({ error: 'Due date cannot fall on a Saturday.' }), { status: 400, headers: corsHeaders });
      }

      if (new Date(checkDue).getTime() < new Date(checkStart).getTime()) {
        return new Response(JSON.stringify({ error: 'Due date cannot be earlier than planned start date.' }), { status: 400, headers: corsHeaders });
      }

      if (planned_start !== undefined) updates.planned_start = planned_start;
      if (due_date !== undefined) updates.due_date = due_date;

      const { data: updatedTask, error: uErr } = await supabaseAdmin
        .from('client_tasks')
        .update(updates)
        .eq('id', task_id)
        .select()
        .single();

      if (uErr || !updatedTask) {
        return new Response(JSON.stringify({ error: uErr?.message || 'Failed to update task.' }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('client_task_events').insert({
        task_id,
        client_id: existingTask.client_id,
        actor_id: callerProfile.id,
        event_type: 'field_updated',
        previous_state: existingTask,
        new_state: updatedTask,
        notes: 'Task fields updated'
      });

      return new Response(JSON.stringify({ success: true, task: updatedTask }), { status: 200, headers: corsHeaders });
    }

    // --------------------------------------------------------------------------
    // ACTION: assign
    // --------------------------------------------------------------------------
    if (action === 'assign') {
      const { task_id, assignee_id } = body;
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'Missing task_id' }), { status: 400, headers: corsHeaders });
      }

      const { data: existingTask } = await supabaseAdmin
        .from('client_tasks')
        .select('*')
        .eq('id', task_id)
        .single();

      if (!existingTask || existingTask.archived_at) {
        return new Response(JSON.stringify({ error: 'Task not found or archived.' }), { status: 404, headers: corsHeaders });
      }

      const canManage = await checkCanManageClient(existingTask.client_id);
      if (!canManage) {
        return new Response(JSON.stringify({ error: 'Forbidden: Only managers can assign/reassign tasks.' }), { status: 403, headers: corsHeaders });
      }

      // Check if client is paused or archived
      const { data: targetClient } = await supabaseAdmin
        .from('clients')
        .select('status')
        .eq('id', existingTask.client_id)
        .single();

      if (targetClient?.status === 'Paused' || targetClient?.status === 'Archived') {
        return new Response(
          JSON.stringify({ error: `Cannot assign tasks for a ${targetClient.status.toLowerCase()} client.` }),
          { status: 400, headers: corsHeaders }
        );
      }

      let newStatus = existingTask.status;
      if (assignee_id) {
        const eligibility = await checkAssigneeEligibility(assignee_id, existingTask.client_id, existingTask.department_id);
        if (!eligibility.valid) {
          return new Response(JSON.stringify({ error: eligibility.error }), { status: 400, headers: corsHeaders });
        }
        if (existingTask.status === 'Draft') {
          newStatus = 'Assigned';
        }
      } else {
        newStatus = 'Draft';
      }

      const { data: updatedTask, error: uErr } = await supabaseAdmin
        .from('client_tasks')
        .update({
          assignee_id: assignee_id || null,
          status: newStatus,
          updated_by: callerProfile.id
        })
        .eq('id', task_id)
        .select()
        .single();

      if (uErr) {
        return new Response(JSON.stringify({ error: uErr.message }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('client_task_events').insert({
        task_id,
        client_id: existingTask.client_id,
        actor_id: callerProfile.id,
        event_type: existingTask.assignee_id ? 'reassigned' : 'assigned',
        previous_state: existingTask,
        new_state: updatedTask,
        notes: assignee_id ? `Assigned to ${assignee_id}` : 'Unassigned back to Draft'
      });

      return new Response(JSON.stringify({ success: true, task: updatedTask }), { status: 200, headers: corsHeaders });
    }

    // --------------------------------------------------------------------------
    // ACTION: update_status
    // --------------------------------------------------------------------------
    if (action === 'update_status') {
      const { task_id, status: targetStatus, reason, current_status } = body;
      const idempotencyKey = body.idempotency_key || body.request_id || req.headers.get('x-idempotency-key') || null;

      if (!task_id || !targetStatus) {
        return new Response(JSON.stringify({ error: 'Missing task_id or target status.' }), { status: 400, headers: corsHeaders });
      }

      const validStatuses = ['Draft', 'Assigned', 'In Progress', 'Blocked', 'Team Review', 'Client Review', 'Completed'];
      if (!validStatuses.includes(targetStatus)) {
        return new Response(JSON.stringify({ error: 'Invalid target status.' }), { status: 400, headers: corsHeaders });
      }

      // 1. Check Idempotency Table if key supplied
      if (idempotencyKey) {
        const { data: existingAction } = await supabaseAdmin
          .from('task_action_idempotency')
          .select('*')
          .eq('task_id', task_id)
          .eq('action_type', `status_${targetStatus}`)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existingAction) {
          return new Response(JSON.stringify(existingAction.response_payload), {
            status: 200,
            headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' }
          });
        }
      }

      const { data: existingTask } = await supabaseAdmin
        .from('client_tasks')
        .select('*')
        .eq('id', task_id)
        .single();

      if (!existingTask || existingTask.archived_at) {
        return new Response(JSON.stringify({ error: 'Task not found or is archived.' }), { status: 404, headers: corsHeaders });
      }

      // Check client paused / archived status
      const { data: targetClient } = await supabaseAdmin
        .from('clients')
        .select('status')
        .eq('id', existingTask.client_id)
        .single();

      if (!targetClient || targetClient.status === 'Archived') {
        return new Response(
          JSON.stringify({ error: 'Cannot change status on tasks for an archived client.' }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (targetClient.status === 'Paused') {
        return new Response(
          JSON.stringify({ error: 'Cannot change status on tasks for a paused client.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Pre-check stale status if caller provided expected current_status
      if (current_status && existingTask.status !== current_status) {
        return new Response(
          JSON.stringify({ error: `Conflict: Task status was concurrently modified to ${existingTask.status}. Please refresh.` }),
          { status: 409, headers: corsHeaders }
        );
      }

      const canManage = await checkCanManageClient(existingTask.client_id);
      const isAssignedMember = existingTask.assignee_id === callerProfile.id;
      const current = existingTask.status;

      let eventType = 'status_changed';
      let blockedReasonValue = existingTask.blocked_reason;
      let completedAtValue = existingTask.completed_at;
      let completedByValue = existingTask.completed_by;
      let reopenedAtValue = existingTask.reopened_at;
      let reopenedByValue = existingTask.reopened_by;
      let reopenReasonValue = existingTask.reopen_reason;
      let finalEventNotes = reason || `Status changed from ${current} to ${targetStatus}`;

      // ------------------------------------------------------------------------
      // Role-Based Transition Guards
      // ------------------------------------------------------------------------
      if (callerProfile.role === 'client') {
        if (callerProfile.organization_id !== existingTask.client_id) {
          return new Response(JSON.stringify({ error: 'Forbidden: Access to this client is not permitted.' }), { status: 403, headers: corsHeaders });
        }
        if (current !== 'Client Review') {
          return new Response(JSON.stringify({ error: 'Clients can only review tasks in Client Review status.' }), { status: 403, headers: corsHeaders });
        }
        if (targetStatus === 'Completed') {
          eventType = 'client_approved';
          completedAtValue = new Date().toISOString();
          completedByValue = callerProfile.id;
        } else if (targetStatus === 'In Progress') {
          if (!reason || !reason.trim()) {
            return new Response(JSON.stringify({ error: 'A mandatory reason is required when requesting changes.' }), { status: 400, headers: corsHeaders });
          }
          eventType = 'client_changes_requested';
          finalEventNotes = reason.trim();
        } else {
          return new Response(JSON.stringify({ error: 'Invalid transition for client role.' }), { status: 403, headers: corsHeaders });
        }
      } else if (callerProfile.role === 'team_member') {
        // Team member may only transition their own assigned work
        if (!isAssignedMember) {
          return new Response(JSON.stringify({ error: 'Forbidden: Team members may only update their own assigned tasks.' }), { status: 403, headers: corsHeaders });
        }

        if (targetStatus === 'Blocked') {
          if (current !== 'In Progress') {
            return new Response(JSON.stringify({ error: 'Only In Progress tasks can be marked as Blocked.' }), { status: 400, headers: corsHeaders });
          }
          if (!reason || !reason.trim()) {
            return new Response(JSON.stringify({ error: 'Blocked status requires a non-empty reason.' }), { status: 400, headers: corsHeaders });
          }
          eventType = 'blocked';
          blockedReasonValue = reason.trim();
          finalEventNotes = reason.trim();
        } else if (current === 'Blocked' && targetStatus === 'In Progress') {
          eventType = 'unblocked';
          blockedReasonValue = null;
        } else if (targetStatus === 'Team Review') {
          if (current !== 'In Progress') {
            return new Response(JSON.stringify({ error: 'Only In Progress tasks can be submitted for Team Review.' }), { status: 400, headers: corsHeaders });
          }
          eventType = 'submitted_for_review';
        } else if (current === 'Assigned' && targetStatus === 'In Progress') {
          eventType = 'status_changed';
        } else {
          return new Response(JSON.stringify({ error: 'Forbidden: Unauthorized transition for team member.' }), { status: 403, headers: corsHeaders });
        }
      } else if (canManage) {
        // Operational Manager or Owner
        if (targetStatus === 'Blocked') {
          if (!reason || !reason.trim()) {
            return new Response(JSON.stringify({ error: 'Blocked status requires a non-empty reason.' }), { status: 400, headers: corsHeaders });
          }
          eventType = 'blocked';
          blockedReasonValue = reason.trim();
          finalEventNotes = reason.trim();
        } else if (current === 'Blocked' && targetStatus === 'In Progress') {
          eventType = 'unblocked';
          blockedReasonValue = null;
        } else if (targetStatus === 'Team Review') {
          eventType = 'submitted_for_review';
        } else if (current === 'Team Review' && targetStatus === 'In Progress') {
          if (!reason || !reason.trim()) {
            return new Response(JSON.stringify({ error: 'Returning a Team Review task to In Progress requires a reason.' }), { status: 400, headers: corsHeaders });
          }
          eventType = 'review_returned';
          finalEventNotes = reason.trim();
        } else if (current === 'Team Review' && targetStatus === 'Completed') {
          if (existingTask.approval_mode === 'Client Approval Required') {
            return new Response(
              JSON.stringify({ error: 'This task requires Client Approval and must be submitted for Client Review first.' }),
              { status: 400, headers: corsHeaders }
            );
          }
          eventType = 'completed';
          completedAtValue = new Date().toISOString();
          completedByValue = callerProfile.id;
        } else if (current === 'Team Review' && targetStatus === 'Client Review') {
          if (existingTask.approval_mode !== 'Client Approval Required') {
            return new Response(
              JSON.stringify({ error: 'This task is Internal Only and cannot be moved to Client Review.' }),
              { status: 400, headers: corsHeaders }
            );
          }
          eventType = 'client_review_submitted';
        } else if (current === 'Client Review' && targetStatus === 'Completed') {
          // Operational Manager CANNOT approve Client Approval Required tasks on behalf of the client
          if (callerProfile.role === 'operational_manager') {
            return new Response(
              JSON.stringify({ error: 'Forbidden: Operational Managers cannot approve Client Approval Required tasks on behalf of the client.' }),
              { status: 403, headers: corsHeaders }
            );
          }

          // Owner override is allowed only with explicit override flag and mandatory reason
          if (callerProfile.role === 'owner') {
            const isOverride = body.is_override === true || body.override === true;
            const overrideReason = (body.override_reason || reason || '').trim();
            if (!isOverride || !overrideReason) {
              return new Response(
                JSON.stringify({ error: 'Owner override requires explicit is_override: true and a mandatory override_reason.' }),
                { status: 400, headers: corsHeaders }
              );
            }
            eventType = 'client_approval_override';
            completedAtValue = new Date().toISOString();
            completedByValue = callerProfile.id;
            finalEventNotes = overrideReason;
          } else {
            return new Response(
              JSON.stringify({ error: 'Forbidden: Only mapped client or authorized owner override can approve.' }),
              { status: 403, headers: corsHeaders }
            );
          }
        } else if (current === 'Client Review' && targetStatus === 'In Progress') {
          if (!reason || !reason.trim()) {
            return new Response(JSON.stringify({ error: 'A mandatory reason is required when returning a Client Review task to In Progress.' }), { status: 400, headers: corsHeaders });
          }
          eventType = 'changes_requested';
          finalEventNotes = reason.trim();
        } else if (current === 'Completed' && targetStatus === 'In Progress') {
          if (!reason || !reason.trim()) {
            return new Response(JSON.stringify({ error: 'A mandatory reason is required to reopen a completed task.' }), { status: 400, headers: corsHeaders });
          }
          eventType = 'reopened';
          completedAtValue = null;
          completedByValue = null;
          reopenedAtValue = new Date().toISOString();
          reopenedByValue = callerProfile.id;
          reopenReasonValue = reason.trim();
          finalEventNotes = reason.trim();
        } else if (targetStatus === 'In Progress') {
          eventType = 'status_changed';
        } else {
          return new Response(JSON.stringify({ error: 'Invalid or unsupported status transition.' }), { status: 400, headers: corsHeaders });
        }
      } else {
        return new Response(JSON.stringify({ error: 'Forbidden: You cannot update status on this task.' }), { status: 403, headers: corsHeaders });
      }

      // ATOMIC UPDATE: Compare-And-Swap on task id and expected current status
      const { data: updatedTask, error: uErr } = await supabaseAdmin
        .from('client_tasks')
        .update({
          status: targetStatus,
          blocked_reason: blockedReasonValue,
          completed_at: completedAtValue,
          completed_by: completedByValue,
          reopened_at: reopenedAtValue,
          reopened_by: reopenedByValue,
          reopen_reason: reopenReasonValue,
          updated_by: callerProfile.id
        })
        .eq('id', task_id)
        .eq('status', current)
        .select()
        .maybeSingle();

      if (uErr) {
        return new Response(JSON.stringify({ error: uErr.message }), { status: 500, headers: corsHeaders });
      }

      if (!updatedTask) {
        return new Response(
          JSON.stringify({ error: 'Conflict: The task status has changed concurrently or was modified by another user.' }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Record Audit Event
      await supabaseAdmin.from('client_task_events').insert({
        task_id,
        client_id: existingTask.client_id,
        actor_id: callerProfile.id,
        event_type: eventType,
        previous_state: existingTask,
        new_state: updatedTask,
        notes: finalEventNotes
      });

      const responsePayload = { success: true, task: updatedTask };

      // Save to Idempotency table if key provided
      if (idempotencyKey) {
        await supabaseAdmin.from('task_action_idempotency').insert({
          task_id,
          action_type: `status_${targetStatus}`,
          idempotency_key: idempotencyKey,
          actor_id: callerProfile.id,
          response_payload: responsePayload
        });
      }

      return new Response(JSON.stringify(responsePayload), { status: 200, headers: corsHeaders });
    }

    // --------------------------------------------------------------------------
    // ACTION: create_message
    // --------------------------------------------------------------------------
    if (action === 'create_message') {
      const { task_id, client_id, visibility, content, links = [] } = body;
      const idempotencyKey = body.idempotency_key || body.request_id || req.headers.get('x-idempotency-key') || null;

      if (!task_id || !client_id || !visibility || !content) {
        return new Response(JSON.stringify({ error: 'Missing required fields: task_id, client_id, visibility, content.' }), { status: 400, headers: corsHeaders });
      }

      if (!['internal_note', 'shared_with_client'].includes(visibility)) {
        return new Response(JSON.stringify({ error: 'Visibility must be internal_note or shared_with_client.' }), { status: 400, headers: corsHeaders });
      }

      const trimmedContent = content.trim();
      if (trimmedContent.length === 0 || trimmedContent.length > 5000) {
        return new Response(JSON.stringify({ error: 'Message content must be between 1 and 5,000 characters.' }), { status: 400, headers: corsHeaders });
      }

      // Validate links (Max 5, HTTPS only, no credentials, <= 2048 chars)
      if (!Array.isArray(links) || links.length > 5) {
        return new Response(JSON.stringify({ error: 'Maximum 5 external links permitted.' }), { status: 400, headers: corsHeaders });
      }

      const validatedLinks = [];
      for (const item of links) {
        const urlStr = typeof item === 'string' ? item : item?.url;
        const res = validateHttpsLink(urlStr);
        if (!res.valid) {
          return new Response(JSON.stringify({ error: res.error }), { status: 400, headers: corsHeaders });
        }
        validatedLinks.push({
          url: res.sanitized,
          title: typeof item === 'object' && item?.title ? String(item.title).trim().slice(0, 100) : undefined
        });
      }

      // Check task and client records
      const { data: existingTask } = await supabaseAdmin
        .from('client_tasks')
        .select('id, client_id, archived_at')
        .eq('id', task_id)
        .single();

      if (!existingTask || existingTask.archived_at || existingTask.client_id !== client_id) {
        return new Response(JSON.stringify({ error: 'Task not found or is archived.' }), { status: 404, headers: corsHeaders });
      }

      const { data: targetClient } = await supabaseAdmin
        .from('clients')
        .select('id, status')
        .eq('id', client_id)
        .single();

      if (!targetClient || targetClient.status === 'Archived') {
        return new Response(JSON.stringify({ error: 'Feed is read-only: Client is archived.' }), { status: 400, headers: corsHeaders });
      }

      // Check role permissions and paused state
      if (callerProfile.role === 'client') {
        if (callerProfile.organization_id !== client_id) {
          return new Response(JSON.stringify({ error: 'Forbidden: Access to this client is not permitted.' }), { status: 403, headers: corsHeaders });
        }
        if (visibility !== 'shared_with_client') {
          return new Response(JSON.stringify({ error: 'Clients can only create shared messages.' }), { status: 403, headers: corsHeaders });
        }
        if (targetClient.status === 'Paused') {
          return new Response(JSON.stringify({ error: 'Cannot post messages for a paused client.' }), { status: 400, headers: corsHeaders });
        }
      } else {
        const canAccess = await checkCanAccessClient(client_id);
        if (!canAccess) {
          return new Response(JSON.stringify({ error: 'Forbidden: You do not have access to this client.' }), { status: 403, headers: corsHeaders });
        }
        if (targetClient.status === 'Paused') {
          if (callerProfile.role === 'team_member') {
            return new Response(JSON.stringify({ error: 'Cannot post messages for a paused client.' }), { status: 400, headers: corsHeaders });
          }
          if (visibility !== 'internal_note') {
            return new Response(JSON.stringify({ error: 'Only internal administrative notes are allowed for paused clients.' }), { status: 400, headers: corsHeaders });
          }
        }
      }

      // 1. Check Idempotency for duplicate message creation
      if (idempotencyKey) {
        const { data: existingMsg } = await supabaseAdmin
          .from('client_task_messages')
          .select(`
            id, task_id, client_id, author_id, visibility, content, links, created_at,
            author:profiles!author_id(id, full_name, role)
          `)
          .eq('task_id', task_id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existingMsg) {
          return new Response(
            JSON.stringify({
              success: true,
              idempotent: true,
              message: {
                id: existingMsg.id,
                taskId: existingMsg.task_id,
                clientId: existingMsg.client_id,
                authorId: existingMsg.author_id,
                authorName: existingMsg.author?.full_name || callerProfile.full_name,
                authorRole: existingMsg.author?.role || callerProfile.role,
                visibility: existingMsg.visibility,
                content: existingMsg.content,
                links: existingMsg.links || [],
                createdAt: existingMsg.created_at
              }
            }),
            { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
          );
        }
      }

      // Insert message record (Append-only)
      const { data: newMsg, error: mErr } = await supabaseAdmin
        .from('client_task_messages')
        .insert({
          task_id,
          client_id,
          author_id: callerProfile.id,
          visibility,
          content: trimmedContent,
          links: validatedLinks,
          idempotency_key: idempotencyKey
        })
        .select(`
          id, task_id, client_id, author_id, visibility, content, links, created_at,
          author:profiles!author_id(id, full_name, role)
        `)
        .single();

      if (mErr || !newMsg) {
        return new Response(JSON.stringify({ error: mErr?.message || 'Failed to save message.' }), { status: 500, headers: corsHeaders });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: {
            id: newMsg.id,
            taskId: newMsg.task_id,
            clientId: newMsg.client_id,
            authorId: newMsg.author_id,
            authorName: newMsg.author?.full_name || callerProfile.full_name,
            authorRole: newMsg.author?.role || callerProfile.role,
            visibility: newMsg.visibility,
            content: newMsg.content,
            links: newMsg.links || [],
            createdAt: newMsg.created_at
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: fetch_feed
    // --------------------------------------------------------------------------
    if (action === 'fetch_feed') {
      const { task_id, before_timestamp, before_id, before_cursor, limit = 30 } = body;
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'Missing task_id' }), { status: 400, headers: corsHeaders });
      }

      const { data: existingTask } = await supabaseAdmin
        .from('client_tasks')
        .select('id, client_id, archived_at')
        .eq('id', task_id)
        .single();

      if (!existingTask) {
        return new Response(JSON.stringify({ error: 'Task not found.' }), { status: 404, headers: corsHeaders });
      }

      const canAccess = await checkCanAccessClient(existingTask.client_id);
      if (!canAccess) {
        return new Response(JSON.stringify({ error: 'Forbidden: You do not have access to this client.' }), { status: 403, headers: corsHeaders });
      }

      const isClient = callerProfile.role === 'client';
      const maxItems = Math.max(1, Math.min(Number(limit) || 30, 100));

      let cursorTimestamp = before_timestamp;
      let cursorId = before_id;
      if (before_cursor && typeof before_cursor === 'object') {
        cursorTimestamp = before_cursor.timestamp || before_cursor.created_at;
        cursorId = before_cursor.id;
      }

      // Query messages with composite cursor
      let msgQuery = supabaseAdmin
        .from('client_task_messages')
        .select(`
          id, task_id, client_id, author_id, visibility, content, links, created_at,
          author:profiles!author_id(id, full_name, role)
        `)
        .eq('task_id', task_id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(maxItems + 1);

      if (isClient) {
        msgQuery = msgQuery.eq('visibility', 'shared_with_client');
      }

      if (cursorTimestamp && cursorId) {
        msgQuery = msgQuery.or(`created_at.lt.${cursorTimestamp},and(created_at.eq.${cursorTimestamp},id.lt.${cursorId})`);
      } else if (cursorTimestamp) {
        msgQuery = msgQuery.lt('created_at', cursorTimestamp);
      }

      // Query events with composite cursor
      const CLIENT_ALLOWED_EVENT_TYPES = [
        'created',
        'client_review_submitted',
        'client_approved',
        'client_approval_override',
        'client_changes_requested',
        'completed'
      ];

      let evtQuery = supabaseAdmin
        .from('client_task_events')
        .select(`
          id, task_id, client_id, actor_id, event_type,
          previous_state, new_state, notes, created_at,
          actor:profiles!actor_id(id, full_name, role)
        `)
        .eq('task_id', task_id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(maxItems + 1);

      if (isClient) {
        evtQuery = evtQuery.in('event_type', CLIENT_ALLOWED_EVENT_TYPES);
      }

      if (cursorTimestamp && cursorId) {
        evtQuery = evtQuery.or(`created_at.lt.${cursorTimestamp},and(created_at.eq.${cursorTimestamp},id.lt.${cursorId})`);
      } else if (cursorTimestamp) {
        evtQuery = evtQuery.lt('created_at', cursorTimestamp);
      }

      const [msgRes, evtRes] = await Promise.all([msgQuery, evtQuery]);
      const rawMsgs = msgRes.data || [];
      const rawEvts = evtRes.data || [];

      const messages = rawMsgs.map((m: any) => ({
        id: m.id,
        taskId: m.task_id,
        clientId: m.client_id,
        authorId: m.author_id,
        authorName: m.author?.full_name || 'Staff Member',
        authorRole: m.author?.role || 'team_member',
        visibility: m.visibility,
        content: m.content,
        links: m.links || [],
        createdAt: m.created_at
      }));

      const events = rawEvts.map((e: any) => {
        // Redact internal notes and payloads for client users
        let safeNotes = e.notes;
        let safePrevState = e.previous_state;
        let safeNewState = e.new_state;

        if (isClient) {
          if (e.event_type !== 'client_changes_requested' && e.event_type !== 'client_review_submitted') {
            safeNotes = null;
          }
          safePrevState = null;
          safeNewState = null;
        }

        return {
          id: e.id,
          taskId: e.task_id,
          clientId: e.client_id,
          actorId: e.actor_id,
          actorName: isClient && e.actor?.role !== 'client' ? (e.actor?.full_name || 'Team') : (e.actor?.full_name || 'System / Staff'),
          eventType: e.event_type,
          previousState: safePrevState,
          newState: safeNewState,
          notes: safeNotes,
          createdAt: e.created_at
        };
      });

      // Combine both messages and events into a unified list sorted newest first
      const combined = [
        ...messages.map((m: any) => ({ type: 'message' as const, data: m, timestamp: m.createdAt, id: m.id })),
        ...events.map((e: any) => ({ type: 'event' as const, data: e, timestamp: e.createdAt, id: e.id }))
      ];

      combined.sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id.localeCompare(a.id);
      });

      // Deliver exactly the top maxItems combined items for this page
      const pageItems = combined.slice(0, maxItems);
      const hasMore = combined.length > maxItems;
      const lastItem = pageItems[pageItems.length - 1];
      const nextCursor = (hasMore && lastItem) ? { timestamp: lastItem.timestamp, id: lastItem.id } : null;

      return new Response(
        JSON.stringify({
          success: true,
          messages: pageItems.filter(i => i.type === 'message').map(i => i.data),
          events: pageItems.filter(i => i.type === 'event').map(i => i.data),
          combinedFeed: pageItems,
          nextCursor,
          hasMore
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: archive
    // --------------------------------------------------------------------------
    if (action === 'archive') {
      const { task_id, reason } = body;
      if (!task_id || !reason || !reason.trim()) {
        return new Response(JSON.stringify({ error: 'Task ID and a non-empty archive reason are required.' }), { status: 400, headers: corsHeaders });
      }

      const { data: existingTask } = await supabaseAdmin
        .from('client_tasks')
        .select('*')
        .eq('id', task_id)
        .single();

      if (!existingTask || existingTask.archived_at) {
        return new Response(JSON.stringify({ error: 'Task not found or already archived.' }), { status: 404, headers: corsHeaders });
      }

      const canManage = await checkCanManageClient(existingTask.client_id);
      if (!canManage) {
        return new Response(JSON.stringify({ error: 'Forbidden: Only management can archive tasks.' }), { status: 403, headers: corsHeaders });
      }

      const { data: updatedTask, error: uErr } = await supabaseAdmin
        .from('client_tasks')
        .update({
          archived_at: new Date().toISOString(),
          archived_by: callerProfile.id,
          archive_reason: reason.trim(),
          updated_by: callerProfile.id
        })
        .eq('id', task_id)
        .select()
        .single();

      if (uErr) {
        return new Response(JSON.stringify({ error: uErr.message }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('client_task_events').insert({
        task_id,
        client_id: existingTask.client_id,
        actor_id: callerProfile.id,
        event_type: 'archived',
        previous_state: existingTask,
        new_state: updatedTask,
        notes: `Archived: ${reason.trim()}`
      });

      return new Response(JSON.stringify({ success: true, task: updatedTask }), { status: 200, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error processing task action.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
