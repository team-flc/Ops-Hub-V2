import { supabase } from './supabase';
import { SystemAuditEvent, AuditEntityType, AuditEventAction } from '../types';

export const auditService = {
  /**
   * Log an immutable system audit event
   */
  async logAuditEvent(params: {
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
    if (!supabase) return { data: null, error: 'Database is not configured.' };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'User must be authenticated to log audit events.' };
      }

      // Fetch actor profile snapshot
      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();

      // Redact sensitive keys from state payloads before logging
      const redactSecrets = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        const copy = Array.isArray(obj) ? [...obj] : { ...obj };
        const secretKeys = ['password', 'passwordHash', 'token', 'access_token', 'refresh_token', 'serviceRoleKey', 'secret'];
        for (const key of Object.keys(copy)) {
          if (secretKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
            copy[key] = '[REDACTED]';
          } else if (typeof copy[key] === 'object') {
            copy[key] = redactSecrets(copy[key]);
          }
        }
        return copy;
      };

      const payload = {
        actor_id: user.id,
        actor_name: actorProfile?.full_name || user.email?.split('@')[0] || 'Unknown',
        actor_role: actorProfile?.role || 'team_member',
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName || null,
        client_id: params.clientId || null,
        client_name: params.clientName || null,
        previous_state: redactSecrets(params.previousState),
        new_state: redactSecrets(params.newState),
        reason: params.reason || null,
        metadata: redactSecrets(params.metadata)
      };

      const { data, error } = await supabase
        .from('system_audit_events')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Failed to log audit event:', error);
        return { data: null, error: error.message };
      }

      return {
        data: {
          id: data.id,
          actorId: data.actor_id,
          actorName: data.actor_name,
          actorRole: data.actor_role,
          action: data.action,
          entityType: data.entity_type,
          entityId: data.entity_id,
          entityName: data.entity_name,
          clientId: data.client_id,
          clientName: data.client_name,
          previousState: data.previous_state,
          newState: data.new_state,
          reason: data.reason,
          metadata: data.metadata,
          createdAt: data.created_at
        },
        error: null
      };
    } catch (err: any) {
      console.error('Audit service error:', err);
      return { data: null, error: err?.message || 'Unexpected audit logging error' };
    }
  },

  /**
   * Fetch system audit events with scoped filters
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
        previousState: row.previous_state,
        newState: row.new_state,
        reason: row.reason,
        metadata: row.metadata,
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
              previousState: row.previous_state,
              newState: row.new_state,
              reason: row.reason,
              metadata: row.metadata,
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