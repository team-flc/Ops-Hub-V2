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

function redactAuditPayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (/[?&](?:token|access_token|refresh_token|signature|apikey|x-amz-signature|secret)=/i.test(obj)) {
      return obj.replace(
        /([?&](?:token|access_token|refresh_token|signature|apikey|x-amz-signature|secret)=)[^&]+/gi,
        '$1[REDACTED]'
      );
    }
    return obj;
  }
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactAuditPayload);
  const copy: Record<string, any> = {};
  const secretKeywords = [
    'password', 'passwordhash', 'token', 'access_token', 'refresh_token',
    'servicerolekey', 'secret', 'apikey', 'cookie', 'authorization',
    'recoverycode', 'otp', 'signedurl', 'signature', 'x-amz-signature'
  ];
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (secretKeywords.some((k) => lower.includes(k))) {
      copy[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      copy[key] = redactAuditPayload(value);
    } else if (typeof value === 'string') {
      copy[key] = redactAuditPayload(value);
    } else {
      copy[key] = value;
    }
  }
  return copy;
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
        backupPhone,
        contactEmail,
        linkedinUrl,
        bio,
        avatarUrl,
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

      // Optional fields validation
      let cleanLinkedinUrl = linkedinUrl?.trim() || null;
      if (cleanLinkedinUrl && !/^https?:\/\//i.test(cleanLinkedinUrl)) {
        return new Response(
          JSON.stringify({ error: 'Invalid LinkedIn URL. Must start with http:// or https://' }),
          { status: 400, headers: corsHeaders }
        );
      }

      let cleanContactEmail = contactEmail?.trim()?.toLowerCase() || null;
      if (cleanContactEmail && !cleanContactEmail.includes('@')) {
        return new Response(
          JSON.stringify({ error: 'Invalid Contact Email format.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const cleanBio = bio?.trim() || null;
      const cleanBackupPhone = backupPhone?.trim() || null;
      const cleanAvatarUrl = avatarUrl?.trim() || null;

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

      // Determine and validate target role based on creation matrix
      let targetRole = 'team_member';
      if (callerProfile.role === 'owner') {
        if (payload.role === 'operational_manager') {
          targetRole = 'operational_manager';
        } else if (payload.role === 'team_member' || !payload.role) {
          targetRole = 'team_member';
        } else {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Owner can only provision Operational Managers or Team Members.' }),
            { status: 400, headers: corsHeaders }
          );
        }
      } else if (callerProfile.role === 'operational_manager') {
        if (payload.role && payload.role !== 'team_member') {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Operational Managers can only provision Team Members.' }),
            { status: 403, headers: corsHeaders }
          );
        }
        targetRole = 'team_member';
      } else {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Insufficient privileges to create users.' }),
          { status: 403, headers: corsHeaders }
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

      // For Manager-created members: restrict client grants to manager's permitted scope
      if (callerProfile.role === 'operational_manager' && Array.isArray(clientIds) && clientIds.length > 0) {
        const { data: managerClients } = await supabaseAdmin
          .from('client_team_access')
          .select('client_id')
          .eq('user_id', callerProfile.id);
        const allowedSet = new Set((managerClients || []).map((mc: any) => mc.client_id));
        const unauthorizedClients = clientIds.filter((cid: string) => !allowedSet.has(cid));
        if (unauthorizedClients.length > 0) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Cannot grant access to clients outside your operational scope.' }),
            { status: 403, headers: corsHeaders }
          );
        }
      }

      // 1. Create Auth User
      const { data: newAuthData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          role: targetRole
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
          backup_phone: cleanBackupPhone,
          contact_email: cleanContactEmail,
          linkedin_url: cleanLinkedinUrl,
          bio: cleanBio,
          avatar_url: cleanAvatarUrl,
          role: targetRole,
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

        // 4. Link Client Access (both tables for backward and forward compatibility)
        if (Array.isArray(clientIds) && clientIds.length > 0) {
          const clientRows = clientIds.map((cId: string) => ({
            profile_id: newUserId,
            client_id: cId,
            granted_by: callerProfile.id
          }));
          const ctaRows = clientIds.map((cId: string) => ({
            profile_id: newUserId,
            client_id: cId
          }));
          await Promise.all([
            supabaseAdmin.from('profile_client_access').insert(clientRows),
            supabaseAdmin.from('client_team_access').insert(ctaRows)
          ]);
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
    // ACTION: UPDATE TEAM MEMBER (Server-Authoritative Client Access Revocation Safeguard)
    // =========================================================================
    if (action === 'update') {
      const {
        id: targetUserId,
        fullName,
        phone,
        backupPhone,
        contactEmail,
        linkedinUrl,
        bio,
        avatarUrl,
        startDate,
        departmentIds,
        designationId,
        reportingManagerId,
        clientIds
      } = payload;

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'Target user ID is required.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // 1. Fetch Target Profile
      const { data: targetProfile, error: targetErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (targetErr || !targetProfile) {
        return new Response(
          JSON.stringify({ error: 'Target team member profile not found.' }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Operational Manager scope check
      if (callerProfile.role === 'operational_manager' && targetProfile.reporting_manager_id !== callerProfile.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You can only edit team members reporting directly to you.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // 2. Authoritative Client-Access Revocation Protection
      const { data: currentClientAccess } = await supabaseAdmin
        .from('client_team_access')
        .select('client_id')
        .eq('profile_id', targetUserId);

      const currentClientIds = (currentClientAccess || []).map((c: any) => c.client_id);
      const newClientIdsSet = new Set(clientIds || []);
      const removedClientIds = currentClientIds.filter((cid: string) => !newClientIdsSet.has(cid));

      if (removedClientIds.length > 0) {
        // Query open tasks assigned to this user under any removed client
        const { data: openTasks } = await supabaseAdmin
          .from('client_tasks')
          .select('id, title, client_id')
          .eq('assignee_id', targetUserId)
          .in('client_id', removedClientIds)
          .in('status', ['Assigned', 'In Progress', 'Blocked', 'Team Review'])
          .is('archived_at', null);

        if (openTasks && openTasks.length > 0) {
          return new Response(
            JSON.stringify({
              error: `Cannot revoke client access: Team member has ${openTasks.length} open task(s) on clients being removed. Reassign all open tasks before revoking client access.`
            }),
            { status: 400, headers: corsHeaders }
          );
        }
      }

      // Validate optional fields if provided
      let cleanLinkedinUrl = linkedinUrl !== undefined ? (linkedinUrl?.trim() || null) : targetProfile.linkedin_url;
      if (cleanLinkedinUrl && !/^https?:\/\//i.test(cleanLinkedinUrl)) {
        return new Response(
          JSON.stringify({ error: 'Invalid LinkedIn URL. Must start with http:// or https://' }),
          { status: 400, headers: corsHeaders }
        );
      }

      let cleanContactEmail = contactEmail !== undefined ? (contactEmail?.trim()?.toLowerCase() || null) : targetProfile.contact_email;
      if (cleanContactEmail && !cleanContactEmail.includes('@')) {
        return new Response(
          JSON.stringify({ error: 'Invalid Contact Email format.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // 3. Update Profile
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (fullName) updateData.full_name = fullName.trim();
      if (phone !== undefined) updateData.phone = phone?.trim() || null;
      if (backupPhone !== undefined) updateData.backup_phone = backupPhone?.trim() || null;
      if (contactEmail !== undefined) updateData.contact_email = cleanContactEmail;
      if (linkedinUrl !== undefined) updateData.linkedin_url = cleanLinkedinUrl;
      if (bio !== undefined) updateData.bio = bio?.trim() || null;
      if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl?.trim() || null;
      if (designationId) updateData.designation_id = designationId;
      if (reportingManagerId && callerProfile.role === 'owner') updateData.reporting_manager_id = reportingManagerId;
      if (startDate) updateData.start_date = startDate;

      const { error: updateProfErr } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', targetUserId);

      if (updateProfErr) {
        return new Response(
          JSON.stringify({ error: updateProfErr.message || 'Failed to update profile.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // 4. Atomically sync departments
      if (departmentIds && Array.isArray(departmentIds)) {
        await supabaseAdmin.from('profile_departments').delete().eq('profile_id', targetUserId);
        if (departmentIds.length > 0) {
          const deptInserts = departmentIds.map((deptId: string) => ({
            profile_id: targetUserId,
            department_id: deptId,
            created_by: callerProfile.id
          }));
          await supabaseAdmin.from('profile_departments').insert(deptInserts);
        }
      }

      // 5. Transactional synchronization of client access tables via database RPC
      if (clientIds && Array.isArray(clientIds)) {
        const { error: syncErr } = await supabaseAdmin.rpc('sync_member_client_access_tx', {
          p_profile_id: targetUserId,
          p_new_client_ids: clientIds,
          p_actor_id: callerProfile.id
        });

        if (syncErr) {
          return new Response(
            JSON.stringify({ error: syncErr.message || 'Failed to update client access transactions.' }),
            { status: 400, headers: corsHeaders }
          );
        }
      }

      // 6. Authoritative Audit Event
      await supabaseAdmin.from('system_audit_events').insert({
        actor_id: callerUser.id,
        actor_name: callerProfile.full_name,
        actor_role: callerProfile.role,
        action: 'team_member_updated',
        entity_type: 'team_member',
        entity_id: targetUserId,
        entity_name: fullName?.trim() || targetProfile.full_name,
        previous_state: redactAuditPayload({
          phone: targetProfile.phone,
          designation_id: targetProfile.designation_id,
          client_ids: currentClientIds
        }),
        new_state: redactAuditPayload({
          ...updateData,
          client_ids: clientIds
        }),
        reason: 'Administrative team member update'
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Team member updated successfully.' }),
        { status: 200, headers: corsHeaders }
      );
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
