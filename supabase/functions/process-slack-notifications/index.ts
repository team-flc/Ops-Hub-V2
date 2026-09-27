// ==============================================================================
// SUPABASE EDGE FUNCTION: process-slack-notifications
// Location: supabase/functions/process-slack-notifications/index.ts
// Environment: Deno Runtime / Supabase Functions
// Phase 1: Ops Hub -> Slack Task Notifications Dispatcher
//
// Practical Delivery Guarantee:
// At-least-once delivery with deterministic occurrence-based deduplication (occ_${seq}).
// Under network partitions, server restarts, or database write failures occurring between
// Slack accepting chat.postMessage and the database recording status = 'delivered',
// redelivery may occur upon lease expiry.
// Deduplication is guaranteed at the event level by sequence-based idempotency keys,
// and worker isolation is enforced atomically by claim_slack_outbox_batch (FOR UPDATE SKIP LOCKED).
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(?:[a-z0-9-]+\.)?faseehlall\.com$/,
  /^https:\/\/(?:[a-z0-9-]+\.)?obshub2\.pages\.dev$/,
  /^http:\/\/localhost:(5173|3000|4173)$/
];

const getCorsHeaders = (origin: string | null) => {
  let matchedOrigin = 'https://ops.faseehlall.com';
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    matchedOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': matchedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
};

export function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Unknown error';
  return msg
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/xoxb-[A-Za-z0-9-]+/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/xoxp-[A-Za-z0-9-]+/g, '[REDACTED_SLACK_USER_TOKEN]')
    .slice(0, 500);
}

