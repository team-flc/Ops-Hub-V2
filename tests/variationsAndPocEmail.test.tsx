import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ClientDetailsTab } from '../src/components/clients/ClientDetailsTab';
import { CreateClientModal } from '../src/components/clients/CreateClientModal';
import { DuplicateClientModal } from '../src/components/clients/DuplicateClientModal';
import { clientManagementService } from '../src/lib/clientManagementService';
import { useOpsStore } from '../src/store/opsStore';
import { ClientRecord, UserProfile } from '../src/types';

const mockOwner: UserProfile = {
  id: 'usr-owner-1',
  fullName: 'Faseeh Owner',
  role: 'owner',
  status: 'active',
  workEmail: 'owner@opshub.test'
};

const mockTeamMember: UserProfile = {
  id: 'usr-tm-1',
  fullName: 'Tariq Member',
  role: 'team_member',
  status: 'active',
  workEmail: 'tm@opshub.test'
};

const mockClientWithLinks: ClientRecord = {
  id: 'client-101',
  companyName: 'Acme Growth Labs',
  clientName: 'Alice Founder',
  package: 'Advanced',
  operationalManagerId: 'usr-owner-1',
  operationalManagerName: 'Faseeh Owner',
  activationDate: '2026-10-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  linkedinProfiles: [],
  links: {
    website: 'https://acmegrowth.com',
    videos: 'https://drive.google.com/videos/acme',
    variations: 'https://drive.google.com/variations/acme',
    poc_number: '+92 300 1234567',
    poc_email: 'poc.alice@acmegrowth.com'
  },
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z'
};

const mockClientWithoutLinks: ClientRecord = {
  id: 'client-102',
  companyName: 'Beta Blank Corp',
  clientName: 'Bob Founder',
  package: 'Basic',
  operationalManagerId: 'usr-owner-1',
  operationalManagerName: 'Faseeh Owner',
  activationDate: '2026-10-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  linkedinProfiles: [],
  links: {},
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z'
};

