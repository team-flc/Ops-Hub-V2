// ==============================================================================
// SUPABASE EDGE FUNCTION: manage-task-template
// Location: supabase/functions/manage-task-template/index.ts
// Environment: Deno Runtime / Supabase Functions
// Phase: 3C — Task Templates System (Internal FLC Global Template Library)
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

  // Extract Caller JWT
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

  // Strict Role Checking:
  // Client and Team Member are strictly denied template library access
  if (callerProfile.role === 'client') {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Client users cannot access task templates.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  if (callerProfile.role === 'team_member') {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Team Members cannot manage task templates.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  const isOwner = callerProfile.role === 'owner';
  const isManager = callerProfile.role === 'operational_manager';

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

  try {
    // --------------------------------------------------------------------------
    // ACTION: list (Owner: Active + Archived; Operational Manager: Active only)
    // --------------------------------------------------------------------------
    if (action === 'list') {
      let query = supabaseAdmin
        .from('task_templates')
        .select(`
          id,
          name,
          description,
          department_id,
          default_task_title,
          task_details,
          default_priority,
          default_approval_mode,
          suggested_duration_days,
          status,
          sort_order,
          version,
          created_by,
          updated_by,
          archived_at,
          archived_by,
          archive_reason,
          created_at,
          updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      // Operational Manager only sees Active templates
      if (isManager || (body.include_archived !== true && !isOwner)) {
        query = query.eq('status', 'Active');
      }

      const { data: templates, error: listError } = await query;
      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), { status: 500, headers: corsHeaders });
      }

      const mapped = (templates || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        departmentId: t.department_id,
        departmentName: t.department?.name,
        defaultTaskTitle: t.default_task_title,
        taskDetails: t.task_details,
        defaultPriority: t.default_priority,
        defaultApprovalMode: t.default_approval_mode,
        suggestedDurationDays: t.suggested_duration_days,
        status: t.status,
        sortOrder: t.sort_order,
        version: t.version,
        createdBy: t.created_by,
        updatedBy: t.updated_by,
        archivedAt: t.archived_at,
        archivedBy: t.archived_by,
        archiveReason: t.archive_reason,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      return new Response(JSON.stringify({ success: true, templates: mapped }), { status: 200, headers: corsHeaders });
    }

    // --------------------------------------------------------------------------
    // ACTION: get (Owner: Active + Archived; Operational Manager: Active only)
    // --------------------------------------------------------------------------
    if (action === 'get') {
      const templateId = body.template_id;
      if (!templateId) {
        return new Response(JSON.stringify({ error: 'Missing required field: template_id' }), { status: 400, headers: corsHeaders });
      }
      const { data: t, error: getErr } = await supabaseAdmin
        .from('task_templates')
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days,
          status, sort_order, version, created_by, updated_by,
          archived_at, archived_by, archive_reason, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .eq('id', templateId)
        .single();

      if (getErr || !t) {
        return new Response(JSON.stringify({ error: 'Template not found.' }), { status: 404, headers: corsHeaders });
      }
      if (isManager && t.status !== 'Active') {
        return new Response(JSON.stringify({ error: 'Forbidden: Operational Manager cannot view archived templates.' }), { status: 403, headers: corsHeaders });
      }

      const mapped = {
        id: t.id,
        name: t.name,
        description: t.description,
        departmentId: t.department_id,
        departmentName: t.department?.name,
        defaultTaskTitle: t.default_task_title,
        taskDetails: t.task_details,
        defaultPriority: t.default_priority,
        defaultApprovalMode: t.default_approval_mode,
        suggestedDurationDays: t.suggested_duration_days,
        status: t.status,
        sortOrder: t.sort_order,
        version: t.version,
        createdBy: t.created_by,
        updatedBy: t.updated_by,
        archivedAt: t.archived_at,
        archivedBy: t.archived_by,
        archiveReason: t.archive_reason,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      };

      return new Response(JSON.stringify({ success: true, template: mapped }), { status: 200, headers: corsHeaders });
    }

    // --------------------------------------------------------------------------
    // MUTATIONS: create, update, duplicate, archive, restore
    // Exclusively governed by Executive Owner through atomic transactional RPC
    // --------------------------------------------------------------------------
    if (!['create', 'update', 'duplicate', 'archive', 'restore'].includes(action)) {
      return new Response(
        JSON.stringify({ error: `Unsupported action: ${action}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only the Executive Owner can govern task templates.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const rawIdempotencyKey = body.idempotency_key || body.request_id || req.headers.get('x-idempotency-key');
    if (!rawIdempotencyKey || typeof rawIdempotencyKey !== 'string' || !rawIdempotencyKey.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: idempotency_key (mutation request ID required).' }),
        { status: 400, headers: corsHeaders }
      );
    }
    const idempotencyKey = rawIdempotencyKey.trim();

    if (action === 'update') {
      if (body.expected_version === undefined || body.expected_version === null || body.expected_version === '') {
        return new Response(
          JSON.stringify({ error: 'Missing required field: expected_version (atomic version locking required).' }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Invoke privileged PostgreSQL RPC: atomically executes claim, mutation, audit log, and result storage
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('fn_manage_task_template_mutation', {
      p_actor_id: callerProfile.id,
      p_action: action,
      p_idempotency_key: idempotencyKey,
      p_payload: body
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Database error executing mutation: ${rpcError.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!rpcResult || !rpcResult.success) {
      const code = String(rpcResult?.code || '');
      let statusCode = 400;
      if (code.startsWith('403') || code.includes('FORBIDDEN')) statusCode = 403;
      else if (code.startsWith('404') || code.includes('NOT_FOUND')) statusCode = 404;
      else if (code.startsWith('409') || code.includes('CONFLICT') || code.includes('CONCURRENT')) statusCode = 409;

      return new Response(
        JSON.stringify({ error: rpcResult?.error || 'Failed to process template mutation.', code: rpcResult?.code }),
        { status: statusCode, headers: corsHeaders }
      );
    }

    const responseHeaders = rpcResult.is_replay
      ? { ...corsHeaders, 'X-Idempotent-Replay': 'true' }
      : corsHeaders;

    return new Response(
      JSON.stringify(rpcResult),
      { status: 200, headers: responseHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error processing template action.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
