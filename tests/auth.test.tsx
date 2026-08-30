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
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockFromSelect = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: () => mockGetSession(),
        onAuthStateChange: () => mockOnAuthStateChange(),
        signInWithPassword: (creds: any) => mockSignInWithPassword(creds),
        signOut: () => mockSignOut(),
        resetPasswordForEmail: (email: any, opts: any) => mockResetPasswordForEmail(email, opts),
        updateUser: (attrs: any) => mockUpdateUser(attrs)
      },
      from: (table: string) => ({
        select: (...args: any[]) => ({
          eq: (...eqArgs: any[]) => ({
            maybeSingle: () => mockFromSelect(table, eqArgs),
            single: () => mockFromSelect(table, eqArgs)
          }),
          order: () => Promise.resolve({ data: [], error: null })
        })
      })
    }
  };
});

describe('Phase 1.1 Role-Isolation & Authentication Hardening Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mockFromSelect.mockResolvedValue({ data: null, error: null });
  });

  it('1. Anonymous user attempting to access staff app (/) is redirected to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>LOGIN_GATE</div>} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
                    <div>STAFF_APP</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('LOGIN_GATE')).toBeInTheDocument();
      expect(screen.queryByText('STAFF_APP')).not.toBeInTheDocument();
    });
  });

  it('2. Anonymous user attempting to access client portal (/client) is redirected to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/client']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>LOGIN_GATE</div>} />
              <Route
                path="/client"
                element={
                  <ProtectedRoute allowedRoles={['client']}>
                    <div>CLIENT_HOLDING_PORTAL</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('LOGIN_GATE')).toBeInTheDocument();
      expect(screen.queryByText('CLIENT_HOLDING_PORTAL')).not.toBeInTheDocument();
    });
  });

  it('3. Active Owner can access staff app, but is redirected to / when opening /client', async () => {
    const fakeUser = { id: 'usr-owner-1', email: 'owner@faseehlall.com' };
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeUser } }, error: null });
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-owner-1',
        full_name: 'Atif Khan',
        role: 'owner',
        status: 'active'
      },
      error: null
    });

    // Attempting /client as owner
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/client']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/client"
                element={
                  <ProtectedRoute allowedRoles={['client']}>
                    <div>CLIENT_PORTAL_CONTENT</div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
                    <div>STAFF_WORKSPACE_AUTHORIZED</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('STAFF_WORKSPACE_AUTHORIZED')).toBeInTheDocument();
      expect(screen.queryByText('CLIENT_PORTAL_CONTENT')).not.toBeInTheDocument();
    });
  });

  it('4. Active Client can access client portal, but is redirected to /client when opening staff app', async () => {
    const fakeClient = { id: 'usr-client-1', email: 'client@partner.com' };
    mockGetUser.mockResolvedValue({ data: { user: fakeClient }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeClient } }, error: null });
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-client-1',
        full_name: 'Client Partner',
        role: 'client',
        status: 'active'
      },
      error: null
    });

    // Attempting staff route / as client
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/client"
                element={
                  <ProtectedRoute allowedRoles={['client']}>
                    <div>CLIENT_HOLDING_PORTAL_AUTHORIZED</div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/*"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
                    <div>STAFF_WORKSPACE_SECRET</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('CLIENT_HOLDING_PORTAL_AUTHORIZED')).toBeInTheDocument();
      expect(screen.queryByText('STAFF_WORKSPACE_SECRET')).not.toBeInTheDocument();
    });
  });

  it('5. Inactive or Suspended user is denied access and presented with account status screen', async () => {
    const fakeSuspended = { id: 'usr-suspended-1', email: 'suspended@faseehlall.com' };
    mockGetUser.mockResolvedValue({ data: { user: fakeSuspended }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeSuspended } }, error: null });
    mockFromSelect.mockResolvedValue({
      data: {
        id: 'usr-suspended-1',
        full_name: 'Suspended Staff',
        role: 'team_member',
        status: 'suspended'
      },
      error: null
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
              <div>STAFF_WORKSPACE_SHOULD_NEVER_SHOW</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Your account has been suspended/i)).toBeInTheDocument();
      expect(screen.queryByText('STAFF_WORKSPACE_SHOULD_NEVER_SHOW')).not.toBeInTheDocument();
    });
  });

  it('6. Missing profile fails closed with Account Configuration Notice and zero exposure', async () => {
    const fakeOrphan = { id: 'usr-orphan-1', email: 'orphan@faseehlall.com' };
    mockGetUser.mockResolvedValue({ data: { user: fakeOrphan }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeOrphan } }, error: null });
    mockFromSelect.mockResolvedValue({
      data: null,
      error: null
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <ProtectedRoute allowedRoles={['owner', 'operational_manager', 'team_member']}>
              <div>CONFIDENTIAL_OPS_DATA</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Account Configuration Notice/i)).toBeInTheDocument();
      expect(screen.queryByText('CONFIDENTIAL_OPS_DATA')).not.toBeInTheDocument();
    });
  });

  it('7. Client holding page does not display full email address or staff features', () => {
    render(
      <MemoryRouter initialEntries={['/client']}>
        <AuthProvider>
          <ClientPortalHoldingPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /client portal/i })).toBeInTheDocument();
    expect(
      screen.getByText('Your secure client workspace is being prepared.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

    // Verify privacy: No email and no staff modules
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Executive Dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/All Tasks/i)).not.toBeInTheDocument();
  });
});
