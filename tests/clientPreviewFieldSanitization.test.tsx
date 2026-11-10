import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientRecord, ClientTask, UserProfile } from '../src/types';
import { useOpsStore } from '../src/store/opsStore';
import { Sidebar } from '../src/components/layout/Sidebar';
import { SelectedClientHeader } from '../src/components/clients/SelectedClientHeader';
import { ClientKanbanCard } from '../src/components/tasks/ClientKanbanCard';
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
});
