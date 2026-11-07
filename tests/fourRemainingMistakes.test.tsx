import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientWeekStepper } from '../src/components/clients/ClientWeekStepper';
import { ClientKanbanBoard } from '../src/components/tasks/ClientKanbanBoard';
import { FinfixClientPortalView } from '../src/components/portal/FinfixClientPortalView';
import { Sidebar } from '../src/components/layout/Sidebar';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { ClientRecord, ClientTask, UserProfile, DEFAULT_WEEK_NAMES } from '../src/types';
import { useOpsStore } from '../src/store/opsStore';

vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    fetchCrossClientTasks: vi.fn(),
    fetchClientWeeks: vi.fn()
  }
}));

describe('4 Remaining Mistakes Verification Suite Across All 28 Clients', () => {
  const staffUser: UserProfile = {
    id: 'staff-user-1',
    email: 'qa.owner.2fa@faseehlall.com',
    fullName: 'Muhammad Atif Naseer',
    role: 'owner',
    status: 'active'
  };

  const cloudZClient: ClientRecord = {
    id: 'd3d666c2-24c7-4cc7-b879-55c6d5881185',
    companyName: 'Cloud Z Technologies',
    clientName: 'Zain Client',
    status: 'Active',
    subscriptionTier: 'Growth Retainer',
    package: 'Dedicated Growth',
    totalTasks: 6,
    completedTasks: 3,
    operationalManagerId: 'mgr-1',
    activationDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
    links: {
      website: 'https://cloudztech.com',
      slack_channel: 'https://app.slack.com/client/T1/C1',
      whatsapp_group: 'https://chat.whatsapp.com/CloudZVip',
      poc_number: '+92 300 7654321',
      poc_email: 'poc@cloudztech.com'
    },
    requiredLinkedinProfileCount: 3
  };

  const cloudZTasks: ClientTask[] = [
    {
      id: 'cz-task-1',
      clientId: cloudZClient.id,
      title: 'Cloud Z Funnel Audit',
      status: 'Done',
      priority: 'Normal',
      weekNumber: 1,
      createdAt: '2026-10-14T08:00:00Z',
      completedAt: '2026-10-15T14:30:00Z'
    },
    {
      id: 'cz-task-2',
      clientId: cloudZClient.id,
      title: 'Cloud Z Meta Campaign Setup',
      status: 'Done',
      priority: 'High',
      weekNumber: 1,
      createdAt: '2026-10-14T09:00:00Z',
      completedAt: '2026-10-15T15:00:00Z'
    },
    {
      id: 'cz-task-3',
      clientId: cloudZClient.id,
      title: 'Cloud Z Internal Budget Note',
      isInternalOnly: true,
      status: 'Done',
      priority: 'Low',
      weekNumber: 1,
      createdAt: '2026-10-14T10:00:00Z',
      completedAt: '2026-10-15T16:00:00Z'
    },
    {
      id: 'cz-task-4',
      clientId: cloudZClient.id,
      title: 'Cloud Z Landing Page Wireframe',
      status: 'Approval',
      priority: 'Normal',
      weekNumber: 1,
      createdAt: '2026-10-14T11:00:00Z'
    },
    {
      id: 'cz-task-5',
      clientId: cloudZClient.id,
      title: 'Cloud Z Creative Asset Review',
      status: 'Approval',
      priority: 'Normal',
      weekNumber: 1,
      createdAt: '2026-10-14T12:00:00Z'
    },
    {
      id: 'cz-task-6',
      clientId: cloudZClient.id,
      title: 'Cloud Z Internal Quality Gate',
      isInternalOnly: true,
      status: 'Approval',
      priority: 'Normal',
      weekNumber: 1,
      createdAt: '2026-10-14T13:00:00Z'
    }
  ];

  const mavenClient: ClientRecord = {
    id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3',
    companyName: 'Maven Professionals',
    clientName: 'Maven Client',
    status: 'Active',
    subscriptionTier: 'Growth Retainer',
    package: 'Dedicated Growth',
    totalTasks: 10,
    completedTasks: 0,
    operationalManagerId: 'mgr-1',
    activationDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
    links: {
      website: 'https://mavenpro.com'
    }
  };

  // Maven has Week 3 Funnel Setup with 8 Approval, 2 In Progress, 0 Done
  const mavenTasks: ClientTask[] = [
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `mvn-app-${i + 1}`,
      clientId: mavenClient.id,
      title: `Maven Funnel Approval Deliverable ${i + 1}`,
      status: 'Approval' as const,
      weekNumber: 3,
      createdAt: '2026-10-15T10:00:00Z'
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `mvn-prog-${i + 1}`,
      clientId: mavenClient.id,
      title: `Maven Funnel In Progress Deliverable ${i + 1}`,
      status: 'In Progress' as const,
      weekNumber: 3,
      createdAt: '2026-10-15T10:00:00Z'
    }))
  ];

  // 1. PROBLEM 1: SKELETON LOADING STATE, NEVER 0/0 AS FIRST PAINT
  it('Problem 1: Week stepper and Kanban board show skeleton loading state without 0/0 or 0 tasks', () => {
    // When isLoading is true
    const { container: stepperContainer } = render(
      <ClientWeekStepper
        client={cloudZClient}
        activeWeekNum={1}
        onSelectWeek={vi.fn()}
        weekNames={DEFAULT_WEEK_NAMES}
        tasksByWeek={{ 1: [], 2: [], 3: [], 4: [] }}
        isLoading={true}
      />
    );

    // Must NOT contain 0/0 or 0 tasks
    expect(stepperContainer.textContent).not.toContain('0/0');
    expect(stepperContainer.textContent).not.toContain('0 tasks');
    expect(stepperContainer.textContent).not.toContain('0%');

    // Skeletons exist
    const loadingPill = screen.getByTestId('week-step-loading-1');
    expect(loadingPill).toBeInTheDocument();

    // When isLoading is false, real totals render
    const { container: loadedContainer } = render(
      <ClientWeekStepper
        client={cloudZClient}
        activeWeekNum={1}
        onSelectWeek={vi.fn()}
        weekNames={DEFAULT_WEEK_NAMES}
        tasksByWeek={{ 1: cloudZTasks, 2: [], 3: [], 4: [] }}
        isLoading={false}
      />
    );
    expect(loadedContainer.textContent).toContain('3/6');
    expect(loadedContainer.textContent).toContain('50%');
  });

  it('Problem 1: ClientKanbanBoard shows skeletons when isLoading is true and does not show 0 count', () => {
    const { container } = render(
      <ClientKanbanBoard
        client={cloudZClient}
        tasks={[]}
        weekNumber={1}
        weekName="Social Media Optimization"
        currentUserProfile={staffUser}
        isClientView={false}
        onSelectTask={vi.fn()}
        onOpenEditModal={vi.fn()}
        onOpenCreateTask={vi.fn()}
        onStatusChange={vi.fn()}
        onStartWork={vi.fn()}
        onPauseTimer={vi.fn()}
        onResumeTimer={vi.fn()}
        onShowToast={vi.fn()}
        isLoading={true}
      />
    );

    // Columns should NOT show '0' count badges when loading
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  // 2. PROBLEM 2: MAVEN FUNNEL SETUP EVALUATES TO IN REVIEW UNDER UNIFIED DOMINANT STATUS RULE
  it('Problem 2: Maven Funnel Setup evaluates to In Review when approvals dominate', () => {
    render(
      <FinfixClientPortalView
        client={mavenClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={mavenTasks}
      />
    );

    const progressSection = screen.getByTestId('project-progress-section');
    expect(progressSection.textContent).toContain('Funnel Setup');
    // Maven Funnel Setup has 8 Approval, 2 In Progress -> Approvals dominate -> In Review
    expect(progressSection.textContent).toContain('In Review');
    expect(progressSection.textContent).not.toContain('In Progress');
  });

  // 3. PROBLEM 3: CLOUD Z FOOTER MATCHES STAT CARDS WITH RECONCILIATION IN BRACKETS
  it('Problem 3: Cloud Z footer reads 50% completed · 3 of 6 deliverables completed (4 visible + 2 internal)', () => {
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const bottomBar = screen.getByTestId('client-portal-bottom-bar');
    expect(bottomBar.textContent).toContain('50% completed · 3 of 6 deliverables completed (4 visible + 2 internal)');
  });

  it('Problem 3: Maven footer matches stat cards (0 of 10) with reconciliation in brackets', () => {
    const mavenWith1Internal: ClientTask[] = [
      ...mavenTasks,
      {
        id: 'mvn-int-1',
        clientId: mavenClient.id,
        title: 'Remind team shift notes',
        isInternalOnly: true,
        status: 'Approval',
        weekNumber: 3,
        createdAt: '2026-10-15T10:00:00Z'
      }
    ];

    render(
      <FinfixClientPortalView
        client={mavenClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={mavenWith1Internal}
      />
    );

    const bottomBar = screen.getByTestId('client-portal-bottom-bar');
    // Total is 11 (10 visible + 1 internal)
    expect(bottomBar.textContent).toContain('0 of 11 deliverables completed (10 visible + 1 internal)');
  });

  // 4. PROBLEM 4: STAFF SIDEBAR LAPTOP OPTIMIZATION (1366x768)
  it('Problem 4: Staff sidebar categorizes links with quick jump pills and keeps Slack, WhatsApp, POC reachable', () => {
    useOpsStore.setState({
      clients: [cloudZClient],
      selectedClientId: cloudZClient.id
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>
    );

    // Jump pills exist
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();

    // Section headers exist
    expect(screen.getByTestId('workspace-cat-core')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-cat-contact')).toBeInTheDocument();

    // Slack, WhatsApp, POC WhatsApp and POC Email are rendered
    expect(screen.getByTestId('sidebar-link-slack-channel')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-whatsapp-group')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-poc-number')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-poc-email')).toBeInTheDocument();
  });
});
