// ==============================================================================
// SERVICE: slackNotificationService
// Location: src/lib/slackNotificationService.ts
// Phase 1: Ops Hub -> Slack Notification Frontend Dispatcher & Inspection
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { SlackNotificationOutboxRecord } from '../types';

export const slackNotificationService = {
  /**
   * Asynchronously triggers edge function to process outbox in background (fire-and-forget).
   * A failure in this dispatch call or Slack outage will NEVER fail the client task mutation.
   */
  async triggerDispatch(options?: { isLiveDisabled?: boolean; batchSize?: number }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      // Asynchronous fire-and-forget invocation
      supabase.functions.invoke('process-slack-notifications', {
        body: {
          isLiveDisabled: options?.isLiveDisabled ?? false,
          batchSize: options?.batchSize ?? 25
        },
        headers: { Authorization: `Bearer ${token}` }
      }).catch((err) => {
        // Non-blocking catch
        console.warn('Background Slack notification dispatch trigger warning:', err?.message);
      });
    } catch (err: any) {
      console.warn('Could not trigger Slack dispatch:', err?.message);
    }
  },

  /**
   * Query recent notification outbox history for management visibility
   */
  async fetchOutboxHistory(limit = 50): Promise<SlackNotificationOutboxRecord[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('slack_notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        taskId: row.task_id,
        clientId: row.client_id,
        eventType: row.event_type,
        idempotencyKey: row.idempotency_key,
        recipientProfileId: row.recipient_profile_id,
        recipientSlackId: row.recipient_slack_id,
        channelId: row.channel_id,
        messageText: row.message_text,
        blocks: row.blocks,
        status: row.status,
        skipReason: row.skip_reason,
        retryCount: row.retry_count,
        maxRetries: row.max_retries,
        nextRetryAt: row.next_retry_at,
        lastError: row.last_error,
        slackMessageTs: row.slack_message_ts,
        deliveredAt: row.delivered_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch {
      return [];
    }
  }
};
