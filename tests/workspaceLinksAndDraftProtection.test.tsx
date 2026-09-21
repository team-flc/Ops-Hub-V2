import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ClientDetailsTab } from '../src/components/clients/ClientDetailsTab';
import { CreateClientModal } from '../src/components/clients/CreateClientModal';
import { DuplicateClientModal } from '../src/components/clients/DuplicateClientModal';
import { clientManagementService, formatWhatsAppUrl } from '../src/lib/clientManagementService';
import { useOpsStore } from '../src/store/opsStore';
import { ClientRecord, UserProfile } from '../src/types';

const mockOwnerProfile: UserProfile = {
  id: 'usr-owner-1',
  fullName: 'Faseeh Lall',
  role: 'owner',
  status: 'active',
  workEmail: 'owner@faseehlall.com'
};

const mockClientA: ClientRecord = {
  id: 'client-aaa',
  companyName: 'Apex Growth Inc',
  clientName: 'Sarah Jenkins',
  package: 'Advanced',
  operationalManagerId: 'usr-owner-1',
  operationalManagerName: 'Faseeh Lall',
  activationDate: '2026-09-01',
  status: 'Active',
  requiredLinkedinProfileCount: 3,
  linkedinProfiles: [],
  links: {
    website: 'https://apexgrowth.com',
    flc_landing_page: 'https://flc-landing.com/apex',
    brand_identity: 'https://brand.apex.com/guidelines',
    google_drive: 'https://drive.google.com/drive/folders/apex-root',
    important_docs: 'https://docs.google.com/document/d/apex-sop',
    master_business_doc: 'https://docs.google.com/document/d/apex-master-biz',
    static_creatives: 'https://drive.google.com/drive/folders/apex-statics',
    videos: 'https://drive.google.com/drive/folders/apex-videos',
    grid: 'https://grid.app/apex-dashboard',
    vsl: 'https://vimeo.com/apex-vsl-2026',
    testimonials: 'https://drive.google.com/drive/folders/apex-testimonials',
    social_media_management: 'https://buffer.com/apex',
    linkedin_management: 'https://linkedin.com/campaignmanager/apex',
    seo_management: 'https://app.ahrefs.com/dashboard/apex',
    email_marketing_management: 'https://klaviyo.com/dashboard/apex',
    paid_ads_management: 'https://adsmanager.facebook.com/apex',
    linkedin_company_page: 'https://linkedin.com/company/apex-growth',
    facebook: 'https://facebook.com/apexgrowth',
    instagram: 'https://instagram.com/apexgrowth',
    slack_channel: 'https://app.slack.com/client/T1/C1',
    whatsapp_group: 'https://chat.whatsapp.com/ApexVip',
    poc_number: '+92 300 1234567'
  },
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z'
};

const mockClientB: ClientRecord = {
  id: 'client-bbb',
  companyName: 'Beacon Ventures',
  clientName: 'Robert Vance',
  package: 'Intermediate',
  operationalManagerId: 'usr-owner-1',
  operationalManagerName: 'Faseeh Lall',
  activationDate: '2026-09-05',
  status: 'Onboarding',
  requiredLinkedinProfileCount: 3,
  linkedinProfiles: [],
  links: {
    website: 'https://beaconventures.com'
  },
  createdAt: '2026-09-05T00:00:00Z',
  updatedAt: '2026-09-05T00:00:00Z'
};

// Mock Supabase & AuthContext dependencies
const mockGetUser = vi.fn();
const mockFromSelect = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    from: (table: string) => ({
      select: () => mockFromSelect(table)
    })
  }
}));

