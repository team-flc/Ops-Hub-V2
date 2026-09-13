import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ProfileDropdown } from '../src/components/profile/ProfileDropdown';
import { storageService } from '../src/lib/storageService';

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFromSelect = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageGetPublicUrl = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: () => mockGetSession(),
        onAuthStateChange: () => mockOnAuthStateChange(),
        signOut: vi.fn().mockResolvedValue({ error: null })
      },
      from: (table: string) => ({
        select: (_cols?: string) => ({
          eq: (...eqArgs: any[]) => ({
            maybeSingle: () => mockFromSelect(table, eqArgs),
            single: () => mockFromSelect(table, eqArgs),
            order: () => Promise.resolve({ data: [], error: null })
          }),
          in: () => ({
            or: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            }),
            order: () => Promise.resolve({ data: [], error: null })
          }),
          order: () => Promise.resolve({ data: [], error: null })
        })
      }),
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: (path: string, expiry: number) => mockStorageCreateSignedUrl(bucket, path, expiry),
          getPublicUrl: (path: string) => mockStorageGetPublicUrl(bucket, path),
          upload: vi.fn().mockResolvedValue({ data: { path: 'avatars/usr-1/test.png' }, error: null })
        })
      }
    }
  };
});

describe('Profile Avatar & DP Rendering Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'usr-1',
          email: 'maaz@flc.com'
        }
      },
      error: null
    });
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: { id: 'usr-1', email: 'maaz@flc.com' }
        }
      },
      error: null
    });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.signed.com/avatars/usr-1/dp.png' },
      error: null
    });
    mockStorageGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.public.com/avatars/usr-1/dp.png' }
    });
  });

  it('1. AuthContext loads avatar_url from profiles table and populates profile.avatarUrl', async () => {
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-1',
        full_name: 'Muhammad Maaz Khan',
        role: 'operational_manager',
        status: 'active',
        work_email: 'maaz@flc.com',
        avatar_url: 'avatars/usr-1/dp.png',
        organization_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      },
      error: null
    });

    let contextValue: any = null;
    const TestConsumer = () => {
      contextValue = useAuth();
      return <div>Loaded: {contextValue.profile?.fullName}</div>;
    };

    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(contextValue.profile).not.toBeNull();
      expect(contextValue.profile?.avatarUrl).toBe('avatars/usr-1/dp.png');
      expect(contextValue.profile?.fullName).toBe('Muhammad Maaz Khan');
    });
  });

  it('2. ProfileDropdown renders avatar image in trigger button and dropdown menu when profile has avatarUrl', async () => {
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-1',
        full_name: 'Muhammad Maaz Khan',
        role: 'operational_manager',
        status: 'active',
        work_email: 'maaz@flc.com',
        avatar_url: 'https://images.example.com/maaz-dp.jpg',
        organization_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      },
      error: null
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <ProfileDropdown />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    // Wait for image to render in trigger button
    await waitFor(() => {
      const avatarImg = screen.getByAltText('Muhammad Maaz Khan');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute('src', 'https://images.example.com/maaz-dp.jpg');
    });

    // Open dropdown menu
    const triggerBtn = screen.getByLabelText('Staff Profile Menu');
    await act(async () => {
      fireEvent.click(triggerBtn);
    });

    // Wait for dropdown menu to show avatar and details
    await waitFor(() => {
      expect(screen.getByText('Muhammad Maaz Khan')).toBeInTheDocument();
      expect(screen.getByText('Operational Manager')).toBeInTheDocument();
      expect(screen.getByText('maaz@flc.com')).toBeInTheDocument();
      const imgs = screen.getAllByAltText('Muhammad Maaz Khan');
      expect(imgs.length).toBe(2); // Trigger button + dropdown header
    });
  });

  it('3. ProfileDropdown gracefully falls back to initials when avatarUrl is null', async () => {
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-1',
        full_name: 'Muhammad Maaz Khan',
        role: 'operational_manager',
        status: 'active',
        work_email: 'maaz@flc.com',
        avatar_url: null,
        organization_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      },
      error: null
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <ProfileDropdown />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    // Initials MM should be rendered
    await waitFor(() => {
      expect(screen.getByText('MM')).toBeInTheDocument();
      expect(screen.queryByAltText('Muhammad Maaz Khan')).not.toBeInTheDocument();
    });
  });

  it('4. storageService.getSignedUrl cleans bucket prefix and resolves relative storage paths', async () => {
    const signedUrl = await storageService.getSignedUrl('profile-avatars', 'profile-avatars/avatars/usr-1/dp.png');
    expect(signedUrl).toBe('https://storage.signed.com/avatars/usr-1/dp.png');
    expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith('profile-avatars', 'avatars/usr-1/dp.png', 3600);
  });
});
