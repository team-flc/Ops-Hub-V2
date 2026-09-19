import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  calculateDaysSinceOnboarding, 
  getPKTTodayDateString
} from '../src/lib/pktDateUtils';
import { clientManagementService } from '../src/lib/clientManagementService';
import { supabase } from '../src/lib/supabase';
import { SelectedClientHeader } from '../src/components/clients/SelectedClientHeader';
import { ClientPortalLayout } from '../src/components/portal/ClientPortalLayout';
import { PortalOverviewTab } from '../src/components/portal/tabs/PortalOverviewTab';
import { ClientRecord, UserProfile } from '../src/types';
import { MemoryRouter } from 'react-router-dom';

// Mock Supabase
vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn()
  }
}));

describe('Days Since Onboarding Counter Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Pure Calculation & Timezone Boundaries', () => {
    it('1.1 counts onboarding day as Day 1 (same-day count)', () => {
      const refDate = new Date('2026-09-19T12:00:00+05:00');
      const res = calculateDaysSinceOnboarding('2026-09-19', refDate);
      expect(res.isMissing).toBe(false);
      expect(res.isFuture).toBe(false);
      expect(res.dayNumber).toBe(1);
      expect(res.weekNumber).toBe(1);
      expect(res.formattedBadge).toBe('Day 1 with us (Week 1) · Started 19 September 2026');
    });

    it('1.2 accurately calculates multi-day elapsed counter (Day 5 with us)', () => {
      const refDate = new Date('2026-09-19T12:00:00+05:00');
      // 4 calendar days between 15 Sep and 19 Sep + 1 = Day 5
      const res = calculateDaysSinceOnboarding('2026-09-15', refDate);
      expect(res.dayNumber).toBe(5);
      expect(res.weekNumber).toBe(1);
      expect(res.formattedBadge).toBe('Day 5 with us (Week 1) · Started 15 September 2026');
    });

    it('1.3 maps first 30 days to informational setup weeks 1 through 4', () => {
      const refDate = new Date('2026-09-30T12:00:00+05:00');

      // Day 1 (Week 1)
      expect(calculateDaysSinceOnboarding('2026-09-30', refDate).weekNumber).toBe(1);
      // Day 7 (Week 1)
      expect(calculateDaysSinceOnboarding('2026-09-24', refDate).weekNumber).toBe(1);
      // Day 8 (Week 2)
      expect(calculateDaysSinceOnboarding('2026-09-23', refDate).weekNumber).toBe(2);
      // Day 14 (Week 2)
      expect(calculateDaysSinceOnboarding('2026-09-17', refDate).weekNumber).toBe(2);
      // Day 15 (Week 3)
      expect(calculateDaysSinceOnboarding('2026-09-16', refDate).weekNumber).toBe(3);
      // Day 21 (Week 3)
      expect(calculateDaysSinceOnboarding('2026-09-10', refDate).weekNumber).toBe(3);
      // Day 22 (Week 4)
      expect(calculateDaysSinceOnboarding('2026-09-09', refDate).weekNumber).toBe(4);
      // Day 30 (Week 4)
      expect(calculateDaysSinceOnboarding('2026-09-01', refDate).weekNumber).toBe(4);
    });

    it('1.4 continues day count beyond Day 30 without week label', () => {
      const refDate = new Date('2026-09-30T12:00:00+05:00');
      // 30 calendar days diff + 1 = Day 31
      const res31 = calculateDaysSinceOnboarding('2026-08-31', refDate);
      expect(res31.dayNumber).toBe(31);
      expect(res31.weekNumber).toBeNull();
      expect(res31.formattedBadge).toBe('Day 31 with us · Started 31 August 2026');

      // Day 100
      const res100 = calculateDaysSinceOnboarding('2026-06-23', refDate);
      expect(res100.dayNumber).toBe(100);
      expect(res100.weekNumber).toBeNull();
      expect(res100.formattedBadge).toBe('Day 100 with us · Started 23 June 2026');
    });

    it('1.5 handles month boundaries and leap year transitions accurately', () => {
      // Month boundary: Feb 28, 2026 to Mar 1, 2026 (non-leap year) -> 1 day diff -> Day 2
      const mar1Ref = new Date('2026-03-01T12:00:00+05:00');
      const resFeb28 = calculateDaysSinceOnboarding('2026-02-28', mar1Ref);
      expect(resFeb28.dayNumber).toBe(2);

      // Year boundary: Dec 31, 2025 to Jan 1, 2026 -> 1 day diff -> Day 2
      const jan1Ref = new Date('2026-01-01T12:00:00+05:00');
      const resDec31 = calculateDaysSinceOnboarding('2025-12-31', jan1Ref);
      expect(resDec31.dayNumber).toBe(2);
    });

    it('1.6 enforces company timezone (Asia/Karachi) across UTC boundaries', () => {
      // 2026-09-18T19:30:00Z is 2026-09-19T00:30:00+05:00 in PKT
      const pktMidnightRef = new Date('2026-09-18T19:30:00.000Z');
      const res = calculateDaysSinceOnboarding('2026-09-19', pktMidnightRef);
      expect(res.dayNumber).toBe(1);
      expect(res.isFuture).toBe(false);
    });

    it('1.7 returns missing state for empty, null, or invalid dates', () => {
      expect(calculateDaysSinceOnboarding(null).isMissing).toBe(true);
      expect(calculateDaysSinceOnboarding(null).formattedBadge).toBe('Start date required');
      expect(calculateDaysSinceOnboarding('').isMissing).toBe(true);
      expect(calculateDaysSinceOnboarding('invalid-date').isMissing).toBe(true);
    });

    it('1.8 returns future state with "Starts on [date]" for future start dates', () => {
      const refDate = new Date('2026-09-19T12:00:00+05:00');
      const res = calculateDaysSinceOnboarding('2026-09-25', refDate);
      expect(res.isMissing).toBe(false);
      expect(res.isFuture).toBe(true);
      expect(res.dayNumber).toBeNull();
      expect(res.formattedBadge).toBe('Starts on 25 September 2026');
    });
  });

  describe('2. Service Layer Permissions & Auto-Save on Onboarding Completion', () => {
    it('2.1 automatically saves start date in PKT when onboarding is completed', async () => {
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: {
            id: 'client-1',
            company_name: 'Alpha Corp',
            status: 'Onboarding',
            activation_date: null,
            operational_manager_id: 'mgr-1'
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            id: 'client-1',
            company_name: 'Alpha Corp',
            status: 'Active',
            activation_date: getPKTTodayDateString(),
            operational_manager_id: 'mgr-1'
          },
          error: null
        });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: mockSingle
          })
        })
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingle
              })
            }),
            update: mockUpdate
          };
        }
        if (table === 'client_audit_log') {
          return { insert: mockInsert };
        }
        if (table === 'client_links') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
        }
        if (table === 'client_linkedin_profiles') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [] }) }) }) };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      await clientManagementService.updateClient('client-1', {
        status: 'Active'
      }, 'owner-1');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Active',
          activation_date: getPKTTodayDateString()
        })
      );
    });

    it('2.2 never overwrites existing start date on subsequent edits or reactivation', async () => {
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: {
            id: 'client-2',
            company_name: 'Beta LLC',
            status: 'Paused',
            activation_date: '2026-08-01',
            operational_manager_id: 'mgr-1'
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            id: 'client-2',
            company_name: 'Beta LLC',
            status: 'Active',
            activation_date: '2026-08-01',
            operational_manager_id: 'mgr-1'
          },
          error: null
        });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: mockSingle
          })
        })
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingle
              })
            }),
            update: mockUpdate
          };
        }
        if (table === 'client_audit_log') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'client_links') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
        }
        if (table === 'client_linkedin_profiles') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [] }) }) }) };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      await clientManagementService.updateClient('client-2', {
        status: 'Active'
      }, 'owner-1');

      // Must NOT overwrite activation_date with today
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          activation_date: getPKTTodayDateString()
        })
      );
    });

    it('2.3 rejects start date modification when attempted by unauthorized Team Member', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'client-3',
                    activation_date: '2026-09-01',
                    operational_manager_id: 'mgr-1'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'team-member-1', role: 'team_member' }
                })
              })
            })
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await clientManagementService.updateClient('client-3', {
        activationDate: '2026-09-10'
      }, 'team-member-1');

      expect(res.error).toContain('Only Owner and authorized Operational Managers are permitted');
    });
  });

  describe('3. UI Rendering & Quick Edit in Workspace & Portal', () => {
    const mockClient: ClientRecord = {
      id: 'client-10',
      companyName: 'Apex Growth Inc',
      clientName: 'Sarah Jenkins',
      package: 'Advanced',
      operationalManagerId: 'mgr-1',
      operationalManagerName: 'Faseeh Manager',
      activationDate: '2026-09-15',
      status: 'Active',
      requiredLinkedinProfileCount: 3,
      links: {},
      linkedinProfiles: [],
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z'
    };

    const ownerProfile: UserProfile = {
      id: 'owner-1',
      fullName: 'Atif Owner',
      role: 'owner',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    it('3.1 renders compact onboarding badge in SelectedClientHeader', () => {
      render(
        <MemoryRouter>
          <SelectedClientHeader
            client={mockClient}
            currentUserProfile={ownerProfile}
            currentUserRole="owner"
          />
        </MemoryRouter>
      );

      const badge = screen.getByTestId('onboarding-days-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain('with us');
      expect(badge.textContent).toContain('Started 15 September 2026');
    });

    it('3.2 allows Owner to open quick start date correction dialog from header', () => {
      render(
        <MemoryRouter>
          <SelectedClientHeader
            client={mockClient}
            currentUserProfile={ownerProfile}
            currentUserRole="owner"
          />
        </MemoryRouter>
      );

      const editBtn = screen.getByTestId('edit-start-date-btn');
      expect(editBtn).toBeInTheDocument();
      fireEvent.click(editBtn);

      expect(screen.getByText('Update Project Start Date')).toBeInTheDocument();
      expect(screen.getByTestId('quick-start-date-input')).toBeInTheDocument();
    });

    it('3.3 renders onboarding days badge in ClientPortalLayout', () => {
      const portalData = {
        client: mockClient,
        tasks: [],
        roadmapMilestones: [],
        deliverables: [],
        overview: null
      };

      render(
        <MemoryRouter>
          <ClientPortalLayout
            portalData={portalData as any}
            isReadOnlyPreview={false}
            dateRange="all"
            onDateRangeChange={vi.fn()}
            onRefresh={vi.fn()}
          />
        </MemoryRouter>
      );

      const portalBadge = screen.getByTestId('portal-onboarding-days-badge');
      expect(portalBadge).toBeInTheDocument();
      expect(portalBadge.textContent).toContain('with us');
    });

    it('3.4 renders onboarding days badge in PortalOverviewTab Executive Snapshot', () => {
      render(
        <PortalOverviewTab
          client={mockClient}
          overview={null}
          tasks={[]}
          milestones={[]}
          deliverables={[]}
          isReadOnlyPreview={false}
          currentUserProfile={ownerProfile}
          onSelectTab={vi.fn()}
          onApproveTask={vi.fn()}
          onRequestChanges={vi.fn()}
          onSelectTask={vi.fn()}
        />
      );

      const overviewBadge = screen.getByTestId('portal-overview-onboarding-badge');
      expect(overviewBadge).toBeInTheDocument();
      expect(overviewBadge.textContent).toContain('with us');
      expect(overviewBadge.textContent).toContain('Started 15 September 2026');
    });
  });
});