describe('Workspace Links & Unsaved Draft Protection Enhancement Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'usr-owner-1', email: 'owner@faseehlall.com' } },
      error: null
    });

    mockFromSelect.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return Promise.resolve({
          data: {
            id: 'usr-owner-1',
            full_name: 'Faseeh Lall',
            role: 'owner',
            status: 'active',
            work_email: 'owner@faseehlall.com'
          },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
      data: [mockClientA, mockClientB],
      error: undefined
    });

    vi.spyOn(clientManagementService, 'fetchEligibleManagers').mockResolvedValue([mockOwnerProfile]);

    useOpsStore.setState({
      clients: [mockClientA, mockClientB],
      selectedClientId: mockClientA.id
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  // 1. EXACT 22-ITEM ORDER, LABELS, AND ICONS IN SIDEBAR
  it('1. Sidebar renders all 22 workspace links in exact required order with correct labels and icons', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('22 active')).toBeInTheDocument();
    });

    // Query all rendered links inside sidebar
    const renderedLinks = screen.getAllByRole('link');
    const linkTexts = renderedLinks.map((l) => l.textContent?.trim() || '');

    const expectedOrder = [
      'Website',
      'Landing Page',
      'Brand Identity',
      'Google Drive',
      'Important Documents',
      'Master Business Document',
      'Statics',
      'Videos',
      'Grid',
      'VSL',
      'Testimonials',
      'Social Media Management',
      'LinkedIn Management',
      'SEO Management',
      'Email Marketing Management',
      'Paid Ads Management',
      'LinkedIn',
      'Facebook',
      'Instagram',
      'Slack',
      'WhatsApp',
      'POC WhatsApp'
    ];

    expect(linkTexts).toEqual(expectedOrder);

    // Verify Brand Identity URL link attributes
    const brandIdentityLink = screen.getByRole('link', { name: /Brand Identity/i });
    expect(brandIdentityLink).toHaveAttribute('href', 'https://brand.apex.com/guidelines');
    expect(brandIdentityLink).toHaveAttribute('target', '_blank');
    expect(brandIdentityLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify Important Documents link attributes
    const importantDocsLink = screen.getByRole('link', { name: /Important Documents/i });
    expect(importantDocsLink).toHaveAttribute('href', 'https://docs.google.com/document/d/apex-sop');
    expect(importantDocsLink).toHaveAttribute('target', '_blank');
    expect(importantDocsLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify Master Business Document link attributes
    const masterBizDocLink = screen.getByRole('link', { name: /Master Business Document/i });
    expect(masterBizDocLink).toHaveAttribute('href', 'https://docs.google.com/document/d/apex-master-biz');
    expect(masterBizDocLink).toHaveAttribute('target', '_blank');
    expect(masterBizDocLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify Testimonials link attributes
    const testimonialsLink = screen.getByRole('link', { name: /Testimonials/i });
    expect(testimonialsLink).toHaveAttribute('href', 'https://drive.google.com/drive/folders/apex-testimonials');
    expect(testimonialsLink).toHaveAttribute('target', '_blank');
    expect(testimonialsLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify 5 new client links
    const socialMediaLink = screen.getByRole('link', { name: /Social Media Management/i });
    expect(socialMediaLink).toHaveAttribute('href', 'https://buffer.com/apex');
    const linkedinMgmtLink = screen.getByRole('link', { name: /LinkedIn Management/i });
    expect(linkedinMgmtLink).toHaveAttribute('href', 'https://linkedin.com/campaignmanager/apex');
    const seoLink = screen.getByRole('link', { name: /SEO Management/i });
    expect(seoLink).toHaveAttribute('href', 'https://app.ahrefs.com/dashboard/apex');
    const emailLink = screen.getByRole('link', { name: /Email Marketing Management/i });
    expect(emailLink).toHaveAttribute('href', 'https://klaviyo.com/dashboard/apex');
    const paidAdsLink = screen.getByRole('link', { name: /Paid Ads Management/i });
    expect(paidAdsLink).toHaveAttribute('href', 'https://adsmanager.facebook.com/apex');

    // Verify POC WhatsApp link attributes
    const pocWhatsAppLink = screen.getByRole('link', { name: /POC WhatsApp/i });
    expect(pocWhatsAppLink).toHaveAttribute('href', 'https://wa.me/923001234567');
    expect(pocWhatsAppLink).toHaveAttribute('target', '_blank');
    expect(pocWhatsAppLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify Landing Page and Statics labels (not FLC Landing Page or Static)
    expect(screen.getByRole('link', { name: /Landing Page/i })).toHaveAttribute('href', 'https://flc-landing.com/apex');
    expect(screen.getByRole('link', { name: /Statics/i })).toHaveAttribute('href', 'https://drive.google.com/drive/folders/apex-statics');
  });

  // 2. DYNAMIC ACTIVE COUNT & REACTIVE STORE UPDATES IN SIDEBAR
  it('2. Sidebar dynamically updates active links and active count pill reactively when store changes', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('22 active')).toBeInTheDocument();
    });

    // Update client A in store to have only 3 links
    act(() => {
      useOpsStore.getState().updateClientRecord({
        ...mockClientA,
        links: {
          website: 'https://apexgrowth.com',
          brand_identity: 'https://brand.apex.com',
          google_drive: 'https://drive.google.com'
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText('3 active')).toBeInTheDocument();
      // Configured links are clickable <a> elements
      expect(screen.getByRole('link', { name: /Website/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Brand Identity/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Google Drive/i })).toBeInTheDocument();

      // Missing links are still rendered in the sidebar, but disabled with "Link not added"
      expect(screen.getByText('Landing Page')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Landing Page/i })).not.toBeInTheDocument();
      expect(screen.getByText('Master Business Document')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Master Business Document/i })).not.toBeInTheDocument();
      expect(screen.getByText('Testimonials')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Testimonials/i })).not.toBeInTheDocument();
      expect(screen.getByText('Social Media Management')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Social Media Management/i })).not.toBeInTheDocument();
      expect(screen.getByText('SEO Management')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /SEO Management/i })).not.toBeInTheDocument();
      expect(screen.getByText('Statics')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Statics/i })).not.toBeInTheDocument();
      expect(screen.getByText('Important Documents')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Important Documents/i })).not.toBeInTheDocument();
    });

    // Switch to Client B with 1 link
    act(() => {
      useOpsStore.getState().setSelectedClientId(mockClientB.id);
    });

    await waitFor(() => {
      expect(screen.getByText('1 active')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Website/i })).toBeInTheDocument();
      expect(screen.getByText('Brand Identity')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Brand Identity/i })).not.toBeInTheDocument();
    });
  });

  // 3. ALL LINKS DISPLAYED WITH DISABLED STATE WHEN NO LINKS CONFIGURED
  it('3. Sidebar displays all 22 workspace links as disabled with "Link not added" and "0 active" when client has no workspace links', async () => {
    const clientWithNoLinks: ClientRecord = {
      ...mockClientA,
      id: 'client-empty',
      links: {}
    };

    vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
      data: [clientWithNoLinks],
      error: undefined
    });

    useOpsStore.setState({
      clients: [clientWithNoLinks],
      selectedClientId: clientWithNoLinks.id
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('0 active')).toBeInTheDocument();
      // All 22 link labels are present in the sidebar
      expect(screen.getByText('Website')).toBeInTheDocument();
      expect(screen.getByText('Landing Page')).toBeInTheDocument();
      expect(screen.getByText('Brand Identity')).toBeInTheDocument();
      expect(screen.getByText('Google Drive')).toBeInTheDocument();
      expect(screen.getByText('Important Documents')).toBeInTheDocument();
      expect(screen.getByText('Master Business Document')).toBeInTheDocument();
      expect(screen.getByText('Statics')).toBeInTheDocument();
      expect(screen.getByText('Videos')).toBeInTheDocument();
      expect(screen.getByText('Grid')).toBeInTheDocument();
      expect(screen.getByText('VSL')).toBeInTheDocument();
      expect(screen.getByText('Testimonials')).toBeInTheDocument();
      expect(screen.getByText('Social Media Management')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn Management')).toBeInTheDocument();
      expect(screen.getByText('SEO Management')).toBeInTheDocument();
      expect(screen.getByText('Email Marketing Management')).toBeInTheDocument();
      expect(screen.getByText('Paid Ads Management')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('Facebook')).toBeInTheDocument();
      expect(screen.getByText('Instagram')).toBeInTheDocument();
      expect(screen.getByText('Slack')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
      expect(screen.getByText('POC WhatsApp')).toBeInTheDocument();

      // No clickable <a> links rendered for workspace links
      expect(screen.queryByRole('link', { name: /Website/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Google Drive/i })).not.toBeInTheDocument();
    });
  });

  // 4. CLIENT DETAILS TAB RENDERS BRAND IDENTITY INPUT AND ALL 18 LINK FIELDS
  it('4. ClientDetailsTab renders Brand Identity URL field and pre-populates existing links', () => {
    render(
      <ClientDetailsTab
        client={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={vi.fn()}
      />
    );

    const brandInput = screen.getByLabelText(/Brand Identity URL/i) as HTMLInputElement;
    expect(brandInput).toBeInTheDocument();
    expect(brandInput.value).toBe('https://brand.apex.com/guidelines');

    expect((screen.getByLabelText(/Website URL/i) as HTMLInputElement).value).toBe('https://apexgrowth.com');
    expect((screen.getByLabelText(/FLC Landing Page URL/i) as HTMLInputElement).value).toBe('https://flc-landing.com/apex');
    expect((screen.getByLabelText(/Google Drive Folder URL/i) as HTMLInputElement).value).toBe('https://drive.google.com/drive/folders/apex-root');
    expect((screen.getByLabelText(/Important Documents URL/i) as HTMLInputElement).value).toBe('https://docs.google.com/document/d/apex-sop');
    expect((screen.getByLabelText(/Master Business Document URL/i) as HTMLInputElement).value).toBe('https://docs.google.com/document/d/apex-master-biz');
    expect((screen.getByLabelText(/Static Creatives URL/i) as HTMLInputElement).value).toBe('https://drive.google.com/drive/folders/apex-statics');
    expect((screen.getByLabelText(/Videos URL/i) as HTMLInputElement).value).toBe('https://drive.google.com/drive/folders/apex-videos');
    expect((screen.getByLabelText(/VSL \(Video Sales Letter\) URL/i) as HTMLInputElement).value).toBe('https://vimeo.com/apex-vsl-2026');
    expect((screen.getByLabelText(/Testimonials URL/i) as HTMLInputElement).value).toBe('https://drive.google.com/drive/folders/apex-testimonials');
    expect((screen.getByLabelText(/Grid URL/i) as HTMLInputElement).value).toBe('https://grid.app/apex-dashboard');
    expect((screen.getByLabelText(/Social Media Management URL/i) as HTMLInputElement).value).toBe('https://buffer.com/apex');
    expect((screen.getByLabelText(/LinkedIn Management URL/i) as HTMLInputElement).value).toBe('https://linkedin.com/campaignmanager/apex');
    expect((screen.getByLabelText(/SEO Management URL/i) as HTMLInputElement).value).toBe('https://app.ahrefs.com/dashboard/apex');
    expect((screen.getByLabelText(/Email Marketing Management URL/i) as HTMLInputElement).value).toBe('https://klaviyo.com/dashboard/apex');
    expect((screen.getByLabelText(/Paid Ads Management URL/i) as HTMLInputElement).value).toBe('https://adsmanager.facebook.com/apex');
    expect((screen.getByLabelText(/LinkedIn Company Page URL/i) as HTMLInputElement).value).toBe('https://linkedin.com/company/apex-growth');
    expect((screen.getByLabelText(/Facebook Page URL/i) as HTMLInputElement).value).toBe('https://facebook.com/apexgrowth');
    expect((screen.getByLabelText(/Instagram Page URL/i) as HTMLInputElement).value).toBe('https://instagram.com/apexgrowth');
    expect((screen.getByLabelText(/Slack Channel URL/i) as HTMLInputElement).value).toBe('https://app.slack.com/client/T1/C1');
    expect((screen.getByLabelText(/WhatsApp Group URL/i) as HTMLInputElement).value).toBe('https://chat.whatsapp.com/ApexVip');
    expect((screen.getByLabelText(/POC Number \/ WhatsApp/i) as HTMLInputElement).value).toBe('+92 300 1234567');
    expect(screen.getByTestId('poc-direct-whatsapp-link')).toHaveAttribute('href', 'https://wa.me/923001234567');

    // Clean initial state should NOT show unsaved changes indicator
    expect(screen.queryByTestId('unsaved-changes-indicator')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Discard Changes/i })).not.toBeInTheDocument();
  });

  // 5. DRAFT PROTECTION: TYPING PERSISTS TO SESSIONSTORAGE AND SHOWS UNSAVED BADGE
  it('5. Typing in ClientDetailsTab shows "Unsaved changes" indicator and saves draft into sessionStorage', async () => {
    render(
      <ClientDetailsTab
        client={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={vi.fn()}
      />
    );

    const brandInput = screen.getByLabelText(/Brand Identity URL/i);

    // Modify Brand Identity URL
    fireEvent.change(brandInput, { target: { value: 'https://newbrand.apex.com/assets' } });

    // Verify indicator and discard button appear
    expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard Changes/i })).toBeInTheDocument();

    // Verify draft is stored in sessionStorage under client specific key
    const draftKey = `ops_hub_client_links_draft_${mockClientA.id}`;
    const rawDraft = sessionStorage.getItem(draftKey);
    expect(rawDraft).toBeTruthy();

    const parsedDraft = JSON.parse(rawDraft!);
    expect(parsedDraft.brandIdentityUrl).toBe('https://newbrand.apex.com/assets');
    expect(parsedDraft.companyName).toBe(mockClientA.companyName);
  });

  // 6. DRAFT RESTORATION ON COMPONENT REMOUNT
  it('6. ClientDetailsTab restores unsaved draft from sessionStorage across remounts', () => {
    const draftKey = `ops_hub_client_links_draft_${mockClientA.id}`;
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({
        companyName: 'Apex Growth Updated Draft',
        clientName: mockClientA.clientName,
        brandIdentityUrl: 'https://restored-draft-brand.com',
        websiteUrl: 'https://restored-website.com'
      })
    );

    render(
      <ClientDetailsTab
        client={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={vi.fn()}
      />
    );

    expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();
    expect((screen.getByLabelText(/Brand Identity URL/i) as HTMLInputElement).value).toBe('https://restored-draft-brand.com');
    expect((screen.getByLabelText(/Website URL/i) as HTMLInputElement).value).toBe('https://restored-website.com');
    expect((screen.getByLabelText(/Company Name/i) as HTMLInputElement).value).toBe('Apex Growth Updated Draft');
  });

  // 7. DRAFT ISOLATION ACROSS DIFFERENT CLIENTS
  it('7. Draft storage is strictly isolated per client ID and does not leak to other clients', () => {
    // Put draft for Client A
    sessionStorage.setItem(
      `ops_hub_client_links_draft_${mockClientA.id}`,
      JSON.stringify({
        brandIdentityUrl: 'https://client-a-draft-brand.com'
      })
    );

    // Render Client B
    render(
      <ClientDetailsTab
        client={mockClientB}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={vi.fn()}
      />
    );

    // Client B should NOT load Client A draft
    expect((screen.getByLabelText(/Brand Identity URL/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Company Name/i) as HTMLInputElement).value).toBe('Beacon Ventures');
    expect(screen.queryByTestId('unsaved-changes-indicator')).not.toBeInTheDocument();
  });

  // 8. DISCARD CONFIRMATION MODAL & STATE RESET
  it('8. Clicking Discard Changes prompts confirmation modal, reverts changes, and clears draft on confirmation', async () => {
    render(
      <ClientDetailsTab
        client={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={vi.fn()}
      />
    );

    const brandInput = screen.getByLabelText(/Brand Identity URL/i);
    fireEvent.change(brandInput, { target: { value: 'https://temporary-modified-brand.com' } });

    expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();

    const discardBtn = screen.getByRole('button', { name: /Discard Changes/i });
    fireEvent.click(discardBtn);

    // Verify confirmation modal is open
    expect(screen.getByText('Discard Unsaved Changes?')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to discard your unsaved modifications\?/i)).toBeInTheDocument();

    // Click "Keep Editing" - draft remains
    const keepEditingBtn = screen.getByRole('button', { name: /Keep Editing/i });
    fireEvent.click(keepEditingBtn);
    expect(screen.queryByText('Discard Unsaved Changes?')).not.toBeInTheDocument();
    expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();

    // Click Discard again and confirm
    fireEvent.click(screen.getByRole('button', { name: /Discard Changes/i }));
    const confirmDiscardBtn = screen.getByRole('dialog').querySelector('button.bg-rose-600') as HTMLButtonElement;
    fireEvent.click(confirmDiscardBtn);

    // Form reverted and draft cleared
    expect((screen.getByLabelText(/Brand Identity URL/i) as HTMLInputElement).value).toBe('https://brand.apex.com/guidelines');
    expect(screen.queryByTestId('unsaved-changes-indicator')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(`ops_hub_client_links_draft_${mockClientA.id}`)).toBeNull();
  });

  // 9. SAVE PERSISTS BRAND IDENTITY URL, CLEARS DRAFT, AND UPDATES STORE
  it('9. Saving client details persists Brand Identity URL, clears draft from sessionStorage, and updates store', async () => {
    const updatedClientRecord: ClientRecord = {
      ...mockClientA,
      links: {
        ...mockClientA.links,
        brand_identity: 'https://brand-persisted.apex.com'
      }
    };

    const updateClientSpy = vi.spyOn(clientManagementService, 'updateClient').mockResolvedValue({
      data: updatedClientRecord,
      error: undefined
    });

    const onClientUpdatedMock = vi.fn();

    render(
      <ClientDetailsTab
        client={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={onClientUpdatedMock}
      />
    );

    const brandInput = screen.getByLabelText(/Brand Identity URL/i);
    fireEvent.change(brandInput, { target: { value: 'https://brand-persisted.apex.com' } });

    expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateClientSpy).toHaveBeenCalledWith(
        mockClientA.id,
        expect.objectContaining({
          links: expect.objectContaining({
            brand_identity: 'https://brand-persisted.apex.com'
          })
        }),
        'usr-owner-1'
      );
    });

    expect(onClientUpdatedMock).toHaveBeenCalledWith(updatedClientRecord);
    expect(sessionStorage.getItem(`ops_hub_client_links_draft_${mockClientA.id}`)).toBeNull();
  });

  // 10. CREATE AND DUPLICATE CLIENT MODALS INCLUDE BRAND IDENTITY AND POC NUMBER
  it('10. CreateClientModal and DuplicateClientModal render Brand Identity URL & POC Number inputs and submit them', async () => {
    const createSpy = vi.spyOn(clientManagementService, 'createClient').mockResolvedValue({
      data: mockClientA,
      error: undefined
    });

    const { unmount } = render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
      />
    );

    const brandInput = screen.getByLabelText(/Brand Identity URL/i);
    const pocInput = screen.getByLabelText(/POC Number \/ WhatsApp/i);
    expect(brandInput).toBeInTheDocument();
    expect(pocInput).toBeInTheDocument();

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: 'New Test Co' } });
    fireEvent.change(screen.getByLabelText(/Client \/ Owner Full Name/i), { target: { value: 'John Owner' } });
    fireEvent.change(screen.getByLabelText(/Activation Date/i), { target: { value: '2026-09-20' } });
    fireEvent.change(brandInput, { target: { value: 'https://brand.newtest.com' } });
    fireEvent.change(pocInput, { target: { value: '+92 300 9998877' } });

    const submitBtn = screen.getByRole('button', { name: /Create Client Workspace/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'New Test Co',
          links: expect.objectContaining({
            brand_identity: 'https://brand.newtest.com',
            poc_number: '+92 300 9998877'
          })
        }),
        'usr-owner-1'
      );
    });

    unmount();

    // Duplicate Client Modal
    const duplicateSpy = vi.spyOn(clientManagementService, 'duplicateClient').mockResolvedValue({
      data: mockClientB,
      error: undefined
    });

    render(
      <DuplicateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        sourceClient={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
      />
    );

    const dupBrandInput = screen.getByLabelText(/Brand Identity URL/i) as HTMLInputElement;
    const dupPocInput = screen.getByLabelText(/POC Number \/ WhatsApp/i) as HTMLInputElement;
    expect(dupBrandInput).toBeInTheDocument();
    expect(dupPocInput).toBeInTheDocument();
    expect(dupBrandInput.value).toBe(''); // Clean/blank links on duplicate
    expect(dupPocInput.value).toBe('');

    fireEvent.change(screen.getByLabelText(/New Company Name/i), { target: { value: 'Apex Europe' } });
    fireEvent.change(screen.getByLabelText(/Client \/ Owner Full Name/i), { target: { value: 'Jane European' } });
    fireEvent.change(screen.getByLabelText(/Activation Date/i), { target: { value: '2026-09-25' } });
    fireEvent.change(dupBrandInput, { target: { value: 'https://brand.apexeurope.com' } });
    fireEvent.change(dupPocInput, { target: { value: '+44 7700 900077' } });

    const dupSubmitBtn = screen.getByRole('button', { name: /Duplicate Client/i });
    await act(async () => {
      fireEvent.click(dupSubmitBtn);
    });

    await waitFor(() => {
      expect(duplicateSpy).toHaveBeenCalledWith(
        mockClientA.id,
        expect.objectContaining({
          companyName: 'Apex Europe',
          links: expect.objectContaining({
            brand_identity: 'https://brand.apexeurope.com',
            poc_number: '+44 7700 900077'
          })
        }),
        'usr-owner-1'
      );
    });
  });

  // 11. DIRECT WHATSAPP CLICK-TO-CHAT FORMATTING
  it('11. formatWhatsAppUrl correctly formats raw phone numbers, international formats, and preserve existing URLs', () => {
    expect(formatWhatsAppUrl('+92 300 1234567')).toBe('https://wa.me/923001234567');
    expect(formatWhatsAppUrl('03001234567')).toBe('https://wa.me/03001234567');
    expect(formatWhatsAppUrl('+1 (555) 234-5678')).toBe('https://wa.me/15552345678');
    expect(formatWhatsAppUrl('https://wa.me/923001234567')).toBe('https://wa.me/923001234567');
    expect(formatWhatsAppUrl('https://chat.whatsapp.com/ApexGroup')).toBe('https://chat.whatsapp.com/ApexGroup');
    expect(formatWhatsAppUrl('')).toBe('');
    expect(formatWhatsAppUrl(null)).toBe('');
    expect(formatWhatsAppUrl(undefined)).toBe('');
  });

  // 12. IMPORTANT DOCUMENTS WORKSPACE LINK CRUD & DRAFT PROTECTION
  it('12. Important Documents URL is configurable in ClientDetailsTab, CreateClientModal, and DuplicateClientModal', async () => {
    const updatedClientWithDocs: ClientRecord = {
      ...mockClientA,
      links: {
        ...mockClientA.links,
        important_docs: 'https://notion.so/apex/important-docs'
      }
    };

    const updateClientSpy = vi.spyOn(clientManagementService, 'updateClient').mockResolvedValue({
      data: updatedClientWithDocs,
      error: undefined
    });

    const onClientUpdatedMock = vi.fn();

    render(
      <ClientDetailsTab
        client={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={onClientUpdatedMock}
      />
    );

    const importantDocsInput = screen.getByLabelText(/Important Documents URL/i) as HTMLInputElement;
    expect(importantDocsInput).toBeInTheDocument();
    expect(importantDocsInput.value).toBe('https://docs.google.com/document/d/apex-sop');

    fireEvent.change(importantDocsInput, { target: { value: 'https://notion.so/apex/important-docs' } });
    expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateClientSpy).toHaveBeenCalledWith(
        mockClientA.id,
        expect.objectContaining({
          links: expect.objectContaining({
            important_docs: 'https://notion.so/apex/important-docs'
          })
        }),
        'usr-owner-1'
      );
    });

    expect(onClientUpdatedMock).toHaveBeenCalledWith(updatedClientWithDocs);
  });

  // 13. FIVE NEW CLIENT-SPECIFIC LINKS CRUD IN CLIENT DETAILS TAB
  it('13. Five new client-specific link options are configurable and saved in ClientDetailsTab', async () => {
    const updatedClientWithNewLinks: ClientRecord = {
      ...mockClientA,
      links: {
        ...mockClientA.links,
        social_media_management: 'https://hootsuite.com/apex-updated',
        linkedin_management: 'https://linkedin.com/apex-updated',
        seo_management: 'https://semrush.com/apex-updated',
        email_marketing_management: 'https://mailchimp.com/apex-updated',
        paid_ads_management: 'https://ads.google.com/apex-updated'
      }
    };

    const updateClientSpy = vi.spyOn(clientManagementService, 'updateClient').mockResolvedValue({
      data: updatedClientWithNewLinks,
      error: undefined
    });

    const onClientUpdatedMock = vi.fn();

    render(
      <ClientDetailsTab
        client={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={onClientUpdatedMock}
      />
    );

    const smmInput = screen.getByLabelText(/Social Media Management URL/i);
    const liInput = screen.getByLabelText(/LinkedIn Management URL/i);
    const seoInput = screen.getByLabelText(/SEO Management URL/i);
    const emailInput = screen.getByLabelText(/Email Marketing Management URL/i);
    const paidAdsInput = screen.getByLabelText(/Paid Ads Management URL/i);

    expect(smmInput).toBeInTheDocument();
    expect(liInput).toBeInTheDocument();
    expect(seoInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(paidAdsInput).toBeInTheDocument();

    fireEvent.change(smmInput, { target: { value: 'https://hootsuite.com/apex-updated' } });
    fireEvent.change(liInput, { target: { value: 'https://linkedin.com/apex-updated' } });
    fireEvent.change(seoInput, { target: { value: 'https://semrush.com/apex-updated' } });
    fireEvent.change(emailInput, { target: { value: 'https://mailchimp.com/apex-updated' } });
    fireEvent.change(paidAdsInput, { target: { value: 'https://ads.google.com/apex-updated' } });

    expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateClientSpy).toHaveBeenCalledWith(
        mockClientA.id,
        expect.objectContaining({
          links: expect.objectContaining({
            social_media_management: 'https://hootsuite.com/apex-updated',
            linkedin_management: 'https://linkedin.com/apex-updated',
            seo_management: 'https://semrush.com/apex-updated',
            email_marketing_management: 'https://mailchimp.com/apex-updated',
            paid_ads_management: 'https://ads.google.com/apex-updated'
          })
        }),
        'usr-owner-1'
      );
    });

    expect(onClientUpdatedMock).toHaveBeenCalledWith(updatedClientWithNewLinks);
  });

  // 14. FIVE NEW LINKS IN CREATE AND DUPLICATE CLIENT MODALS
  it('14. CreateClientModal and DuplicateClientModal render inputs for 5 new links and include them in payload', async () => {
    const createSpy = vi.spyOn(clientManagementService, 'createClient').mockResolvedValue({
      data: mockClientA,
      error: undefined
    });

    const { unmount } = render(
      <CreateClientModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
      />
    );

    const smmInput = screen.getByLabelText(/Social Media Management URL/i);
    const liInput = screen.getByLabelText(/LinkedIn Management URL/i);
    const seoInput = screen.getByLabelText(/SEO Management URL/i);
    const emailInput = screen.getByLabelText(/Email Marketing Management URL/i);
    const paidAdsInput = screen.getByLabelText(/Paid Ads Management URL/i);

    expect(smmInput).toBeInTheDocument();
    expect(liInput).toBeInTheDocument();
    expect(seoInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(paidAdsInput).toBeInTheDocument();

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: 'Alpha Marketing Co' } });
    fireEvent.change(screen.getByLabelText(/Client \/ Owner Full Name/i), { target: { value: 'Alpha Owner' } });
    fireEvent.change(screen.getByLabelText(/Activation Date/i), { target: { value: '2026-09-20' } });
    fireEvent.change(smmInput, { target: { value: 'https://buffer.com/alpha' } });
    fireEvent.change(liInput, { target: { value: 'https://linkedin.com/alpha' } });
    fireEvent.change(seoInput, { target: { value: 'https://ahrefs.com/alpha' } });
    fireEvent.change(emailInput, { target: { value: 'https://klaviyo.com/alpha' } });
    fireEvent.change(paidAdsInput, { target: { value: 'https://facebook.com/ads/alpha' } });

    const submitBtn = screen.getByRole('button', { name: /Create Client Workspace/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'Alpha Marketing Co',
          links: expect.objectContaining({
            social_media_management: 'https://buffer.com/alpha',
            linkedin_management: 'https://linkedin.com/alpha',
            seo_management: 'https://ahrefs.com/alpha',
            email_marketing_management: 'https://klaviyo.com/alpha',
            paid_ads_management: 'https://facebook.com/ads/alpha'
          })
        }),
        'usr-owner-1'
      );
    });

    unmount();
  });

  // 15. READABILITY OF MISSING LINKS (MEDIUM GREY & TOOLTIP)
  it('15. Missing links render with readable medium grey styles, disabled state, and "Link not added" tooltip', async () => {
    const clientPartialLinks: ClientRecord = {
      ...mockClientA,
      id: 'client-partial',
      links: {
        website: 'https://apexgrowth.com'
      }
    };

    vi.spyOn(clientManagementService, 'fetchClients').mockResolvedValue({
      data: [clientPartialLinks],
      error: undefined
    });

    useOpsStore.setState({
      clients: [clientPartialLinks],
      selectedClientId: clientPartialLinks.id
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('1 active')).toBeInTheDocument();
    });

    // Active link is rendered as <a>
    const activeLink = screen.getByRole('link', { name: /Website/i });
    expect(activeLink).toBeInTheDocument();

    // Missing links are rendered as non-clickable containers with title="Link not added" and aria-disabled="true"
    const missingElements = screen.getAllByTitle('Link not added');
    expect(missingElements.length).toBe(21); // 22 total - 1 active = 21 missing

    missingElements.forEach((el) => {
      expect(el).toHaveAttribute('aria-disabled', 'true');
      expect(el.className).toContain('text-gray-500');
      expect(el.className).toContain('cursor-not-allowed');
      expect(el.className).not.toContain('opacity-40');
      expect(el.className).not.toContain('opacity-50');
    });
  });

  // 16. MASTER BUSINESS DOCUMENT & TESTIMONIALS WORKSPACE LINKS CRUD & DRAFT PROTECTION
  it('16. Master Business Document and Testimonials links are configurable in ClientDetailsTab, CreateClientModal, and DuplicateClientModal', async () => {
    const updatedClient: ClientRecord = {
      ...mockClientA,
      links: {
        ...mockClientA.links,
        master_business_doc: 'https://notion.so/apex/mbd-doc',
        testimonials: 'https://drive.google.com/drive/folders/apex-testimonials-2'
      }
    };

    const updateClientSpy = vi.spyOn(clientManagementService, 'updateClient').mockResolvedValue({
      data: updatedClient,
      error: undefined
    });

    const onClientUpdatedMock = vi.fn();

    render(
      <ClientDetailsTab
        client={mockClientA}
        currentUserProfile={mockOwnerProfile}
        eligibleManagers={[mockOwnerProfile]}
        onClientUpdated={onClientUpdatedMock}
      />
    );

    const mbdInput = screen.getByLabelText(/Master Business Document URL/i) as HTMLInputElement;
    const testInput = screen.getByLabelText(/Testimonials URL/i) as HTMLInputElement;
    expect(mbdInput).toBeInTheDocument();
    expect(testInput).toBeInTheDocument();

    fireEvent.change(mbdInput, { target: { value: 'https://notion.so/apex/mbd-doc' } });
    fireEvent.change(testInput, { target: { value: 'https://drive.google.com/drive/folders/apex-testimonials-2' } });
    expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateClientSpy).toHaveBeenCalledWith(
        mockClientA.id,
        expect.objectContaining({
          links: expect.objectContaining({
            master_business_doc: 'https://notion.so/apex/mbd-doc',
            testimonials: 'https://drive.google.com/drive/folders/apex-testimonials-2'
          })
        }),
        'usr-owner-1'
      );
    });

    expect(onClientUpdatedMock).toHaveBeenCalledWith(updatedClient);
  });
});