export function calculateBackoffSeconds(retryCount: number): number {
  return Math.min(3600, Math.pow(2, retryCount) * 30);
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const slackBotToken = Deno.env.get('SLACK_BOT_TOKEN');
  const slackApprovalsChannel = Deno.env.get('SLACK_APPROVALS_CHANNEL_ID') || 'C0C4MCNDX0D';

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error: Supabase credentials missing.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  // Admin client with service_role to access outbox and RPC
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Authorization: Only service_role or management (owner, operational_manager) can trigger processing
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Missing authorization header.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  let isAuthorizedServiceOrManagement = false;

  if (token === supabaseServiceKey) {
    // Authorized directly as server-side service_role (e.g., cron or internal webhook)
    isAuthorizedServiceOrManagement = true;
  } else {
    // Validate caller JWT session
    const { data: { user: callerUser }, error: userAuthError } = await supabaseAdmin.auth.getUser(token);

    if (userAuthError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid authentication session.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check caller's role in public.profiles
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileErr || !profile) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Caller profile could not be verified.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (profile.role === 'owner' || profile.role === 'operational_manager') {
      isAuthorizedServiceOrManagement = true;
    } else {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only owners and operational managers can process Slack notifications.' }),
        { status: 403, headers: corsHeaders }
      );
    }
  }

  if (!isAuthorizedServiceOrManagement) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Access denied.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  try {
    let batchSize = 25;
    try {
      const body = await req.json();
      if (body?.batchSize && typeof body.batchSize === 'number') {
        batchSize = Math.min(50, Math.max(1, body.batchSize));
      }
      // Note: Client-controlled isLiveDisabled switch is strictly ignored/removed.
    } catch {
      // Empty or non-JSON body is valid, defaults apply
    }

    // 2. Atomically claim outbox records via FOR UPDATE SKIP LOCKED
    const workerId = `edge_worker_${crypto.randomUUID()}`;
    const { data: rows, error: claimErr } = await supabaseAdmin.rpc('claim_slack_outbox_batch', {
      p_batch_size: batchSize,
      p_worker_id: workerId,
      p_timeout_seconds: 300
    });

    if (claimErr) {
      return new Response(
        JSON.stringify({ error: `Failed to claim outbox batch: ${sanitizeErrorMessage(claimErr.message)}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, delivered: 0, failed: 0, skipped: 0, held: 0 }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. Handle missing bot token: HOLD messages for recovery, NEVER permanently skip them!
    if (!slackBotToken) {
      const rowIds = rows.map((r: any) => r.id);
      const { error: holdErr } = await supabaseAdmin
        .from('slack_notification_outbox')
        .update({
          status: 'pending',
          claimed_at: null,
          claimed_by: null,
          last_error: 'Held for recovery: SLACK_BOT_TOKEN environment secret is not configured',
          skip_reason: 'holding_for_slack_bot_token',
          updated_at: new Date().toISOString()
        })
        .in('id', rowIds);

      if (holdErr) {
        console.error(`[Slack Dispatch] Failed to hold rows for recovery: ${holdErr.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: rows.length,
          delivered: 0,
          failed: 0,
          skipped: 0,
          held: rows.length,
          message: 'Notifications held for recovery: SLACK_BOT_TOKEN is not configured.'
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    let deliveredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // 4. Process each claimed row sequentially
    for (const row of rows) {
      let targetChannel: string | null = null;

      if (row.event_type === 'approval_submitted') {
        // Event 2: Posts to public #ops-approvals channel
        targetChannel = row.channel_id || slackApprovalsChannel;
      } else {
        // Event 1 & 3: Direct Message to recipient
        if (!row.recipient_slack_id) {
          // Permanently skip row if recipient has no Slack mapping
          const { error: skipErr } = await supabaseAdmin
            .from('slack_notification_outbox')
            .update({
              status: 'skipped',
              skip_reason: 'missing_slack_member_id',
              claimed_at: null,
              claimed_by: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.id);

          if (skipErr) {
            console.error(`[Slack Dispatch] DB error marking skipped row ${row.id}: ${skipErr.message}`);
          }
          skippedCount++;
          continue;
        }

        // Open/retrieve DM channel (D...) via conversations.open
        try {
          const openRes = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${slackBotToken}`,
              'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({ users: row.recipient_slack_id })
          });

          const openData = await openRes.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

          if (openRes.ok && openData.ok && openData.channel?.id) {
            targetChannel = openData.channel.id;
          } else {
            const nextRetry = row.retry_count + 1;
            const backoff = calculateBackoffSeconds(nextRetry);
            const nextRetryAt = new Date(Date.now() + backoff * 1000).toISOString();
            const safeError = sanitizeErrorMessage(openData.error || `conversations.open failed HTTP ${openRes.status}`);

            const { error: failErr } = await supabaseAdmin
              .from('slack_notification_outbox')
              .update({
                status: 'failed',
                retry_count: nextRetry,
                next_retry_at: nextRetryAt,
                last_error: safeError,
                claimed_at: null,
                claimed_by: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', row.id);

            if (failErr) {
              console.error(`[Slack Dispatch] DB error recording open failure for row ${row.id}: ${failErr.message}`);
            }
            failedCount++;
            continue;
          }
        } catch (openErr: any) {
          const nextRetry = row.retry_count + 1;
          const backoff = calculateBackoffSeconds(nextRetry);
          const nextRetryAt = new Date(Date.now() + backoff * 1000).toISOString();
          const safeError = sanitizeErrorMessage(openErr?.message || 'conversations.open network failure');

          const { error: failErr } = await supabaseAdmin
            .from('slack_notification_outbox')
            .update({
              status: 'failed',
              retry_count: nextRetry,
              next_retry_at: nextRetryAt,
              last_error: safeError,
              claimed_at: null,
              claimed_by: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.id);

          if (failErr) {
            console.error(`[Slack Dispatch] DB error recording network failure for row ${row.id}: ${failErr.message}`);
          }
          failedCount++;
          continue;
        }
      }

      // 5. Send message via chat.postMessage
      try {
        const slackPayload: Record<string, any> = {
          channel: targetChannel,
          text: row.message_text
        };
        if (row.blocks && Array.isArray(row.blocks) && row.blocks.length > 0) {
          slackPayload.blocks = row.blocks;
        }

        const postRes = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slackBotToken}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(slackPayload)
        });

        const postData = await postRes.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

        if (postRes.ok && postData.ok) {
          const { error: deliverErr } = await supabaseAdmin
            .from('slack_notification_outbox')
            .update({
              status: 'delivered',
              channel_id: targetChannel,
              slack_message_ts: postData.ts || null,
              delivered_at: new Date().toISOString(),
              last_error: null,
              claimed_at: null,
              claimed_by: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.id);

          if (deliverErr) {
            console.error(`[Slack Dispatch] DB update error after successful Slack post for row ${row.id}: ${deliverErr.message}`);
          }
          deliveredCount++;
        } else {
          const nextRetry = row.retry_count + 1;
          const backoff = calculateBackoffSeconds(nextRetry);
          const nextRetryAt = new Date(Date.now() + backoff * 1000).toISOString();
          const safeError = sanitizeErrorMessage(postData.error || `chat.postMessage failed HTTP ${postRes.status}`);

          const { error: failErr } = await supabaseAdmin
            .from('slack_notification_outbox')
            .update({
              status: 'failed',
              retry_count: nextRetry,
              next_retry_at: nextRetryAt,
              last_error: safeError,
              claimed_at: null,
              claimed_by: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.id);

          if (failErr) {
            console.error(`[Slack Dispatch] DB error recording post failure for row ${row.id}: ${failErr.message}`);
          }
          failedCount++;
        }
      } catch (postErr: any) {
        const nextRetry = row.retry_count + 1;
        const backoff = calculateBackoffSeconds(nextRetry);
        const nextRetryAt = new Date(Date.now() + backoff * 1000).toISOString();
        const safeError = sanitizeErrorMessage(postErr?.message || 'chat.postMessage network failure');

        const { error: failErr } = await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'failed',
            retry_count: nextRetry,
            next_retry_at: nextRetryAt,
            last_error: safeError,
            claimed_at: null,
            claimed_by: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id);

        if (failErr) {
          console.error(`[Slack Dispatch] DB error recording network exception for row ${row.id}: ${failErr.message}`);
        }
        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: rows.length,
        delivered: deliveredCount,
        failed: failedCount,
        skipped: skippedCount,
        held: 0
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    const safeError = sanitizeErrorMessage(err?.message || 'Internal server error');
    return new Response(
      JSON.stringify({ error: safeError }),
      { status: 500, headers: corsHeaders }
    );
  }
});
