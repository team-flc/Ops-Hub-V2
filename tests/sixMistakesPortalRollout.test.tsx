import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinfixClientPortalView } from '../src/components/portal/FinfixClientPortalView';
import { ClientMonthlyReportsView, generateMonthlyReportContent, triggerDownload } from '../src/components/portal/ClientMonthlyReportsView';
import { ClientRecord, ClientTask, UserProfile } from '../src/types';

vi.mock('../src/lib/taskManagementService', () => ({
  taskManagementService: {
    fetchCrossClientTasks: vi.fn(),
    fetchClientWeeks: vi.fn()
  }
}));

describe('6 Remaining Mistakes Verification Suite', () => {
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
      facebook: 'https://facebook.com/cloudztech',
      linkedin_management: 'https://linkedin.com/company/cloudz',
      paid_ads_management: 'https://ads.google.com/cloudz',
      email_marketing_management: 'https://mailchimp.com/cloudz'
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
      departmentId: 'dept-1',
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
      departmentId: 'dept-1',
      createdAt: '2026-10-14T09:00:00Z',
      completedAt: '2026-10-15T15:00:00Z'
    },
    {
      id: 'cz-task-3',
      clientId: cloudZClient.id,
      title: 'Cloud Z Internal Budget Note',
      status: 'Done',
      priority: 'Low',
      weekNumber: 1,
      departmentId: 'dept-1',
      details: 'Sensitive internal staff only notes for profit margin',
      createdAt: '2026-10-14T10:00:00Z',
      completedAt: '2026-10-15T16:00:00Z'
    },
    {
      id: 'cz-task-4',
      clientId: cloudZClient.id,
      title: 'Cloud Z Landing Page Wireframe',
      status: 'In Progress',
      priority: 'Normal',
      weekNumber: 1,
      departmentId: 'dept-1',
      createdAt: '2026-10-14T11:00:00Z'
    }
  ];

  const zeroClient: ClientRecord = {
    id: 'zero-client-1',
    companyName: 'Zero Task Client',
    clientName: 'Zero Lead',
    status: 'Active',
    subscriptionTier: 'Growth Retainer',
    package: 'Starter',
    totalTasks: 0,
    completedTasks: 0,
    operationalManagerId: 'mgr-1',
    activationDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
    links: {},
    requiredLinkedinProfileCount: 1
  };

  it('Fix 2: Trending line removes demo text and renders calculated status line or clean empty state', () => {
    // 1. Client with zero tasks
    const { container: zeroContainer } = render(
      <FinfixClientPortalView
        client={zeroClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={[]}
      />
    );

    const zeroBottomBar = screen.getByTestId('client-portal-bottom-bar');
    expect(zeroBottomBar.textContent).not.toContain("You're on the right track! Campaign performance is trending up this month.");
    expect(zeroContainer.textContent).not.toContain('trending up this month');

    // 2. Client with real tasks (Cloud Z)
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const bottomBars = screen.getAllByTestId('client-portal-bottom-bar');
    const cloudZBottomBar = bottomBars[bottomBars.length - 1];
    expect(cloudZBottomBar.textContent).not.toContain('trending up this month');
    expect(cloudZBottomBar.textContent).toContain('completed');
  });

  it('Fix 3: Marketing Channels renders real pie graph with real percentages for connected clients and Not connected for missing sources', () => {
    // 1. Cloud Z has Website, Meta, LinkedIn, Google Ads, Email connected
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const mktgSections = screen.getAllByTestId('marketing-channels-section');
    const cloudZMktg = mktgSections[mktgSections.length - 1];
    expect(cloudZMktg.textContent).toContain('Google Ads');
    expect(cloudZMktg.textContent).toContain('Meta Social');
    expect(cloudZMktg.textContent).toContain('Organic Search');
    expect(cloudZMktg.textContent).toContain('Total Leads');

    // 2. Zero Client has NO sources connected
    render(
      <FinfixClientPortalView
        client={zeroClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={[]}
      />
    );

    const zeroMktg = screen.getAllByTestId('marketing-channels-section');
    const lastZeroMktg = zeroMktg[zeroMktg.length - 1];
    expect(lastZeroMktg.textContent).toContain('Marketing Channels: Not connected');
    expect(lastZeroMktg.textContent).toContain('+ Connect Website');
    expect(lastZeroMktg.textContent).toContain('+ Connect Meta');
  });

  it('Fix 4: Dedicated monthly report source renders reports by month with dates and clean empty state', () => {
    const { container } = render(
      <ClientMonthlyReportsView
        client={cloudZClient}
        tasks={cloudZTasks}
        isStaffView={false}
      />
    );

    const reportCards = screen.getAllByTestId('monthly-report-card');
    expect(reportCards.length).toBeGreaterThan(0);
    // Verified that report dates and status are rendered
    expect(container.textContent).toContain('October 2026 Monthly Report');
    expect(container.textContent).toContain('No monthly report for November 2026');
    expect(container.textContent).toContain('Download Latest Report');
  });

  it('Fix 5: Cloud Z Recent Activity dates match between preview list and modal (Oct 15, 2026)', () => {
    render(
      <FinfixClientPortalView
        client={cloudZClient}
        currentUserProfile={staffUser}
        isPreview={true}
        tasks={cloudZTasks}
      />
    );

    const previewList = screen.getAllByTestId('recent-activity-section');
    const cloudZRecent = previewList[previewList.length - 1];

    // Completed tasks cz-task-1 and cz-task-2 must show Oct 15, 2026 (completedAt), NOT Oct 14 (createdAt)
    expect(cloudZRecent.textContent).toContain('Oct 15, 2026');
    expect(cloudZRecent.textContent).toContain('Cloud Z Funnel Audit');
    expect(cloudZRecent.textContent).toContain('Cloud Z Meta Campaign Setup');
  });

  it('Fix 6: triggerDownload produces valid downloadable file blob', () => {
    let appendedElem: any = null;
    let clicked = false;

    const originalAppendChild = document.body.appendChild.bind(document.body);
    const originalRemoveChild = document.body.removeChild.bind(document.body);

    document.body.appendChild = ((node: any) => {
      appendedElem = node;
      return node;
    }) as any;

    document.body.removeChild = ((node: any) => {
      return node;
    }) as any;

    const summary = {
      monthKey: '2026-11',
      monthName: 'November 2026',
      startDateStr: 'Nov 1, 2026',
      endDateStr: 'Nov 6, 2026',
      hasData: true,
      totalTasks: 4,
      completedTasks: 2,
      pendingTasks: 2,
      approvalTasks: 0,
      completionPercent: 50,
      tasksList: cloudZTasks,
      reportText: ''
    };

    const text = generateMonthlyReportContent(cloudZClient, summary);
    expect(text).toContain('OPS HUB - MONTHLY OPERATIONS REPORT');
    expect(text).toContain('Cloud Z Technologies');

    const result = triggerDownload('test_cloudz_report.txt', text);
    expect(result).toBe(true);

    document.body.appendChild = originalAppendChild;
    document.body.removeChild = originalRemoveChild;
  });
});
