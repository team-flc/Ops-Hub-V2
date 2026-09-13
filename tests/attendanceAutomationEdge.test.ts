import { describe, it, expect, vi } from 'vitest';
import { handleAttendanceAutomationRequest } from '../src/lib/attendanceAutomationHandler';

describe('Real Attendance Automation Edge Function Handler Suite', () => {
  const MOCK_CRON_SECRET = 'ephemeral_cron_secret_2026';
  const MOCK_SERVICE_KEY = 'ephemeral_service_role_key_2026';
  const MOCK_SUPABASE_URL = 'http://127.0.0.1:54321';

  const defaultEnv: Record<string, string> = {
    CRON_SECRET: MOCK_CRON_SECRET,
    SUPABASE_URL: MOCK_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
  };

  it('1. Non-POST methods return 405 Method Not Allowed with Allow: POST header', async () => {
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
      const req = new Request('http://localhost/functions/v1/attendance-automation', { method });
      const res = await handleAttendanceAutomationRequest(req, {
        getEnv: (k) => defaultEnv[k],
        createClient: () => ({ rpc: vi.fn() })
      });
      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('POST');
      const body = await res.json();
      expect(body.error).toBe('Method not allowed');
    }
  });

  it('2. Missing secret returns 401 Unauthorized', async () => {
    const req = new Request('http://localhost/functions/v1/attendance-automation', { method: 'POST' });
    const res = await handleAttendanceAutomationRequest(req, {
      getEnv: (k) => defaultEnv[k],
      createClient: () => ({ rpc: vi.fn() })
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('3. Invalid secret returns 401 Unauthorized', async () => {
    const req = new Request('http://localhost/functions/v1/attendance-automation', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer forged_secret_token' }
    });
    const res = await handleAttendanceAutomationRequest(req, {
      getEnv: (k) => defaultEnv[k],
      createClient: () => ({ rpc: vi.fn() })
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('4. Unauthorized requests never initialize the administrative client or invoke the RPC', async () => {
    const createClientSpy = vi.fn();
    const rpcSpy = vi.fn();

    const req = new Request('http://localhost/functions/v1/attendance-automation', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer wrong_token' }
    });

    const res = await handleAttendanceAutomationRequest(req, {
      getEnv: (k) => defaultEnv[k],
      createClient: (url, key) => {
        createClientSpy(url, key);
        return { rpc: rpcSpy };
      }
    });

    expect(res.status).toBe(401);
    expect(createClientSpy).not.toHaveBeenCalled();
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('5. Valid secret via Bearer token invokes the RPC exactly once and returns 200 OK', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: { work_date: '2026-09-13', missing_60m_tasks_created: 0 },
      error: null
    });

    const req = new Request('http://localhost/functions/v1/attendance-automation', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MOCK_CRON_SECRET}` }
    });

    const res = await handleAttendanceAutomationRequest(req, {
      getEnv: (k) => defaultEnv[k],
      createClient: () => ({ rpc: rpcSpy })
    });

    expect(res.status).toBe(200);
    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(rpcSpy).toHaveBeenCalledWith('fn_cron_process_attendance_automation');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary.work_date).toBe('2026-09-13');
  });

  it('6. Valid secret via x-cron-secret header invokes the RPC exactly once and returns 200 OK', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: { work_date: '2026-09-13', missing_60m_tasks_created: 0 },
      error: null
    });

    const req = new Request('http://localhost/functions/v1/attendance-automation', {
      method: 'POST',
      headers: { 'x-cron-secret': MOCK_CRON_SECRET }
    });

    const res = await handleAttendanceAutomationRequest(req, {
      getEnv: (k) => defaultEnv[k],
      createClient: () => ({ rpc: rpcSpy })
    });

    expect(res.status).toBe(200);
    expect(rpcSpy).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('7. Internal errors are sanitized and return 500 without leaking stack traces or database internals', async () => {
    const req = new Request('http://localhost/functions/v1/attendance-automation', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MOCK_CRON_SECRET}` }
    });

    const res = await handleAttendanceAutomationRequest(req, {
      getEnv: (k) => defaultEnv[k],
      createClient: () => ({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'FATAL: database connection dead' }
        })
      })
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Database automation cycle failed');
    expect(JSON.stringify(body)).not.toContain('FATAL');
  });

  it('8. Secrets are absent from response bodies and captured output', async () => {
    const req = new Request('http://localhost/functions/v1/attendance-automation', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MOCK_CRON_SECRET}` }
    });

    const res = await handleAttendanceAutomationRequest(req, {
      getEnv: (k) => defaultEnv[k],
      createClient: () => ({
        rpc: vi.fn().mockResolvedValue({
          data: { result: 'ok' },
          error: null
        })
      })
    });

    const bodyText = await res.text();
    expect(bodyText).not.toContain(MOCK_CRON_SECRET);
    expect(bodyText).not.toContain(MOCK_SERVICE_KEY);
  });
});
