import { supabase } from './supabase';
import { UserProfile } from '../types';
import { auditService } from './auditService';

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
   * Update self profile (allowed self-editable fields only)
   */
  async updateSelfProfile(params: {
    fullName: string;
    bio?: string | null;
    linkedinUrl?: string | null;
    contactEmail?: string | null;
    phone?: string | null;
    backupPhone?: string | null;
    avatarUrl?: string | null;
  }): Promise<{ data: UserProfile | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Database is not configured.' };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'User is not authenticated.' };
      }

      if (!params.fullName.trim()) {
        return { data: null, error: 'Full name cannot be blank.' };
      }

      // Fetch previous profile for audit
      const { data: prev } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const updatePayload: Record<string, any> = {
        full_name: params.fullName.trim(),
        bio: params.bio?.trim() || null,
        linkedin_url: params.linkedinUrl?.trim() || null,
        contact_email: params.contactEmail?.trim() || null,
        phone: params.phone?.trim() || null,
        backup_phone: params.backupPhone?.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (params.avatarUrl !== undefined) {
        updatePayload.avatar_url = params.avatarUrl;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      // Log system audit event
      await auditService.logAuditEvent({
        action: 'profile_updated',
        entityType: 'profile',
        entityId: user.id,
        entityName: data.full_name,
        previousState: {
          full_name: prev?.full_name,
          bio: prev?.bio,
          linkedin_url: prev?.linkedin_url,
          contact_email: prev?.contact_email,
          phone: prev?.phone,
          backup_phone: prev?.backup_phone,
          avatar_url: prev?.avatar_url
        },
        newState: {
          full_name: data.full_name,
          bio: data.bio,
          linkedin_url: data.linkedin_url,
          contact_email: data.contact_email,
          phone: data.phone,
          backup_phone: data.backup_phone,
          avatar_url: data.avatar_url
        },
        reason: 'User updated personal profile details'
      });

      const updatedProfile: UserProfile = {
        id: data.id,
        fullName: data.full_name,
        workEmail: data.work_email,
        email: data.work_email,
        phone: data.phone,
        backupPhone: data.backup_phone,
        bio: data.bio,
        avatarUrl: data.avatar_url,
        linkedinUrl: data.linkedin_url,
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

      return { data: updatedProfile, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to update profile.' };
    }
  }
};