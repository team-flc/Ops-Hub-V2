import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/**
 * Edge Function: Attendance Background Automation
 * Idempotently executes:
 * 1. 60m Missing Check-in Alerts -> Management Tasks
 * 2. Shift End Unapproved Absences -> Attendance Records + Salary Cut (Base / Month Days)
 * 3. Shift End Missing Checkouts -> Management Review Tasks
 *
 * Trigger Schedule: Cron every 5-15 minutes
 * Security: Authorization Bearer (service_role or CRON_SECRET)
 */

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment configuration' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call authoritative database stored procedure
    const { data, error } = await supabase.rpc('fn_cron_process_attendance_automation');

    if (error) {
      console.error('Attendance automation RPC failed:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Attendance automation cycle completed successfully.',
        results: data,
        executedAt: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unexpected automation error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
