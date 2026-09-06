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

  try {
    // --------------------------------------------------------------------------
    // ACTION: list
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
    // Mutation Guards: Only Owner can create, edit, duplicate, archive, restore
    // --------------------------------------------------------------------------
    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only the Executive Owner can govern task templates.' }),
        { status: 403, headers: corsHeaders }
      );
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

      // Check for duplicate recent creation
      const { data: existingDup } = await supabaseAdmin
        .from('task_templates')
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
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
          return new Response(
            JSON.stringify({
              success: true,
              template: {
                id: existingDup.id,
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
            }),
            { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
          );
        }
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
        return new Response(JSON.stringify({ error: insertError?.message || 'Failed to create template.' }), { status: 500, headers: corsHeaders });
      }

      // Record Audit Event
      await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_created',
        entity_type: 'task_template',
        entity_id: newTemplate.id,
        entity_name: newTemplate.name,
        new_state: newTemplate
      });

      return new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: update
    // --------------------------------------------------------------------------
    if (action === 'update') {
      const { id, name, description, department_id, default_task_title, task_details, default_priority, default_approval_mode, suggested_duration_days, sort_order } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: 'Template not found.' }), { status: 404, headers: corsHeaders });
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
        .eq('id', id)
        .select(`
          id, name, description, department_id, default_task_title, task_details,
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
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_updated',
        entity_type: 'task_template',
        entity_id: updated.id,
        entity_name: updated.name,
        previous_state: existing,
        new_state: updated
      });

      return new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: duplicate
    // --------------------------------------------------------------------------
    if (action === 'duplicate') {
      const { id } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !existing) {
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
        return new Response(JSON.stringify({ error: dupErr?.message || 'Failed to duplicate template.' }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_duplicated',
        entity_type: 'task_template',
        entity_id: duplicated.id,
        entity_name: duplicated.name,
        metadata: { source_template_id: existing.id }
      });

      return new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: archive
    // --------------------------------------------------------------------------
    if (action === 'archive') {
      const { id, reason } = body;
      if (!id || !reason || !reason.trim()) {
        return new Response(JSON.stringify({ error: 'Template id and a mandatory archive reason are required.' }), { status: 400, headers: corsHeaders });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: 'Template not found.' }), { status: 404, headers: corsHeaders });
      }

      // Idempotency check: if already archived, return safely without duplicate audit event
      if (existing.status === 'Archived') {
        return new Response(
          JSON.stringify({
            success: true,
            template: {
              id: existing.id,
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
          }),
          { status: 200, headers: { ...corsHeaders, 'X-Idempotent-Replay': 'true' } }
        );
      }

      const { data: archived, error: archErr } = await supabaseAdmin
        .from('task_templates')
        .update({
          status: 'Archived',
          archived_at: new Date().toISOString(),
          archived_by: callerProfile.id,
          archive_reason: reason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          id, name, description, department_id, default_task_title, task_details,
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
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_archived',
        entity_type: 'task_template',
        entity_id: archived.id,
        entity_name: archived.name,
        reason: reason.trim()
      });

      return new Response(
        JSON.stringify({
          success: true,
          template: {
            id: archived.id,
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
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION: restore
    // --------------------------------------------------------------------------
    if (action === 'restore') {
      const { id } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing template id.' }), { status: 400, headers: corsHeaders });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('task_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: 'Template not found.' }), { status: 404, headers: corsHeaders });
      }

      // Idempotency check: if already active, return safely without duplicate audit event
      if (existing.status === 'Active') {
        return new Response(
          JSON.stringify({
            success: true,
            template: {
              id: existing.id,
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
          }),
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
        .eq('id', id)
        .select(`
          id, name, description, department_id, default_task_title, task_details,
          default_priority, default_approval_mode, suggested_duration_days, status,
          sort_order, version, created_by, updated_by, created_at, updated_at,
          department:departments!department_id(id, name, slug)
        `)
        .single();

      if (restErr || !restored) {
        return new Response(JSON.stringify({ error: restErr?.message || 'Failed to restore template.' }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerProfile.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'template_restored',
        entity_type: 'task_template',
        entity_id: restored.id,
        entity_name: restored.name
      });

      return new Response(
        JSON.stringify({
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
        }),
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
