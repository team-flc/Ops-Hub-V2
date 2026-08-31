// ==============================================================================
// SERVICE LAYER: Client Management Service (Phase 2B)
// Location: src/lib/clientManagementService.ts
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  ClientRecord, 
  ClientPackage, 
  ClientStatus, 
  ClientPauseReason, 
  ClientLinkType, 
  UserProfile 
} from '../types';

/**
 * Validate and sanitize workspace/communication URLs.
 * Strictly accepts http:// and https:// protocols only.
 * Rejects javascript:, data:, malformed strings, and unsafe scripts.
 */
export function sanitizeUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export interface CreateClientInput {
  companyName: string;
  clientName: string;
  package: ClientPackage;
  operationalManagerId: string;
  activationDate: string;
  status: ClientStatus;
  pauseReason?: ClientPauseReason | null;
  links?: Partial<Record<ClientLinkType, string>>;
}

export interface DuplicateClientInput {
  companyName: string;
  clientName: string;
  package: ClientPackage;
  operationalManagerId: string;
  activationDate: string;
  status: ClientStatus;
  pauseReason?: ClientPauseReason | null;
  links?: Partial<Record<ClientLinkType, string>>;
}

export interface UpdateClientInput {
  companyName?: string;
  clientName?: string;
  package?: ClientPackage;
  operationalManagerId?: string;
  activationDate?: string;
  status?: ClientStatus;
  pauseReason?: ClientPauseReason | null;
  links?: Partial<Record<ClientLinkType, string>>;
}

