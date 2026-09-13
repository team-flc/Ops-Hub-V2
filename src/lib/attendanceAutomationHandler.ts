/**
 * Shared Attendance Automation Edge Function Handler
 * Location: src/lib/attendanceAutomationHandler.ts
 *
 * Authoritative business & security logic for cron background processing.
 * Tested identically by Deno test runner and Vitest suite.
 */

export interface AttendanceAutomationDependencies {
  getEnv: (key: string) => string | undefined;
  createClient: (url: string, key: string) => {
    rpc: (fnName: string, ...args: any[]) => any;
  } | any;
}

export async function handleAttendanceAutomationRequest(
  req: Request,
  deps: AttendanceAutomationDependencies
): Promise<Response> {
  // 1. Strictly accept only POST requests (Reject GET, PUT, DELETE, OPTIONS, PATCH)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST' } }
    );
  }

  // 2. Validate CRON_SECRET before client initialization
  const expectedSecret = deps.getEnv('CRON_SECRET');
  if (!expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: server configuration missing' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
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
    const supabaseUrl = deps.getEnv('SUPABASE_URL');
    const supabaseServiceKey = deps.getEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Service configuration unavailable' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Initialize client and invoke authoritative RPC
    const supabase = deps.createClient(supabaseUrl, supabaseServiceKey);
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
}
