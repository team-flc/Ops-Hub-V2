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
    // MUTATION GUARDS: Only Executive Owner can govern templates
    // --------------------------------------------------------------------------
    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only the Executive Owner can govern task templates.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Mutation Request ID / Idempotency Key validation
    const rawIdempotencyKey = body.idempotency_key || body.request_id || req.headers.get('x-idempotency-key');
    if (!rawIdempotencyKey || typeof rawIdempotencyKey !== 'string' || !rawIdempotencyKey.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: idempotency_key (mutation request ID required).' }),
        { status: 400, headers: corsHeaders }
      );
    }
    const idempotencyKey = rawIdempotencyKey.trim();

    // --------------------------------------------------------------------------
    // CLAIM IDEMPOTENCY BEFORE MUTATION EXECUTION
    // --------------------------------------------------------------------------
    const { data: existingIdemp, error: fetchIdempErr } = await supabaseAdmin
      .from('template_mutation_requests')
      .select('status, response_payload, resource_id')
      .eq('actor_id', callerProfile.id)
      .eq('action', action)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (fetchIdempErr) {
      return new Response(
        JSON.stringify({ error: `Idempotency lookup error: ${fetchIdempErr.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (existingIdemp) {
      if (existingIdemp.status === 'completed' && existingIdemp.response_payload) {
        return new Response(
          JSON.stringify(existingIdemp.response_payload),
          { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
        );
      }
      if (existingIdemp.status === 'processing') {
        return new Response(
          JSON.stringify({ error: 'Conflict: Mutation already in progress for this request. Please wait.' }),
          { status: 409, headers: corsHeaders }
        );
      }
    }

    // Claim the request with status = 'processing'
    const { error: claimErr } = await supabaseAdmin
      .from('template_mutation_requests')
      .insert({
        actor_id: callerProfile.id,
        action: action,
        idempotency_key: idempotencyKey,
        status: 'processing'
      });

    if (claimErr) {
      if (claimErr.code === '23505') {
        const { data: raceRecord } = await supabaseAdmin
          .from('template_mutation_requests')
          .select('status, response_payload')
          .eq('actor_id', callerProfile.id)
          .eq('action', action)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (raceRecord && raceRecord.status === 'completed' && raceRecord.response_payload) {
          return new Response(
            JSON.stringify(raceRecord.response_payload),
            { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
          );
        }
        return new Response(
          JSON.stringify({ error: 'Conflict: Concurrent duplicate request in progress. Please retry shortly.' }),
          { status: 409, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ error: `Failed to claim mutation idempotency: ${claimErr.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Helper: Mark idempotency completed with response payload
    async function completeIdempotency(resourceId: string | null, payload: any) {
      const { error: compErr } = await supabaseAdmin
        .from('template_mutation_requests')
        .update({
          status: 'completed',
          resource_id: resourceId,
          response_payload: payload,
          completed_at: new Date().toISOString()
        })
        .eq('actor_id', callerProfile.id)
        .eq('action', action)
        .eq('idempotency_key', idempotencyKey);
      if (compErr) {
        console.error('Failed to complete idempotency record:', compErr);
      }
    }

    // Helper: Mark idempotency failed on validation or execution errors
    async function failIdempotency(reason: string) {
      await supabaseAdmin
        .from('template_mutation_requests')
        .update({
          status: 'failed',
          response_payload: { error: reason },
          completed_at: new Date().toISOString()
        })
        .eq('actor_id', callerProfile.id)
        .eq('action', action)
        .eq('idempotency_key', idempotencyKey);
    }

    // --------------------------------------------------------------------------
    // ACTION: create
    // --------------------------------------------------------------------------
    if (action === 'create') {
      const {
        name,
        description,
        department_id,
        default_task_title,
        task_details,
        default_priority = 'Normal',
        default_approval_mode = 'Internal Only',
        suggested_duration_days = 3,
        sort_order = 0
      } = body;

      if (!name || !name.trim()) {
        await failIdempotency('Template name is required.');
        return new Response(JSON.stringify({ error: 'Template name is required.' }), { status: 400, headers: corsHeaders });
      }
      if (!default_task_title || !default_task_title.trim()) {
        await failIdempotency('Default task title is required.');
        return new Response(JSON.stringify({ error: 'Default task title is required.' }), { status: 400, headers: corsHeaders });
      }
      if (!department_id) {
        await failIdempotency('Responsible department is required.');
        return new Response(JSON.stringify({ error: 'Responsible department is required.' }), { status: 400, headers: corsHeaders });
      }

      if (!['Low', 'Normal', 'High', 'Urgent'].includes(default_priority)) {
        await failIdempotency('Invalid default priority.');
        return new Response(JSON.stringify({ error: 'Invalid default priority.' }), { status: 400, headers: corsHeaders });
      }
      if (!['Internal Only', 'Client Approval Required'].includes(default_approval_mode)) {
        await failIdempotency('Invalid default approval mode.');
        return new Response(JSON.stringify({ error: 'Invalid default approval mode.' }), { status: 400, headers: corsHeaders });
      }

      const durationNum = Number(suggested_duration_days);
      if (isNaN(durationNum) || durationNum < 1 || durationNum > 30) {
        await failIdempotency('Suggested duration must be between 1 and 30 business days.');
        return new Response(JSON.stringify({ error: 'Suggested duration must be between 1 and 30 business days.' }), { status: 400, headers: corsHeaders });
      }

      const { data: newTemplate, error: insertError } = await supabaseAdmin
        .from('task_templates')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          department_id,
          default_task_title: default_task_title.trim(),
          task_details: task_details || null,
          default_priority,
          default_approval_mode,
          suggested_duration_days: durationNum,
          sort_order: Number(sort_order) || 0,
          status: 'Active',
          version: 1,
          created_by: callerProfile.id,
          updated_by: callerProfile.id
        })
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .single();

      if (insertError || !newTemplate) {
        await failIdempotency(insertError?.message || 'Failed to create template.');
        return new Response(JSON.stringify({ error: insertError?.message || 'Failed to create template.' }), { status: 500, headers: corsHeaders });
      }

      // Mandatory Audit Event Writing with strict error checking
      const { error: auditError } = await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_created',
        entity_type: 'task_template',
        entity_id: newTemplate.id,
        entity_name: newTemplate.name,
        new_state: newTemplate,
        metadata: { version: newTemplate.version }
      });

      if (auditError) {
        await failIdempotency(`Audit error: ${auditError.message}`);
        return new Response(
          JSON.stringify({ error: `Mandatory audit writing failed: ${auditError.message}. Mutation aborted.` }),
          { status: 500, headers: corsHeaders }
        );
      }

      const responsePayload = {
        success: true,
        template: {
          id: newTemplate.id,
          name: newTemplate.name,
          description: newTemplate.description,
          departmentId: newTemplate.department_id,
          departmentName: newTemplate.department?.name,
          defaultTaskTitle: newTemplate.default_task_title,
          taskDetails: newTemplate.task_details,
          defaultPriority: newTemplate.default_priority,
          defaultApprovalMode: newTemplate.default_approval_mode,
          suggestedDurationDays: newTemplate.suggested_duration_days,
          status: newTemplate.status,
          sortOrder: newTemplate.sort_order,
          version: newTemplate.version,
          createdAt: newTemplate.created_at,
          updatedAt: newTemplate.updated_at
        }
      };

      await completeIdempotency(newTemplate.id, responsePayload);

      return new Response(
        JSON.stringify(responsePayload),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: update (Atomic concurrency check via expected_version in WHERE)
    // --------------------------------------------------------------------------
    if (action === 'update') {
      const templateId = body.template_id || body.id;
      if (!templateId) {
        await failIdempotency('Missing template id.');
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      const targetVersion = body.expected_version !== undefined ? body.expected_version : body.expectedVersion;
      if (targetVersion === undefined || targetVersion === null) {
        await failIdempotency('Missing expected_version.');
        return new Response(
          JSON.stringify({ error: 'Missing required field: expected_version is required for concurrent update safety.' }),
          { status: 400, headers: corsHeaders }
        );
      }
      const expectedVerNum = Number(targetVersion);

      const {
        name,
        description,
        department_id,
        default_task_title,
        task_details,
        default_priority,
        default_approval_mode,
        suggested_duration_days,
        sort_order
      } = body;

      const updates: any = {
        updated_by: callerProfile.id,
        updated_at: new Date().toISOString(),
        version: expectedVerNum + 1
      };

      if (name !== undefined) {
        if (!name.trim()) {
          await failIdempotency('Template name cannot be empty.');
          return new Response(JSON.stringify({ error: 'Template name cannot be empty.' }), { status: 400, headers: corsHeaders });
        }
        updates.name = name.trim();
      }
      if (description !== undefined) updates.description = description?.trim() || null;
      if (department_id !== undefined) updates.department_id = department_id;
      if (default_task_title !== undefined) {
        if (!default_task_title.trim()) {
          await failIdempotency('Default task title cannot be empty.');
          return new Response(JSON.stringify({ error: 'Default task title cannot be empty.' }), { status: 400, headers: corsHeaders });
        }
        updates.default_task_title = default_task_title.trim();
      }
      if (task_details !== undefined) updates.task_details = task_details;
      if (default_priority !== undefined) {
        if (!['Low', 'Normal', 'High', 'Urgent'].includes(default_priority)) {
          await failIdempotency('Invalid default priority.');
          return new Response(JSON.stringify({ error: 'Invalid default priority.' }), { status: 400, headers: corsHeaders });
        }
        updates.default_priority = default_priority;
      }
      if (default_approval_mode !== undefined) {
        if (!['Internal Only', 'Client Approval Required'].includes(default_approval_mode)) {
          await failIdempotency('Invalid default approval mode.');
          return new Response(JSON.stringify({ error: 'Invalid default approval mode.' }), { status: 400, headers: corsHeaders });
        }
        updates.default_approval_mode = default_approval_mode;
      }
      if (suggested_duration_days !== undefined) {
        const dNum = Number(suggested_duration_days);
        if (isNaN(dNum) || dNum < 1 || dNum > 30) {
          await failIdempotency('Suggested duration must be between 1 and 30 business days.');
          return new Response(JSON.stringify({ error: 'Suggested duration must be between 1 and 30 business days.' }), { status: 400, headers: corsHeaders });
        }
        updates.suggested_duration_days = dNum;
      }
      if (sort_order !== undefined) updates.sort_order = Number(sort_order) || 0;

      // Atomic UPDATE query enforcing expected_version in WHERE condition
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('task_templates')
        .update(updates)
        .eq('id', templateId)
        .eq('version', expectedVerNum)
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, archived_at, archived_by,
          archive_reason, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .maybeSingle();

      if (updateErr) {
        await failIdempotency(updateErr.message);
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: corsHeaders });
      }

      if (!updated) {
        // Distinguish between 404 (not found) and 409 (stale version conflict)
        const { data: existingCheck } = await supabaseAdmin
          .from('task_templates')
          .select('id, version')
          .eq('id', templateId)
          .maybeSingle();

        if (!existingCheck) {
          await failIdempotency('Template not found');
          return new Response(JSON.stringify({ error: 'Template not found.' }), { status: 404, headers: corsHeaders });
        }

        await failIdempotency('Stale version conflict');
        return new Response(
          JSON.stringify({
            error: `Stale update rejected: Expected version ${expectedVerNum}, but template is at version ${existingCheck.version}. Please refresh and retry.`
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Mandatory Audit Event Writing with strict error checking
      const { error: auditError } = await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_updated',
        entity_type: 'task_template',
        entity_id: updated.id,
        entity_name: updated.name,
        previous_state: { version: expectedVerNum },
        new_state: updated,
        metadata: { previous_version: expectedVerNum, new_version: updated.version }
      });

      if (auditError) {
        await failIdempotency(`Audit error: ${auditError.message}`);
        return new Response(
          JSON.stringify({ error: `Mandatory audit writing failed: ${auditError.message}. Mutation aborted.` }),
          { status: 500, headers: corsHeaders }
        );
      }

      const responsePayload = {
        success: true,
        template: {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          departmentId: updated.department_id,
          departmentName: updated.department?.name,
          defaultTaskTitle: updated.default_task_title,
          taskDetails: updated.task_details,
          defaultPriority: updated.default_priority,
          defaultApprovalMode: updated.default_approval_mode,
          suggestedDurationDays: updated.suggested_duration_days,
          status: updated.status,
          sortOrder: updated.sort_order,
          version: updated.version,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        }
      };

      await completeIdempotency(updated.id, responsePayload);

      return new Response(
        JSON.stringify(responsePayload),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: duplicate
    // --------------------------------------------------------------------------
    if (action === 'duplicate') {
      const templateId = body.template_id || body.id;
      if (!templateId) {
        await failIdempotency('Missing template id.');
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle();

      if (fetchErr || !existing) {
        await failIdempotency('Template not found.');
        return new Response(JSON.stringify({ error: 'Template not found.' }), { status: 404, headers: corsHeaders });
      }

      const duplicateName = `${existing.name} (Copy)`.slice(0, 200);

      const { data: duplicated, error: dupErr } = await supabaseAdmin
        .from('task_templates')
        .insert({
          name: duplicateName,
          description: existing.description,
          department_id: existing.department_id,
          default_task_title: existing.default_task_title,
          task_details: existing.task_details,
          default_priority: existing.default_priority,
          default_approval_mode: existing.default_approval_mode,
          suggested_duration_days: existing.suggested_duration_days,
          sort_order: existing.sort_order + 1,
          status: 'Active',
          version: 1,
          created_by: callerProfile.id,
          updated_by: callerProfile.id
        })
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .single();

      if (dupErr || !duplicated) {
        await failIdempotency(dupErr?.message || 'Failed to duplicate template.');
        return new Response(JSON.stringify({ error: dupErr?.message || 'Failed to duplicate template.' }), { status: 500, headers: corsHeaders });
      }

      // Mandatory Audit Event Writing with strict error checking
      const { error: auditError } = await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_duplicated',
        entity_type: 'task_template',
        entity_id: duplicated.id,
        entity_name: duplicated.name,
        metadata: { source_template_id: existing.id }
      });

      if (auditError) {
        await failIdempotency(`Audit error: ${auditError.message}`);
        return new Response(
          JSON.stringify({ error: `Mandatory audit writing failed: ${auditError.message}. Mutation aborted.` }),
          { status: 500, headers: corsHeaders }
        );
      }

      const responsePayload = {
        success: true,
        template: {
          id: duplicated.id,
          name: duplicated.name,
          description: duplicated.description,
          departmentId: duplicated.department_id,
          departmentName: duplicated.department?.name,
          defaultTaskTitle: duplicated.default_task_title,
          taskDetails: duplicated.task_details,
          defaultPriority: duplicated.default_priority,
          defaultApprovalMode: duplicated.default_approval_mode,
          suggestedDurationDays: duplicated.suggested_duration_days,
          status: duplicated.status,
          sortOrder: duplicated.sort_order,
          version: duplicated.version,
          createdAt: duplicated.created_at,
          updatedAt: duplicated.updated_at
        }
      };

      await completeIdempotency(duplicated.id, responsePayload);

      return new Response(
        JSON.stringify(responsePayload),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: archive (Atomic condition status = 'Active' in WHERE)
    // --------------------------------------------------------------------------
    if (action === 'archive') {
      const templateId = body.template_id || body.id;
      const archiveReason = (body.archive_reason || body.reason || '').trim();

      if (!templateId || !archiveReason) {
        await failIdempotency('Template id and a mandatory archive reason are required.');
        return new Response(JSON.stringify({ error: 'Template id and a mandatory archive reason are required.' }), { status: 400, headers: corsHeaders });
      }

      // Atomic update query enforcing status = 'Active'
      const { data: archived, error: archErr } = await supabaseAdmin
        .from('task_templates')
        .update({
          status: 'Archived',
          archived_at: new Date().toISOString(),
          archived_by: callerProfile.id,
          archive_reason: archiveReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('status', 'Active')
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, archived_at, archived_by,
          archive_reason, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .maybeSingle();

      if (archErr) {
        await failIdempotency(archErr.message);
        return new Response(JSON.stringify({ error: archErr.message }), { status: 500, headers: corsHeaders });
      }

      if (!archived) {
        // Check if template exists
        const { data: existingCheck } = await supabaseAdmin
          .from('task_templates')
          .select('id, status')
          .eq('id', templateId)
          .maybeSingle();

        if (!existingCheck) {
          await failIdempotency('Template not found.');
          return new Response(JSON.stringify({ error: 'Template not found.' }), { status: 404, headers: corsHeaders });
        }

        await failIdempotency('State conflict: Template is not Active.');
        return new Response(
          JSON.stringify({ error: `State conflict: Template is already ${existingCheck.status}. Only Active templates can be archived.` }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Mandatory Audit Event Writing with strict error checking
      const { error: auditError } = await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_archived',
        entity_type: 'task_template',
        entity_id: archived.id,
        entity_name: archived.name,
        reason: archiveReason,
        new_state: archived
      });

      if (auditError) {
        await failIdempotency(`Audit error: ${auditError.message}`);
        return new Response(
          JSON.stringify({ error: `Mandatory audit writing failed: ${auditError.message}. Mutation aborted.` }),
          { status: 500, headers: corsHeaders }
        );
      }

      const responsePayload = {
        success: true,
        template: {
          id: archived.id,
          name: archived.name,
          description: archived.description,
          departmentId: archived.department_id,
          defaultTaskTitle: archived.default_task_title,
          taskDetails: archived.task_details,
          defaultPriority: archived.default_priority,
          defaultApprovalMode: archived.default_approval_mode,
          suggestedDurationDays: archived.suggested_duration_days,
          status: archived.status,
          sortOrder: archived.sort_order,
          version: archived.version,
          archivedAt: archived.archived_at,
          archivedBy: archived.archived_by,
          archiveReason: archived.archive_reason,
          createdAt: archived.created_at,
          updatedAt: archived.updated_at
        }
      };

      await completeIdempotency(archived.id, responsePayload);

      return new Response(
        JSON.stringify(responsePayload),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: restore (Atomic condition status = 'Archived' in WHERE)
    // --------------------------------------------------------------------------
    if (action === 'restore') {
      const templateId = body.template_id || body.id;
      if (!templateId) {
        await failIdempotency('Missing template id.');
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      // Atomic update query enforcing status = 'Archived'
      const { data: restored, error: restErr } = await supabaseAdmin
        .from('task_templates')
        .update({
          status: 'Active',
          archived_at: null,
          archived_by: null,
          archive_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('status', 'Archived')
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .maybeSingle();

      if (restErr) {
        await failIdempotency(restErr.message);
        return new Response(JSON.stringify({ error: restErr.message }), { status: 500, headers: corsHeaders });
      }

      if (!restored) {
        // Check if template exists
        const { data: existingCheck } = await supabaseAdmin
          .from('task_templates')
          .select('id, status')
          .eq('id', templateId)
          .maybeSingle();

        if (!existingCheck) {
          await failIdempotency('Template not found.');
          return new Response(JSON.stringify({ error: 'Template not found.' }), { status: 404, headers: corsHeaders });
        }

        await failIdempotency('State conflict: Template is not Archived.');
        return new Response(
          JSON.stringify({ error: `State conflict: Template is already ${existingCheck.status}. Only Archived templates can be restored.` }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Mandatory Audit Event Writing with strict error checking
      const { error: auditError } = await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_restored',
        entity_type: 'task_template',
        entity_id: restored.id,
        entity_name: restored.name
      });

      if (auditError) {
        await failIdempotency(`Audit error: ${auditError.message}`);
        return new Response(
          JSON.stringify({ error: `Mandatory audit writing failed: ${auditError.message}. Mutation aborted.` }),
          { status: 500, headers: corsHeaders }
        );
      }

      const responsePayload = {
        success: true,
        template: {
          id: restored.id,
          name: restored.name,
          description: restored.description,
          departmentId: restored.department_id,
          departmentName: restored.department?.name,
          defaultTaskTitle: restored.default_task_title,
          taskDetails: restored.task_details,
          defaultPriority: restored.default_priority,
          defaultApprovalMode: restored.default_approval_mode,
          suggestedDurationDays: restored.suggested_duration_days,
          status: restored.status,
          sortOrder: restored.sort_order,
          version: restored.version,
          createdAt: restored.created_at,
          updatedAt: restored.updated_at
        }
      };

      await completeIdempotency(restored.id, responsePayload);

      return new Response(
        JSON.stringify(responsePayload),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action: ${action}` }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error processing template action.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
