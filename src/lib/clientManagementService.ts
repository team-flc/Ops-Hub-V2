// ==============================================================================
// SERVICE LAYER: Client Management & LinkedIn Access Service (Phase 2B)
// Location: src/lib/clientManagementService.ts
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  ClientRecord, 
  ClientPackage, 
  ClientStatus, 
  ClientPauseReason, 
  ClientLinkType, 
  UserProfile,
  ClientLinkedInProfile,
  LinkedInReadiness
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

/**
 * Validate LinkedIn Profile URL format.
 */
export function isValidLinkedInUrl(rawUrl?: string | null): boolean {
  const sanitized = sanitizeUrl(rawUrl);
  if (!sanitized) return false;
  try {
    const parsed = new URL(sanitized);
    return parsed.hostname.includes('linkedin.com');
  } catch {
    return false;
  }
}

/**
 * Pure, reusable LinkedIn access completeness & readiness calculator.
 */
export function calculateLinkedInReadiness(
  requiredCount: number,
  profiles?: ClientLinkedInProfile[]
): LinkedInReadiness {
  const req = Math.max(1, requiredCount || 3);
  const activeProfiles = (profiles || []).filter((p) => p.status === 'active');
  const totalAdded = activeProfiles.length;

  const validSalesNavProfiles = activeProfiles.filter(
    (p) => p.salesNavigatorActive && Boolean(p.salesNavigatorActivatedOn)
  );
  const salesNavActiveCount = validSalesNavProfiles.length;

  const isProfileCountComplete = totalAdded >= req;
  const isSalesNavComplete = salesNavActiveCount >= req;
  const isComplete = isProfileCountComplete && isSalesNavComplete;

  let statusText = 'LinkedIn Access Complete';
  if (!isComplete) {
    if (totalAdded === 0) {
      statusText = `0 of ${req} LinkedIn Profiles Added`;
    } else if (totalAdded < req) {
      statusText = `${totalAdded} of ${req} LinkedIn Profiles Added`;
    } else if (salesNavActiveCount < req) {
      statusText = `${salesNavActiveCount} of ${req} Sales Navigators Active`;
    } else {
      statusText = 'LinkedIn Access Pending';
    }
  }

  const summaryLabel = isComplete 
    ? `${totalAdded}/${req} Complete` 
    : `${salesNavActiveCount}/${req} Active`;

  return {
    totalAdded,
    requiredCount: req,
    salesNavActiveCount,
    isProfileCountComplete,
    isSalesNavComplete,
    isComplete,
    statusText,
    summaryLabel
  };
}

export interface LinkedInProfileInput {
  id?: string;
  profileLabel: string;
  profileUrl: string;
  salesNavigatorActive: boolean;
  salesNavigatorActivatedOn?: string | null;
  sortOrder?: number;
}

export interface CreateClientInput {
  companyName: string;
  clientName: string;
  package: ClientPackage;
  operationalManagerId: string;
  activationDate: string;
  status: ClientStatus;
  pauseReason?: ClientPauseReason | null;
  requiredLinkedinProfileCount?: number;
  links?: Partial<Record<ClientLinkType, string>>;
  linkedinProfiles?: LinkedInProfileInput[];
}

export interface DuplicateClientInput {
  companyName: string;
  clientName: string;
  package: ClientPackage;
  operationalManagerId: string;
  activationDate: string;
  status: ClientStatus;
  pauseReason?: ClientPauseReason | null;
  requiredLinkedinProfileCount?: number;
  links?: Partial<Record<ClientLinkType, string>>;
}

export interface UpdateClientInput {
  companyName?: string;
  clientName?: string;
  businessBio?: string | null;
  industry?: string | null;
  logoUrl?: string | null;
  package?: ClientPackage;
  operationalManagerId?: string;
  activationDate?: string;
  status?: ClientStatus;
  pauseReason?: ClientPauseReason | null;
  requiredLinkedinProfileCount?: number;
  links?: Partial<Record<ClientLinkType, string>>;
}

