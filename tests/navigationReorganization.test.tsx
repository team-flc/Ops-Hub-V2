import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  UserProfile,
  ClientRecord,
  UserRole
} from '../src/types';
import { Sidebar } from '../src/components/layout/Sidebar';
import { SettingsLayout } from '../src/components/settings/SettingsLayout';
import { useOpsStore } from '../src/store/opsStore';

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: () => mockGetSession(),
        signOut: vi.fn()
      },
      from: (table: string) => mockFrom(table),
      functions: {
        invoke: (...args: any[]) => mockFunctionsInvoke(...args)
      }
    }
  };
});

let mockCurrentUser: { id: string; role: UserRole; fullName: string } = {
  id: 'mgr-1',
  role: 'operational_manager',
  fullName: 'John Manager'
};

vi.mock('../src/context/AuthContext', () => {
  return {
    useAuth: () => ({
      user: { id: mockCurrentUser.id, email: `${mockCurrentUser.id}@opshub.local` },
      profile: {
        id: mockCurrentUser.id,
        role: mockCurrentUser.role,
        fullName: mockCurrentUser.fullName,
        status: 'active'
      },
      hasRole: (role: string) => mockCurrentUser.role === role,
      isOwner: () => mockCurrentUser.role === 'owner',
      isOperationalManager: () => mockCurrentUser.role === 'operational_manager',
      isTeamMember: () => mockCurrentUser.role === 'team_member',
      isClient: () => mockCurrentUser.role === 'client',
      loading: false
    })
  };
});

const mockClient: ClientRecord = {
  id: 'client-1',
  companyName: 'Apex Brands',
  clientName: 'Alice Smith',
  package: 'Advanced',
  operationalManagerId: 'mgr-1',
  operationalManagerName: 'John Manager',
  activationDate: '2026-01-15',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  links: {
    website: 'https://apexbrands.com',
    flc_landing_page: 'https://apexbrands.com/flc'
  },
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z'
};

describe('Navigation Reorganization Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 'mgr-1',
      role: 'operational_manager',
      fullName: 'John Manager'
    };
    mockGetUser.mockResolvedValue({ data: { user: { id: 'mgr-1' } }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } }, error: null });

    useOpsStore.getState().setClients([mockClient]);
    useOpsStore.getState().setSelectedClientId('client-1');
  });

  describe('1. Sidebar Navigation Structure', () => {
    it('1.1 verifies Sidebar no longer renders the old Operations & Workspace section', () => {
      render(<Sidebar />);

      // The text "Operations & Workspace" must not exist in the sidebar
      expect(screen.queryByText(/Operations & Workspace/i)).not.toBeInTheDocument();
    });

    it('1.2 renders Client Switcher, Workspace Links, and Settings button at bottom for Manager/Owner', () => {
      render(<Sidebar />);

      // Client Switcher & Workspace Links present
      expect(screen.getByText('Workspace Links')).toBeInTheDocument();
      expect(screen.getByText('Website')).toBeInTheDocument();
      expect(screen.getByText('Landing Page')).toBeInTheDocument();

      // Settings button at the bottom
      const settingsBtn = screen.getByRole('button', { name: /Settings/i });
      expect(settingsBtn).toBeInTheDocument();
    });

    it('1.3 renders Settings button in Sidebar for Team Member (all staff access)', () => {
      mockCurrentUser = {
        id: 'tm-1',
        role: 'team_member',
        fullName: 'Team Member 1'
      };

      render(<Sidebar />);

      // Settings button is visible to team members
      const settingsBtn = screen.getByRole('button', { name: /Settings/i });
      expect(settingsBtn).toBeInTheDocument();
    });
  });

  describe('2. Settings Top Navigation & Role-Based Permissions', () => {
    it('2.1 renders all 9 tabs for Owner and Operational Manager', () => {
      mockCurrentUser = {
        id: 'owner-1',
        role: 'owner',
        fullName: 'Owner User'
      };

      render(<SettingsLayout initialTab="dashboard" />);

      expect(screen.getByTestId('settings-tab-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-workspace')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-attendance')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-employee_operations')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-team')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-clients')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-templates')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-archive')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-audit')).toBeInTheDocument();
    });

    it('2.2 renders only permitted operational tabs (My Dashboard, Client Workspace, My Attendance & Portal) for Team Member', () => {
      mockCurrentUser = {
        id: 'tm-1',
        role: 'team_member',
        fullName: 'Team Member 1'
      };

      render(<SettingsLayout initialTab="dashboard" />);

      // Permitted tabs visible
      expect(screen.getByTestId('settings-tab-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-workspace')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-attendance')).toBeInTheDocument();

      // Restricted tabs must NOT be in navigation
      expect(screen.queryByTestId('settings-tab-employee_operations')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-tab-team')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-tab-clients')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-tab-templates')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-tab-archive')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-tab-audit')).not.toBeInTheDocument();
    });

    it('2.3 displays Access Restricted when Team Member attempts to access a restricted tab', () => {
      mockCurrentUser = {
        id: 'tm-1',
        role: 'team_member',
        fullName: 'Team Member 1'
      };

      render(<SettingsLayout initialTab="team" />);

      // Content displays Access Restricted
      expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.queryByText(/Archive Center/i)).not.toBeInTheDocument();
    });

    it('2.4 renders Back to Workspace shortcut button', () => {
      render(<SettingsLayout initialTab="dashboard" />);

      const backBtn = screen.getByRole('button', { name: /Back to Workspace/i });
      expect(backBtn).toBeInTheDocument();
    });
  });
});
