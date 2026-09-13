import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientWorkspaceView } from '../src/components/clients/ClientWorkspaceView';
import { CustomizeWeekTitlesModal } from '../src/components/clients/CustomizeWeekTitlesModal';
import { ClientRecord, UserProfile } from '../src/types';

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn()
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null })
        }),
        order: () => Promise.resolve({ data: [], error: null })
      })
    })
  }
}));

const mockOwner: UserProfile = {
  id: 'owner-1',
  fullName: 'Agency Owner',
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const baseClient: ClientRecord = {
  id: 'client-custom-1',
  companyName: 'Apex Growth Labs',
  clientName: 'Sarah Jenkins',
  package: 'Advanced',
  operationalManagerId: 'owner-1',
  activationDate: '2026-03-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  links: {},
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z'
};

describe('Client Workspace Customizable Week 1-4 Titles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders default Week 1-4 titles when customWeekTitles is undefined', () => {
    render(
      <ClientWorkspaceView
        client={baseClient}
        currentUserProfile={mockOwner}
        eligibleManagers={[mockOwner]}
        onClientUpdated={vi.fn()}
      />
    );

    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('Week 3')).toBeInTheDocument();
    expect(screen.getByText('Week 4')).toBeInTheDocument();
    expect(screen.getByText('Customize Week Titles')).toBeInTheDocument();
  });

  it('2. Renders custom milestone titles on weekly tabs and header when customWeekTitles is configured', () => {
    const clientWithTitles: ClientRecord = {
      ...baseClient,
      customWeekTitles: {
        1: 'Social Media Optimization',
        2: 'LinkedIn Optimization + 1 Reporting',
        3: 'SEO Optimization + 2 Reportings',
        4: 'Paid Ads Optimization + 3 Reportings'
      }
    };

    render(
      <ClientWorkspaceView
        client={clientWithTitles}
        currentUserProfile={mockOwner}
        eligibleManagers={[mockOwner]}
        onClientUpdated={vi.fn()}
      />
    );

    // Custom titles rendered on tab cards
    expect(screen.getByText('Social Media Optimization')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn Optimization + 1 Reporting')).toBeInTheDocument();
    expect(screen.getByText('SEO Optimization + 2 Reportings')).toBeInTheDocument();
    expect(screen.getByText('Paid Ads Optimization + 3 Reportings')).toBeInTheDocument();

    // Header displays custom title for active Week 1
    expect(screen.getByText(/Week 1: Social Media Optimization Tasks/i)).toBeInTheDocument();
  });

  it('3. CustomizeWeekTitlesModal allows loading Agency preset and saving custom titles', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <CustomizeWeekTitlesModal
        isOpen={true}
        onClose={handleClose}
        client={baseClient}
        onSave={handleSave}
      />
    );

    expect(screen.getByText('Customize 30-Day Setup Week Titles')).toBeInTheDocument();

    // Click Apply Preset
    fireEvent.click(screen.getByRole('button', { name: /apply preset/i }));

    const w1Input = screen.getByPlaceholderText('e.g. Social Media Optimization') as HTMLInputElement;
    const w2Input = screen.getByPlaceholderText('e.g. LinkedIn Optimization + 1 Reporting') as HTMLInputElement;
    const w3Input = screen.getByPlaceholderText('e.g. SEO Optimization + 2 Reportings') as HTMLInputElement;
    const w4Input = screen.getByPlaceholderText('e.g. Paid Ads Optimization + 3 Reportings') as HTMLInputElement;

    expect(w1Input.value).toBe('Social Media Optimization');
    expect(w2Input.value).toBe('LinkedIn Optimization + 1 Reporting');
    expect(w3Input.value).toBe('SEO Optimization + 2 Reportings');
    expect(w4Input.value).toBe('Paid Ads Optimization + 3 Reportings');

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /save week titles/i }));

    expect(handleSave).toHaveBeenCalledWith({
      1: 'Social Media Optimization',
      2: 'LinkedIn Optimization + 1 Reporting',
      3: 'SEO Optimization + 2 Reportings',
      4: 'Paid Ads Optimization + 3 Reportings'
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('4. CustomizeWeekTitlesModal allows resetting titles back to default', () => {
    const handleSave = vi.fn();
    const clientWithTitles: ClientRecord = {
      ...baseClient,
      customWeekTitles: {
        1: 'Custom Week 1',
        2: 'Custom Week 2',
        3: 'Custom Week 3',
        4: 'Custom Week 4'
      }
    };

    render(
      <CustomizeWeekTitlesModal
        isOpen={true}
        onClose={vi.fn()}
        client={clientWithTitles}
        onSave={handleSave}
      />
    );

    const w1Input = screen.getByPlaceholderText('e.g. Social Media Optimization') as HTMLInputElement;
    expect(w1Input.value).toBe('Custom Week 1');

    // Click Reset
    fireEvent.click(screen.getByTitle('Reset to default Week 1 - 4 titles'));

    expect(w1Input.value).toBe('');

    // Save empty titles (resets to default)
    fireEvent.click(screen.getByRole('button', { name: /save week titles/i }));
    expect(handleSave).toHaveBeenCalledWith({});
  });
});
