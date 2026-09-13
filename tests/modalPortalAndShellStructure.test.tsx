import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useOpsStore } from '../src/store/opsStore';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Header } from '../src/components/layout/Header';
import { SettingsLayout } from '../src/components/settings/SettingsLayout';
import { CreateClientModal } from '../src/components/clients/CreateClientModal';
import { DuplicateClientModal } from '../src/components/clients/DuplicateClientModal';
import { Modal } from '../src/components/common/Modal';
import { ClientRecord, UserProfile } from '../src/types';

const { mockProfile, mockClient } = vi.hoisted(() => {
  const profile: UserProfile = {
    id: 'usr-1',
    authUserId: 'auth-1',
    workEmail: 'owner@faseehlall.com',
    fullName: 'Executive Owner',
    role: 'owner',
    designationId: 'des-1',
    status: 'active',
    departmentIds: ['dept-1'],
    assignedClientIds: ['client-1'],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  };

  const client: ClientRecord = {
    id: 'client-1',
    companyName: 'Acme Global',
    clientName: 'Alice CEO',
    package: 'Advanced',
    operationalManagerId: 'usr-1',
    operationalManagerName: 'Executive Owner',
    status: 'Active',
    activationDate: '2026-09-01',
    requiredLinkedinProfilesCount: 5,
    linkedinProfiles: [],
    links: {
      website: 'https://acme.com',
      linkedin_company: 'https://linkedin.com/company/acme',
      google_drive: 'https://drive.google.com/drive/folders/acme',
      facebook: 'https://facebook.com/acme',
      instagram: 'https://instagram.com/acme',
      slack_channel: 'https://slack.com/acme',
      whatsapp_group: 'https://chat.whatsapp.com/acme'
    },
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  };

  return { mockProfile: profile, mockClient: client };
});

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'owner@faseehlall.com' },
    profile: mockProfile,
    signOut: vi.fn(),
    refreshProfile: vi.fn()
  })
}));

vi.mock('../src/lib/clientManagementService', () => ({
  clientManagementService: {
    fetchClients: vi.fn().mockResolvedValue({ data: [mockClient], error: null }),
    fetchEligibleManagers: vi.fn().mockResolvedValue([mockProfile]),
    createClient: vi.fn().mockResolvedValue({ data: mockClient, error: null })
  },
  sanitizeUrl: (url?: string) => url?.trim() || undefined,
  isValidLinkedInUrl: (url: string) => url.includes('linkedin.com')
}));