export const clientManagementService = {
  /**
   * Fetch all accessible clients with their links and LinkedIn profiles.
   * Returns { data, error } to distinguish loading, empty, and failure states.
   */
  async fetchClients(): Promise<{ data: ClientRecord[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          client_name,
          business_bio,
          industry,
          logo_url,
          package,
          operational_manager_id,
          activation_date,
          status,
          previous_status,
          pause_reason,
          required_linkedin_profile_count,
          source_client_id,
          created_by,
          created_at,
          updated_at,
          archived_at,
          archived_by,
          archive_reason,
          manager:operational_manager_id (
            id,
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (clientsError) {
        console.error('Failed to fetch clients from Supabase:', clientsError.message);
        return { data: [], error: clientsError.message };
      }

      if (!clientsData || clientsData.length === 0) {
        return { data: [] };
      }

      const clientIds = clientsData.map((c: any) => c.id);

      // 1. Fetch Links
      const linksMap: Record<string, Partial<Record<ClientLinkType, string>>> = {};
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

      // 2. Fetch Active LinkedIn Profiles
      const linkedinMap: Record<string, ClientLinkedInProfile[]> = {};
      const { data: profilesData } = await supabase
        .from('client_linkedin_profiles')
        .select('*')
        .in('client_id', clientIds)
        .order('sort_order', { ascending: true });

      if (profilesData) {
        for (const p of profilesData) {
          if (!linkedinMap[p.client_id]) linkedinMap[p.client_id] = [];
          linkedinMap[p.client_id].push({
            id: p.id,
            clientId: p.client_id,
            profileLabel: p.profile_label,
            profileUrl: p.profile_url,
            salesNavigatorActive: Boolean(p.sales_navigator_active),
            salesNavigatorActivatedOn: p.sales_navigator_activated_on,
            sortOrder: p.sort_order || 0,
            status: p.status || 'active',
            createdBy: p.created_by,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            archivedAt: p.archived_at
          });
        }
      }

      const mappedClients: ClientRecord[] = clientsData.map((c: any) => {
        const mgr = Array.isArray(c.manager) ? c.manager[0] : c.manager;
        return {
          id: c.id,
          companyName: c.company_name,
          clientName: c.client_name,
          businessBio: c.business_bio,
          industry: c.industry,
          logoUrl: c.logo_url,
          package: c.package as ClientPackage,
          operationalManagerId: c.operational_manager_id,
          operationalManagerName: mgr?.full_name || 'Assigned Manager',
          activationDate: c.activation_date,
          status: c.status as ClientStatus,
          previousStatus: c.previous_status,
          pauseReason: c.pause_reason as ClientPauseReason | null,
          requiredLinkedinProfileCount: c.required_linkedin_profile_count || 3,
          linkedinProfiles: linkedinMap[c.id] || [],
          sourceClientId: c.source_client_id,
          links: linksMap[c.id] || {},
          createdBy: c.created_by,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          archivedAt: c.archived_at,
          archivedBy: c.archived_by,
          archiveReason: c.archive_reason
        };
      });

      return { data: mappedClients };
    } catch (err: any) {
      console.error('Error in fetchClients:', err?.message || err);
      return { data: [], error: err?.message || 'Failed to fetch clients.' };
    }
  },

  /**
   * Fetch single client details with links and LinkedIn profiles.
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
          required_linkedin_profile_count,
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

      // Fetch LinkedIn profiles
      const { data: profilesData } = await supabase
        .from('client_linkedin_profiles')
        .select('*')
        .eq('client_id', clientId)
        .order('sort_order', { ascending: true });

      const linkedinProfiles: ClientLinkedInProfile[] = (profilesData || []).map((p: any) => ({
        id: p.id,
        clientId: p.client_id,
        profileLabel: p.profile_label,
        profileUrl: p.profile_url,
        salesNavigatorActive: Boolean(p.sales_navigator_active),
        salesNavigatorActivatedOn: p.sales_navigator_activated_on,
        sortOrder: p.sort_order || 0,
        status: p.status || 'active',
        createdBy: p.created_by,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        archivedAt: p.archived_at
      }));

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
        requiredLinkedinProfileCount: c.required_linkedin_profile_count || 3,
        linkedinProfiles,
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
   * Create a new Client Workspace with links and optional LinkedIn profiles.
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

    const reqLinkedInCount = Math.max(1, input.requiredLinkedinProfileCount || 3);

    // Validate LinkedIn profile rows if provided
    const validProfilesToInsert: LinkedInProfileInput[] = [];
    const seenUrls = new Set<string>();

    if (input.linkedinProfiles && input.linkedinProfiles.length > 0) {
      for (let i = 0; i < input.linkedinProfiles.length; i++) {
        const p = input.linkedinProfiles[i];
        if (!p.profileUrl?.trim()) {
          // Blank rows are ignored during creation
          continue;
        }

        const cleanUrl = sanitizeUrl(p.profileUrl);
        if (!cleanUrl || !cleanUrl.includes('linkedin.com')) {
          return { error: `Profile row ${i + 1}: Invalid LinkedIn profile URL. Must be a valid http/https LinkedIn URL.` };
        }

        const normalizedUrl = cleanUrl.toLowerCase();
        if (seenUrls.has(normalizedUrl)) {
          return { error: `Profile row ${i + 1}: Duplicate LinkedIn profile URL entered.` };
        }
        seenUrls.add(normalizedUrl);

        if (p.salesNavigatorActive && !p.salesNavigatorActivatedOn) {
          return { error: `Profile row ${i + 1}: Sales Navigator Activation Date is required when Sales Navigator is active.` };
        }

        validProfilesToInsert.push({
          profileLabel: p.profileLabel?.trim() || `LinkedIn ID ${i + 1}`,
          profileUrl: cleanUrl,
          salesNavigatorActive: Boolean(p.salesNavigatorActive),
          salesNavigatorActivatedOn: p.salesNavigatorActive ? p.salesNavigatorActivatedOn : null,
          sortOrder: i
        });
      }
    }

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
          required_linkedin_profile_count: reqLinkedInCount,
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

      // Insert valid LinkedIn profiles
      const savedLinkedInProfiles: ClientLinkedInProfile[] = [];
      if (validProfilesToInsert.length > 0) {
        const profileInserts = validProfilesToInsert.map((p, idx) => ({
          client_id: newClient.id,
          profile_label: p.profileLabel,
          profile_url: p.profileUrl,
          sales_navigator_active: p.salesNavigatorActive,
          sales_navigator_activated_on: p.salesNavigatorActivatedOn || null,
          sort_order: idx,
          status: 'active',
          created_by: actorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { data: insertedProfiles } = await supabase
          .from('client_linkedin_profiles')
          .insert(profileInserts)
          .select();

        if (insertedProfiles) {
          for (const ip of insertedProfiles) {
            savedLinkedInProfiles.push({
              id: ip.id,
              clientId: ip.client_id,
              profileLabel: ip.profile_label,
              profileUrl: ip.profile_url,
              salesNavigatorActive: Boolean(ip.sales_navigator_active),
              salesNavigatorActivatedOn: ip.sales_navigator_activated_on,
              sortOrder: ip.sort_order,
              status: ip.status,
              createdBy: ip.created_by,
              createdAt: ip.created_at,
              updatedAt: ip.updated_at
            });
          }
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
          managerId: newClient.operational_manager_id,
          requiredLinkedinProfileCount: reqLinkedInCount,
          linkedinProfilesCount: savedLinkedInProfiles.length
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
          requiredLinkedinProfileCount: reqLinkedInCount,
          linkedinProfiles: savedLinkedInProfiles,
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
   * Duplicate Client into a fresh workspace.
   * Copies package, manager, and required_linkedin_profile_count.
   * Keeps links, profile URLs, and tasks blank.
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

    const reqLinkedInCount = Math.max(1, input.requiredLinkedinProfileCount || 3);

    try {
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
          required_linkedin_profile_count: reqLinkedInCount,
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

      // Record Audit Log
      await supabase.from('client_audit_log').insert({
        client_id: newClient.id,
        actor_id: actorId,
        action: 'client_duplicated',
        safe_metadata: {
          sourceClientId,
          sourceCompanyName: sourceClient?.company_name || 'Unknown Source',
          newCompanyName: newClient.company_name,
          requiredLinkedinProfileCount: reqLinkedInCount
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
          requiredLinkedinProfileCount: reqLinkedInCount,
          linkedinProfiles: [],
          sourceClientId,
          sourceCompanyName: sourceClient?.company_name,
          links: {},
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
      if (input.businessBio !== undefined) updates.business_bio = input.businessBio?.trim() || null;
      if (input.industry !== undefined) updates.industry = input.industry?.trim() || null;
      if (input.logoUrl !== undefined) updates.logo_url = input.logoUrl;
      if (input.package !== undefined) updates.package = input.package;
      if (input.operationalManagerId !== undefined) updates.operational_manager_id = input.operationalManagerId;
      if (input.activationDate !== undefined) updates.activation_date = input.activationDate;
      if (input.requiredLinkedinProfileCount !== undefined) {
        updates.required_linkedin_profile_count = Math.max(1, input.requiredLinkedinProfileCount);
      }
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
            await supabase
              .from('client_links')
              .delete()
              .eq('client_id', clientId)
              .eq('link_type', key);
          }
        }
      }

      // Record Audit Events
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
  },

  /**
   * Add a new LinkedIn Profile to an existing client.
   */
  async addLinkedInProfile(
    clientId: string,
    profileInput: LinkedInProfileInput,
    actorId?: string
  ): Promise<{ data?: ClientLinkedInProfile; error?: string }> {
    if (!isSupabaseConfigured || !supabase || !clientId) {
      return { error: 'Database is not configured.' };
    }

    const cleanUrl = sanitizeUrl(profileInput.profileUrl);
    if (!cleanUrl || !cleanUrl.includes('linkedin.com')) {
      return { error: 'Invalid LinkedIn Profile URL. Must be a valid http/https LinkedIn URL.' };
    }

    if (profileInput.salesNavigatorActive && !profileInput.salesNavigatorActivatedOn) {
      return { error: 'Sales Navigator Activation Date is required when Sales Navigator is active.' };
    }

    try {
      // Check duplicate URL
      const { data: existing } = await supabase
        .from('client_linkedin_profiles')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .ilike('profile_url', cleanUrl)
        .maybeSingle();

      if (existing) {
        return { error: 'This LinkedIn profile URL is already added for this client.' };
      }

      const { data: newProfile, error } = await supabase
        .from('client_linkedin_profiles')
        .insert({
          client_id: clientId,
          profile_label: profileInput.profileLabel.trim() || 'LinkedIn ID',
          profile_url: cleanUrl,
          sales_navigator_active: Boolean(profileInput.salesNavigatorActive),
          sales_navigator_activated_on: profileInput.salesNavigatorActive ? profileInput.salesNavigatorActivatedOn : null,
          sort_order: profileInput.sortOrder || 0,
          status: 'active',
          created_by: actorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error || !newProfile) {
        return { error: error?.message || 'Failed to add LinkedIn profile.' };
      }

      // Record Audit
      await supabase.from('client_audit_log').insert({
        client_id: clientId,
        linkedin_profile_id: newProfile.id,
        actor_id: actorId,
        action: 'linkedin_profile_added',
        changed_field: 'profile_url',
        new_value: cleanUrl,
        safe_metadata: {
          profileLabel: newProfile.profile_label,
          salesNavigatorActive: newProfile.sales_navigator_active
        }
      });

      return {
        data: {
          id: newProfile.id,
          clientId: newProfile.client_id,
          profileLabel: newProfile.profile_label,
          profileUrl: newProfile.profile_url,
          salesNavigatorActive: Boolean(newProfile.sales_navigator_active),
          salesNavigatorActivatedOn: newProfile.sales_navigator_activated_on,
          sortOrder: newProfile.sort_order,
          status: newProfile.status,
          createdBy: newProfile.created_by,
          createdAt: newProfile.created_at,
          updatedAt: newProfile.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message || 'Error adding LinkedIn profile.' };
    }
  },

  /**
   * Update an existing LinkedIn Profile.
   */
  async updateLinkedInProfile(
    profileId: string,
    profileInput: Partial<LinkedInProfileInput>,
    actorId?: string
  ): Promise<{ data?: ClientLinkedInProfile; error?: string }> {
    if (!isSupabaseConfigured || !supabase || !profileId) {
      return { error: 'Database is not configured.' };
    }

    try {
      const { data: previous } = await supabase
        .from('client_linkedin_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (!previous) return { error: 'Profile not found.' };

      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (profileInput.profileLabel !== undefined) {
        updates.profile_label = profileInput.profileLabel.trim();
      }

      if (profileInput.profileUrl !== undefined) {
        const cleanUrl = sanitizeUrl(profileInput.profileUrl);
        if (!cleanUrl || !cleanUrl.includes('linkedin.com')) {
          return { error: 'Invalid LinkedIn Profile URL.' };
        }
        updates.profile_url = cleanUrl;
      }

      if (profileInput.salesNavigatorActive !== undefined) {
        updates.sales_navigator_active = profileInput.salesNavigatorActive;
        if (profileInput.salesNavigatorActive) {
          if (!profileInput.salesNavigatorActivatedOn && !previous.sales_navigator_activated_on) {
            return { error: 'Sales Navigator Activation Date is required.' };
          }
          updates.sales_navigator_activated_on = profileInput.salesNavigatorActivatedOn || previous.sales_navigator_activated_on;
        } else {
          updates.sales_navigator_activated_on = null;
        }
      }

      if (profileInput.sortOrder !== undefined) {
        updates.sort_order = profileInput.sortOrder;
      }

      const { data: updated, error } = await supabase
        .from('client_linkedin_profiles')
        .update(updates)
        .eq('id', profileId)
        .select()
        .single();

      if (error || !updated) {
        return { error: error?.message || 'Failed to update profile.' };
      }

      // Record Audit
      await supabase.from('client_audit_log').insert({
        client_id: updated.client_id,
        linkedin_profile_id: updated.id,
        actor_id: actorId,
        action: 'linkedin_profile_updated',
        safe_metadata: {
          previousValues: previous,
          updatedValues: updates
        }
      });

      return {
        data: {
          id: updated.id,
          clientId: updated.client_id,
          profileLabel: updated.profile_label,
          profileUrl: updated.profile_url,
          salesNavigatorActive: Boolean(updated.sales_navigator_active),
          salesNavigatorActivatedOn: updated.sales_navigator_activated_on,
          sortOrder: updated.sort_order,
          status: updated.status,
          createdBy: updated.created_by,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        }
      };
    } catch (err: any) {
      return { error: err.message || 'Error updating LinkedIn profile.' };
    }
  },

  /**
   * Archive a LinkedIn Profile (never hard deleted).
   */
  async archiveLinkedInProfile(profileId: string, actorId?: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase || !profileId) return { success: false, error: 'Database not ready.' };

    try {
      const { data: profile } = await supabase
        .from('client_linkedin_profiles')
        .select('client_id, profile_label')
        .eq('id', profileId)
        .single();

      const { error } = await supabase
        .from('client_linkedin_profiles')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId);

      if (error) return { success: false, error: error.message };

      if (profile) {
        await supabase.from('client_audit_log').insert({
          client_id: profile.client_id,
          linkedin_profile_id: profileId,
          actor_id: actorId,
          action: 'linkedin_profile_archived',
          safe_metadata: { profileLabel: profile.profile_label }
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
