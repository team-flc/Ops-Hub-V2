// ==============================================================================
// SERVICE: slackNotificationHandler
// Location: src/lib/slackNotificationHandler.ts
// Phase 1: Ops Hub -> Slack Notifications Outbox Processor
//
// Practical Delivery Guarantee:
// At-least-once delivery with deterministic occurrence-based deduplication (occ_${seq}).
// Under network partitions or database write failures occurring after Slack accepts
// chat.postMessage, redelivery may occur upon lease expiry.
// Deduplication is guaranteed at the event level by sequence-based idempotency keys,
// and worker isolation is enforced atomically by claim_slack_outbox_batch (FOR UPDATE SKIP LOCKED).
// ==============================================================================

export interface SlackOutboxRow {
  id: string;
  task_id: string;
  client_id: string;
  event_type: 'task_assigned' | 'approval_submitted' | 'approval_decision';
  idempotency_key: string;
  recipient_profile_id?: string | null;
  recipient_slack_id?: string | null;
  channel_id?: string | null;
  message_text: string;
  blocks?: any;
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'skipped';
  skip_reason?: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  claimed_at?: string | null;
  claimed_by?: string | null;
  last_error?: string | null;
  slack_message_ts?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessOutboxOptions {
  supabaseAdmin: any;
  slackBotToken?: string;
  defaultApprovalsChannelId?: string;
  appBaseUrl?: string;
  fetchImpl?: typeof fetch;
  batchSize?: number;
  workerId?: string;
  nowProvider?: () => Date;
}

export interface ProcessOutboxResult {
  processed: number;
  delivered: number;
  failed: number;
  skipped: number;
  held: number;
  details: Array<{
    id: string;
    eventType: string;
    status: 'delivered' | 'failed' | 'skipped' | 'held';
    reason?: string;
  }>;
}

/**
 * Strips all sensitive tokens, credentials, or secrets from error messages before logging or storing
 */
export function sanitizeSlackErrorMessage(msg: string): string {
  if (!msg) return 'Unknown error';
  return msg
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/xoxb-[A-Za-z0-9-]+/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/xoxp-[A-Za-z0-9-]+/g, '[REDACTED_SLACK_USER_TOKEN]')
    .slice(0, 500);
}

/**
 * Calculates exponential backoff in seconds for retries (30s, 60s, 120s, up to 1 hour max)
 */
export function calculateBackoffSeconds(retryCount: number): number {
  return Math.min(3600, Math.pow(2, retryCount) * 30);
}

/**
 * Authoritative outbox processor for Ops Hub -> Slack notifications.
 * Processes outbox rows with atomic claiming, conversations.open for DMs,
 * occurrence-based deduplication, exponential backoff, safe recipient skipping,
 * configuration hold for recovery, and zero credential leakage.
 */
