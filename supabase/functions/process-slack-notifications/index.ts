// ==============================================================================
// SUPABASE EDGE FUNCTION: process-slack-notifications
// Location: supabase/functions/process-slack-notifications/index.ts
// Environment: Deno Runtime / Supabase Functions
// Phase 1: Ops Hub -> Slack Task Notifications Dispatcher
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

function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Unknown error';
  return msg
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/xoxb-[A-Za-z0-9-]+/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/xoxp-[A-Za-z0-9-]+/g, '[REDACTED_SLACK_USER_TOKEN]')
    .slice(0, 500);
}

function calculateBackoffSeconds(retryCount: number): number {
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

  // Admin client with service_role to access slack_notification_outbox
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Authorization: Validate JWT caller or service call
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Missing authorization header.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user: callerUser }, error: userAuthError } = await supabaseAdmin.auth.getUser(token);

  if (userAuthError || !callerUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid authentication session.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    let batchSize = 25;
    let isLiveDisabled = false;

    try {
      const body = await req.json();
      if (body?.batchSize && typeof body.batchSize === 'number') {
        batchSize = Math.min(50, Math.max(1, body.batchSize));
      }
      if (body?.isLiveDisabled === true) {
        isLiveDisabled = true;
      }
    } catch {
      // Empty or non-JSON body is valid, defaults apply
    }

    const nowIso = new Date().toISOString();

    // 1. Fetch eligible outbox records
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from('slack_notification_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('next_retry_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: `Failed to query outbox: ${fetchErr.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, delivered: 0, failed: 0, skipped: 0 }),
        { status: 200, headers: corsHeaders }
      );
    }

    let deliveredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      if (row.retry_count >= row.max_retries) {
        continue;
      }

      let targetChannel = row.channel_id;
      if (row.event_type === 'approval_submitted' && !targetChannel) {
        targetChannel = slackApprovalsChannel;
      } else if (!targetChannel && row.recipient_slack_id) {
        targetChannel = row.recipient_slack_id;
      }

      // Check missing recipient
      if (!targetChannel) {
        await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'skipped',
            skip_reason: 'missing_slack_member_id',
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id);

        skippedCount++;
        continue;
      }

      // If token missing or live delivery disabled
      if (!slackBotToken || isLiveDisabled) {
        const reason = !slackBotToken ? 'missing_slack_bot_token' : 'live_delivery_blocked_review_mode';
        await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'skipped',
            skip_reason: reason,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id);

        skippedCount++;
        continue;
      }

      // Send to Slack API
      try {
        const slackPayload: Record<string, any> = {
          channel: targetChannel,
          text: row.message_text
        };
        if (row.blocks && Array.isArray(row.blocks) && row.blocks.length > 0) {
          slackPayload.blocks = row.blocks;
        }

        const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slackBotToken}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(slackPayload)
        });

        const slackData = await slackRes.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

        if (slackRes.ok && slackData.ok) {
          await supabaseAdmin
            .from('slack_notification_outbox')
            .update({
              status: 'delivered',
              slack_message_ts: slackData.ts || null,
              delivered_at: new Date().toISOString(),
              last_error: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.id);

          deliveredCount++;
        } else {
          const nextRetry = row.retry_count + 1;
          const backoff = calculateBackoffSeconds(nextRetry);
          const nextRetryAt = new Date(Date.now() + backoff * 1000).toISOString();
          const safeError = sanitizeErrorMessage(slackData.error || `HTTP ${slackRes.status}`);

          await supabaseAdmin
            .from('slack_notification_outbox')
            .update({
              status: 'failed',
              retry_count: nextRetry,
              next_retry_at: nextRetryAt,
              last_error: safeError,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.id);

          failedCount++;
        }
      } catch (postErr: any) {
        const nextRetry = row.retry_count + 1;
        const backoff = calculateBackoffSeconds(nextRetry);
        const nextRetryAt = new Date(Date.now() + backoff * 1000).toISOString();
        const safeError = sanitizeErrorMessage(postErr?.message || 'Network exception');

        await supabaseAdmin
          .from('slack_notification_outbox')
          .update({
            status: 'failed',
            retry_count: nextRetry,
            next_retry_at: nextRetryAt,
            last_error: safeError,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id);

        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: rows.length,
        delivered: deliveredCount,
        failed: failedCount,
        skipped: skippedCount
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
