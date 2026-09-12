import { supabase } from './supabase';
import { UserProfile } from '../types';

export const profileService = {
  /**
   * Fetch complete user profile
   */
  async fetchProfile(userId: string): Promise<{ data: UserProfile | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Database is not configured.' };
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          work_email,
          phone,
          backup_phone,
          bio,
          avatar_url,
          linkedin_url,
          facebook_url,
          instagram_url,
          contact_email,
          role,
          status,
          designation_id,
          reporting_manager_id,
          start_date,
          suspended_at,
          suspended_by,
          archived_at,
          archived_by,
          archive_reason,
          previous_status,
          organization_id,
          created_at,
          updated_at
        `)
        .eq('id', userId)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const profile: UserProfile = {
        id: data.id,
        fullName: data.full_name,
        workEmail: data.work_email,
        email: data.work_email,
        phone: data.phone,
        backupPhone: data.backup_phone,
        bio: data.bio,
        avatarUrl: data.avatar_url,
        linkedinUrl: data.linkedin_url,
        facebookUrl: data.facebook_url,
        instagramUrl: data.instagram_url,
        contactEmail: data.contact_email,
        role: data.role,
        status: data.status,
        designationId: data.designation_id,
        reportingManagerId: data.reporting_manager_id,
        startDate: data.start_date,
        suspendedAt: data.suspended_at,
        suspendedBy: data.suspended_by,
        archivedAt: data.archived_at,
        archivedBy: data.archived_by,
        archiveReason: data.archive_reason,
        previousStatus: data.previous_status,
        organizationId: data.organization_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return { data: profile, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to fetch profile' };
    }
  },

  /**
   * Update self profile via server-authoritative Edge Function (manage-profile)
   * Enforces server-side validation and generates immutable system audit events.
   */
  async updateSelfProfile(params: {
    fullName: string;
    bio?: string | null;
    linkedinUrl?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    contactEmail?: string | null;
    phone?: string | null;
    backupPhone?: string | null;
    avatarUrl?: string | null;
  }): Promise<{ data: UserProfile | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Database is not configured.' };
    try {
      if (!params.fullName.trim()) {
        return { data: null, error: 'Full name cannot be blank.' };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        return { data: null, error: 'User is not authenticated.' };
      }

      const { data, error } = await supabase.functions.invoke('manage-profile', {
        body: params,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) {
        return { data: null, error: error.message || 'Failed to update profile.' };
      }

      if (data?.error) {
        return { data: null, error: data.error };
      }

      const raw = data?.profile;
      if (!raw) {
        return { data: null, error: 'No profile data returned.' };
      }

      const updatedProfile: UserProfile = {
        id: raw.id,
        fullName: raw.full_name,
        workEmail: raw.work_email,
        email: raw.work_email,
        phone: raw.phone,
        backupPhone: raw.backup_phone,
        bio: raw.bio,
        avatarUrl: raw.avatar_url,
        linkedinUrl: raw.linkedin_url,
        facebookUrl: raw.facebook_url,
        instagramUrl: raw.instagram_url,
        contactEmail: raw.contact_email,
        role: raw.role,
        status: raw.status,
        designationId: raw.designation_id,
        reportingManagerId: raw.reporting_manager_id,
        startDate: raw.start_date,
        suspendedAt: raw.suspended_at,
        suspendedBy: raw.suspended_by,
        archivedAt: raw.archived_at,
        archivedBy: raw.archived_by,
        archiveReason: raw.archive_reason,
        previousStatus: raw.previous_status,
        organizationId: raw.organization_id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at
      };

      return { data: updatedProfile, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to update profile.' };
    }
  }
};