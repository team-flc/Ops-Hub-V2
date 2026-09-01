import { supabase } from './supabase';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadImageResult {
  url: string | null;
  error: string | null;
}

export const storageService = {
  /**
   * Validate image before uploading
   */
  validateImage(file: File): { isValid: boolean; error: string | null } {
    if (!file) {
      return { isValid: false, error: 'No file selected.' };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { 
        isValid: false, 
        error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.' 
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { 
        isValid: false, 
        error: 'File size exceeds maximum limit of 5 MB.' 
      };
    }

    return { isValid: true, error: null };
  },

  /**
   * Upload user profile avatar
   */
  async uploadAvatar(file: File, userId: string): Promise<UploadImageResult> {
    const validation = this.validateImage(file);
    if (!validation.isValid) {
      return { url: null, error: validation.error };
    }
    if (!supabase) {
      return { url: null, error: 'Database storage is not configured.' };
    }

    try {
      const ext = file.name.split('.').pop() || 'png';
      const randomStr = Math.random().toString(36).substring(2, 9);
      const filePath = `avatars/${userId}/${Date.now()}_${randomStr}.${ext}`;

      const { data, error } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        return { url: null, error: error.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(data.path);

      return { url: publicUrlData.publicUrl, error: null };
    } catch (err: any) {
      return { url: null, error: err?.message || 'Failed to upload profile picture.' };
    }
  },

  /**
   * Upload client brand logo
   */
  async uploadClientLogo(file: File, clientId: string): Promise<UploadImageResult> {
    const validation = this.validateImage(file);
    if (!validation.isValid) {
      return { url: null, error: validation.error };
    }
    if (!supabase) {
      return { url: null, error: 'Database storage is not configured.' };
    }

    try {
      const ext = file.name.split('.').pop() || 'png';
      const randomStr = Math.random().toString(36).substring(2, 9);
      const filePath = `logos/${clientId}/${Date.now()}_${randomStr}.${ext}`;

      const { data, error } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        return { url: null, error: error.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from('client-logos')
        .getPublicUrl(data.path);

      return { url: publicUrlData.publicUrl, error: null };
    } catch (err: any) {
      return { url: null, error: err?.message || 'Failed to upload client logo.' };
    }
  }
};