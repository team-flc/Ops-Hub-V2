import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { handleRequest } from './index.ts';

Deno.test('1. Rejects non-POST HTTP methods with 405 Method Not Allowed', async () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
    const req = new Request('http://localhost/functions/v1/attendance-automation', {
      method
    });
    const res = await handleRequest(req);
    assertEquals(res.status, 405);
    const body = await res.json();
    assertEquals(body.error, 'Method not allowed');
  }
});

Deno.test('2. Rejects request with missing CRON_SECRET with 401', async () => {
  Deno.env.set('CRON_SECRET', 'test_cron_secret_key');
  const req = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST'
  });
  const res = await handleRequest(req);
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, 'Unauthorized');
});

Deno.test('3. Rejects request with incorrect CRON_SECRET with 401', async () => {
  Deno.env.set('CRON_SECRET', 'test_cron_secret_key');
  const req = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer wrong_token_val'
    }
  });
  const res = await handleRequest(req);
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, 'Unauthorized');
});

Deno.test('4. Validates x-cron-secret header and rejects leaked secrets', async () => {
  Deno.env.set('CRON_SECRET', 'test_cron_secret_key');
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'secret_service_key');

  const req = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST',
    headers: {
      'x-cron-secret': 'test_cron_secret_key'
    }
  });
  const res = await handleRequest(req);
  const text = await res.text();
  assertNotEquals(text.includes('test_cron_secret_key'), true);
  assertNotEquals(text.includes('secret_service_key'), true);
});

Deno.test('5. Never exposes secrets or internal errors in responses', async () => {
  Deno.env.set('CRON_SECRET', 'prod_like_secret');
  Deno.env.set('SUPABASE_URL', 'http://invalid-db-host:9999');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service_role_secret_key_123');

  const req = new Request('http://localhost/functions/v1/attendance-automation', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer prod_like_secret'
    }
  });
  const res = await handleRequest(req);
  const body = await res.json();
  assertEquals(res.status >= 400, true);
  assertNotEquals(JSON.stringify(body).includes('service_role_secret_key_123'), true);
});
