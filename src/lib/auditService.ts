import { supabase } from './supabase';
import { SystemAuditEvent, AuditEntityType, AuditEventAction } from '../types';

/**
 * Redact sensitive security attributes from payloads before audit persistence or display
 */
export function redactAuditPayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  const secretKeywords = [
    'password', 'passwordhash', 'token', 'access_token', 'refresh_token', 
    'servicerolekey', 'secret', 'apikey', 'cookie', 'authorization', 
    'recoverycode', 'otp', 'signedurl'
  ];
  for (const key of Object.keys(copy)) {
    const lowerKey = key.toLowerCase();
    if (secretKeywords.some((s) => lowerKey.includes(s))) {
      copy[key] = '[REDACTED]';
    } else if (typeof copy[key] === 'object') {
      copy[key] = redactAuditPayload(copy[key]);
    }
  }
  return copy;
}

export const auditService = {
  redactAuditPayload,

  /**
   * Client-side direct audit insertion is disabled.
   * All authoritative audit events are generated server-side by Edge Functions
   * (manage-client-task, manage-team-member, manage-archive, manage-profile)
   * to guarantee non-repudiation, tamper-resistance, and atomic mutation logging.
   */
  async logAuditEvent(_params: {
    action: AuditEventAction | string;
    entityType: AuditEntityType | string;
    entityId: string;
    entityName?: string | null;
    clientId?: string | null;
    clientName?: string | null;
    previousState?: Record<string, any> | null;
    newState?: Record<string, any> | null;
    reason?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<{ data: SystemAuditEvent | null; error: string | null }> {
    return {
      data: null,
      error: 'Direct client-side audit insertion is prohibited. Audit events are generated authoritatively by server-side Edge Functions.'
    };
  },

  /**
   * Fetch system audit events with scoped filters (read-only through database RLS)
   */
  async fetchAuditEvents(filters?: {
    actorId?: string;
    clientId?: string;
    entityType?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: SystemAuditEvent[]; error: string | null }> {
    if (!supabase) return { data: [], error: 'Database is not configured.' };
    try {
      let query = supabase
        .from('system_audit_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.actorId) {
        query = query.eq('actor_id', filters.actorId);
      }
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.action) {
        query = query.ilike('action', `%${filters.action}%`);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query.limit(150);

      if (error) {
        return { data: [], error: error.message };
      }

      const mapped: SystemAuditEvent[] = (data || []).map((row: any) => ({
        id: row.id,
        actorId: row.actor_id,
        actorName: row.actor_name,
        actorRole: row.actor_role,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        clientId: row.client_id,
        clientName: row.client_name,
        previousState: redactAuditPayload(row.previous_state),
        newState: redactAuditPayload(row.new_state),
        reason: row.reason,
        metadata: redactAuditPayload(row.metadata),
        createdAt: row.created_at
      }));

      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch audit events.' };
    }
  },

  /**
   * Subscribe to real-time audit stream
   */
  subscribeToAuditStream(onNewEvent: (event: SystemAuditEvent) => void) {
    if (!supabase) return () => {};
    const channel = supabase
      .channel('system_audit_events_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_audit_events' },
        (payload) => {
          if (payload.new) {
            const row = payload.new;
            onNewEvent({
              id: row.id,
              actorId: row.actor_id,
              actorName: row.actor_name,
              actorRole: row.actor_role,
              action: row.action,
              entityType: row.entity_type,
              entityId: row.entity_id,
              entityName: row.entity_name,
              clientId: row.client_id,
              clientName: row.client_name,
              previousState: redactAuditPayload(row.previous_state),
              newState: redactAuditPayload(row.new_state),
              reason: row.reason,
              metadata: redactAuditPayload(row.metadata),
              createdAt: row.created_at
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }
};