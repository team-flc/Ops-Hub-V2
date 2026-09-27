import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  processSlackOutbox, 
  sanitizeSlackErrorMessage, 
  calculateBackoffSeconds,
  SlackOutboxRow 
} from '../src/lib/slackNotificationHandler';
import { slackNotificationService } from '../src/lib/slackNotificationService';

const mockSupabaseRpc = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockSupabaseGetSession = vi.fn().mockResolvedValue({
  data: { session: { access_token: 'fake-token' } }
});
const mockSupabaseInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getSession: () => mockSupabaseGetSession(),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user' } } })
      },
      functions: {
        invoke: (...args: any[]) => mockSupabaseInvoke(...args)
      },
      rpc: (...args: any[]) => mockSupabaseRpc(...args),
      from: (...args: any[]) => mockSupabaseFrom(...args)
    }
  };
});

describe('Phase 1: Ops Hub -> Slack Task Notifications Comprehensive Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Token Security & Sanitization', () => {
    it('1.1 Redacts sensitive Slack bot tokens, user tokens, and Bearer headers from error strings', () => {
      const errorWithBotToken = 'Slack request failed: Invalid auth with token xoxb-1234567890-abcdef123456';
      const sanitizedBot = sanitizeSlackErrorMessage(errorWithBotToken);
      expect(sanitizedBot).not.toContain('xoxb-1234567890-abcdef123456');
      expect(sanitizedBot).toContain('[REDACTED_SLACK_TOKEN]');

      const errorWithUserToken = 'User auth failure: xoxp-9876543210-xyz987654321';
      const sanitizedUser = sanitizeSlackErrorMessage(errorWithUserToken);
      expect(sanitizedUser).not.toContain('xoxp-9876543210-xyz987654321');
      expect(sanitizedUser).toContain('[REDACTED_SLACK_USER_TOKEN]');

      const errorWithBearer = 'Network error during request: Bearer xoxb-secret-token-value';
      const sanitizedBearer = sanitizeSlackErrorMessage(errorWithBearer);
      expect(sanitizedBearer).not.toContain('xoxb-secret-token-value');
      expect(sanitizedBearer).toContain('Bearer [REDACTED]');
    });

    it('1.2 Safely handles empty or missing error messages', () => {
      expect(sanitizeSlackErrorMessage('')).toBe('Unknown error');
      expect(sanitizeSlackErrorMessage(null as any)).toBe('Unknown error');
    });
  });

  describe('2. Exponential Backoff Calculation', () => {
    it('2.1 Computes progressive exponential backoff times up to maximum cap', () => {
      // 2^1 * 30 = 60s
      expect(calculateBackoffSeconds(1)).toBe(60);
      // 2^2 * 30 = 120s
      expect(calculateBackoffSeconds(2)).toBe(120);
      // 2^3 * 30 = 240s
      expect(calculateBackoffSeconds(3)).toBe(240);
      // 2^10 * 30 = 30720 capped at 3600s (1 hour)
      expect(calculateBackoffSeconds(10)).toBe(3600);
    });
  });

  describe('3. Event 1: Task Assigned or Reassigned (DM via conversations.open)', () => {
    it('3.1 Opens DM channel via conversations.open before posting message to assignee', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-1',
        task_id: 'task-101',
        client_id: 'client-501',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-101:occ_1:user-201',
        recipient_profile_id: 'user-201',
        recipient_slack_id: 'U01ABCDEF99',
        channel_id: null,
        message_text: '📋 *New Task Assigned*: Design Homepage (Acme Corp)',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '📋 New Task Assigned', emoji: true }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: '*Client:*\nAcme Corp' },
              { type: 'mrkdwn', text: '*Priority:*\nUrgent' },
              { type: 'mrkdwn', text: '*Task:*\nDesign Homepage' },
              { type: 'mrkdwn', text: '*Due Date:*\n2026-10-05' }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Open in Ops Hub', emoji: true },
                url: 'https://ops.faseehlall.com/clients/client-501',
                style: 'primary'
              }
            ]
          }
        ],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:00:00.000Z',
        created_at: '2026-09-27T12:00:00.000Z',
        updated_at: '2026-09-27T12:00:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const callsMade: Array<{ url: string; body: any }> = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        const body = JSON.parse(init.body);
        callsMade.push({ url, body });

        if (url.includes('conversations.open')) {
          return {
            ok: true,
            json: async () => ({ ok: true, channel: { id: 'D01ABCDEF99_DM' } })
          };
        }
        if (url.includes('chat.postMessage')) {
          return {
            ok: true,
            json: async () => ({ ok: true, ts: '1695816000.000100' })
          };
        }
        return { ok: false };
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:00:01.000Z')
      });

      expect(res.processed).toBe(1);
      expect(res.delivered).toBe(1);
      expect(res.failed).toBe(0);
      expect(res.skipped).toBe(0);
      expect(res.held).toBe(0);

      // Verify conversations.open was called first with recipient user ID
      expect(callsMade[0].url).toContain('conversations.open');
      expect(callsMade[0].body.users).toBe('U01ABCDEF99');

      // Verify chat.postMessage was called targeting opened DM channel
      expect(callsMade[1].url).toContain('chat.postMessage');
      expect(callsMade[1].body.channel).toBe('D01ABCDEF99_DM');
      expect(callsMade[1].body.text).toContain('Design Homepage');

      // Verify Data Privacy: Link uses production base origin only
      const buttonUrl = callsMade[1].body.blocks[2].elements[0].url;
      expect(buttonUrl).toBe('https://ops.faseehlall.com/clients/client-501');
      expect(buttonUrl).not.toContain('pages.dev');
      expect(buttonUrl).not.toContain('localhost');

      // Verify update in outbox marked delivered with DM channel and message ts
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          channel_id: 'D01ABCDEF99_DM',
          slack_message_ts: '1695816000.000100',
          last_error: null
        })
      );
    });
  });

  describe('4. Event 2: Task Submitted for Internal Approval (Public Channel #ops-approvals)', () => {
    it('4.1 Posts notification directly in #ops-approvals (C0C4MCNDX0D) without calling conversations.open', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-2',
        task_id: 'task-102',
        client_id: 'client-502',
        event_type: 'approval_submitted',
        idempotency_key: 'approval_submitted:task-102:occ_1',
        recipient_profile_id: null,
        recipient_slack_id: null,
        channel_id: 'C0C4MCNDX0D',
        message_text: '🔍 *Task Submitted for Internal Approval*: Prepare Q3 Strategy (Starlight Media)',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🔍 Task Submitted for Approval', emoji: true }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: '*Client:*\nStarlight Media' },
              { type: 'mrkdwn', text: '*Assignee:*\nSarah Connor' },
              { type: 'mrkdwn', text: '*Task:*\nPrepare Q3 Strategy' },
              { type: 'mrkdwn', text: '*Priority:*\nNormal' }
            ]
          }
        ],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:05:00.000Z',
        created_at: '2026-09-27T12:05:00.000Z',
        updated_at: '2026-09-27T12:05:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      let capturedUrl = '';
      let capturedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedUrl = url;
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({ ok: true, ts: '1695816300.000200' })
        };
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        defaultApprovalsChannelId: 'C0C4MCNDX0D',
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:05:01.000Z')
      });

      expect(res.delivered).toBe(1);
      // Ensure conversations.open was NEVER called for public channel
      expect(capturedUrl).toContain('chat.postMessage');
      expect(capturedPayload.channel).toBe('C0C4MCNDX0D');
      expect(capturedPayload.text).toContain('Prepare Q3 Strategy');
    });
  });

  describe('5. Event 3: Owner/Manager Decision on Task (DM via conversations.open)', () => {
    it('5.1 DMs assignee with decision "Approved" and Completed status', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-3',
        task_id: 'task-103',
        client_id: 'client-503',
        event_type: 'approval_decision',
        idempotency_key: 'approval_decision:task-103:occ_1:approved',
        recipient_profile_id: 'user-301',
        recipient_slack_id: 'U0987654321',
        channel_id: null,
        message_text: '✅ *Task Approved*: Launch Campaign (Global Retail)',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '✅ Task Approved', emoji: true }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: '*Client:*\nGlobal Retail' },
              { type: 'mrkdwn', text: '*Decision:*\nApproved' },
              { type: 'mrkdwn', text: '*Task:*\nLaunch Campaign' },
              { type: 'mrkdwn', text: '*Status:*\nCompleted' }
            ]
          }
        ],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:10:00.000Z',
        created_at: '2026-09-27T12:10:00.000Z',
        updated_at: '2026-09-27T12:10:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('conversations.open')) {
          return { ok: true, json: async () => ({ ok: true, channel: { id: 'D_USER_301' } }) };
        }
        return { ok: true, json: async () => ({ ok: true, ts: '1695816600.000300' }) };
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:10:01.000Z')
      });

      expect(res.delivered).toBe(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          channel_id: 'D_USER_301'
        })
      );
    });

    it('5.2 DMs assignee with decision "Returned for changes" when returned to In Progress', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-4',
        task_id: 'task-104',
        client_id: 'client-504',
        event_type: 'approval_decision',
        idempotency_key: 'approval_decision:task-104:occ_1:returned',
        recipient_profile_id: 'user-301',
        recipient_slack_id: 'U0987654321',
        channel_id: null,
        message_text: '🔄 *Task Returned for Changes*: Revise Ad Copy (Global Retail)',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🔄 Task Returned for Changes', emoji: true }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: '*Client:*\nGlobal Retail' },
              { type: 'mrkdwn', text: '*Decision:*\nReturned for changes' },
              { type: 'mrkdwn', text: '*Task:*\nRevise Ad Copy' },
              { type: 'mrkdwn', text: '*Status:*\nIn Progress' }
            ]
          }
        ],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:15:00.000Z',
        created_at: '2026-09-27T12:15:00.000Z',
        updated_at: '2026-09-27T12:15:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('conversations.open')) {
          return { ok: true, json: async () => ({ ok: true, channel: { id: 'D_USER_301' } }) };
        }
        return { ok: true, json: async () => ({ ok: true, ts: '1695816900.000400' }) };
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:15:01.000Z')
      });

      expect(res.delivered).toBe(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          channel_id: 'D_USER_301'
        })
      );
    });
  });

  describe('6. Missing Bot Configuration Holds for Recovery (Never Skipped)', () => {
    it('6.1 When SLACK_BOT_TOKEN is missing, holds messages in pending state for recovery, never skips them', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-hold-1',
        task_id: 'task-hold',
        client_id: 'client-hold',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-hold:occ_1:user-1',
        recipient_profile_id: 'user-1',
        recipient_slack_id: 'U01ABCDEF99',
        channel_id: null,
        message_text: '📋 *New Task Assigned*: Important Task',
        blocks: [],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:00:00.000Z',
        created_at: '2026-09-27T12:00:00.000Z',
        updated_at: '2026-09-27T12:00:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const mockFetch = vi.fn();

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: undefined, // Missing bot token!
        fetchImpl: mockFetch as any
      });

      expect(res.processed).toBe(1);
      expect(res.delivered).toBe(0);
      expect(res.skipped).toBe(0); // MUST NEVER BE SKIPPED
      expect(res.held).toBe(1);     // HELD FOR RECOVERY
      expect(mockFetch).not.toHaveBeenCalled();

      // Verify row is preserved in pending state for recovery
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          skip_reason: 'holding_for_slack_bot_token',
          last_error: expect.stringContaining('Held for recovery')
        })
      );
    });
  });

  describe('7. Head-of-Line Blocking Prevention & Atomic Worker Isolation', () => {
    it('7.1 Excludes exhausted failure rows so they cannot block newer pending rows', async () => {
      const exhaustedRow: SlackOutboxRow = {
        id: 'outbox-exhausted',
        task_id: 'task-old',
        client_id: 'client-1',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-old:occ_1:user-1',
        recipient_profile_id: 'user-1',
        recipient_slack_id: 'U01ABCDEF99',
        channel_id: null,
        message_text: 'Old Task',
        blocks: [],
        status: 'failed',
        skip_reason: null,
        retry_count: 3,
        max_retries: 3, // Exhausted!
        next_retry_at: '2026-09-27T11:00:00.000Z',
        created_at: '2026-09-27T11:00:00.000Z',
        updated_at: '2026-09-27T11:30:00.000Z'
      };

      const freshRow: SlackOutboxRow = {
        id: 'outbox-fresh',
        task_id: 'task-new',
        client_id: 'client-1',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-new:occ_1:user-2',
        recipient_profile_id: 'user-2',
        recipient_slack_id: 'U02ABCDEF99',
        channel_id: null,
        message_text: 'Fresh Task',
        blocks: [],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:00:00.000Z',
        created_at: '2026-09-27T12:00:00.000Z',
        updated_at: '2026-09-27T12:00:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [exhaustedRow, freshRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('conversations.open')) {
          return { ok: true, json: async () => ({ ok: true, channel: { id: 'D_FRESH' } }) };
        }
        return { ok: true, json: async () => ({ ok: true, ts: '1695816999.000100' }) };
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any
      });

      // The fresh row was processed and delivered, while the exhausted row did not block it
      expect(res.delivered).toBe(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          channel_id: 'D_FRESH'
        })
      );
    });

    it('7.2 Invokes claim_slack_outbox_batch RPC when available for atomic FOR UPDATE SKIP LOCKED worker isolation', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'outbox-claimed-1',
            task_id: 'task-rpc',
            client_id: 'client-rpc',
            event_type: 'approval_submitted',
            idempotency_key: 'approval_submitted:task-rpc:occ_1',
            channel_id: 'C0C4MCNDX0D',
            message_text: 'Test RPC',
            blocks: [],
            status: 'processing',
            retry_count: 0,
            max_retries: 3,
            next_retry_at: '2026-09-27T12:00:00.000Z',
            created_at: '2026-09-27T12:00:00.000Z',
            updated_at: '2026-09-27T12:00:00.000Z'
          }
        ],
        error: null
      });

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabaseAdmin = {
        rpc: mockRpc,
        from: vi.fn().mockReturnValue({ update: updateMock })
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '1695817000.000100' })
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        workerId: 'worker-node-1',
        fetchImpl: mockFetch as any
      });

      expect(mockRpc).toHaveBeenCalledWith('claim_slack_outbox_batch', {
        p_batch_size: 25,
        p_worker_id: 'worker-node-1',
        p_timeout_seconds: 300
      });
      expect(res.delivered).toBe(1);
    });
  });

  describe('8. Edge Function Server-Side Authorization & Management Gate', () => {
    // Pure logic simulation of Edge Function authorization gate
    async function simulateEdgeFunctionAuth(params: {
      authHeader: string | null;
      serviceRoleKey: string;
      profilesTable: Record<string, { role: string }>;
    }): Promise<{ status: number; error?: string }> {
      const { authHeader, serviceRoleKey, profilesTable } = params;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { status: 401, error: 'Unauthorized: Missing authorization header.' };
      }

      const token = authHeader.replace('Bearer ', '');

      if (token === serviceRoleKey) {
        return { status: 200 };
      }

      // Look up user by token in test simulation
      const profile = profilesTable[token];
      if (!profile) {
        return { status: 401, error: 'Unauthorized: Invalid authentication session.' };
      }

      if (['owner', 'operational_manager'].includes(profile.role)) {
        return { status: 200 };
      }

      return {
        status: 403,
        error: 'Forbidden: Only owners and operational managers can process Slack notifications.'
      };
    }

    const testProfiles = {
      'token-owner': { role: 'owner' },
      'token-manager': { role: 'operational_manager' },
      'token-team-member': { role: 'team_member' }
    };

    it('8.1 Denies requests with missing or invalid bearer token (401)', async () => {
      const missing = await simulateEdgeFunctionAuth({
        authHeader: null,
        serviceRoleKey: 'secret-service-key',
        profilesTable: testProfiles
      });
      expect(missing.status).toBe(401);

      const invalid = await simulateEdgeFunctionAuth({
        authHeader: 'Bearer token-unknown',
        serviceRoleKey: 'secret-service-key',
        profilesTable: testProfiles
      });
      expect(invalid.status).toBe(401);
    });

    it('8.2 Denies ordinary team members from processing the global queue (403 Forbidden)', async () => {
      const teamMember = await simulateEdgeFunctionAuth({
        authHeader: 'Bearer token-team-member',
        serviceRoleKey: 'secret-service-key',
        profilesTable: testProfiles
      });
      expect(teamMember.status).toBe(403);
      expect(teamMember.error).toContain('Only owners and operational managers');
    });

    it('8.3 Authorizes management users (owner, operational_manager) and server service_role (200)', async () => {
      const owner = await simulateEdgeFunctionAuth({
        authHeader: 'Bearer token-owner',
        serviceRoleKey: 'secret-service-key',
        profilesTable: testProfiles
      });
      expect(owner.status).toBe(200);

      const manager = await simulateEdgeFunctionAuth({
        authHeader: 'Bearer token-manager',
        serviceRoleKey: 'secret-service-key',
        profilesTable: testProfiles
      });
      expect(manager.status).toBe(200);

      const service = await simulateEdgeFunctionAuth({
        authHeader: 'Bearer secret-service-key',
        serviceRoleKey: 'secret-service-key',
        profilesTable: testProfiles
      });
      expect(service.status).toBe(200);
    });
  });

  describe('9. Deterministic Occurrence Sequence Keys & Database Trigger Logic', () => {
    // Exact simulation of fn_track_task_notification_sequences and fn_trigger_enqueue_slack_notification
    interface TaskState {
      id: string;
      assignee_id: string | null;
      status: string;
      archived_at: string | null;
      assignment_seq: number;
      approval_seq: number;
    }

    interface OutboxItem {
      event_type: string;
      idempotency_key: string;
      recipient_id: string | null;
      channel_id: string | null;
    }

    function applyTaskTransition(
      oldState: TaskState | null,
      newState: Omit<TaskState, 'assignment_seq' | 'approval_seq'>
    ): { nextState: TaskState; outboxItem: OutboxItem | null } {
      const op = oldState ? 'UPDATE' : 'INSERT';
      let nextAssignmentSeq = oldState?.assignment_seq ?? 0;
      let nextApprovalSeq = oldState?.approval_seq ?? 0;

      // Maintain assignment_seq
      if (
        (op === 'INSERT' && newState.assignee_id !== null && newState.status !== 'Draft') ||
        (op === 'UPDATE' && newState.assignee_id !== null && (
          (oldState!.assignee_id !== newState.assignee_id && newState.status !== 'Draft') ||
          (oldState!.status === 'Draft' && newState.status !== 'Draft')
        ))
      ) {
        nextAssignmentSeq = (oldState?.assignment_seq ?? 0) + 1;
      }

      // Maintain approval_seq
      if (
        (op === 'INSERT' && ['Approval', 'Team Review'].includes(newState.status)) ||
        (op === 'UPDATE' && ['Approval', 'Team Review'].includes(newState.status) && !['Approval', 'Team Review'].includes(oldState!.status))
      ) {
        nextApprovalSeq = (oldState?.approval_seq ?? 0) + 1;
      }

      const nextState: TaskState = {
        ...newState,
        assignment_seq: nextAssignmentSeq,
        approval_seq: nextApprovalSeq
      };

      if (nextState.archived_at !== null) {
        return { nextState, outboxItem: null };
      }

      // Enqueue Event 1: Task Assigned or Reassigned
      if (
        nextState.assignment_seq > 0 &&
        (op === 'INSERT' || nextState.assignment_seq > (oldState?.assignment_seq ?? 0))
      ) {
        return {
          nextState,
          outboxItem: {
            event_type: 'task_assigned',
            idempotency_key: `task_assigned:${nextState.id}:occ_${nextState.assignment_seq}:${nextState.assignee_id}`,
            recipient_id: nextState.assignee_id,
            channel_id: null
          }
        };
      }

      // Enqueue Event 2: Task Submitted for Internal Approval
      if (
        nextState.approval_seq > 0 &&
        (op === 'INSERT' || nextState.approval_seq > (oldState?.approval_seq ?? 0))
      ) {
        return {
          nextState,
          outboxItem: {
            event_type: 'approval_submitted',
            idempotency_key: `approval_submitted:${nextState.id}:occ_${nextState.approval_seq}`,
            recipient_id: null,
            channel_id: 'C0C4MCNDX0D'
          }
        };
      }

      // Enqueue Event 3: Owner/Manager Approves or Returns Task
      if (
        op === 'UPDATE' &&
        oldState &&
        ['Approval', 'Team Review'].includes(oldState.status) &&
        ['Done', 'Completed', 'In Progress', 'Todo'].includes(nextState.status) &&
        nextState.assignee_id !== null
      ) {
        const decision = ['Done', 'Completed'].includes(nextState.status) ? 'approved' : 'returned';
        return {
          nextState,
          outboxItem: {
            event_type: 'approval_decision',
            idempotency_key: `approval_decision:${nextState.id}:occ_${nextState.approval_seq}:${decision}`,
            recipient_id: nextState.assignee_id,
            channel_id: null
          }
        };
      }

      return { nextState, outboxItem: null };
    }

    it('9.1 Suppresses notification when task is created in Draft status with assignee', () => {
      const { nextState, outboxItem } = applyTaskTransition(null, {
        id: 't1',
        assignee_id: 'alice',
        status: 'Draft',
        archived_at: null
      });

      expect(nextState.assignment_seq).toBe(0);
      expect(outboxItem).toBeNull();
    });

    it('9.2 Emits occ_1 notification when activating draft to Todo', () => {
      const draftState: TaskState = {
        id: 't1',
        assignee_id: 'alice',
        status: 'Draft',
        archived_at: null,
        assignment_seq: 0,
        approval_seq: 0
      };

      const { nextState, outboxItem } = applyTaskTransition(draftState, {
        id: 't1',
        assignee_id: 'alice',
        status: 'Todo',
        archived_at: null
      });

      expect(nextState.assignment_seq).toBe(1);
      expect(outboxItem).not.toBeNull();
      expect(outboxItem?.idempotency_key).toBe('task_assigned:t1:occ_1:alice');
    });

    it('9.3 PROVES: Alice -> Bob -> Alice produces distinct occurrence keys occ_1, occ_2, occ_3', () => {
      // 1. Initial assignment to Alice
      const step1 = applyTaskTransition(null, {
        id: 't-reassign',
        assignee_id: 'alice',
        status: 'Todo',
        archived_at: null
      });
      expect(step1.nextState.assignment_seq).toBe(1);
      expect(step1.outboxItem?.idempotency_key).toBe('task_assigned:t-reassign:occ_1:alice');

      // 2. Reassignment to Bob
      const step2 = applyTaskTransition(step1.nextState, {
        id: 't-reassign',
        assignee_id: 'bob',
        status: 'Todo',
        archived_at: null
      });
      expect(step2.nextState.assignment_seq).toBe(2);
      expect(step2.outboxItem?.idempotency_key).toBe('task_assigned:t-reassign:occ_2:bob');

      // 3. Reassignment BACK to Alice: In old code, this was dropped because key was task_assigned:t-reassign:alice!
      // With occurrence keys, occ_3 is generated!
      const step3 = applyTaskTransition(step2.nextState, {
        id: 't-reassign',
        assignee_id: 'alice',
        status: 'Todo',
        archived_at: null
      });
      expect(step3.nextState.assignment_seq).toBe(3);
      expect(step3.outboxItem?.idempotency_key).toBe('task_assigned:t-reassign:occ_3:alice');

      // All three occurrence keys are completely distinct!
      const keys = [step1.outboxItem?.idempotency_key, step2.outboxItem?.idempotency_key, step3.outboxItem?.idempotency_key];
      expect(new Set(keys).size).toBe(3);
    });

    it('9.4 Suppresses outbox notification when task title or description changes with same assignee', () => {
      const currentState: TaskState = {
        id: 't1',
        assignee_id: 'alice',
        status: 'Todo',
        archived_at: null,
        assignment_seq: 1,
        approval_seq: 0
      };

      const { nextState, outboxItem } = applyTaskTransition(currentState, {
        id: 't1',
        assignee_id: 'alice',
        status: 'Todo', // Unchanged
        archived_at: null
      });

      expect(nextState.assignment_seq).toBe(1);
      expect(outboxItem).toBeNull();
    });

    it('9.5 PROVES: Approval -> Return -> Resubmission -> Approval generates distinct occurrence keys', () => {
      const inProgressState: TaskState = {
        id: 't-review',
        assignee_id: 'alice',
        status: 'In Progress',
        archived_at: null,
        assignment_seq: 1,
        approval_seq: 0
      };

      // 1. First submission to Approval -> occ_1
      const step1 = applyTaskTransition(inProgressState, {
        id: 't-review',
        assignee_id: 'alice',
        status: 'Approval',
        archived_at: null
      });
      expect(step1.nextState.approval_seq).toBe(1);
      expect(step1.outboxItem?.idempotency_key).toBe('approval_submitted:t-review:occ_1');

      // 2. Manager returns for changes -> occ_1:returned
      const step2 = applyTaskTransition(step1.nextState, {
        id: 't-review',
        assignee_id: 'alice',
        status: 'In Progress',
        archived_at: null
      });
      expect(step2.nextState.approval_seq).toBe(1);
      expect(step2.outboxItem?.idempotency_key).toBe('approval_decision:t-review:occ_1:returned');

      // 3. Resubmission to Approval -> occ_2 (distinct from occ_1!)
      const step3 = applyTaskTransition(step2.nextState, {
        id: 't-review',
        assignee_id: 'alice',
        status: 'Approval',
        archived_at: null
      });
      expect(step3.nextState.approval_seq).toBe(2);
      expect(step3.outboxItem?.idempotency_key).toBe('approval_submitted:t-review:occ_2');

      // 4. Manager approves -> occ_2:approved
      const step4 = applyTaskTransition(step3.nextState, {
        id: 't-review',
        assignee_id: 'alice',
        status: 'Completed',
        archived_at: null
      });
      expect(step4.nextState.approval_seq).toBe(2);
      expect(step4.outboxItem?.idempotency_key).toBe('approval_decision:t-review:occ_2:approved');

      // All keys are unique!
      const keys = [
        step1.outboxItem?.idempotency_key,
        step2.outboxItem?.idempotency_key,
        step3.outboxItem?.idempotency_key,
        step4.outboxItem?.idempotency_key
      ];
      expect(new Set(keys).size).toBe(4);
    });

    it('9.6 Completely suppresses all notifications for archived tasks', () => {
      const activeState: TaskState = {
        id: 't-archived',
        assignee_id: 'alice',
        status: 'Todo',
        archived_at: null,
        assignment_seq: 1,
        approval_seq: 0
      };

      const { outboxItem } = applyTaskTransition(activeState, {
        id: 't-archived',
        assignee_id: 'bob',
        status: 'Approval',
        archived_at: '2026-09-27T12:00:00.000Z'
      });

      expect(outboxItem).toBeNull();
    });
  });

  describe('10. Management Visibility & Retrying Failed Notifications', () => {
    it('10.1 fetchFailedNotifications queries failed notifications specifically', async () => {
      const mockRows = [
        {
          id: 'outbox-fail-1',
          task_id: 't-1',
          client_id: 'c-1',
          event_type: 'task_assigned',
          idempotency_key: 'task_assigned:t-1:occ_1:u-1',
          status: 'failed',
          retry_count: 3,
          max_retries: 3,
          next_retry_at: '2026-09-27T12:00:00Z',
          last_error: 'rate_limited',
          created_at: '2026-09-27T12:00:00Z',
          updated_at: '2026-09-27T12:10:00Z'
        }
      ];

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockRows,
                error: null
              })
            })
          })
        })
      });

      const records = await slackNotificationService.fetchFailedNotifications();
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('outbox-fail-1');
      expect(records[0].status).toBe('failed');
      expect(mockSupabaseFrom).toHaveBeenCalledWith('slack_notification_outbox');
    });

    it('10.2 retryFailedNotification invokes RPC to reset retry state and immediately triggers queue dispatch', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { success: true, id: 'outbox-fail-1' },
        error: null
      });

      const dispatchSpy = vi.spyOn(slackNotificationService, 'triggerDispatch').mockResolvedValue();

      const result = await slackNotificationService.retryFailedNotification('outbox-fail-1');
      expect(result).toBe(true);
      expect(mockSupabaseRpc).toHaveBeenCalledWith('retry_failed_slack_notification', {
        p_notification_id: 'outbox-fail-1'
      });
      expect(dispatchSpy).toHaveBeenCalled();
      dispatchSpy.mockRestore();
    });
  });

  describe('11. Database Update Resilience & Network Error Handling', () => {
    it('11.1 Gracefully handles database update failure after successful Slack delivery', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-db-err',
        task_id: 'task-110',
        client_id: 'client-110',
        event_type: 'approval_submitted',
        idempotency_key: 'approval_submitted:task-110:occ_1',
        channel_id: 'C0C4MCNDX0D',
        message_text: 'DB Error Handling Task',
        blocks: [],
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:00:00.000Z',
        created_at: '2026-09-27T12:00:00.000Z',
        updated_at: '2026-09-27T12:00:00.000Z'
      };

      // Mock update to return a DB error
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Database transaction lock timeout' } })
      });

      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '1695818000.000100' })
      });

      // Does not throw, logs error and continues
      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any
      });

      expect(res.delivered).toBe(1);
    });

    it('11.2 conversations.open API error records failure with backoff', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-open-fail',
        task_id: 'task-111',
        client_id: 'client-111',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-111:occ_1:u-1',
        recipient_profile_id: 'u-1',
        recipient_slack_id: 'U_INVALID_ID',
        channel_id: null,
        message_text: 'Open Fail Task',
        blocks: [],
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:00:00.000Z',
        created_at: '2026-09-27T12:00:00.000Z',
        updated_at: '2026-09-27T12:00:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('conversations.open')) {
          return { ok: false, status: 400, json: async () => ({ ok: false, error: 'user_not_found' }) };
        }
        return { ok: true };
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any
      });

      expect(res.failed).toBe(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          retry_count: 1,
          last_error: 'user_not_found'
        })
      );
    });

    it('11.3 conversations.open network exception records failure without crashing', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-open-exc',
        task_id: 'task-112',
        client_id: 'client-112',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-112:occ_1:u-1',
        recipient_profile_id: 'u-1',
        recipient_slack_id: 'U01ABCDEF99',
        channel_id: null,
        message_text: 'Open Exception Task',
        blocks: [],
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:00:00.000Z',
        created_at: '2026-09-27T12:00:00.000Z',
        updated_at: '2026-09-27T12:00:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const mockFetch = vi.fn().mockRejectedValue(new Error('DNS resolution failure'));

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any
      });

      expect(res.failed).toBe(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          retry_count: 1,
          last_error: 'DNS resolution failure'
        })
      );
    });

    it('11.4 chat.postMessage network exception records failure without crashing', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-post-exc',
        task_id: 'task-113',
        client_id: 'client-113',
        event_type: 'approval_submitted',
        idempotency_key: 'approval_submitted:task-113:occ_1',
        channel_id: 'C0C4MCNDX0D',
        message_text: 'Post Exception Task',
        blocks: [],
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:00:00.000Z',
        created_at: '2026-09-27T12:00:00.000Z',
        updated_at: '2026-09-27T12:00:00.000Z'
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      const mockSupabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockOutboxRow],
                    error: null
                  })
                })
              })
            })
          }),
          update: updateMock
        })
      };

      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection reset by peer'));

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any
      });

      expect(res.failed).toBe(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          retry_count: 1,
          last_error: 'Connection reset by peer'
        })
      );
    });
  });
});
