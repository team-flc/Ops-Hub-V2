// ==============================================================================
// SUPABASE EDGE FUNCTION: manage-client-task
// Location: supabase/functions/manage-client-task/index.ts
// Environment: Deno Runtime / Supabase Functions
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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
};

// Date Validation Helpers (Timezone: Asia/Karachi / UTC)
function isSunday(dateStr: string): boolean {
  const d = new Date(dateStr);
  return d.getUTCDay() === 0;
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
    .select('id, full_name, role, status')
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

  // Helper: Verify Manager/Owner Permissions for Client
  async function checkCanManageClient(clientId: string): Promise<boolean> {
    if (callerProfile.role === 'owner') return true;
    if (callerProfile.role === 'operational_manager') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, operational_manager_id, created_by')
        .eq('id', clientId)
        .single();
      return client && (client.operational_manager_id === callerProfile.id || client.created_by === callerProfile.id);
    }
    return false;
  }

  // Helper: Verify Client Access for Team Member
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
    return false;
  }

  // Helper: Verify Assignee Eligibility
  async function checkAssigneeEligibility(assigneeId: string, clientId: string, departmentId?: string): Promise<{ valid: boolean; error?: string }> {
    const { data: assignee, error: aErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, status')
      .eq('id', assigneeId)
      .single();

    if (aErr || !assignee || assignee.status !== 'active') {
      return { valid: false, error: 'Assignee profile is not active.' };
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
        assignee_id, priority = 'Normal', planned_start, due_date 
      } = body;

      if (!client_id || !week_number || !title || !department_id || !planned_start || !due_date) {
        return new Response(
          JSON.stringify({ error: 'Missing required task fields: client_id, week_number, title, department_id, planned_start, due_date.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (![1, 2, 3, 4].includes(Number(week_number))) {
        return new Response(
          JSON.stringify({ error: 'Week number must be 1, 2, 3, or 4.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!['Low', 'Normal', 'High', 'Urgent'].includes(priority)) {
        return new Response(
          JSON.stringify({ error: 'Priority must be Low, Normal, High, or Urgent.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const canManage = await checkCanManageClient(client_id);
      if (!canManage) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You do not have permission to create tasks for this client.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Date validations
      if (isSunday(planned_start)) {
        return new Response(
          JSON.stringify({ error: 'Planned start date cannot fall on a Sunday.' }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (isSunday(due_date)) {
        return new Response(
          JSON.stringify({ error: 'Due date cannot fall on a Sunday.' }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (new Date(due_date).getTime() <= new Date(planned_start).getTime()) {
        return new Response(
          JSON.stringify({ error: 'Due date/time must be strictly later than planned start date/time.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      let initialStatus = 'Draft';
      if (assignee_id) {
        const eligibility = await checkAssigneeEligibility(assignee_id, client_id, department_id);
        if (!eligibility.valid) {
          return new Response(
            JSON.stringify({ error: eligibility.error }),
            { status: 400, headers: corsHeaders }
          );
        }
        initialStatus = 'Assigned';
      }

      // Insert Task
      const { data: newTask, error: insertError } = await supabaseAdmin
        .from('client_tasks')
        .insert({
          client_id,
          week_number: Number(week_number),
          title: title.trim(),
          details: details?.trim() || null,
          department_id,
          assignee_id: assignee_id || null,
          priority,
          planned_start,
          due_date,
          status: initialStatus,
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
        notes: `Task created in ${initialStatus} status`
      });

      return new Response(
        JSON.stringify({ success: true, task: newTask }),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: update
    // --------------------------------------------------------------------------
    if (action === 'update') {
      const { task_id, title, details, department_id, priority, planned_start, due_date } = body;
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

      const checkStart = planned_start || existingTask.planned_start;
      const checkDue = due_date || existingTask.due_date;

      if (planned_start && isSunday(planned_start)) {
        return new Response(JSON.stringify({ error: 'Planned start date cannot fall on a Sunday.' }), { status: 400, headers: corsHeaders });
      }
      if (due_date && isSunday(due_date)) {
        return new Response(JSON.stringify({ error: 'Due date cannot fall on a Sunday.' }), { status: 400, headers: corsHeaders });
      }
      if (new Date(checkDue).getTime() <= new Date(checkStart).getTime()) {
        return new Response(JSON.stringify({ error: 'Due date/time must be strictly later than planned start date/time.' }), { status: 400, headers: corsHeaders });
      }

      if (planned_start) updates.planned_start = planned_start;
      if (due_date) updates.due_date = due_date;

      const { data: updatedTask, error: uErr } = await supabaseAdmin
        .from('client_tasks')
        .update(updates)
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
        event_type: 'field_updated',
        previous_state: existingTask,
        new_state: updatedTask,
        notes: 'Task fields updated by management'
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
        notes: assignee_id ? `Assigned to user ${assignee_id}` : 'Unassigned to Draft'
      });

      return new Response(JSON.stringify({ success: true, task: updatedTask }), { status: 200, headers: corsHeaders });
    }

    // --------------------------------------------------------------------------
    // ACTION: update_status
    // --------------------------------------------------------------------------
    if (action === 'update_status') {
      const { task_id, status: targetStatus, reason } = body;
      if (!task_id || !targetStatus) {
        return new Response(JSON.stringify({ error: 'Missing task_id or target status.' }), { status: 400, headers: corsHeaders });
      }

      if (!['Draft', 'Assigned', 'In Progress', 'Blocked', 'Team Review'].includes(targetStatus)) {
        return new Response(JSON.stringify({ error: 'Invalid target status.' }), { status: 400, headers: corsHeaders });
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
      const isAssignedMember = existingTask.assignee_id === callerProfile.id;

      if (!canManage && !isAssignedMember) {
        return new Response(JSON.stringify({ error: 'Forbidden: You cannot update status on this task.' }), { status: 403, headers: corsHeaders });
      }

      // Workflow transition enforcement
      const current = existingTask.status;
      let eventType = 'status_changed';
      let blockedReasonValue = existingTask.blocked_reason;

      if (targetStatus === 'Blocked') {
        if (!reason || !reason.trim()) {
          return new Response(JSON.stringify({ error: 'Blocked status requires a non-empty reason.' }), { status: 400, headers: corsHeaders });
        }
        if (current !== 'In Progress' && !canManage) {
          return new Response(JSON.stringify({ error: 'Only In Progress tasks can be moved to Blocked.' }), { status: 400, headers: corsHeaders });
        }
        eventType = 'blocked';
        blockedReasonValue = reason.trim();
      } else if (current === 'Blocked' && targetStatus === 'In Progress') {
        eventType = 'unblocked';
        blockedReasonValue = null;
      } else if (targetStatus === 'Team Review') {
        if (current !== 'In Progress' && !canManage) {
          return new Response(JSON.stringify({ error: 'Only In Progress tasks can be submitted for Team Review.' }), { status: 400, headers: corsHeaders });
        }
        eventType = 'submitted_for_review';
      } else if (current === 'Team Review' && targetStatus === 'In Progress') {
        if (!canManage) {
          return new Response(JSON.stringify({ error: 'Only management can return a Team Review task to In Progress.' }), { status: 403, headers: corsHeaders });
        }
        if (!reason || !reason.trim()) {
          return new Response(JSON.stringify({ error: 'Returning a Team Review task to In Progress requires a reason.' }), { status: 400, headers: corsHeaders });
        }
        eventType = 'review_returned';
      } else if (targetStatus === 'In Progress') {
        if (current !== 'Assigned' && current !== 'Blocked' && !canManage) {
          return new Response(JSON.stringify({ error: 'Invalid transition to In Progress.' }), { status: 400, headers: corsHeaders });
        }
      }

      const { data: updatedTask, error: uErr } = await supabaseAdmin
        .from('client_tasks')
        .update({
          status: targetStatus,
          blocked_reason: blockedReasonValue,
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
        event_type: eventType,
        previous_state: existingTask,
        new_state: updatedTask,
        notes: reason || `Status changed from ${current} to ${targetStatus}`
      });

      return new Response(JSON.stringify({ success: true, task: updatedTask }), { status: 200, headers: corsHeaders });
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