describe('Variations and POC Email Workspace Links Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useOpsStore.setState({
      clients: [mockClientWithLinks, mockClientWithoutLinks],
      selectedClientId: mockClientWithLinks.id,
      viewMode: 'client_workspace'
    });
  });

  describe('1. Sidebar Integration', () => {
    it('renders Variations link as an external link with safe attributes when populated', async () => {
      vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
        data: [mockClientWithLinks],
        error: undefined
      });
      vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue({
        data: [mockOwner],
        error: undefined
      });

      render(
        <MemoryRouter initialEntries={[`/clients/${mockClientWithLinks.id}`]}>
          <AuthProvider initialProfile={mockOwner}>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );

      const variationsLink = await screen.findByTestId('sidebar-link-variations');
      expect(variationsLink).toBeInTheDocument();
      expect(variationsLink).toHaveAttribute('href', 'https://drive.google.com/variations/acme');
      expect(variationsLink).toHaveAttribute('target', '_blank');
      expect(variationsLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(variationsLink).toHaveTextContent('Variations');
    });

    it('renders Variations as disabled item when not populated', async () => {
      useOpsStore.setState({
        clients: [mockClientWithoutLinks],
        selectedClientId: mockClientWithoutLinks.id
      });
      vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
        data: [mockClientWithoutLinks],
        error: undefined
      });
      vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue({
        data: [mockOwner],
        error: undefined
      });

      render(
        <MemoryRouter initialEntries={[`/clients/${mockClientWithoutLinks.id}`]}>
          <AuthProvider initialProfile={mockOwner}>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );

      const disabledItem = await screen.findByTestId('sidebar-link-variations-disabled');
      expect(disabledItem).toBeInTheDocument();
      expect(disabledItem).toHaveAttribute('title', 'Link not added');
      expect(disabledItem).toHaveAttribute('aria-label', 'Variations (Link not added)');
      expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
    });

    it('renders POC Email button and opens PocEmailModal with selectable text box and NO mailto link', async () => {
      vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
        data: [mockClientWithLinks],
        error: undefined
      });
      vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue({
        data: [mockOwner],
        error: undefined
      });

      render(
        <MemoryRouter initialEntries={[`/clients/${mockClientWithLinks.id}`]}>
          <AuthProvider initialProfile={mockOwner}>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );

      const pocEmailBtn = await screen.findByTestId('sidebar-link-poc-email');
      expect(pocEmailBtn).toBeInTheDocument();
      expect(pocEmailBtn).toHaveTextContent('POC Email');

      // Click to open dialog
      fireEvent.click(pocEmailBtn);

      const modalTitle = await screen.findByTestId('poc-email-modal-title');
      expect(modalTitle).toBeInTheDocument();
      expect(modalTitle).toHaveTextContent('POC Email');

      // Check selectable input box
      const emailInput = screen.getByTestId('poc-email-input');
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveValue('poc.alice@acmegrowth.com');
      expect(emailInput).toHaveAttribute('readonly');
      expect(emailInput.className).toContain('select-all');

      // Check copy button
      const copyBtn = screen.getByTestId('poc-email-copy-btn');
      expect(copyBtn).toBeInTheDocument();

      // Ensure NO mailto link anywhere in document
      const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
      expect(mailtoLinks.length).toBe(0);

      // Close modal
      const dismissBtn = screen.getByTestId('poc-email-dismiss-btn');
      fireEvent.click(dismissBtn);
      await waitFor(() => {
        expect(screen.queryByTestId('poc-email-modal-title')).not.toBeInTheDocument();
      });
    });

    it('renders POC Email as disabled item when not populated', async () => {
      useOpsStore.setState({
        clients: [mockClientWithoutLinks],
        selectedClientId: mockClientWithoutLinks.id
      });
      vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
        data: [mockClientWithoutLinks],
        error: undefined
      });
      vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue({
        data: [mockOwner],
        error: undefined
      });

      render(
        <MemoryRouter initialEntries={[`/clients/${mockClientWithoutLinks.id}`]}>
          <AuthProvider initialProfile={mockOwner}>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );

      const disabledItem = await screen.findByTestId('sidebar-link-poc-email-disabled');
      expect(disabledItem).toBeInTheDocument();
      expect(disabledItem).toHaveAttribute('title', 'Link not added');
      expect(disabledItem).toHaveAttribute('aria-label', 'POC Email (Link not added)');
    });
  });

  describe('2. ClientDetailsTab Form & Persistence', () => {
    it('populates existing Variations URL and POC Email in ClientDetailsTab', () => {
      render(
        <MemoryRouter initialEntries={[`/clients/${mockClientWithLinks.id}`]}>
          <ClientDetailsTab
            client={mockClientWithLinks}
            currentUserProfile={mockOwner}
            eligibleManagers={[mockOwner]}
            onClientUpdated={vi.fn()}
          />
        </MemoryRouter>
      );

      const variationsInput = screen.getByTestId('edit-variations') as HTMLInputElement;
      expect(variationsInput).toBeInTheDocument();
      expect(variationsInput.value).toBe('https://drive.google.com/variations/acme');

      const pocEmailInput = screen.getByTestId('edit-poc-email') as HTMLInputElement;
      expect(pocEmailInput).toBeInTheDocument();
      expect(pocEmailInput.value).toBe('poc.alice@acmegrowth.com');
    });

    it('rejects invalid POC email format on manual save', async () => {
      render(
        <MemoryRouter initialEntries={[`/clients/${mockClientWithLinks.id}`]}>
          <ClientDetailsTab
            client={mockClientWithLinks}
            currentUserProfile={mockOwner}
            eligibleManagers={[mockOwner]}
            onClientUpdated={vi.fn()}
          />
        </MemoryRouter>
      );

      const pocEmailInput = screen.getByTestId('edit-poc-email');
      fireEvent.change(pocEmailInput, { target: { value: 'not-a-valid-email' } });

      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveBtn);

      const errorMsg = await screen.findByText(/Invalid email format for POC Email/i);
      expect(errorMsg).toBeInTheDocument();
    });

    it('successfully saves valid Variations and POC Email updates', async () => {
      const updateSpy = vi.spyOn(clientManagementService, 'updateClient').mockResolvedValue({
        data: {
          ...mockClientWithLinks,
          links: {
            ...mockClientWithLinks.links,
            variations: 'https://drive.google.com/variations/updated',
            poc_email: 'new.poc@acmegrowth.com'
          }
        },
        error: undefined
      });

      const onClientUpdated = vi.fn();
      render(
        <MemoryRouter initialEntries={[`/clients/${mockClientWithLinks.id}`]}>
          <ClientDetailsTab
            client={mockClientWithLinks}
            currentUserProfile={mockOwner}
            eligibleManagers={[mockOwner]}
            onClientUpdated={onClientUpdated}
          />
        </MemoryRouter>
      );

      const variationsInput = screen.getByTestId('edit-variations');
      fireEvent.change(variationsInput, { target: { value: 'https://drive.google.com/variations/updated' } });

      const pocEmailInput = screen.getByTestId('edit-poc-email');
      fireEvent.change(pocEmailInput, { target: { value: 'new.poc@acmegrowth.com' } });

      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          mockClientWithLinks.id,
          expect.objectContaining({
            links: expect.objectContaining({
              variations: 'https://drive.google.com/variations/updated',
              poc_email: 'new.poc@acmegrowth.com'
            })
          }),
          mockOwner.id
        );
      });
    });

    it('locks Variations and POC Email for Team Member when already set by management', () => {
      render(
        <MemoryRouter initialEntries={[`/clients/${mockClientWithLinks.id}`]}>
          <ClientDetailsTab
            client={mockClientWithLinks}
            currentUserProfile={mockTeamMember}
            eligibleManagers={[mockOwner]}
            onClientUpdated={vi.fn()}
          />
        </MemoryRouter>
      );

      const variationsInput = screen.getByTestId('edit-variations');
      expect(variationsInput).toBeDisabled();

      const pocEmailInput = screen.getByTestId('edit-poc-email');
      expect(pocEmailInput).toBeDisabled();
    });
  });

  describe('3. CreateClientModal & DuplicateClientModal Integration', () => {
    it('CreateClientModal includes Variations and POC Email in creation payload', async () => {
      const createSpy = vi.spyOn(clientManagementService, 'createClient').mockResolvedValue({
        data: mockClientWithLinks,
        error: undefined
      });

      render(
        <CreateClientModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          currentUserProfile={mockOwner}
          eligibleManagers={[mockOwner]}
        />
      );

      const companyNameInput = document.getElementById('create-company-name') as HTMLInputElement;
      fireEvent.change(companyNameInput, { target: { value: 'New Test Co' } });

      const clientNameInput = document.getElementById('create-client-name') as HTMLInputElement;
      fireEvent.change(clientNameInput, { target: { value: 'John Founder' } });

      const variationsInput = screen.getByTestId('link-variations');
      fireEvent.change(variationsInput, { target: { value: 'https://variations.newco.com' } });

      const pocEmailInput = screen.getByTestId('link-poc-email');
      fireEvent.change(pocEmailInput, { target: { value: 'poc@newco.com' } });

      const submitBtn = screen.getByRole('button', { name: /create client/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            companyName: 'New Test Co',
            clientName: 'John Founder',
            links: expect.objectContaining({
              variations: 'https://variations.newco.com',
              poc_email: 'poc@newco.com'
            })
          }),
          mockOwner.id
        );
      });
    });

    it('DuplicateClientModal includes Variations and POC Email in duplicate payload', async () => {
      const dupSpy = vi.spyOn(clientManagementService, 'duplicateClient').mockResolvedValue({
        data: { ...mockClientWithLinks, id: 'client-dup' },
        error: undefined
      });

      render(
        <DuplicateClientModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          sourceClient={mockClientWithLinks}
          currentUserProfile={mockOwner}
          eligibleManagers={[mockOwner]}
        />
      );

      const companyNameInput = document.getElementById('dup-company-name') as HTMLInputElement;
      fireEvent.change(companyNameInput, { target: { value: 'Acme Clone Co' } });

      const clientNameInput = document.getElementById('dup-client-name') as HTMLInputElement;
      fireEvent.change(clientNameInput, { target: { value: 'Jane Clone' } });

      const variationsInput = screen.getByTestId('dup-variations');
      fireEvent.change(variationsInput, { target: { value: 'https://variations.clone.com' } });

      const pocEmailInput = screen.getByTestId('dup-poc-email');
      fireEvent.change(pocEmailInput, { target: { value: 'poc@clone.com' } });

      const submitBtn = screen.getByRole('button', { name: /duplicate client/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(dupSpy).toHaveBeenCalledWith(
          mockClientWithLinks.id,
          expect.objectContaining({
            companyName: 'Acme Clone Co',
            clientName: 'Jane Clone',
            links: expect.objectContaining({
              variations: 'https://variations.clone.com',
              poc_email: 'poc@clone.com'
            })
          }),
          mockOwner.id
        );
      });
    });
  });
});
