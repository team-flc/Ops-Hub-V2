// ==============================================================================
// SUPABASE EDGE FUNCTION: manage-task-template
// Location: supabase/functions/manage-task-template/index.ts
// Environment: Deno Runtime / Supabase Functions
// Phase: 3C — Task Templates System
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

  // Load Caller Profile and Resolve Organization Server-Side
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

  // Strict Role Checking:
  // Client and Team Member are strictly denied template library governance
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

  // Derive organization strictly from authenticated profile (never trust client-supplied org ID)
  let callerOrgId = callerProfile.organization_id;
  if (!callerOrgId) {
    const { data: defaultOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (defaultOrg) {
      callerOrgId = defaultOrg.id;
    }
  }

  if (!callerOrgId) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Caller does not belong to a valid organization.' }),
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

  const idempotencyKey = body.idempotency_key || body.request_id || req.headers.get('x-idempotency-key') || null;
  const { action } = body;
  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Missing required field: action' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const isOwner = callerProfile.role === 'owner';
  const isManager = callerProfile.role === 'operational_manager';

  // Helper: Persist idempotency record safely
  async function persistIdempotency(actionName: string, resourceId: string | null, payload: any) {
    if (!idempotencyKey) return;
    try {
      await supabaseAdmin.from('mutation_idempotency_records').insert({
        organization_id: callerOrgId,
        actor_id: callerProfile.id,
        idempotency_key: idempotencyKey,
        action: actionName,
        resource_id: resourceId,
        response_payload: payload
      });
    } catch {
      // Ignore idempotency insert collisions
    }
  }

  try {
    // --------------------------------------------------------------------------
    // ACTION: list
    // --------------------------------------------------------------------------
    if (action === 'list') {
      let query = supabaseAdmin
        .from('task_templates')
        .select(`
          id,
          organization_id,
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
        .eq('organization_id', callerOrgId)
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
        organizationId: t.organization_id,
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
    // Mutation Guards: Only Owner can create, edit, duplicate, archive, restore
    // --------------------------------------------------------------------------
    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only the Executive Owner can govern task templates.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Database-backed idempotency replay check for mutations
    if (idempotencyKey) {
      const { data: existingIdemp } = await supabaseAdmin
        .from('mutation_idempotency_records')
        .select('response_payload')
        .eq('organization_id', callerOrgId)
        .eq('actor_id', callerProfile.id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingIdemp && existingIdemp.response_payload) {
        return new Response(
          JSON.stringify(existingIdemp.response_payload),
          { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
        );
      }
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
        return new Response(JSON.stringify({ error: 'Template name is required.' }), { status: 400, headers: corsHeaders });
      }
      if (!default_task_title || !default_task_title.trim()) {
        return new Response(JSON.stringify({ error: 'Default task title is required.' }), { status: 400, headers: corsHeaders });
      }
      if (!department_id) {
        return new Response(JSON.stringify({ error: 'Responsible department is required.' }), { status: 400, headers: corsHeaders });
      }

      if (!['Low', 'Normal', 'High', 'Urgent'].includes(default_priority)) {
        return new Response(JSON.stringify({ error: 'Invalid default priority.' }), { status: 400, headers: corsHeaders });
      }
      if (!['Internal Only', 'Client Approval Required'].includes(default_approval_mode)) {
        return new Response(JSON.stringify({ error: 'Invalid default approval mode.' }), { status: 400, headers: corsHeaders });
      }

      const durationNum = Number(suggested_duration_days);
      if (isNaN(durationNum) || durationNum < 1 || durationNum > 30) {
        return new Response(JSON.stringify({ error: 'Suggested duration must be between 1 and 30 business days.' }), { status: 400, headers: corsHeaders });
      }

      // Check for duplicate recent creation within the same organization
      const { data: existingDup } = await supabaseAdmin
        .from('task_templates')
        .select(`
          id, organization_id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .eq('organization_id', callerOrgId)
        .eq('name', name.trim())
        .eq('department_id', department_id)
        .eq('status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingDup) {
        const createdMs = new Date(existingDup.created_at).getTime();
        const nowMs = Date.now();
        if (idempotencyKey || (nowMs - createdMs < 60000 && existingDup.created_by === callerProfile.id)) {
          const replayPayload = {
            success: true,
            template: {
              id: existingDup.id,
              organizationId: existingDup.organization_id,
              name: existingDup.name,
              description: existingDup.description,
              departmentId: existingDup.department_id,
              departmentName: existingDup.department?.name,
              defaultTaskTitle: existingDup.default_task_title,
              taskDetails: existingDup.task_details,
              defaultPriority: existingDup.default_priority,
              defaultApprovalMode: existingDup.default_approval_mode,
              suggestedDurationDays: existingDup.suggested_duration_days,
              status: existingDup.status,
              sortOrder: existingDup.sort_order,
              version: existingDup.version,
              createdAt: existingDup.created_at,
              updatedAt: existingDup.updated_at
            }
          };
          await persistIdempotency('create', existingDup.id, replayPayload);
          return new Response(
            JSON.stringify(replayPayload),
            { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
          );
        }
      }

      const { data: newTemplate, error: insertError } = await supabaseAdmin
        .from('task_templates')
        .insert({
          organization_id: callerOrgId,
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
          id, organization_id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .single();

      if (insertError || !newTemplate) {
        return new Response(JSON.stringify({ error: insertError?.message || 'Failed to create template.' }), { status: 500, headers: corsHeaders });
      }

      // Record Audit Event
      await supabaseAdmin.from('system_audit_events').insert({
        organization_id: callerOrgId,
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_created',
        entity_type: 'task_template',
        entity_id: newTemplate.id,
        entity_name: newTemplate.name,
        new_state: newTemplate,
        metadata: { organization_id: callerOrgId }
      });

      const responsePayload = {
        success: true,
        template: {
          id: newTemplate.id,
          organizationId: newTemplate.organization_id,
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

      await persistIdempotency('create', newTemplate.id, responsePayload);

      return new Response(
        JSON.stringify(responsePayload),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: update
    // --------------------------------------------------------------------------
    if (action === 'update') {
      const templateId = body.template_id || body.id;
      const {
        name, description, department_id, default_task_title, task_details,
        default_priority, default_approval_mode, suggested_duration_days, sort_order,
        expected_version, expectedVersion
      } = body;

      if (!templateId) {
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      // Scoped fetch: enforces same organization isolation
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', templateId)
        .eq('organization_id', callerOrgId)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: 'Template not found or belongs to another organization.' }), { status: 404, headers: corsHeaders });
      }

      // Concurrency protection: Reject stale updates
      const targetVersion = expected_version !== undefined ? expected_version : expectedVersion;
      if (targetVersion !== undefined && targetVersion !== null) {
        if (existing.version !== Number(targetVersion)) {
          return new Response(
            JSON.stringify({
              error: `Stale update rejected: Expected version ${targetVersion}, but template is at version ${existing.version}. Please refresh and retry.`
            }),
            { status: 409, headers: corsHeaders }
          );
        }
      }

      const updates: any = {
        updated_by: callerProfile.id,
        updated_at: new Date().toISOString(),
        version: existing.version + 1
      };

      if (name !== undefined) {
        if (!name.trim()) return new Response(JSON.stringify({ error: 'Template name cannot be empty.' }), { status: 400, headers: corsHeaders });
        updates.name = name.trim();
      }
      if (description !== undefined) updates.description = description?.trim() || null;
      if (department_id !== undefined) updates.department_id = department_id;
      if (default_task_title !== undefined) {
        if (!default_task_title.trim()) return new Response(JSON.stringify({ error: 'Default task title cannot be empty.' }), { status: 400, headers: corsHeaders });
        updates.default_task_title = default_task_title.trim();
      }
      if (task_details !== undefined) updates.task_details = task_details;
      if (default_priority !== undefined) {
        if (!['Low', 'Normal', 'High', 'Urgent'].includes(default_priority)) {
          return new Response(JSON.stringify({ error: 'Invalid default priority.' }), { status: 400, headers: corsHeaders });
        }
        updates.default_priority = default_priority;
      }
      if (default_approval_mode !== undefined) {
        if (!['Internal Only', 'Client Approval Required'].includes(default_approval_mode)) {
          return new Response(JSON.stringify({ error: 'Invalid default approval mode.' }), { status: 400, headers: corsHeaders });
        }
        updates.default_approval_mode = default_approval_mode;
      }
      if (suggested_duration_days !== undefined) {
        const dNum = Number(suggested_duration_days);
        if (isNaN(dNum) || dNum < 1 || dNum > 30) {
          return new Response(JSON.stringify({ error: 'Suggested duration must be between 1 and 30 business days.' }), { status: 400, headers: corsHeaders });
        }
        updates.suggested_duration_days = dNum;
      }
      if (sort_order !== undefined) updates.sort_order = Number(sort_order) || 0;

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('task_templates')
        .update(updates)
        .eq('id', templateId)
        .eq('organization_id', callerOrgId)
        .select(`
          id, organization_id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, archived_at, archived_by,
          archive_reason, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .single();

      if (updateErr || !updated) {
        return new Response(JSON.stringify({ error: updateErr?.message || 'Failed to update template.' }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('system_audit_events').insert({
        organization_id: callerOrgId,
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_updated',
        entity_type: 'task_template',
        entity_id: updated.id,
        entity_name: updated.name,
        previous_state: existing,
        new_state: updated,
        metadata: { organization_id: callerOrgId }
      });

      const responsePayload = {
        success: true,
        template: {
          id: updated.id,
          organizationId: updated.organization_id,
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

      await persistIdempotency('update', updated.id, responsePayload);

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
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      // Scoped fetch: enforces same organization
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', templateId)
        .eq('organization_id', callerOrgId)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: 'Template not found or belongs to another organization.' }), { status: 404, headers: corsHeaders });
      }

      const duplicateName = `${existing.name} (Copy)`.slice(0, 200);

      const { data: duplicated, error: dupErr } = await supabaseAdmin
        .from('task_templates')
        .insert({
          organization_id: callerOrgId,
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
          id, organization_id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .single();

      if (dupErr || !duplicated) {
        return new Response(JSON.stringify({ error: dupErr?.message || 'Failed to duplicate template.' }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('system_audit_events').insert({
        organization_id: callerOrgId,
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_duplicated',
        entity_type: 'task_template',
        entity_id: duplicated.id,
        entity_name: duplicated.name,
        metadata: { source_template_id: existing.id, organization_id: callerOrgId }
      });

      const responsePayload = {
        success: true,
        template: {
          id: duplicated.id,
          organizationId: duplicated.organization_id,
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

      await persistIdempotency('duplicate', duplicated.id, responsePayload);

      return new Response(
        JSON.stringify(responsePayload),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: archive
    // --------------------------------------------------------------------------
    if (action === 'archive') {
      const templateId = body.template_id || body.id;
      const { reason, archive_reason, expected_status, expectedStatus } = body;
      const archiveReason = reason || archive_reason;

      if (!templateId || !archiveReason || !archiveReason.trim()) {
        return new Response(JSON.stringify({ error: 'Template id and a mandatory archive reason are required.' }), { status: 400, headers: corsHeaders });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', templateId)
        .eq('organization_id', callerOrgId)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: 'Template not found or belongs to another organization.' }), { status: 404, headers: corsHeaders });
      }

      // Expected state validation for concurrency
      const reqStatus = expected_status || expectedStatus;
      if (reqStatus && existing.status !== reqStatus) {
        return new Response(
          JSON.stringify({ error: `State conflict: Expected status ${reqStatus}, but template is ${existing.status}.` }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Idempotency check: if already archived, return safely without duplicate audit event
      if (existing.status === 'Archived') {
        const replayPayload = {
          success: true,
          template: {
            id: existing.id,
            organizationId: existing.organization_id,
            name: existing.name,
            description: existing.description,
            departmentId: existing.department_id,
            defaultTaskTitle: existing.default_task_title,
            taskDetails: existing.task_details,
            defaultPriority: existing.default_priority,
            defaultApprovalMode: existing.default_approval_mode,
            suggestedDurationDays: existing.suggested_duration_days,
            status: existing.status,
            sortOrder: existing.sort_order,
            version: existing.version,
            archivedAt: existing.archived_at,
            archivedBy: existing.archived_by,
            archiveReason: existing.archive_reason,
            createdAt: existing.created_at,
            updatedAt: existing.updated_at
          }
        };
        await persistIdempotency('archive', existing.id, replayPayload);
        return new Response(
          JSON.stringify(replayPayload),
          { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
        );
      }

      const { data: archived, error: archErr } = await supabaseAdmin
        .from('task_templates')
        .update({
          status: 'Archived',
          archived_at: new Date().toISOString(),
          archived_by: callerProfile.id,
          archive_reason: archiveReason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('organization_id', callerOrgId)
        .select(`
          id, organization_id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, archived_at, archived_by,
          archive_reason, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .single();

      if (archErr || !archived) {
        return new Response(JSON.stringify({ error: archErr?.message || 'Failed to archive template.' }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('system_audit_events').insert({
        organization_id: callerOrgId,
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_archived',
        entity_type: 'task_template',
        entity_id: archived.id,
        entity_name: archived.name,
        reason: archiveReason.trim(),
        metadata: { organization_id: callerOrgId }
      });

      const responsePayload = {
        success: true,
        template: {
          id: archived.id,
          organizationId: archived.organization_id,
          name: archived.name,
          description: archived.description,
          departmentId: archived.department_id,
          departmentName: archived.department?.name,
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

      await persistIdempotency('archive', archived.id, responsePayload);

      return new Response(
        JSON.stringify(responsePayload),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: restore
    // --------------------------------------------------------------------------
    if (action === 'restore') {
      const templateId = body.template_id || body.id;
      const { expected_status, expectedStatus } = body;

      if (!templateId) {
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', templateId)
        .eq('organization_id', callerOrgId)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: 'Template not found or belongs to another organization.' }), { status: 404, headers: corsHeaders });
      }

      // Expected state validation for concurrency
      const reqStatus = expected_status || expectedStatus;
      if (reqStatus && existing.status !== reqStatus) {
        return new Response(
          JSON.stringify({ error: `State conflict: Expected status ${reqStatus}, but template is ${existing.status}.` }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Idempotency check: if already active, return safely without duplicate audit event
      if (existing.status === 'Active') {
        const replayPayload = {
          success: true,
          template: {
            id: existing.id,
            organizationId: existing.organization_id,
            name: existing.name,
            description: existing.description,
            departmentId: existing.department_id,
            defaultTaskTitle: existing.default_task_title,
            taskDetails: existing.task_details,
            defaultPriority: existing.default_priority,
            defaultApprovalMode: existing.default_approval_mode,
            suggestedDurationDays: existing.suggested_duration_days,
            status: existing.status,
            sortOrder: existing.sort_order,
            version: existing.version,
            createdAt: existing.created_at,
            updatedAt: existing.updated_at
          }
        };
        await persistIdempotency('restore', existing.id, replayPayload);
        return new Response(
          JSON.stringify(replayPayload),
          { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
        );
      }

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
        .eq('organization_id', callerOrgId)
        .select(`
          id, organization_id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .single();

      if (restErr || !restored) {
        return new Response(JSON.stringify({ error: restErr?.message || 'Failed to restore template.' }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('system_audit_events').insert({
        organization_id: callerOrgId,
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_restored',
        entity_type: 'task_template',
        entity_id: restored.id,
        entity_name: restored.name,
        metadata: { organization_id: callerOrgId }
      });

      const responsePayload = {
        success: true,
        template: {
          id: restored.id,
          organizationId: restored.organization_id,
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

      await persistIdempotency('restore', restored.id, responsePayload);

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
      JSON.stringify({ error: err.message || 'Internal server error.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
