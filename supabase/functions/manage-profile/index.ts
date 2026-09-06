// Edge Function: manage-profile
// Secure server-side validation for self-profile updates and avatar management

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

    // 1. Authenticate caller
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { fullName, bio, linkedinUrl, contactEmail, phone, backupPhone, avatarUrl } = body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return new Response(
        JSON.stringify({ error: 'Full name is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch previous profile
    const { data: previousProfile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (pErr || !previousProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Update only self-editable fields
    const updatePayload: Record<string, any> = {
      full_name: fullName.trim(),
      bio: typeof bio === 'string' ? bio.trim() : null,
      linkedin_url: typeof linkedinUrl === 'string' ? linkedinUrl.trim() : null,
      contact_email: typeof contactEmail === 'string' ? contactEmail.trim() : null,
      phone: typeof phone === 'string' ? phone.trim() : null,
      backup_phone: typeof backupPhone === 'string' ? backupPhone.trim() : null,
      updated_at: new Date().toISOString()
    };

    if (avatarUrl !== undefined) {
      updatePayload.avatar_url = avatarUrl;
    }

    const { data: updatedProfile, error: uErr } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .single();

    if (uErr || !updatedProfile) {
      return new Response(
        JSON.stringify({ error: uErr?.message || 'Failed to update profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Log Immutable Audit Event
    await supabaseAdmin.from('system_audit_events').insert({
      actor_id: user.id,
      actor_name: updatedProfile.full_name,
      actor_role: updatedProfile.role,
      action: 'profile_updated',
      entity_type: 'profile',
      entity_id: user.id,
      entity_name: updatedProfile.full_name,
      previous_state: {
        full_name: previousProfile.full_name,
        bio: previousProfile.bio,
        linkedin_url: previousProfile.linkedin_url,
        contact_email: previousProfile.contact_email,
        phone: previousProfile.phone,
        avatar_url: previousProfile.avatar_url
      },
      new_state: {
        full_name: updatedProfile.full_name,
        bio: updatedProfile.bio,
        linkedin_url: updatedProfile.linkedin_url,
        contact_email: updatedProfile.contact_email,
        phone: updatedProfile.phone,
        avatar_url: updatedProfile.avatar_url
      },
      reason: 'Self profile update'
    });

    return new Response(
      JSON.stringify({ success: true, profile: updatedProfile }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});