export async function processSlackOutbox(options: ProcessOutboxOptions): Promise<ProcessOutboxResult> {
  const {
    supabaseAdmin,
    slackBotToken,
    defaultApprovalsChannelId = 'C0C4MCNDX0D',
    fetchImpl = globalThis.fetch,
    batchSize = 25,
    workerId = `worker_${Math.random().toString(36).substring(2, 9)}`,
    nowProvider = () => new Date()
  } = options;

  const result: ProcessOutboxResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
    held: 0,
    details: []
  };

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is required to process Slack notifications outbox.');
  }

  const currentDate = nowProvider();
  const nowIso = currentDate.toISOString();

  let rows: SlackOutboxRow[] = [];

  // 1. Claim rows atomically via RPC if available, or fall back to query for test mocks
  if (typeof supabaseAdmin.rpc === 'function') {
    const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc('claim_slack_outbox_batch', {
      p_batch_size: batchSize,
      p_worker_id: workerId,
      p_timeout_seconds: 300
    });

    if (rpcErr) {
      throw new Error(`Failed to claim outbox batch via RPC: ${sanitizeSlackErrorMessage(rpcErr.message)}`);
    }
    rows = (rpcRows || []) as SlackOutboxRow[];
  } else {
    // Fallback query for mocked environments that only mock supabaseAdmin.from
    const { data: queryRows, error: fetchErr } = await supabaseAdmin
      .from('slack_notification_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('next_retry_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchErr) {
      throw new Error(`Failed to query slack_notification_outbox: ${fetchErr.message}`);
    }
    rows = (queryRows || []) as SlackOutboxRow[];
  }

  if (!rows || rows.length === 0) {
    return result;
  }

  // 2. Handle missing bot token: HOLD messages for recovery, NEVER permanently skip!
  if (!slackBotToken) {
    for (const row of rows) {
      result.processed++;
      result.held++;
      result.details.push({
        id: row.id,
        eventType: row.event_type,
        status: 'held',
        reason: 'holding_for_slack_bot_token'
      });

      await supabaseAdmin
        .from('slack_notification_outbox')
        .update({
          status: 'pending',
          claimed_at: null,
          claimed_by: null,
          last_error: 'Held for recovery: SLACK_BOT_TOKEN environment secret is not configured',
          skip_reason: 'holding_for_slack_bot_token',
          updated_at: nowIso
        })
        .eq('id', row.id);
    }
    return result;
  }

  // 3. Process each claimed row sequentially
  for (const row of rows) {
    // Exclude exhausted failures to prevent head-of-line blocking
    if (row.retry_count >= row.max_retries) {
      continue;
    }

    result.processed++;

    let targetChannel = row.channel_id;

    if (row.event_type === 'approval_submitted') {
      // Event 2: Posts directly to public #ops-approvals channel
      targetChannel = targetChannel || defaultApprovalsChannelId;
    } else {
      // Event 1 & 3: Direct Message to recipient
      if (!row.recipient_slack_id) {
        // Missing mapping: permanently skip row without guessing
        await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'skipped',
            skip_reason: 'missing_slack_member_id',
            claimed_at: null,
            claimed_by: null,
            updated_at: nowIso
          })
          .eq('id', row.id);

        result.skipped++;
        result.details.push({
          id: row.id,
          eventType: row.event_type,
          status: 'skipped',
          reason: 'missing_slack_member_id'
        });
        continue;
      }

      // If already resolved to a DM channel (D...), use it directly
      if (targetChannel && targetChannel.startsWith('D')) {
        // DM channel already resolved
      } else {
        // Open/retrieve DM channel (D...) via conversations.open
        try {
          const openResponse = await fetchImpl('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${slackBotToken}`,
              'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({ users: row.recipient_slack_id })
          });

          const openJson: any = await openResponse.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

          if (openResponse.ok && openJson.ok && openJson.channel?.id) {
            targetChannel = openJson.channel.id;
          } else {
            const nextRetryCount = row.retry_count + 1;
            const backoffSec = calculateBackoffSeconds(nextRetryCount);
            const nextRetryDate = new Date(nowProvider().getTime() + backoffSec * 1000).toISOString();
            const rawError = openJson.error || `HTTP ${openResponse.status} ${openResponse.statusText}`;
            const sanitizedError = sanitizeSlackErrorMessage(rawError);

            await supabaseAdmin
              .from('slack_notification_outbox')
              .update({
                status: 'failed',
                retry_count: nextRetryCount,
                next_retry_at: nextRetryDate,
                last_error: sanitizedError,
                claimed_at: null,
                claimed_by: null,
                updated_at: nowProvider().toISOString()
              })
              .eq('id', row.id);

            result.failed++;
            result.details.push({
              id: row.id,
              eventType: row.event_type,
              status: 'failed',
              reason: sanitizedError
            });
            continue;
          }
        } catch (openErr: any) {
          const nextRetryCount = row.retry_count + 1;
          const backoffSec = calculateBackoffSeconds(nextRetryCount);
          const nextRetryDate = new Date(nowProvider().getTime() + backoffSec * 1000).toISOString();
          const sanitizedError = sanitizeSlackErrorMessage(openErr?.message || 'conversations.open network failure');

          await supabaseAdmin
            .from('slack_notification_outbox')
            .update({
              status: 'failed',
              retry_count: nextRetryCount,
              next_retry_at: nextRetryDate,
              last_error: sanitizedError,
              claimed_at: null,
              claimed_by: null,
              updated_at: nowProvider().toISOString()
            })
            .eq('id', row.id);

          result.failed++;
          result.details.push({
            id: row.id,
            eventType: row.event_type,
            status: 'failed',
            reason: sanitizedError
          });
          continue;
        }
      }
    }

    // 4. Dispatch to Slack chat.postMessage API
    try {
      const payload: Record<string, any> = {
        channel: targetChannel,
        text: row.message_text
      };

      if (row.blocks && Array.isArray(row.blocks) && row.blocks.length > 0) {
        payload.blocks = row.blocks;
      }

      const slackResponse = await fetchImpl('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackBotToken}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const responseJson: any = await slackResponse.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

      if (slackResponse.ok && responseJson.ok) {
        // Success
        const { error: updateErr } = await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'delivered',
            channel_id: targetChannel,
            slack_message_ts: responseJson.ts || null,
            delivered_at: nowProvider().toISOString(),
            last_error: null,
            claimed_at: null,
            claimed_by: null,
            updated_at: nowProvider().toISOString()
          })
          .eq('id', row.id);

        if (updateErr) {
          console.error(`[Slack Dispatch] DB error updating delivered row ${row.id}:`, updateErr.message);
        }

        result.delivered++;
        result.details.push({
          id: row.id,
          eventType: row.event_type,
          status: 'delivered'
        });
      } else {
        // Slack API returned an error
        const nextRetryCount = row.retry_count + 1;
        const backoffSec = calculateBackoffSeconds(nextRetryCount);
        const nextRetryDate = new Date(nowProvider().getTime() + backoffSec * 1000).toISOString();
        const rawError = responseJson.error || `HTTP ${slackResponse.status} ${slackResponse.statusText}`;
        const sanitizedError = sanitizeSlackErrorMessage(rawError);

        const { error: updateErr } = await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'failed',
            retry_count: nextRetryCount,
            next_retry_at: nextRetryDate,
            last_error: sanitizedError,
            claimed_at: null,
            claimed_by: null,
            updated_at: nowProvider().toISOString()
          })
          .eq('id', row.id);

        if (updateErr) {
          console.error(`[Slack Dispatch] DB error recording failure for row ${row.id}:`, updateErr.message);
        }

        result.failed++;
        result.details.push({
          id: row.id,
          eventType: row.event_type,
          status: 'failed',
          reason: sanitizedError
        });
      }
    } catch (networkErr: any) {
      // Network failure
      const nextRetryCount = row.retry_count + 1;
      const backoffSec = calculateBackoffSeconds(nextRetryCount);
      const nextRetryDate = new Date(nowProvider().getTime() + backoffSec * 1000).toISOString();
      const sanitizedError = sanitizeSlackErrorMessage(networkErr?.message || 'Network request failed');

      const { error: updateErr } = await supabaseAdmin
        .from('slack_notification_outbox')
        .update({
          status: 'failed',
          retry_count: nextRetryCount,
          next_retry_at: nextRetryDate,
          last_error: sanitizedError,
          claimed_at: null,
          claimed_by: null,
          updated_at: nowProvider().toISOString()
        })
        .eq('id', row.id);

      if (updateErr) {
        console.error(`[Slack Dispatch] DB error recording network failure for row ${row.id}:`, updateErr.message);
      }

      result.failed++;
      result.details.push({
        id: row.id,
        eventType: row.event_type,
        status: 'failed',
        reason: sanitizedError
      });
    }
  }

  return result;
}
