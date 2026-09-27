// ==============================================================================
// SERVICE: slackNotificationHandler
// Location: src/lib/slackNotificationHandler.ts
// Phase 1: Ops Hub -> Slack Notifications Outbox Processor
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
  status: 'pending' | 'delivered' | 'failed' | 'skipped';
  skip_reason?: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
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
  dryRun?: boolean;
  isLiveDisabled?: boolean;
  nowProvider?: () => Date;
}

export interface ProcessOutboxResult {
  processed: number;
  delivered: number;
  failed: number;
  skipped: number;
  details: Array<{
    id: string;
    eventType: string;
    status: 'delivered' | 'failed' | 'skipped';
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
 * Processes pending/failed outbox rows with idempotency, exponential backoff,
 * safe recipient skipping, and zero credential leakage.
 */
export async function processSlackOutbox(options: ProcessOutboxOptions): Promise<ProcessOutboxResult> {
  const {
    supabaseAdmin,
    slackBotToken,
    defaultApprovalsChannelId = 'C0C4MCNDX0D',
    fetchImpl = globalThis.fetch,
    batchSize = 25,
    dryRun = false,
    isLiveDisabled = false,
    nowProvider = () => new Date()
  } = options;

  const result: ProcessOutboxResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is required to process Slack notifications outbox.');
  }

  const currentDate = nowProvider();
  const nowIso = currentDate.toISOString();

  // 1. Fetch eligible outbox records (pending or failed with retries remaining and backoff expired)
  const { data: rows, error: fetchErr } = await supabaseAdmin
    .from('slack_notification_outbox')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    throw new Error(`Failed to query slack_notification_outbox: ${fetchErr.message}`);
  }

  if (!rows || rows.length === 0) {
    return result;
  }

  // 2. Process each row sequentially to respect rate limits and order
  for (const row of rows as SlackOutboxRow[]) {
    // Check if max retries exceeded
    if (row.retry_count >= row.max_retries) {
      continue;
    }

    result.processed++;

    // Determine target recipient/channel
    let targetChannel = row.channel_id;
    if (row.event_type === 'approval_submitted' && !targetChannel) {
      targetChannel = defaultApprovalsChannelId;
    } else if (!targetChannel && row.recipient_slack_id) {
      targetChannel = row.recipient_slack_id;
    }

    // Missing Slack Member ID or channel check
    if (!targetChannel) {
      await supabaseAdmin
        .from('slack_notification_outbox')
        .update({
          status: 'skipped',
          skip_reason: 'missing_slack_member_id',
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

    // Safety Mandate: If live delivery is disabled or dry run, mark skipped or failed without sending
    if (isLiveDisabled || dryRun || !slackBotToken) {
      const skipOrHoldReason = !slackBotToken 
        ? 'missing_slack_bot_token' 
        : (isLiveDisabled ? 'live_delivery_blocked_review_mode' : 'dry_run_mode');

      // In dry run or blocked review mode, do not execute real Slack API call
      result.skipped++;
      result.details.push({
        id: row.id,
        eventType: row.event_type,
        status: 'skipped',
        reason: skipOrHoldReason
      });
      continue;
    }

    // 3. Dispatch to Slack chat.postMessage API
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
        await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'delivered',
            slack_message_ts: responseJson.ts || null,
            delivered_at: nowProvider().toISOString(),
            last_error: null,
            updated_at: nowProvider().toISOString()
          })
          .eq('id', row.id);

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

        await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'failed',
            retry_count: nextRetryCount,
            next_retry_at: nextRetryDate,
            last_error: sanitizedError,
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
      }
    } catch (networkErr: any) {
      // Network failure
      const nextRetryCount = row.retry_count + 1;
      const backoffSec = calculateBackoffSeconds(nextRetryCount);
      const nextRetryDate = new Date(nowProvider().getTime() + backoffSec * 1000).toISOString();
      const sanitizedError = sanitizeSlackErrorMessage(networkErr?.message || 'Network request failed');

      await supabaseAdmin
        .from('slack_notification_outbox')
        .update({
          status: 'failed',
          retry_count: nextRetryCount,
          next_retry_at: nextRetryDate,
          last_error: sanitizedError,
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
    }
  }

  return result;
}
