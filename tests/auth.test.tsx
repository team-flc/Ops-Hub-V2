import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { LoginPage } from '../src/components/auth/LoginPage';
import { ForgotPasswordPage } from '../src/components/auth/ForgotPasswordPage';
import { UpdatePasswordPage } from '../src/components/auth/UpdatePasswordPage';
import { ClientPortalHoldingPage } from '../src/components/auth/ClientPortalHoldingPage';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';

// Mock Supabase client
vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signInWithPassword: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
        updateUser: vi.fn().mockResolvedValue({ data: {}, error: null })
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      })
    }
  };
});

describe('Phase 1 Production Authentication Gate Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders the real login page with required FLC branding and exact copy', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    expect(screen.getByText('FLC Ops Hub')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(
      screen.getByText('Sign in to manage your clients, tasks, reporting and delivery operations.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Secure access for authorized FLC team members and clients.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Work Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to ops hub/i })).toBeInTheDocument();
    expect(
      screen.getByText('Don’t have access? Contact your FLC administrator.')
    ).toBeInTheDocument();
  });

  it('2. Redirects unauthenticated visitor attempting to access protected route to /login', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>LOGIN_PAGE_RENDERED</div>} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <div>INTERNAL_STAFF_WORKSPACE</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('LOGIN_PAGE_RENDERED')).toBeInTheDocument();
      expect(screen.queryByText('INTERNAL_STAFF_WORKSPACE')).not.toBeInTheDocument();
    });
  });

  it('3. Displays generic error message on invalid login without revealing account existence', async () => {
    const { supabase } = await import('../src/lib/supabase');
    (supabase!.auth.signInWithPassword as any).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' }
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^Work Email$/i), {
        target: { value: 'unknown@faseehlall.com' }
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: 'WrongPassword123' }
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in to ops hub/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't sign you in. Check your email and password and try again.")
      ).toBeInTheDocument();
    });
  });

  it('4. Forgot password displays generic success message', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/forgot-password']}>
          <AuthProvider>
            <ForgotPasswordPage />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Reset your password')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^Work Email$/i), {
        target: { value: 'user@faseehlall.com' }
      });
      fireEvent.click(screen.getByRole('button', { name: /send reset instructions/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText('If an account exists for this email, password reset instructions have been sent.')
      ).toBeInTheDocument();
    });
  });

  it('5. Renders isolated ClientPortalHoldingPage with zero internal staff content', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/client']}>
          <AuthProvider>
            <ClientPortalHoldingPage />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Client Portal')).toBeInTheDocument();
    expect(
      screen.getByText('Your secure client workspace is being prepared.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

    // Verify complete absence of internal staff dashboard & navigation
    expect(screen.queryByText(/Executive Dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/All Tasks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SOPs & Playbooks/i)).not.toBeInTheDocument();
  });

  it('6. Update password page shows expired message when no valid recovery session is present', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/update-password']}>
          <AuthProvider>
            <UpdatePasswordPage />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Recovery Session Expired')).toBeInTheDocument();
    expect(screen.getByText('Request New Link')).toBeInTheDocument();
  });
});
