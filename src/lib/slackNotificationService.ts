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
  async triggerDispatch(options?: { batchSize?: number }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const sessionRes = await supabase.auth.getSession().catch(() => null);
      const token = sessionRes?.data?.session?.access_token;
      if (!token) return;

      // Asynchronous fire-and-forget invocation
      const invokePromise = supabase.functions.invoke('process-slack-notifications', {
        body: {
          batchSize: options?.batchSize ?? 25
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (invokePromise && typeof invokePromise.catch === 'function') {
        invokePromise.catch((err: any) => {
          console.warn('Background Slack notification dispatch trigger warning:', err?.message);
        });
      }
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

      return data.map((row: any) => this.mapRecord(row));
    } catch {
      return [];
    }
  },

  /**
   * Query failed notifications specifically to expose exhausted or retryable failures to management
   */
  async fetchFailedNotifications(limit = 50): Promise<SlackNotificationOutboxRecord[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('slack_notification_outbox')
        .select('*')
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      return data.map((row: any) => this.mapRecord(row));
    } catch {
      return [];
    }
  },

  /**
   * Allows management (owner, operational_manager) to reset a failed notification for immediate retry
   */
  async retryFailedNotification(notificationId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      // 1. Try atomic RPC if available
      const { data: rpcData, error: rpcErr } = await supabase.rpc('retry_failed_slack_notification', {
        p_notification_id: notificationId
      });

      if (!rpcErr && rpcData?.success) {
        // Trigger dispatch immediately so it is processed without waiting
        void this.triggerDispatch();
        return true;
      }

      // 2. Fallback update
      const { error: updateErr } = await supabase
        .from('slack_notification_outbox')
        .update({
          status: 'pending',
          retry_count: 0,
          next_retry_at: new Date().toISOString(),
          claimed_at: null,
          claimed_by: null,
          last_error: null,
          skip_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (updateErr) {
        console.error('Failed to retry notification:', updateErr.message);
        return false;
      }

      void this.triggerDispatch();
      return true;
    } catch (err: any) {
      console.error('Exception retrying notification:', err?.message);
      return false;
    }
  },

  mapRecord(row: any): SlackNotificationOutboxRecord {
    return {
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
    };
  }
};