describe('Modal Portal & Shell Structural Verification', () => {
  beforeEach(() => {
    useOpsStore.getState().setClients([mockClient]);
    useOpsStore.getState().setSelectedClientId('client-1');
  });

  describe('1. Modal Portal & DOM Hierarchy Verification', () => {
    it('renders CreateClientModal as a direct child of document.body via Portal', () => {
      const { container } = render(
        <div id="sidebar-container">
          <CreateClientModal
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
            currentUserProfile={mockProfile}
            eligibleManagers={[mockProfile]}
          />
        </div>
      );

      const modalHeading = screen.getByText('Create New Client Workspace');
      expect(modalHeading).toBeInTheDocument();

      // The modal heading must NOT be inside the sidebar-container
      const sidebarContainer = container.querySelector('#sidebar-container');
      expect(sidebarContainer).not.toContainElement(modalHeading);

      // It must be a descendant of document.body
      expect(document.body).toContainElement(modalHeading);
    });

    it('renders DuplicateClientModal as a direct child of document.body via Portal', () => {
      const { container } = render(
        <div id="sidebar-container">
          <DuplicateClientModal
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
            sourceClient={mockClient}
            currentUserProfile={mockProfile}
            eligibleManagers={[mockProfile]}
          />
        </div>
      );

      const modalHeading = screen.getByText(/Duplicate Client:/);
      expect(modalHeading).toBeInTheDocument();

      // The modal heading must NOT be inside the sidebar-container
      const sidebarContainer = container.querySelector('#sidebar-container');
      expect(sidebarContainer).not.toContainElement(modalHeading);

      // It must be a descendant of document.body
      expect(document.body).toContainElement(modalHeading);
    });

    it('renders shared Modal component as a direct child of document.body via Portal', () => {
      const { container } = render(
        <div id="nested-parent">
          <Modal isOpen={true} onClose={() => {}} title="Shared Portal Modal">
            <div>Modal Body Content</div>
          </Modal>
        </div>
      );

      const modalTitle = screen.getByText('Shared Portal Modal');
      expect(modalTitle).toBeInTheDocument();

      const nestedParent = container.querySelector('#nested-parent');
      expect(nestedParent).not.toContainElement(modalTitle);
      expect(document.body).toContainElement(modalTitle);
    });
  });

  describe('2. Mobile Shell & Responsive Navigation Structure', () => {
    it('verifies Sidebar contains mobile drawer transform and responsive classes', () => {
      const { container, rerender } = render(
        <BrowserRouter>
          <Sidebar />
        </BrowserRouter>
      );

      let aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
      expect(aside?.className).toContain('transition-transform');
      expect(aside?.className).toContain('-translate-x-full');
      expect(aside?.className).toContain('md:translate-x-0');
      expect(aside?.className).toContain('h-[100dvh]');

      // Test when opened in mobile drawer mode
      useOpsStore.getState().setMobileSidebarOpen(true);
      rerender(
        <BrowserRouter>
          <Sidebar />
        </BrowserRouter>
      );
      aside = container.querySelector('aside');
      expect(aside?.className).toContain('translate-x-0');
      expect(aside?.className).toContain('max-w-[85vw]');
      useOpsStore.getState().setMobileSidebarOpen(false);
    });

    it('verifies Header contains mobile hamburger button', () => {
      render(
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      );

      const hamburgerBtn = screen.getByLabelText('Open Navigation Menu');
      expect(hamburgerBtn).toBeInTheDocument();
      expect(hamburgerBtn.className).toContain('md:hidden');
    });

    it('verifies Settings navigation sub-header contains controlled horizontal overflow', () => {
      const { container } = render(
        <BrowserRouter>
          <SettingsLayout initialTab="team" />
        </BrowserRouter>
      );

      const navScrollContainer = container.querySelector('.overflow-x-auto');
      expect(navScrollContainer).toBeInTheDocument();
      expect(navScrollContainer?.className).toContain('flex-nowrap');
      expect(screen.getByText('Back to Workspace')).toBeInTheDocument();
    });
  });

  describe('3. Modal Lifecycle & Duplicate Client Logic Boundary', () => {
    it('verifies opening and closing client modal lifecycle cleanly', () => {
      let isOpen = true;
      const handleClose = () => {
        isOpen = false;
      };

      const { rerender } = render(
        <CreateClientModal
          isOpen={isOpen}
          onClose={handleClose}
          onSuccess={() => {}}
          currentUserProfile={mockProfile}
          eligibleManagers={[mockProfile]}
        />
      );

      expect(screen.getByText('Create New Client Workspace')).toBeInTheDocument();

      // Trigger close
      const closeButton = screen.getByLabelText('Close dialog');
      fireEvent.click(closeButton);

      rerender(
        <CreateClientModal
          isOpen={isOpen}
          onClose={handleClose}
          onSuccess={() => {}}
          currentUserProfile={mockProfile}
          eligibleManagers={[mockProfile]}
        />
      );

      expect(screen.queryByText('Create New Client Workspace')).not.toBeInTheDocument();
    });

    it('confirms DuplicateClientModal prefills operational requirements and leaves links blank', () => {
      render(
        <DuplicateClientModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
          sourceClient={mockClient}
          currentUserProfile={mockProfile}
          eligibleManagers={[mockProfile]}
        />
      );

      // Package prefilled from source
      const packageSelect = screen.getByLabelText(/Service Package/i) as HTMLSelectElement;
      expect(packageSelect.value).toBe(mockClient.package);

      // Company name requires fresh input (starts blank)
      const companyInput = screen.getByLabelText(/New Company Name/i) as HTMLInputElement;
      expect(companyInput.value).toBe('');

      // Website URL starts blank (not copied from source client)
      const websiteInput = screen.getByLabelText(/^Website URL/i) as HTMLInputElement;
      expect(websiteInput.value).toBe('');
    });
  });
});
