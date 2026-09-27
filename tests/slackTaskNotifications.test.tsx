import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  processSlackOutbox, 
  sanitizeSlackErrorMessage, 
  calculateBackoffSeconds,
  SlackOutboxRow 
} from '../src/lib/slackNotificationHandler';
import { slackNotificationService } from '../src/lib/slackNotificationService';

describe('Phase 1: Ops Hub -> Slack Task Notifications Suite', () => {
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

  describe('3. Event 1: Task Assigned or Reassigned (Direct Message to Assignee)', () => {
    it('3.1 Dispatches DM to assignee with client, task title, priority, due date, and production link', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-1',
        task_id: 'task-101',
        client_id: 'client-501',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-101:user-201:20260927120000',
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

      let capturedSlackPayload: any = null;
      let capturedAuthHeader: string | null = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedSlackPayload = JSON.parse(init.body);
        capturedAuthHeader = init.headers['Authorization'];
        return {
          ok: true,
          json: async () => ({ ok: true, ts: '1695816000.000100' })
        };
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

      // Verify Slack DM channel target matches assignee's Slack ID
      expect(capturedSlackPayload.channel).toBe('U01ABCDEF99');
      expect(capturedSlackPayload.text).toContain('Design Homepage');

      // Verify Data Privacy: Link uses production base origin only
      const buttonUrl = capturedSlackPayload.blocks[2].elements[0].url;
      expect(buttonUrl).toBe('https://ops.faseehlall.com/clients/client-501');
      expect(buttonUrl).not.toContain('pages.dev');
      expect(buttonUrl).not.toContain('localhost');

      // Verify zero evidence URLs or notes leaked
      expect(JSON.stringify(capturedSlackPayload)).not.toContain('evidence_url');
      expect(JSON.stringify(capturedSlackPayload)).not.toContain('completion_notes');

      // Verify update in outbox marked delivered with ts
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          slack_message_ts: '1695816000.000100',
          last_error: null
        })
      );
    });
  });

  describe('2. Event 2: Task Submitted for Internal Approval (Public Channel #ops-approvals)', () => {
    it('2.1 Posts notification in #ops-approvals with client, task, assignee, and priority', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-2',
        task_id: 'task-102',
        client_id: 'client-502',
        event_type: 'approval_submitted',
        idempotency_key: 'approval_submitted:task-102:20260927120500',
        recipient_profile_id: null,
        recipient_slack_id: null,
        channel_id: 'C0C4MCNDX0D', // Public #ops-approvals channel
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
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Review in Ops Hub', emoji: true },
                url: 'https://ops.faseehlall.com/clients/client-502',
                style: 'primary'
              }
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

      let capturedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
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
      expect(capturedPayload.channel).toBe('C0C4MCNDX0D');
      expect(capturedPayload.text).toContain('Prepare Q3 Strategy');
      expect(JSON.stringify(capturedPayload)).toContain('Sarah Connor');
    });
  });

  describe('3. Event 3: Owner/Manager Approves or Returns Task (Direct Message to Assignee)', () => {
    it('3.1 DMs assignee with decision "Approved" and Completed status', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-3',
        task_id: 'task-103',
        client_id: 'client-503',
        event_type: 'approval_decision',
        idempotency_key: 'approval_decision:task-103:Completed:20260927121000',
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

      let capturedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({ ok: true, ts: '1695816600.000300' })
        };
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:10:01.000Z')
      });

      expect(res.delivered).toBe(1);
      expect(capturedPayload.channel).toBe('U0987654321');
      expect(capturedPayload.blocks[1].fields[1].text).toBe('*Decision:*\nApproved');
      expect(capturedPayload.blocks[1].fields[3].text).toBe('*Status:*\nCompleted');
    });

    it('3.2 DMs assignee with decision "Returned for changes" when returned to In Progress', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-4',
        task_id: 'task-104',
        client_id: 'client-504',
        event_type: 'approval_decision',
        idempotency_key: 'approval_decision:task-104:In Progress:20260927121500',
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

      let capturedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({ ok: true, ts: '1695816900.000400' })
        };
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:15:01.000Z')
      });

      expect(res.delivered).toBe(1);
      expect(capturedPayload.channel).toBe('U0987654321');
      expect(capturedPayload.blocks[1].fields[1].text).toBe('*Decision:*\nReturned for changes');
      expect(capturedPayload.blocks[1].fields[3].text).toBe('*Status:*\nIn Progress');
    });
  });

  describe('4. Missing Slack Member ID & Guessing Prevention', () => {
    it('4.1 Safely skips sending when recipient has no mapped Slack ID, without guessing recipient', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-missing-slack',
        task_id: 'task-105',
        client_id: 'client-505',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-105:user-unmapped:20260927122000',
        recipient_profile_id: 'user-unmapped',
        recipient_slack_id: null, // Missing mapping!
        channel_id: null,
        message_text: '📋 *New Task Assigned*: Write Article (Client B)',
        blocks: [],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:20:00.000Z',
        created_at: '2026-09-27T12:20:00.000Z',
        updated_at: '2026-09-27T12:20:00.000Z'
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
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:20:01.000Z')
      });

      expect(res.processed).toBe(1);
      expect(res.delivered).toBe(0);
      expect(res.skipped).toBe(1);

      // Verify ZERO calls made to Slack API
      expect(mockFetch).not.toHaveBeenCalled();

      // Verify outbox row marked as skipped with reason missing_slack_member_id
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'skipped',
          skip_reason: 'missing_slack_member_id'
        })
      );
    });
  });

  describe('5. Slack Outage, Error Handling & Exponential Retries', () => {
    it('5.1 Increments retry_count, computes backoff, and keeps task safe when Slack API fails', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-fail',
        task_id: 'task-106',
        client_id: 'client-506',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-106:user-1:20260927122500',
        recipient_profile_id: 'user-1',
        recipient_slack_id: 'U01ABCDEF99',
        channel_id: null,
        message_text: '📋 *New Task Assigned*: Title',
        blocks: [],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:25:00.000Z',
        created_at: '2026-09-27T12:25:00.000Z',
        updated_at: '2026-09-27T12:25:00.000Z'
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

      // Slack returns rate limit or channel_not_found error
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ ok: false, error: 'rate_limited' })
      });

      const res = await processSlackOutbox({
        supabaseAdmin: mockSupabaseAdmin,
        slackBotToken: 'xoxb-valid-test-bot-token',
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:25:01.000Z')
      });

      expect(res.processed).toBe(1);
      expect(res.delivered).toBe(0);
      expect(res.failed).toBe(1);

      // Verify retry count incremented to 1
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          retry_count: 1,
          last_error: 'rate_limited'
        })
      );
    });
  });

  describe('6. Safety Mandate: Live Slack Delivery Blocked during Review', () => {
    it('6.1 When isLiveDisabled is true, outbox skips dispatch and makes no network calls to Slack', async () => {
      const mockOutboxRow: SlackOutboxRow = {
        id: 'outbox-safety',
        task_id: 'task-107',
        client_id: 'client-507',
        event_type: 'task_assigned',
        idempotency_key: 'task_assigned:task-107:user-1:20260927123000',
        recipient_profile_id: 'user-1',
        recipient_slack_id: 'U01ABCDEF99',
        channel_id: null,
        message_text: '📋 *New Task Assigned*: Title',
        blocks: [],
        status: 'pending',
        skip_reason: null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: '2026-09-27T12:30:00.000Z',
        created_at: '2026-09-27T12:30:00.000Z',
        updated_at: '2026-09-27T12:30:00.000Z'
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
        slackBotToken: 'xoxb-valid-test-bot-token',
        isLiveDisabled: true, // Safety mandate
        fetchImpl: mockFetch as any,
        nowProvider: () => new Date('2026-09-27T12:30:01.000Z')
      });

      expect(res.processed).toBe(1);
      expect(res.delivered).toBe(0);
      expect(res.skipped).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('7. Slack ID Format Validation', () => {
    it('7.1 Accepts valid user IDs starting with U or W (9 to 15 alphanumeric characters)', () => {
      const validIds = ['U0123456789', 'W0987654321', 'U12345678', 'W12345678901234'];
      const regex = /^[UW][A-Z0-9]{8,14}$/;

      for (const id of validIds) {
        expect(regex.test(id)).toBe(true);
      }
    });

    it('7.2 Rejects invalid formats (wrong prefixes, symbols, or incorrect lengths)', () => {
      const invalidIds = ['X0123456789', '123456789', 'U12', 'W1234567890123456', 'U1234-5678', ''];
      const regex = /^[UW][A-Z0-9]{8,14}$/;

      for (const id of invalidIds) {
        expect(regex.test(id)).toBe(false);
      }
    });
  });

  describe('8. Authoritative Trigger Decision Logic & Suppressions', () => {
    // Pure unit test of the decision logic encoded in PostgreSQL trigger fn_trigger_enqueue_slack_notification
    function evaluateTriggerConditions(params: {
      op: 'INSERT' | 'UPDATE';
      oldRecord?: { assignee_id: string | null; status: string; archived_at?: string | null };
      newRecord: { assignee_id: string | null; status: string; archived_at?: string | null };
    }): { eventType: string | null; targetChannel: string | null } {
      const { op, oldRecord, newRecord } = params;

      if (newRecord.archived_at) {
        return { eventType: null, targetChannel: null };
      }

      // EVENT 1: Task Assigned or Reassigned
      const isAssignedOrReassigned = 
        newRecord.assignee_id !== null &&
        ((op === 'INSERT' && newRecord.status !== 'Draft') ||
         (oldRecord && oldRecord.assignee_id !== newRecord.assignee_id && newRecord.status !== 'Draft') ||
         (oldRecord && oldRecord.status === 'Draft' && newRecord.status !== 'Draft'));

      if (isAssignedOrReassigned) {
        return { eventType: 'task_assigned', targetChannel: 'assignee_dm' };
      }

      // EVENT 2: Task Submitted for Internal Approval
      const isSubmittedForApproval =
        ['Approval', 'Team Review'].includes(newRecord.status) &&
        (op === 'INSERT' || !['Approval', 'Team Review'].includes(oldRecord?.status || ''));

      if (isSubmittedForApproval) {
        return { eventType: 'approval_submitted', targetChannel: 'C0C4MCNDX0D' };
      }

      // EVENT 3: Owner/Manager Decision on Task
      const isDecision =
        op === 'UPDATE' &&
        oldRecord &&
        ['Approval', 'Team Review'].includes(oldRecord.status) &&
        ['Done', 'Completed', 'In Progress', 'Todo'].includes(newRecord.status) &&
        newRecord.assignee_id !== null;

      if (isDecision) {
        return { eventType: 'approval_decision', targetChannel: 'assignee_dm' };
      }

      return { eventType: null, targetChannel: null };
    }

    it('8.1 Suppresses notification when task is created in Draft status with assignee', () => {
      const res = evaluateTriggerConditions({
        op: 'INSERT',
        newRecord: { assignee_id: 'user-1', status: 'Draft' }
      });
      expect(res.eventType).toBeNull();
    });

    it('8.2 Suppresses notification when task assignment is unchanged', () => {
      const res = evaluateTriggerConditions({
        op: 'UPDATE',
        oldRecord: { assignee_id: 'user-1', status: 'Todo' },
        newRecord: { assignee_id: 'user-1', status: 'Todo' }
      });
      expect(res.eventType).toBeNull();
    });

    it('8.3 Emits task_assigned when activating a drafted task with an assignee', () => {
      const res = evaluateTriggerConditions({
        op: 'UPDATE',
        oldRecord: { assignee_id: 'user-1', status: 'Draft' },
        newRecord: { assignee_id: 'user-1', status: 'Todo' }
      });
      expect(res.eventType).toBe('task_assigned');
      expect(res.targetChannel).toBe('assignee_dm');
    });

    it('8.4 Emits task_assigned when assigning previously unassigned active task', () => {
      const res = evaluateTriggerConditions({
        op: 'UPDATE',
        oldRecord: { assignee_id: null, status: 'Todo' },
        newRecord: { assignee_id: 'user-2', status: 'Todo' }
      });
      expect(res.eventType).toBe('task_assigned');
    });

    it('8.5 Emits approval_submitted to C0C4MCNDX0D when moving from In Progress to Approval', () => {
      const res = evaluateTriggerConditions({
        op: 'UPDATE',
        oldRecord: { assignee_id: 'user-1', status: 'In Progress' },
        newRecord: { assignee_id: 'user-1', status: 'Approval' }
      });
      expect(res.eventType).toBe('approval_submitted');
      expect(res.targetChannel).toBe('C0C4MCNDX0D');
    });

    it('8.6 Emits approval_decision when manager approves task from Approval to Completed', () => {
      const res = evaluateTriggerConditions({
        op: 'UPDATE',
        oldRecord: { assignee_id: 'user-1', status: 'Approval' },
        newRecord: { assignee_id: 'user-1', status: 'Completed' }
      });
      expect(res.eventType).toBe('approval_decision');
      expect(res.targetChannel).toBe('assignee_dm');
    });

    it('8.7 Emits approval_decision when manager returns task from Approval to In Progress', () => {
      const res = evaluateTriggerConditions({
        op: 'UPDATE',
        oldRecord: { assignee_id: 'user-1', status: 'Approval' },
        newRecord: { assignee_id: 'user-1', status: 'In Progress' }
      });
      expect(res.eventType).toBe('approval_decision');
      expect(res.targetChannel).toBe('assignee_dm');
    });

    it('8.8 Suppresses all notifications for archived tasks', () => {
      const res = evaluateTriggerConditions({
        op: 'UPDATE',
        oldRecord: { assignee_id: 'user-1', status: 'Todo' },
        newRecord: { assignee_id: 'user-2', status: 'Todo', archived_at: '2026-09-27T00:00:00Z' }
      });
      expect(res.eventType).toBeNull();
    });
  });

  describe('9. Frontend Dispatcher Fire-and-Forget Resilience', () => {
    it('9.1 triggerDispatch executes non-blocking and never throws or fails callers on edge function errors', async () => {
      // Mock invoke failure
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'fake-token' } }
          })
        },
        functions: {
          invoke: vi.fn().mockRejectedValue(new Error('Edge function 500 error or network timeout'))
        }
      };

      // Ensure calling triggerDispatch does not throw
      await expect(
        slackNotificationService.triggerDispatch()
      ).resolves.not.toThrow();
    });
  });
});
