import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadImageResult {
  path: string | null;
  error: string | null;
}

// In-memory cache for short-lived signed URLs
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

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
   * Upload user profile avatar to private storage
   * Returns relative storage object path (NOT a public URL)
   */
  async uploadAvatar(file: File, userId: string): Promise<UploadImageResult> {
    const validation = this.validateImage(file);
    if (!validation.isValid) {
      return { path: null, error: validation.error };
    }
    if (!supabase) {
      return { path: null, error: 'Database storage is not configured.' };
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
        return { path: null, error: error.message };
      }

      return { path: data.path, error: null };
    } catch (err: any) {
      return { path: null, error: err?.message || 'Failed to upload profile picture.' };
    }
  },

  /**
   * Upload client brand logo to private storage
   * Returns relative storage object path (NOT a public URL)
   */
  async uploadClientLogo(file: File, clientId: string): Promise<UploadImageResult> {
    const validation = this.validateImage(file);
    if (!validation.isValid) {
      return { path: null, error: validation.error };
    }
    if (!supabase) {
      return { path: null, error: 'Database storage is not configured.' };
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
        return { path: null, error: error.message };
      }

      return { path: data.path, error: null };
    } catch (err: any) {
      return { path: null, error: err?.message || 'Failed to upload client logo.' };
    }
  },

  /**
   * Authoritative signed URL generation for private storage objects
   * Signed URLs are valid for 3600 seconds (1 hour).
   */
  async getSignedUrl(bucket: 'profile-avatars' | 'client-logos', path: string): Promise<string | null> {
    if (!path || !supabase) return null;

    // Direct data URI or external mock support
    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const cacheKey = `${bucket}:${path}`;
    const cached = signedUrlCache.get(cacheKey);
    const now = Date.now();

    // Re-use cached signed URL if valid for at least 5 more minutes
    if (cached && cached.expiresAt > now + 300 * 1000) {
      return cached.url;
    }

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (error || !data?.signedUrl) {
        return null;
      }

      signedUrlCache.set(cacheKey, {
        url: data.signedUrl,
        expiresAt: now + 3600 * 1000
      });

      return data.signedUrl;
    } catch {
      return null;
    }
  }
};

/**
 * React Hook: Resolves private storage object paths into short-lived signed URLs.
 * Handles cache hits, lifecycle unmounts, and fallback states seamlessly.
 */
export function useSignedUrl(
  bucket: 'profile-avatars' | 'client-logos',
  path: string | null | undefined
): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!path) {
      setSignedUrl(null);
      return;
    }

    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
      setSignedUrl(path);
      return;
    }

    storageService.getSignedUrl(bucket, path).then((url) => {
      if (!isCancelled) {
        setSignedUrl(url);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [bucket, path]);

  return signedUrl;
}