// ==============================================================================
// SUPABASE EDGE FUNCTION: manage-team-member
// Location: supabase/functions/manage-team-member/index.ts
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

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;

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

  // Admin Client (Service Role for identity operations)
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

  // Load and Verify Caller Profile Server-Side
  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, status')
    .eq('id', callerUser.id)
    .single();

  if (profileError || !callerProfile) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Caller profile could not be verified.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  if (callerProfile.status !== 'active') {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Your account is suspended or inactive.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  if (callerProfile.role !== 'owner' && callerProfile.role !== 'operational_manager') {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Insufficient privileges for Team Management.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  try {
    const payload = await req.json();
    const { action } = payload;

    // =========================================================================
    // ACTION: CREATE TEAM MEMBER
    // =========================================================================
    if (action === 'create') {
      const {
        fullName,
        workEmail,
        phone,
        startDate,
        departmentIds,
        designationId,
        reportingManagerId,
        clientIds,
        password
      } = payload;

      // Validation
      if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
        return new Response(
          JSON.stringify({ error: 'Full Name is required.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const cleanEmail = workEmail?.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return new Response(
          JSON.stringify({ error: 'A valid Work Email is required.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!password || !PASSWORD_REGEX.test(password)) {
        return new Response(
          JSON.stringify({
            error: 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character.'
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'At least one department is required.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!designationId) {
        return new Response(
          JSON.stringify({ error: 'A designation is required.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Enforce Scope on Reporting Manager
      let targetManagerId: string = reportingManagerId;
      if (callerProfile.role === 'operational_manager') {
        // Operational Manager MUST be the reporting manager for their direct creations
        targetManagerId = callerProfile.id;
      } else {
        // Owner can select any active Owner or Operational Manager
        if (!targetManagerId) {
          targetManagerId = callerProfile.id;
        } else {
          const { data: mgrCheck } = await supabaseAdmin
            .from('profiles')
            .select('id, role, status')
            .eq('id', targetManagerId)
            .single();

          if (!mgrCheck || mgrCheck.status !== 'active' || (mgrCheck.role !== 'owner' && mgrCheck.role !== 'operational_manager')) {
            return new Response(
              JSON.stringify({ error: 'Selected reporting manager must be an active Owner or Operational Manager.' }),
              { status: 400, headers: corsHeaders }
            );
          }
        }
      }

      // 1. Create Auth User
      const { data: newAuthData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          role: 'team_member' // Locked role
        }
      });

      if (authCreateError || !newAuthData.user) {
        return new Response(
          JSON.stringify({ error: authCreateError?.message || 'Failed to create user account in authentication service.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const newUserId = newAuthData.user.id;

      try {
        // 2. Insert Profile
        const { error: insertProfileError } = await supabaseAdmin.from('profiles').insert({
          id: newUserId,
          full_name: fullName.trim(),
          work_email: cleanEmail,
          phone: phone?.trim() || null,
          role: 'team_member',
          status: 'active',
          designation_id: designationId,
          reporting_manager_id: targetManagerId,
          start_date: startDate || new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        if (insertProfileError) {
          throw new Error(`Profile creation failed: ${insertProfileError.message}`);
        }

        // 3. Link Departments
        const deptRows = departmentIds.map((deptId: string) => ({
          profile_id: newUserId,
          department_id: deptId,
          created_by: callerProfile.id
        }));
        await supabaseAdmin.from('profile_departments').insert(deptRows);

        // 4. Link Client Access
        if (Array.isArray(clientIds) && clientIds.length > 0) {
          const clientRows = clientIds.map((cId: string) => ({
            profile_id: newUserId,
            client_id: cId,
            granted_by: callerProfile.id
          }));
          await supabaseAdmin.from('profile_client_access').insert(clientRows);
        }

        // 5. Audit Log Entry
        await supabaseAdmin.from('user_management_audit_log').insert({
          actor_id: callerProfile.id,
          target_user_id: newUserId,
          action: 'team_member_created',
          safe_changes: {
            fullName: fullName.trim(),
            workEmail: cleanEmail,
            role: 'team_member',
            reportingManagerId: targetManagerId,
            departmentCount: departmentIds.length,
            clientAccessCount: clientIds?.length || 0
          }
        });

        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: newUserId,
              fullName: fullName.trim(),
              workEmail: cleanEmail,
              role: 'team_member',
              reportingManagerId: targetManagerId,
              status: 'active'
            }
          }),
          { status: 201, headers: corsHeaders }
        );
      } catch (err: any) {
        // Compensating Cleanup: Delete the Auth user so no orphaned auth user remains
        console.error('Compensating cleanup: Deleting created auth user', newUserId, err.message);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return new Response(
          JSON.stringify({ error: `Account setup failed: ${err.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // =========================================================================
    // ACTION: RESET PASSWORD
    // =========================================================================
    if (action === 'reset_password') {
      const { targetUserId, newPassword } = payload;

      if (!targetUserId || !newPassword) {
        return new Response(
          JSON.stringify({ error: 'Target User ID and new password are required.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!PASSWORD_REGEX.test(newPassword)) {
        return new Response(
          JSON.stringify({
            error: 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character.'
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Verify Target Profile and Scope
      const { data: targetProfile, error: targetError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role, reporting_manager_id')
        .eq('id', targetUserId)
        .single();

      if (targetError || !targetProfile) {
        return new Response(
          JSON.stringify({ error: 'Target user profile not found.' }),
          { status: 404, headers: corsHeaders }
        );
      }

      if (callerProfile.role === 'operational_manager') {
        if (targetProfile.reporting_manager_id !== callerProfile.id || targetProfile.role !== 'team_member') {
          return new Response(
            JSON.stringify({ error: 'Forbidden: You can only reset passwords for your direct reports.' }),
            { status: 403, headers: corsHeaders }
          );
        }
      }

      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password: newPassword
      });

      if (resetError) {
        return new Response(
          JSON.stringify({ error: resetError.message || 'Failed to update user password.' }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Audit Log
      await supabaseAdmin.from('user_management_audit_log').insert({
        actor_id: callerProfile.id,
        target_user_id: targetUserId,
        action: 'password_reset',
        safe_changes: {
          performedBy: callerProfile.role,
          targetName: targetProfile.full_name
        }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Password updated successfully.' }),
        { status: 200, headers: corsHeaders }
      );
    }

    // =========================================================================
    // ACTION: SUSPEND TEAM MEMBER
    // =========================================================================
    if (action === 'suspend') {
      const { targetUserId } = payload;

      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role, status, reporting_manager_id')
        .eq('id', targetUserId)
        .single();

      if (!targetProfile) {
        return new Response(
          JSON.stringify({ error: 'Target user not found.' }),
          { status: 404, headers: corsHeaders }
        );
      }

      if (callerProfile.role === 'operational_manager' && targetProfile.reporting_manager_id !== callerProfile.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You can only suspend your direct reports.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Update Profile Status
      await supabaseAdmin
        .from('profiles')
        .update({
          status: 'suspended',
          suspended_at: new Date().toISOString(),
          suspended_by: callerProfile.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId);

      // Ban/Suspend Auth User for 100 years
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: '876000h'
      });

      // Audit Log
      await supabaseAdmin.from('user_management_audit_log').insert({
        actor_id: callerProfile.id,
        target_user_id: targetUserId,
        action: 'team_member_suspended',
        safe_changes: { previousStatus: targetProfile.status, newStatus: 'suspended' }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Team member suspended successfully.' }),
        { status: 200, headers: corsHeaders }
      );
    }

    // =========================================================================
    // ACTION: REACTIVATE TEAM MEMBER
    // =========================================================================
    if (action === 'reactivate') {
      const { targetUserId } = payload;

      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role, status, reporting_manager_id')
        .eq('id', targetUserId)
        .single();

      if (!targetProfile) {
        return new Response(
          JSON.stringify({ error: 'Target user not found.' }),
          { status: 404, headers: corsHeaders }
        );
      }

      if (callerProfile.role === 'operational_manager' && targetProfile.reporting_manager_id !== callerProfile.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You can only reactivate your direct reports.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Restore Profile
      await supabaseAdmin
        .from('profiles')
        .update({
          status: 'active',
          suspended_at: null,
          suspended_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId);

      // Lift Auth Ban
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: 'none'
      });

      // Audit Log
      await supabaseAdmin.from('user_management_audit_log').insert({
        actor_id: callerProfile.id,
        target_user_id: targetUserId,
        action: 'team_member_reactivated',
        safe_changes: { previousStatus: targetProfile.status, newStatus: 'active' }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Team member reactivated successfully.' }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action: ${action}` }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Unhandled manage-team-member error:', err);
    return new Response(
      JSON.stringify({ error: 'An unexpected server error occurred.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
