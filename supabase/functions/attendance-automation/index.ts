import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/**
 * Edge Function: Attendance Background Automation
 *
 * Scheduled invocation only (e.g. pg_net or external secure cron every 5-15m).
 *
 * Security:
 * - Only POST method accepted (405 for any other method).
 * - Mandatory CRON_SECRET validation via Authorization header or x-cron-secret header.
 * - Missing or invalid secret immediately rejected with 401 Unauthorized before client initialization.
 * - Zero secrets or keys logged, exposed, or returned in response.
 * - No browser CORS headers enabled.
 */

serve(async (req: Request) => {
  // 1. Strictly accept only POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST' } }
    );
  }

  // 2. Validate CRON_SECRET before doing any work
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (!expectedSecret) {
    // Missing server configuration
    return new Response(
      JSON.stringify({ error: 'Unauthorized: server configuration missing' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = req.headers.get('Authorization') || '';
  const customHeader = req.headers.get('x-cron-secret') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

  const providedSecret = bearerToken || customHeader;
  if (!providedSecret || providedSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Service configuration unavailable' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Initialize isolated service-role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Call authoritative database stored procedure
    const { data, error } = await supabase.rpc('fn_cron_process_attendance_automation');

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Database automation cycle failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: data,
        executedAt: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