export const clientManagementService = {
  /**
   * Fetch all clients accessible by the current authenticated user (RLS scoped).
   */
  async fetchClients(): Promise<ClientRecord[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          client_name,
          package,
          operational_manager_id,
          activation_date,
          status,
          pause_reason,
          source_client_id,
          created_by,
          created_at,
          updated_at,
          archived_at,
          manager:operational_manager_id (
            id,
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (clientsError || !clientsData) {
        console.error('Failed to fetch clients:', clientsError?.message);
        return [];
      }

      // Fetch all links for these clients
      const clientIds = clientsData.map((c: any) => c.id);
      let linksMap: Record<string, Partial<Record<ClientLinkType, string>>> = {};

      if (clientIds.length > 0) {
        const { data: linksData } = await supabase
          .from('client_links')
          .select('client_id, link_type, url')
          .in('client_id', clientIds);

        if (linksData) {
          for (const l of linksData) {
            if (!linksMap[l.client_id]) linksMap[l.client_id] = {};
            linksMap[l.client_id][l.link_type as ClientLinkType] = l.url;
          }
        }
      }

      return clientsData.map((c: any) => {
        const mgr = Array.isArray(c.manager) ? c.manager[0] : c.manager;
        return {
          id: c.id,
          companyName: c.company_name,
          clientName: c.client_name,
          package: c.package as ClientPackage,
          operationalManagerId: c.operational_manager_id,
          operationalManagerName: mgr?.full_name || 'Assigned Manager',
          activationDate: c.activation_date,
          status: c.status as ClientStatus,
          pauseReason: c.pause_reason as ClientPauseReason | null,
          sourceClientId: c.source_client_id,
          links: linksMap[c.id] || {},
          createdBy: c.created_by,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          archivedAt: c.archived_at
        };
      });
    } catch (err) {
      console.error('Error fetching clients:', err);
      return [];
    }
  },

  /**
   * Fetch single client details with links and manager info.
   */
  async fetchClientById(clientId: string): Promise<ClientRecord | null> {
    if (!isSupabaseConfigured || !supabase || !clientId) return null;

    try {
      const { data: c, error } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          client_name,
          package,
          operational_manager_id,
          activation_date,
          status,
          pause_reason,
          source_client_id,
          created_by,
          created_at,
          updated_at,
          archived_at,
          manager:operational_manager_id (
            id,
            full_name
          )
        `)
        .eq('id', clientId)
        .single();

      if (error || !c) return null;

      // Fetch links
      const { data: linksData } = await supabase
        .from('client_links')
        .select('link_type, url')
        .eq('client_id', clientId);

      const links: Partial<Record<ClientLinkType, string>> = {};
      if (linksData) {
        for (const l of linksData) {
          links[l.link_type as ClientLinkType] = l.url;
        }
      }

      const clientMgr = Array.isArray(c.manager) ? (c.manager as any)[0] : (c.manager as any);

      return {
        id: c.id,
        companyName: c.company_name,
        clientName: c.client_name,
        package: c.package as ClientPackage,
        operationalManagerId: c.operational_manager_id,
        operationalManagerName: clientMgr?.full_name || 'Assigned Manager',
        activationDate: c.activation_date,
        status: c.status as ClientStatus,
        pauseReason: c.pause_reason as ClientPauseReason | null,
        sourceClientId: c.source_client_id,
        links,
        createdBy: c.created_by,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        archivedAt: c.archived_at
      };
    } catch (err) {
      console.error('Error fetching client by ID:', err);
      return null;
    }
  },

  /**
   * Fetch eligible operational managers (Owner and Operational Managers).
   */
  async fetchEligibleManagers(): Promise<UserProfile[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, status, created_at, updated_at')
        .in('role', ['owner', 'operational_manager'])
        .eq('status', 'active')
        .order('full_name');

      if (error || !data) return [];
      return data.map((p: any) => ({
        id: p.id,
        fullName: p.full_name,
        role: p.role,
        status: p.status,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
    } catch {
      return [];
    }
  },

  /**
   * Create a new Client Workspace.
   */
  async createClient(input: CreateClientInput, actorId?: string): Promise<{ data?: ClientRecord; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Database connection is not configured.' };
    }

    if (!input.companyName?.trim()) return { error: 'Company Name is required.' };
    if (!input.clientName?.trim()) return { error: 'Client/Owner Name is required.' };
    if (!input.package) return { error: 'Package selection is required.' };
    if (!input.operationalManagerId) return { error: 'Operational Manager is required.' };
    if (!input.activationDate) return { error: 'Activation Date is required.' };

    try {
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          company_name: input.companyName.trim(),
          client_name: input.clientName.trim(),
          package: input.package,
          operational_manager_id: input.operationalManagerId,
          activation_date: input.activationDate,
          status: input.status || 'Onboarding',
          pause_reason: input.status === 'Paused' ? input.pauseReason || 'Operational reason' : null,
          created_by: actorId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError || !newClient) {
        return { error: insertError?.message || 'Failed to create client record.' };
      }

      // Insert valid links
      const savedLinks: Partial<Record<ClientLinkType, string>> = {};
      if (input.links) {
        const linkEntries: { client_id: string; link_type: string; url: string; created_by?: string }[] = [];
        for (const [key, rawUrl] of Object.entries(input.links)) {
          const cleanUrl = sanitizeUrl(rawUrl);
          if (cleanUrl) {
            linkEntries.push({
              client_id: newClient.id,
              link_type: key,
              url: cleanUrl,
              created_by: actorId
            });
            savedLinks[key as ClientLinkType] = cleanUrl;
          }
        }

        if (linkEntries.length > 0) {
          await supabase.from('client_links').insert(linkEntries);
        }
      }

      // Record Audit Log
      await supabase.from('client_audit_log').insert({
        client_id: newClient.id,
        actor_id: actorId,
        action: 'client_created',
        safe_metadata: {
          companyName: newClient.company_name,
          package: newClient.package,
          managerId: newClient.operational_manager_id
        }
      });

      return {
        data: {
          id: newClient.id,
          companyName: newClient.company_name,
          clientName: newClient.client_name,
          package: newClient.package as ClientPackage,
          operationalManagerId: newClient.operational_manager_id,
          activationDate: newClient.activation_date,
          status: newClient.status as ClientStatus,
          pauseReason: newClient.pause_reason as ClientPauseReason | null,
          sourceClientId: null,
          links: savedLinks,
          createdBy: newClient.created_by,
          createdAt: newClient.created_at,
          updatedAt: newClient.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message || 'An unexpected error occurred while creating client.' };
    }
  },

  /**
   * Duplicate Client into a fresh, independent client workspace.
   * Links and task history are NOT cloned. Source client ID is recorded.
   */
  async duplicateClient(
    sourceClientId: string, 
    input: DuplicateClientInput, 
    actorId?: string
  ): Promise<{ data?: ClientRecord; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Database connection is not configured.' };
    }

    if (!input.companyName?.trim()) return { error: 'New Company Name is required.' };
    if (!input.clientName?.trim()) return { error: 'New Client/Owner Name is required.' };
    if (!input.activationDate) return { error: 'New Activation Date is required.' };

    try {
      // Verify source client
      const { data: sourceClient } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('id', sourceClientId)
        .single();

      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          company_name: input.companyName.trim(),
          client_name: input.clientName.trim(),
          package: input.package,
          operational_manager_id: input.operationalManagerId,
          activation_date: input.activationDate,
          status: input.status || 'Onboarding',
          pause_reason: input.status === 'Paused' ? input.pauseReason || 'Operational reason' : null,
          source_client_id: sourceClientId,
          created_by: actorId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError || !newClient) {
        return { error: insertError?.message || 'Failed to duplicate client record.' };
      }

      // Insert any freshly provided links (not copied from source)
      const savedLinks: Partial<Record<ClientLinkType, string>> = {};
      if (input.links) {
        const linkEntries: { client_id: string; link_type: string; url: string; created_by?: string }[] = [];
        for (const [key, rawUrl] of Object.entries(input.links)) {
          const cleanUrl = sanitizeUrl(rawUrl);
          if (cleanUrl) {
            linkEntries.push({
              client_id: newClient.id,
              link_type: key,
              url: cleanUrl,
              created_by: actorId
            });
            savedLinks[key as ClientLinkType] = cleanUrl;
          }
        }

        if (linkEntries.length > 0) {
          await supabase.from('client_links').insert(linkEntries);
        }
      }

      // Record Audit Log
      await supabase.from('client_audit_log').insert({
        client_id: newClient.id,
        actor_id: actorId,
        action: 'client_duplicated',
        safe_metadata: {
          sourceClientId,
          sourceCompanyName: sourceClient?.company_name || 'Unknown Source',
          newCompanyName: newClient.company_name
        }
      });

      return {
        data: {
          id: newClient.id,
          companyName: newClient.company_name,
          clientName: newClient.client_name,
          package: newClient.package as ClientPackage,
          operationalManagerId: newClient.operational_manager_id,
          activationDate: newClient.activation_date,
          status: newClient.status as ClientStatus,
          pauseReason: newClient.pause_reason as ClientPauseReason | null,
          sourceClientId,
          sourceCompanyName: sourceClient?.company_name,
          links: savedLinks,
          createdBy: newClient.created_by,
          createdAt: newClient.created_at,
          updatedAt: newClient.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message || 'An unexpected error occurred while duplicating client.' };
    }
  },

  /**
   * Update Client Details & Workspace Links.
   */
  async updateClient(
    clientId: string, 
    input: UpdateClientInput, 
    actorId?: string
  ): Promise<{ data?: ClientRecord; error?: string }> {
    if (!isSupabaseConfigured || !supabase || !clientId) {
      return { error: 'Database connection is not configured.' };
    }

    try {
      // Fetch previous state for audit log
      const { data: previousClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (input.companyName !== undefined) updates.company_name = input.companyName.trim();
      if (input.clientName !== undefined) updates.client_name = input.clientName.trim();
      if (input.package !== undefined) updates.package = input.package;
      if (input.operationalManagerId !== undefined) updates.operational_manager_id = input.operationalManagerId;
      if (input.activationDate !== undefined) updates.activation_date = input.activationDate;
      if (input.status !== undefined) {
        updates.status = input.status;
        if (input.status === 'Paused') {
          updates.pause_reason = input.pauseReason || 'Operational reason';
        } else {
          updates.pause_reason = null;
        }
        if (input.status === 'Archived') {
          updates.archived_at = new Date().toISOString();
        }
      }

      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)
        .select()
        .single();

      if (updateError || !updatedClient) {
        return { error: updateError?.message || 'Failed to update client record.' };
      }

      // Update links if provided
      if (input.links !== undefined) {
        for (const [key, rawUrl] of Object.entries(input.links)) {
          const cleanUrl = sanitizeUrl(rawUrl);
          if (cleanUrl) {
            // Upsert link
            await supabase.from('client_links').upsert(
              {
                client_id: clientId,
                link_type: key,
                url: cleanUrl,
                created_by: actorId,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'client_id,link_type' }
            );
          } else {
            // If empty/invalid, remove the link
            await supabase
              .from('client_links')
              .delete()
              .eq('client_id', clientId)
              .eq('link_type', key);
          }
        }
      }

      // Record Audit Events for each changed field
      if (previousClient) {
        const auditEvents: any[] = [];
        for (const [key, newVal] of Object.entries(updates)) {
          if (key === 'updated_at') continue;
          const oldVal = previousClient[key];
          if (oldVal !== newVal) {
            auditEvents.push({
              client_id: clientId,
              actor_id: actorId,
              action: 'client_updated',
              changed_field: key,
              previous_value: String(oldVal || ''),
              new_value: String(newVal || '')
            });
          }
        }
        if (auditEvents.length > 0) {
          await supabase.from('client_audit_log').insert(auditEvents);
        }
      }

      return await this.fetchClientById(clientId).then(res => ({ data: res || undefined }));
    } catch (err: any) {
      return { error: err.message || 'Failed to update client.' };
    }
  }
};
