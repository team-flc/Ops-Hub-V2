// Edge Function: manage-archive
// Server-side governance for recoverable archiving and restoring of clients, team members, and tasks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing service keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate caller & check role
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerProfile, error: cpErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single();

    if (cpErr || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Caller profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isOwnerOrManager = callerProfile.role === 'owner' || callerProfile.role === 'operational_manager';
    if (!isOwnerOrManager) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient privileges for archive operations' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, entityType, entityId, reason, newAssigneeId } = body;

    const now = new Date().toISOString();

    // ==========================================
    // ACTION: ARCHIVE
    // ==========================================
    if (action === 'archive') {
      if (!reason || !reason.trim()) {
        return new Response(
          JSON.stringify({ error: 'Mandatory archive reason is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (entityType === 'team_member') {
        // Check open tasks
        const { data: openTasks } = await supabaseAdmin
          .from('client_tasks')
          .select('id')
          .eq('assignee_id', entityId)
          .in('status', ['Assigned', 'In Progress', 'Blocked', 'Team Review'])
          .is('archived_at', null);

        if (openTasks && openTasks.length > 0) {
          return new Response(
            JSON.stringify({ 
              error: `Cannot archive team member: User has ${openTasks.length} open task(s). Reassign them first.` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', entityId).single();
        if (!profile) {
          return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        await supabaseAdmin
          .from('profiles')
          .update({
            status: 'suspended',
            previous_status: profile.status,
            archived_at: now,
            archived_by: user.id,
            archive_reason: reason.trim(),
            updated_at: now
          })
          .eq('id', entityId);

        await supabaseAdmin.from('system_audit_events').insert({
          actor_id: user.id,
          actor_name: callerProfile.full_name,
          actor_role: callerProfile.role,
          action: 'user_archived',
          entity_type: 'team_member',
          entity_id: entityId,
          entity_name: profile.full_name,
          previous_state: { status: profile.status },
          new_state: { status: 'suspended', archived_at: now },
          reason: reason.trim()
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (entityType === 'client') {
        const { data: client } = await supabaseAdmin.from('clients').select('*').eq('id', entityId).single();
        if (!client) {
          return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        await supabaseAdmin
          .from('clients')
          .update({
            status: 'Archived',
            previous_status: client.status,
            archived_at: now,
            archived_by: user.id,
            archive_reason: reason.trim(),
            updated_at: now
          })
          .eq('id', entityId);

        await supabaseAdmin.from('system_audit_events').insert({
          actor_id: user.id,
          actor_name: callerProfile.full_name,
          actor_role: callerProfile.role,
          action: 'client_archived',
          entity_type: 'client',
          entity_id: entityId,
          entity_name: client.company_name,
          client_id: entityId,
          client_name: client.company_name,
          previous_state: { status: client.status },
          new_state: { status: 'Archived', previous_status: client.status },
          reason: reason.trim()
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ==========================================
    // ACTION: RESTORE
    // ==========================================
    if (action === 'restore') {
      if (entityType === 'team_member') {
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', entityId).single();
        if (!profile) {
          return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Restores to Suspended status for security
        await supabaseAdmin
          .from('profiles')
          .update({
            status: 'suspended',
            archived_at: null,
            archived_by: null,
            archive_reason: null,
            updated_at: now
          })
          .eq('id', entityId);

        await supabaseAdmin.from('system_audit_events').insert({
          actor_id: user.id,
          actor_name: callerProfile.full_name,
          actor_role: callerProfile.role,
          action: 'user_restored',
          entity_type: 'team_member',
          entity_id: entityId,
          entity_name: profile.full_name,
          reason: 'Restored to Suspended status'
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (entityType === 'client') {
        const { data: client } = await supabaseAdmin.from('clients').select('*').eq('id', entityId).single();
        if (!client) {
          return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const restoreStatus = client.previous_status && client.previous_status !== 'Archived' 
          ? client.previous_status 
          : 'Active';

        await supabaseAdmin
          .from('clients')
          .update({
            status: restoreStatus,
            archived_at: null,
            archived_by: null,
            archive_reason: null,
            updated_at: now
          })
          .eq('id', entityId);

        await supabaseAdmin.from('system_audit_events').insert({
          actor_id: user.id,
          actor_name: callerProfile.full_name,
          actor_role: callerProfile.role,
          action: 'client_restored',
          entity_type: 'client',
          entity_id: entityId,
          entity_name: client.company_name,
          client_id: entityId,
          client_name: client.company_name,
          reason: 'Restored from Archive Center'
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (entityType === 'task') {
        const { data: task } = await supabaseAdmin
          .from('client_tasks')
          .select('*, client:client_id(status, company_name)')
          .eq('id', entityId)
          .single();

        if (!task) {
          return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (task.client?.status === 'Archived') {
          return new Response(
            JSON.stringify({ error: `Cannot restore task: Parent client "${task.client.company_name}" is archived. Please restore the client first.` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const taskUpdates: Record<string, any> = {
          archived_at: null,
          archived_by: null,
          archive_reason: null,
          updated_at: now
        };

        if (newAssigneeId) {
          taskUpdates.assignee_id = newAssigneeId;
          if (task.status === 'Draft') taskUpdates.status = 'Assigned';
        }

        await supabaseAdmin.from('client_tasks').update(taskUpdates).eq('id', entityId);

        await supabaseAdmin.from('client_task_events').insert({
          task_id: entityId,
          client_id: task.client_id,
          actor_id: user.id,
          event_type: 'restored',
          notes: 'Task restored from Archive Center'
        });

        await supabaseAdmin.from('system_audit_events').insert({
          actor_id: user.id,
          actor_name: callerProfile.full_name,
          actor_role: callerProfile.role,
          action: 'task_restored',
          entity_type: 'task',
          entity_id: entityId,
          entity_name: task.title,
          client_id: task.client_id,
          client_name: task.client?.company_name,
          reason: 'Restored from Archive Center'
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});