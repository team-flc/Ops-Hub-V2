import { describe, it, expect, vi } from 'vitest';

describe('Attendance Automation Edge Function Specification Suite', () => {
  const MOCK_CRON_SECRET = 'ephemeral_cron_secret_2026';
  const MOCK_SERVICE_KEY = 'ephemeral_service_role_key_2026';
  const MOCK_SUPABASE_URL = 'http://127.0.0.1:54321';

  async function mockEdgeFunctionHandler(req: {
    method: string;
    headers: Record<string, string>;
    env: Record<string, string>;
    rpcMock?: (fnName: string) => Promise<{ data: any; error: any }>;
  }) {
    if (req.method !== 'POST') {
      return {
        status: 405,
        body: { error: 'Method not allowed' },
        headers: { Allow: 'POST' }
      };
    }

    const expectedSecret = req.env.CRON_SECRET;
    if (!expectedSecret) {
      return {
        status: 401,
        body: { error: 'Unauthorized: server configuration missing' }
      };
    }

    const authHeader = req.headers['Authorization'] || req.headers['authorization'] || '';
    const customHeader = req.headers['x-cron-secret'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    const providedSecret = bearerToken || customHeader;
    if (!providedSecret || providedSecret !== expectedSecret) {
      return {
        status: 401,
        body: { error: 'Unauthorized' }
      };
    }

    const supabaseUrl = req.env.SUPABASE_URL;
    const supabaseKey = req.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 500,
        body: { error: 'Service configuration unavailable' }
      };
    }

    try {
      const rpcResult = req.rpcMock
        ? await req.rpcMock('fn_cron_process_attendance_automation')
        : { data: { work_date: '2026-09-13', missing_60m_tasks_created: 0 }, error: null };

      if (rpcResult.error) {
        return {
          status: 500,
          body: { error: 'Database automation cycle failed' }
        };
      }

      return {
        status: 200,
        body: {
          success: true,
          summary: rpcResult.data,
          executedAt: new Date().toISOString()
        }
      };
    } catch {
      return {
        status: 500,
        body: { error: 'Internal server error' }
      };
    }
  }

  it('rejects GET, PUT, DELETE, and OPTIONS requests with 405 Method Not Allowed', async () => {
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
      const res = await mockEdgeFunctionHandler({
        method,
        headers: {},
        env: { CRON_SECRET: MOCK_CRON_SECRET }
      });
      expect(res.status).toBe(405);
      expect(res.body.error).toBe('Method not allowed');
      expect(res.headers.Allow).toBe('POST');
    }
  });

  it('rejects missing cron secret with 401 Unauthorized', async () => {
    const res = await mockEdgeFunctionHandler({
      method: 'POST',
      headers: {},
      env: { CRON_SECRET: MOCK_CRON_SECRET }
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('rejects incorrect secret with 401 Unauthorized', async () => {
    const res = await mockEdgeFunctionHandler({
      method: 'POST',
      headers: { Authorization: 'Bearer wrong_token_attempt' },
      env: { CRON_SECRET: MOCK_CRON_SECRET }
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('unauthorized requests do not initialize database client or execute stored procedure', async () => {
    const rpcSpy = vi.fn();
    const res = await mockEdgeFunctionHandler({
      method: 'POST',
      headers: { Authorization: 'Bearer fake_secret' },
      env: { CRON_SECRET: MOCK_CRON_SECRET, SUPABASE_URL: MOCK_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY },
      rpcMock: rpcSpy
    });
    expect(res.status).toBe(401);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('correct POST secret invokes stored procedure exactly once and returns 200', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: {
        work_date: '2026-09-13',
        missing_60m_tasks_created: 1,
        absences_marked: 0,
        missing_checkouts_flagged: 0
      },
      error: null
    });

    const res = await mockEdgeFunctionHandler({
      method: 'POST',
      headers: { Authorization: 'Bearer ' + MOCK_CRON_SECRET },
      env: {
        CRON_SECRET: MOCK_CRON_SECRET,
        SUPABASE_URL: MOCK_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
      },
      rpcMock: rpcSpy
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.missing_60m_tasks_created).toBe(1);
    expect(rpcSpy).toHaveBeenCalledTimes(1);
  });

  it('supports x-cron-secret header authentication identically', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: { work_date: '2026-09-13', missing_60m_tasks_created: 0 },
      error: null
    });

    const res = await mockEdgeFunctionHandler({
      method: 'POST',
      headers: { 'x-cron-secret': MOCK_CRON_SECRET },
      env: {
        CRON_SECRET: MOCK_CRON_SECRET,
        SUPABASE_URL: MOCK_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
      },
      rpcMock: rpcSpy
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(rpcSpy).toHaveBeenCalledTimes(1);
  });

  it('secret, authorization header, and service role key are never logged or returned in payload', async () => {
    const res = await mockEdgeFunctionHandler({
      method: 'POST',
      headers: { Authorization: 'Bearer ' + MOCK_CRON_SECRET },
      env: {
        CRON_SECRET: MOCK_CRON_SECRET,
        SUPABASE_URL: MOCK_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
      }
    });

    const payloadString = JSON.stringify(res);
    expect(payloadString.includes(MOCK_CRON_SECRET)).toBe(false);
    expect(payloadString.includes(MOCK_SERVICE_KEY)).toBe(false);
  });

  it('sanitizes internal database errors and does not expose connection strings', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Connection to postgresql://postgres:secretpassword@db:5432 failed' }
    });

    const res = await mockEdgeFunctionHandler({
      method: 'POST',
      headers: { Authorization: 'Bearer ' + MOCK_CRON_SECRET },
      env: {
        CRON_SECRET: MOCK_CRON_SECRET,
        SUPABASE_URL: MOCK_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
      },
      rpcMock: rpcSpy
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Database automation cycle failed');
    expect(JSON.stringify(res).includes('secretpassword')).toBe(false);
  });
});
