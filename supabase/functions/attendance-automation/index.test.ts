import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { handleRequest } from './index.ts';

const MOCK_CRON_SECRET = 'ephemeral_cron_secret_2026';
const MOCK_SERVICE_KEY = 'ephemeral_service_role_key_2026';
const MOCK_SUPABASE_URL = 'http://127.0.0.1:54321';

Deno.test('1. Non-POST methods return 405 Method Not Allowed with Allow: POST header', async () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
    const req = new Request('http://localhost/functions/v1/attendance-automation', {
      method
    });
    const res = await handleRequest(req);
    assertEquals(res.status, 405);
    assertEquals(res.headers.get('Allow'), 'POST');
    const body = await res.json();
    assertEquals(body.error, 'Method not allowed');
  }
});

Deno.test('2. Missing or invalid secret returns 401 Unauthorized', async () => {
  const envMap: Record<string, string> = {
    CRON_SECRET: MOCK_CRON_SECRET,
    SUPABASE_URL: MOCK_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
  };

  // Missing secret header
  const reqNoSecret = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST'
  });
  const resNoSecret = await handleRequest(reqNoSecret, { getEnv: (k) => envMap[k] });
  assertEquals(resNoSecret.status, 401);

  // Forged/invalid secret header
  const reqInvalid = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer forged_token_123' }
  });
  const resInvalid = await handleRequest(reqInvalid, { getEnv: (k) => envMap[k] });
  assertEquals(resInvalid.status, 401);
});

Deno.test('3. Unauthorized requests never initialize the administrative client or invoke the RPC', async () => {
  let clientInitialized = false;
  let rpcCalled = false;

  const req = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer invalid_secret' }
  });

  const res = await handleRequest(req, {
    getEnv: (k) => (k === 'CRON_SECRET' ? MOCK_CRON_SECRET : undefined),
    createClient: () => {
      clientInitialized = true;
      return {
        rpc: async () => {
          rpcCalled = true;
          return { data: null, error: null };
        }
      };
    }
  });

  assertEquals(res.status, 401);
  assertEquals(clientInitialized, false);
  assertEquals(rpcCalled, false);
});

Deno.test('4. Valid secret invokes the RPC exactly once and returns 200 OK', async () => {
  let rpcCallCount = 0;

  const envMap: Record<string, string> = {
    CRON_SECRET: MOCK_CRON_SECRET,
    SUPABASE_URL: MOCK_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
  };

  const req = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MOCK_CRON_SECRET}` }
  });

  const res = await handleRequest(req, {
    getEnv: (k) => envMap[k],
    createClient: () => ({
      rpc: async (fnName: string) => {
        assertEquals(fnName, 'fn_cron_process_attendance_automation');
        rpcCallCount++;
        return {
          data: { work_date: '2026-09-13', missing_60m_tasks_created: 0 },
          error: null
        };
      }
    })
  });

  assertEquals(res.status, 200);
  assertEquals(rpcCallCount, 1);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.summary.work_date, '2026-09-13');
});

Deno.test('5. Internal errors are sanitized and secrets are absent from responses', async () => {
  const envMap: Record<string, string> = {
    CRON_SECRET: MOCK_CRON_SECRET,
    SUPABASE_URL: MOCK_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
  };

  const req = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST',
    headers: { 'x-cron-secret': MOCK_CRON_SECRET }
  });

  const res = await handleRequest(req, {
    getEnv: (k) => envMap[k],
    createClient: () => ({
      rpc: async () => ({
        data: null,
        error: { message: 'Database connection refused at internal_host:5432' }
      })
    })
  });

  assertEquals(res.status, 500);
  const bodyText = await res.text();
  assertNotEquals(bodyText.includes(MOCK_CRON_SECRET), true);
  assertNotEquals(bodyText.includes(MOCK_SERVICE_KEY), true);
  assertNotEquals(bodyText.includes('internal_host:5432'), true);
});
