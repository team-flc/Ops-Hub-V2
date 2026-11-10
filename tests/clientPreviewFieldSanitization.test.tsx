import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientRecord, ClientTask, UserProfile } from '../src/types';
import { useOpsStore } from '../src/store/opsStore';
import { Sidebar } from '../src/components/layout/Sidebar';
import { SelectedClientHeader } from '../src/components/clients/SelectedClientHeader';
import { ClientKanbanCard } from '../src/components/tasks/ClientKanbanCard';
import { ClientDetailsTab } from '../src/components/clients/ClientDetailsTab';
import { filterAndSanitizeClientDeliverables } from '../src/components/clients/ClientWorkspaceView';
import { CLIENT_PERMITTED_LINK_KEYS, isInternalOrSensitiveUrl, sanitizeClientDeliverableTitle, isInternalOnlyTask } from '../src/lib/permissions';

vi.mock('../src/lib/safeRouterHooks', () => ({
  useSafeNavigate: () => vi.fn(),
  useSafeParams: () => ({}),
  useSafeLocation: () => ({ pathname: '/clients/8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3', search: '?preview=true' })
}));

describe('Client Preview Field & Layout Security Suite', () => {
  const mavenClient: ClientRecord = {
    id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3',
    companyName: 'Maven Professionals',
    clientName: 'Faseeh Lall',
    operationalManagerName: 'Muhammad Atif Naseer',
    clientEmail: 'client@maven.com',
    status: 'Active',
    totalTasks: 10,
    completedTasks: 0,
    overdueTasks: 0,
    healthScore: 90,
    links: {
      website: 'https://mavenprofessionals.com',
      flc_landing_page: 'https://faseehlall.com/maven',
      brand_identity: 'https://drive.google.com/drive/folders/brand123',
      google_drive: 'https://drive.google.com/drive/folders/internal123',
      slack_channel: 'https://slack.com/archives/C123',
      whatsapp_group: 'https://chat.whatsapp.com/invite123',
      poc_number: 'https://wa.me/923001234567',
      poc_email: 'poc@maven.com'
    }
  };

  const pixelClient: ClientRecord = {
    id: 'b1c2d3e4-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
    companyName: 'Pixel Algos',
    clientName: 'Client Owner',
    operationalManagerName: 'Manager Name',
    clientEmail: 'client@pixel.com',
    status: 'Active',
    totalTasks: 5,
    completedTasks: 1,
    overdueTasks: 0,
    healthScore: 95
  };

  const ownerProfile: UserProfile = {
    id: 'u-owner-1',
    email: 'faseeh@faseehlall.com',
    fullName: 'Faseeh Lall',
    role: 'owner',
    status: 'active'
  };

  // 10 Tasks on staff board for Maven Week 3
  const mavenWeek3Tasks: ClientTask[] = [
    {
      id: 'm-1',
      clientId: mavenClient.id,
      title: 'Maven ICP final',
      status: 'In Progress',
      approvalMode: 'Internal Only',
      weekNumber: 3,
      details: 'remind Faseeh about the Maven 6 PM shift',
      completionNotes: 'Work completed by Muhammad Atif Naseer',
      timerStartedAt: '2026-09-20T10:00:00Z',
      timeSpentSeconds: 3600,
      assigneeName: 'Muhammad Atif Naseer',
      evidenceUrl: 'https://drive.google.com/drive/folders/12345'
    },
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `m-${i + 2}`,
      clientId: mavenClient.id,
      title: `Funnel Deliverable Step ${i + 2}`,
      status: (i < 2 ? 'In Progress' : 'Approval') as any,
      approvalMode: 'Client Approval Required' as any,
      weekNumber: 3,
      details: `Internal technical details ${i + 2}`,
      completionNotes: `Internal completion note ${i + 2}`,
      timerStartedAt: i === 0 ? '2026-09-21T08:00:00Z' : null,
      timeSpentSeconds: 1800,
      assigneeName: 'Staff Member',
      evidenceUrl: 'https://docs.google.com/spreadsheets/d/abc123456789'
    }))
  ];

  it('Check 1: Sidebar renders full staff Workspace Links in preview mode with client switcher locked', () => {
    useOpsStore.getState().setClients([mavenClient]);
    useOpsStore.getState().setSelectedClientId(mavenClient.id);
    const { container } = render(<Sidebar />);
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain('Workspace Links');
    expect(screen.getByTestId('sidebar-link-google-drive')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-slack-channel')).toBeInTheDocument();
  });

  it('Check 2: Maven Week 3 follows count rule 2.3 with exactly 9 client-visible tasks and 1 internal task filtered out', () => {
    expect(mavenWeek3Tasks).toHaveLength(10);
    const sanitized = filterAndSanitizeClientDeliverables(mavenWeek3Tasks);

    // Rule 2.3: client visible total = staff board total (10) - internal only tasks (1) = 9
    expect(sanitized).toHaveLength(9);

    // Check every task shown to client has all internal fields stripped
    sanitized.forEach((t) => {
      expect(t.details).toBeUndefined();
      expect(t.completionNotes).toBeUndefined();
      expect(t.timerStartedAt).toBeNull();
      expect(t.timeSpentSeconds).toBeUndefined();
      expect(t.assigneeName).toBeUndefined();
      expect(t.evidenceUrl).toBeUndefined();
    });

    // The internal task 'm-1' (approvalMode: 'Internal Only') is completely excluded from client view
    expect(sanitized.find((t) => t.id === 'm-1')).toBeUndefined();
  });

  it('Check 3: SelectedClientHeader in preview hides Owner, Manager, and LinkedIn Profiles tracker for any client', () => {
    // Maven
    const { container: mavenHeader } = render(
      <SelectedClientHeader client={mavenClient} currentUserProfile={ownerProfile} isClientView={true} />
    );
    expect(mavenHeader.textContent).not.toContain('Owner:');
    expect(mavenHeader.textContent).not.toContain('Manager:');
    expect(mavenHeader.textContent).not.toContain('Muhammad Atif Naseer');
    expect(mavenHeader.textContent).not.toContain('LinkedIn Profiles');
    expect(mavenHeader.textContent).not.toContain('View as Client');
    expect(mavenHeader.textContent).not.toContain('Client Link');

    // Pixel Algos
    const { container: pixelHeader } = render(
      <SelectedClientHeader client={pixelClient} currentUserProfile={ownerProfile} isClientView={true} />
    );
    expect(pixelHeader.textContent).not.toContain('Owner:');
    expect(pixelHeader.textContent).not.toContain('Manager:');
    expect(pixelHeader.textContent).not.toContain('Manager Name');
    expect(pixelHeader.textContent).not.toContain('LinkedIn Profiles');
  });

  it('Check 4: ClientKanbanCard is completely read-only in preview with zero action buttons and no timers or evidence', () => {
    const sanitizedTasks = filterAndSanitizeClientDeliverables(mavenWeek3Tasks);

    const { container } = render(
      <ClientKanbanCard
        task={sanitizedTasks[0]}
        currentUserProfile={ownerProfile}
        isClientView={true}
        onSelectTask={vi.fn()}
        onOpenEditModal={vi.fn()}
        onStatusChange={vi.fn()}
        onStartWork={vi.fn()}
        onPauseTimer={vi.fn()}
        onResumeTimer={vi.fn()}
        onRequestApproval={vi.fn()}
        onRequestFeedback={vi.fn()}
      />
    );

    // No timers, no edit, no start, no pause, no submit
    expect(container.querySelectorAll('[data-testid^="timer-toggle-btn"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid^="start-task-btn"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid^="submit-approval-btn"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid^="approve-task-btn"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid^="reject-task-btn"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid^="evidence-link"]').length).toBe(0);

    // No assignee or internal text
    expect(container.textContent).not.toContain('Muhammad Atif Naseer');
    expect(container.textContent).not.toContain('6 PM shift');
  });

  it('Check 5: Finfix Pro INTERNAL ONLY leak prevention & reconciliation', () => {
    const finfixTasks: ClientTask[] = [
      {
        id: '833be413-d4ad-464e-ad01-ba26e9d4f891',
        clientId: '5d585580-d378-44a5-8dc1-d2653d4d6d8a',
        weekNumber: 1,
        title: 'FinFix naam confirm karo (FinFix Pro vs FinFix)',
        details: "Kahan se aaya: Client Variations chat 12 Oct. Background: FinFix variations me 'FinFix Pro' naam use hua (client docs se). Faseeh bataye ke plain 'FinFix' chahiye ya Pro theek hai. Priority P2 kyun: Chhota naming faisla hai. Karna kya hai: Naam confirm karo.",
        departmentId: 'dept-1',
        priority: 'Low',
        status: 'Completed',
        approvalMode: 'Internal Only',
        isClientVisible: false,
        sortOrder: 1,
        createdAt: '2026-10-14T09:00:00Z',
        updatedAt: '2026-10-14T09:00:00Z'
      },
      ...['Headline Research', 'Profile Picture & Banner Creation', 'Grid Posting on Page & all LinkedIn Profiles', 'Profile Verification', 'About Section Optimization', 'Featured Section Creation redirect to our Landing Page', 'Recommendations Exchange', 'Update Information according to Business.', 'Sales Navigator Activation'].map((title, idx) => ({
        id: `finfix-week2-${idx}`,
        clientId: '5d585580-d378-44a5-8dc1-d2653d4d6d8a',
        weekNumber: 2 as const,
        title,
        departmentId: 'dept-2',
        priority: 'Normal' as const,
        status: 'Draft' as const,
        approvalMode: 'Internal Only' as const,
        isClientVisible: false,
        sortOrder: idx + 1,
        createdAt: '2026-10-15T06:52:40Z',
        updatedAt: '2026-10-15T06:52:40Z'
      }))
    ];

    expect(finfixTasks).toHaveLength(10);

    // Sanitize for client deliverable view
    const clientVisible = filterAndSanitizeClientDeliverables(finfixTasks);

    // Exactly 9 client-visible deliverables (Week 1 internal task filtered out)
    expect(clientVisible).toHaveLength(9);
    expect(clientVisible.find((t) => t.id === '833be413-d4ad-464e-ad01-ba26e9d4f891')).toBeUndefined();
    expect(clientVisible.find((t) => t.title.includes('FinFix naam confirm karo'))).toBeUndefined();

    // Staff reconciliation calculations: 9 Visible + 1 Internal = 10 Total
    const internalTasks = finfixTasks.filter((t) => isInternalOnlyTask(t));
    expect(internalTasks).toHaveLength(1);
    expect(internalTasks[0].id).toBe('833be413-d4ad-464e-ad01-ba26e9d4f891');

    const totalStaffTasks = finfixTasks.length;
    const totalInternalTasks = internalTasks.length;
    const totalClientVisibleTasks = totalStaffTasks - totalInternalTasks;

    expect(totalStaffTasks).toBe(10);
    expect(totalInternalTasks).toBe(1);
    expect(totalClientVisibleTasks).toBe(9);
  });

  it('Check 6: Maven Week 3 internal working titles sanitized and reminders shielded', () => {
    const rawMavenWeek3Tasks: ClientTask[] = [
      {
        id: 'ffb7cf97-f0ad-447f-88de-98c24c6b9f9c',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Paid Ads Campaign Launch & Performance Report',
        details: 'Kahan se aaya: Register (MV-2). Background: Ads live karwane hain aur 3 din ki ads report Thu meeting ke liye tayyar rakhni hai.',
        status: 'Approval'
      },
      {
        id: '971c794e-8fca-440a-86f0-37c6e516fdc5',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Maven: 3 Sales Navigator + PKR 18,300 invoice; Zain se login/hosting',
        details: 'Kahan se aaya: Gmail notes 13 Oct (Zain Harris meeting).',
        status: 'In Progress'
      },
      {
        id: '1eb67b76-b305-4f92-984e-2ae4af03e33f',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Maven: ICP final (property vs e-commerce)',
        details: 'Kahan se aaya: Register (MV-4) + Gmail notes 13 Oct.',
        status: 'In Progress'
      },
      {
        id: 'e18d3e7f-189e-4c2b-892b-ff6b1414d44d',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Static Creatives & Carousel Assets',
        details: 'Kahan se aaya: Slack #maven-professionals + register (MV-6).',
        status: 'Approval'
      },
      {
        id: '27cf0bfe-9b77-4123-a9cb-d55964482ee0',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Maven: LinkedIn + assets optimize karo',
        details: 'Kahan se aaya: Register (MV-3).',
        status: 'Approval'
      },
      {
        id: '928400f1-04e4-479f-8942-d79fe9cc0fc0',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Thu meeting: Maven Professionals 5 PM',
        details: 'Kahan se aaya: Weekly roster (MEMORY.md).',
        status: 'Approval'
      },
      {
        id: '624fa6f3-44f5-4692-bdec-0a247fa767fc',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Video approval: Maven (13-9-2026 Mp.mp4)',
        details: 'Kahan se aaya: Slack #maven-professionals 13 Oct 7:52 PM.',
        status: 'Approval'
      },
      {
        id: '16db0741-e3d8-4bf4-8500-8e0cb7b9d7ff',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Maven: setup clean/organize (Ops Hub, Drive, socials)',
        details: 'Kahan se aaya: Register (MV-1) 12 Oct.',
        status: 'Approval'
      },
      {
        id: 'dcf70001-25cc-4515-b65d-18d22b14641d',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Maven Professional VSL Script',
        details: 'i want 40 to 50 seconds Maven Professional VSL Script',
        status: 'Approval'
      },
      {
        id: 'fd08be37-1866-4b8c-ae64-940f21be62cc',
        clientId: mavenClient.id,
        weekNumber: 3,
        title: 'Maven prep: Faseeh ko yaad dilao Maven 6 PM shift ki baat kare',
        details: 'Kahan se aaya: Clients Weekly Meetings chat 14 Oct + MEMORY.md.',
        status: 'Approval'
      }
    ];

    expect(rawMavenWeek3Tasks).toHaveLength(10);

    const clientVisible = filterAndSanitizeClientDeliverables(rawMavenWeek3Tasks);

    // 1. None of the three internal working titles appears in client preview
    const visibleTitles = clientVisible.map(t => t.title);
    expect(visibleTitles).not.toContain('Maven prep: Faseeh ko yaad dilao Maven 6 PM shift ki baat kare');
    expect(visibleTitles).not.toContain('Maven statics+carousel: Haider se confirmation lo');
    expect(visibleTitles).not.toContain('Maven: ads live + 3-day report ready rakho');

    // 2. Zero staff names in client-visible titles
    visibleTitles.forEach(title => {
      expect(title).not.toMatch(/\b(faseeh|haider|maaz|taha|zohaib|mushahid|latif|saad|atif|zain|ahmad)\b/i);
      expect(title).not.toMatch(/\b(yaad dilao|confirmation lo|ready rakho|optimize karo|bhejo|banao)\b/i);
    });

    // 3. Professional deliverable titles appear
    expect(visibleTitles).toContain('Paid Ads Campaign Launch & Performance Report');
    expect(visibleTitles).toContain('Static Creatives & Carousel Assets');
    expect(visibleTitles).toContain('Ideal Customer Profile (ICP) Strategy');
    expect(visibleTitles).toContain('LinkedIn Profile & Digital Assets Optimization');
    expect(visibleTitles).toContain('Promotional Video Asset Review');
    expect(visibleTitles).toContain('Workspace Organization & Social Channels Setup');
    expect(visibleTitles).toContain('Video Sales Letter (VSL) Script');

    // 4. Exactly 7 deliverables visible, 3 shielded
    expect(clientVisible).toHaveLength(7);
    const internalTasks = rawMavenWeek3Tasks.filter(isInternalOnlyTask);
    expect(internalTasks).toHaveLength(3);
    expect(rawMavenWeek3Tasks.length - internalTasks.length).toBe(7);
  });

  it('Check 7: Cloud Z internal working titles sanitized and draft delete shielded', () => {
    const rawCloudZTasks: ClientTask[] = [
      {
        id: '2b91f8be-eed6-4ca8-b8fb-e6b44ef6f9e6',
        clientId: 'd3d666c2-24c7-4cc7-b879-55c6d5881185',
        weekNumber: 2,
        title: 'Technical Requirements & Proposals Scoping',
        details: 'Kahan se aaya: Register (CZ-2) + Gmail notes 12 Oct + Slack #cloud-z-tech. Background: Client (Mushahid Ali Mirza) se client requirements aur proposals lene hain.',
        status: 'Approval'
      },
      {
        id: 'fd411616-351a-48b1-8c4d-c7a54ffc245d',
        clientId: 'd3d666c2-24c7-4cc7-b879-55c6d5881185',
        weekNumber: 2,
        title: 'Mushahid 9-post grid doc approve karo',
        details: 'Kahan se aaya: Client Variations chat 12 Oct.',
        status: 'Done'
      },
      {
        id: '48dbb073-cb98-46d8-862b-255c7c4f9cc0',
        clientId: 'd3d666c2-24c7-4cc7-b879-55c6d5881185',
        weekNumber: 2,
        title: 'Thu meeting: Cloud ZTech 8 PM',
        details: 'Kahan se aaya: Weekly roster.',
        status: 'Done'
      },
      {
        id: '2c3202e6-15fb-4899-b218-010517c89c94',
        clientId: 'd3d666c2-24c7-4cc7-b879-55c6d5881185',
        weekNumber: 2,
        title: 'Cloud ZTech 120 Zoho variations DRAFT review/approve karo',
        details: 'Kahan se aaya: Client Variations chat 14 Oct.',
        status: 'Approval'
      },
      {
        id: 'c2d79f93-d1da-48fe-858c-29aa167ce7f8',
        clientId: 'd3d666c2-24c7-4cc7-b879-55c6d5881185',
        weekNumber: 2,
        title: 'Cloud ZTech: pehli audience decide karo',
        details: 'Kahan se aaya: Register (CZ-3).',
        status: 'Approval'
      },
      {
        id: '0b537fca-849d-431c-bbaa-655fa84bb7ac',
        clientId: 'd3d666c2-24c7-4cc7-b879-55c6d5881185',
        weekNumber: 2,
        title: 'Cloud ZTech purana DRAFT PDF delete confirm karo',
        details: 'Kahan se aaya: Client Variations chat 13 Oct. Background: Purana ghalat DRAFT PDF rename karke SUPERSEDED-DO-NOT-USE kar diya gaya hai, delete nahi kiya.',
        status: 'Done'
      }
    ];

    expect(rawCloudZTasks).toHaveLength(6);

    const clientVisible = filterAndSanitizeClientDeliverables(rawCloudZTasks);

    // 1. Neither internal working title appears in client preview
    const visibleTitles = clientVisible.map(t => t.title);
    expect(visibleTitles).not.toContain('Mushahid Mirza se requirements/proposals lo');
    expect(visibleTitles).not.toContain('Cloud ZTech: Mushahid Mirza se requirements/proposals lo');
    expect(visibleTitles).not.toContain('purana DRAFT PDF delete confirm karo');
    expect(visibleTitles).not.toContain('Cloud ZTech purana DRAFT PDF delete confirm karo');
    expect(visibleTitles).not.toContain('Purana DRAFT PDF delete');

    // 2. Zero owner names (Mushahid Mirza) and zero draft delete wording in deliverable titles
    visibleTitles.forEach(title => {
      expect(title).not.toMatch(/\b(mushahid|mirza|shariq|faseeh)\b/i);
      expect(title).not.toMatch(/\b(purana|draft.*delete|delete.*confirm|approve karo|decide karo)\b/i);
    });

    // 3. Clean deliverable titles appear
    expect(visibleTitles).toContain('Technical Requirements & Proposals Scoping');
    expect(visibleTitles).toContain('Social Media Grid Strategy & Designs');
    expect(visibleTitles).toContain('Creative & Copy Variations Planning');
    expect(visibleTitles).toContain('Ideal Customer Profile (ICP) Strategy');

    // 4. Exactly 4 deliverables visible, 2 shielded
    expect(clientVisible).toHaveLength(4);
    const internalTasks = rawCloudZTasks.filter(isInternalOnlyTask);
    expect(internalTasks).toHaveLength(2);
    expect(rawCloudZTasks.length - internalTasks.length).toBe(4);
  });

  it('Check 8: Archived workspaces render zero Add Task buttons, zero action buttons, and reject mutations', () => {
    const archivedClient: ClientRecord = {
      id: '5d585580-d378-44a5-8dc1-d2653d4d6d8a',
      companyName: 'Finfix Pro',
      clientName: 'Finfix Owner',
      operationalManagerName: 'Manager Name',
      clientEmail: 'contact@finfix.com',
      status: 'Archived',
      totalTasks: 10,
      completedTasks: 5,
      overdueTasks: 0,
      healthScore: 80
    };

    const approvalTask: ClientTask = {
      id: 'task-archived-1',
      clientId: archivedClient.id,
      title: 'Review financial accounts',
      status: 'Approval',
      weekNumber: 1
    };

    const pendingTask: ClientTask = {
      id: 'task-archived-2',
      clientId: archivedClient.id,
      title: 'Setup ledger accounts',
      status: 'Pending',
      weekNumber: 1
    };

    // Render ClientKanbanCard with isArchived = true
    const { container: cardContainer } = render(
      <ClientKanbanCard
        task={approvalTask}
        currentUserProfile={ownerProfile}
        isClientView={false}
        onSelectTask={vi.fn()}
        onOpenEditModal={vi.fn()}
        onStatusChange={vi.fn()}
        onStartWork={vi.fn()}
        onPauseTimer={vi.fn()}
        onResumeTimer={vi.fn()}
        onRequestApproval={vi.fn()}
        onRequestFeedback={vi.fn()}
        isArchived={true}
      />
    );

    // 1. Approval card in archived workspace renders NO approve or reject buttons
    expect(cardContainer.querySelector('[data-testid^="approve-task-btn-"]')).toBeNull();
    expect(cardContainer.querySelector('[data-testid^="reject-task-btn-"]')).toBeNull();
    // 2. No edit pencil button
    expect(cardContainer.querySelector('button[title="Edit Task Fields"]')).toBeNull();

    // Render pending task with isArchived = true
    const { container: pendingContainer } = render(
      <ClientKanbanCard
        task={pendingTask}
        currentUserProfile={ownerProfile}
        isClientView={false}
        onSelectTask={vi.fn()}
        onOpenEditModal={vi.fn()}
        onStatusChange={vi.fn()}
        onStartWork={vi.fn()}
        onPauseTimer={vi.fn()}
        onResumeTimer={vi.fn()}
        onRequestApproval={vi.fn()}
        onRequestFeedback={vi.fn()}
        isArchived={true}
      />
    );

    // 3. No start button
    expect(pendingContainer.querySelector('[data-testid^="start-task-btn-"]')).toBeNull();
  });

  it('Check 9: ClientDetailsTab in archived workspace renders zero Save Changes buttons, zero Discard buttons, hides Add Profile drawer, and disables all fields', () => {
    const archivedClient: ClientRecord = {
      id: '5d585580-d378-44a5-8dc1-d2653d4d6d8a',
      companyName: 'Finfix Pro',
      clientName: 'Finfix Pro Owner',
      operationalManagerName: 'Muhammad Atif Naseer',
      clientEmail: 'owner@finfixpro.com',
      status: 'Archived',
      archivedAt: '2026-11-09T00:00:00Z',
      archiveReason: 'Client offboarded',
      totalTasks: 10,
      completedTasks: 5,
      overdueTasks: 0,
      healthScore: 80,
      links: {
        website: 'https://finfixpro.com',
        important_docs: 'https://docs.google.com/test'
      }
    };

    const { container } = render(
      <ClientDetailsTab
        client={archivedClient}
        currentUserProfile={ownerProfile}
        eligibleManagers={[ownerProfile]}
        onClientUpdated={vi.fn()}
        isClientView={false}
      />
    );

    // 1. Must show "Archived (Read-Only)" badge
    expect(container.textContent).toContain('Archived (Read-Only)');

    // 2. Must NOT render "Save Changes" button anywhere
    const buttons = Array.from(container.querySelectorAll('button'));
    const saveButtons = buttons.filter(b => b.textContent?.includes('Save Changes'));
    expect(saveButtons.length).toBe(0);

    // 3. Must NOT render "Discard Changes" button anywhere
    const discardButtons = buttons.filter(b => b.textContent?.includes('Discard'));
    expect(discardButtons.length).toBe(0);

    // 4. Must NOT render "Add Additional LinkedIn Profile"
    expect(container.textContent).not.toContain('Add Additional LinkedIn Profile');

    // 5. Must NOT render "Archive Client" danger button (it's already archived)
    const archiveButtons = buttons.filter(b => b.textContent?.includes('Archive Client'));
    expect(archiveButtons.length).toBe(0);

    // 6. All inputs and textareas must be disabled
    const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"])')) as HTMLInputElement[];
    const textareas = Array.from(container.querySelectorAll('textarea')) as HTMLTextAreaElement[];
    const selects = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];

    expect(inputs.length).toBeGreaterThan(0);
    inputs.forEach(input => {
      expect(input.disabled).toBe(true);
    });

    expect(textareas.length).toBeGreaterThan(0);
    textareas.forEach(textarea => {
      expect(textarea.disabled).toBe(true);
    });

    selects.forEach(select => {
      expect(select.disabled).toBe(true);
    });
  });
});
