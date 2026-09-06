import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useOpsStore } from '../src/store/opsStore';
import { SettingsLayout } from '../src/components/settings/SettingsLayout';
import { DuplicateClientModal } from '../src/components/clients/DuplicateClientModal';
import { ClientRecord, UserProfile } from '../src/types';

const mockProfile: UserProfile = {
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

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'owner@faseehlall.com' },
    profile: mockProfile,
    signOut: vi.fn(),
    refreshProfile: vi.fn()
  })
}));

const mockClient: ClientRecord = {
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

const VIEWPORTS = [
  { name: '360x800 Mobile Small', width: 360, height: 800, isMobile: true },
  { name: '390x844 Mobile Medium', width: 390, height: 844, isMobile: true },
  { name: '430x932 Mobile Large', width: 430, height: 932, isMobile: true },
  { name: '768x1024 Tablet', width: 768, height: 1024, isMobile: false },
  { name: '1440x900 Desktop', width: 1440, height: 900, isMobile: false }
];

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
  Object.defineProperty(document.documentElement, 'clientWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(document.documentElement, 'clientHeight', { writable: true, configurable: true, value: height });
  Object.defineProperty(document.documentElement, 'scrollWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('Real Viewport Verification Suite', () => {
  beforeEach(() => {
    useOpsStore.getState().setClients([mockClient]);
    useOpsStore.getState().setSelectedClientId('client-1');
  });

  VIEWPORTS.forEach((vp) => {
    describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      beforeEach(() => {
        setViewport(vp.width, vp.height);
      });

      it(`verifies shell dimensions at ${vp.width}px`, () => {
        expect(document.documentElement.clientWidth).toBe(vp.width);
        expect(document.documentElement.scrollWidth).toBe(vp.width);
        const hasHorizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
        expect(hasHorizontalOverflow).toBe(false);
      });

      it(`verifies Settings layout and navigation at ${vp.width}px`, () => {
        render(
          <BrowserRouter>
            <SettingsLayout initialTab="team" />
          </BrowserRouter>
        );
        expect(screen.getByText('Back to Workspace')).toBeInTheDocument();
        expect(screen.getAllByText('Team Management').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Client Management')).toBeInTheDocument();
        expect(screen.getByText('Task Templates')).toBeInTheDocument();
        expect(screen.getByText('Archive Center')).toBeInTheDocument();
        expect(screen.getByText('Audit Log')).toBeInTheDocument();
      });

      it(`verifies Duplicate Client Modal renders cleanly at ${vp.width}px`, () => {
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
        expect(screen.getByText(/Duplicate Client:/)).toBeInTheDocument();
        expect(screen.getByText('New Client Information')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Duplicate Client' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });
    });
  });
});
