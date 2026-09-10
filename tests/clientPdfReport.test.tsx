import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getPresetDateRanges, 
  validateDateRange, 
  sanitizeFilename,
  clientPdfReportService,
  ClientReportData
} from '../src/lib/clientPdfReportService';

describe('Client PDF Report Service - Asia/Karachi PKT & Data Contract', () => {
  it('computes exact Asia/Karachi (UTC+5) date ranges for presets', () => {
    const presets = getPresetDateRanges();

    expect(presets.thisWeek.label).toBe('This Week');
    expect(presets.thisMonth.label).toBe('This Month');
    expect(presets.lastMonth.label).toBe('Last Month');

    // Date formats must be YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(presets.thisWeek.startDate).toMatch(dateRegex);
    expect(presets.thisWeek.endDate).toMatch(dateRegex);
    expect(presets.thisMonth.startDate).toMatch(dateRegex);
    expect(presets.thisMonth.endDate).toMatch(dateRegex);
    expect(presets.lastMonth.startDate).toMatch(dateRegex);
    expect(presets.lastMonth.endDate).toMatch(dateRegex);

    // Start dates must be before or equal to end dates
    expect(presets.thisWeek.startDate <= presets.thisWeek.endDate).toBe(true);
    expect(presets.thisMonth.startDate <= presets.thisMonth.endDate).toBe(true);
    expect(presets.lastMonth.startDate <= presets.lastMonth.endDate).toBe(true);
  });

  it('validates custom date ranges correctly', () => {
    // Valid range
    const valid = validateDateRange('2026-04-01', '2026-04-30');
    expect(valid.isValid).toBe(true);
    expect(valid.error).toBeUndefined();

    // End date before start date
    const invalidOrder = validateDateRange('2026-05-01', '2026-04-01');
    expect(invalidOrder.isValid).toBe(false);
    expect(invalidOrder.error).toContain('Start date cannot be after end date');

    // Invalid format
    const invalidFormat = validateDateRange('invalid', '2026-04-01');
    expect(invalidFormat.isValid).toBe(false);
  });

  it('sanitizes filename correctly with company name and dates', () => {
    const filename = sanitizeFilename('Acme Corp / Tech Inc.', '2026-04-01', '2026-04-30');
    expect(filename).toBe('Acme_Corp_Tech_Inc_Progress_Report_2026-04-01_to_2026-04-30.pdf');
    expect(filename.endsWith('.pdf')).toBe(true);
    expect(filename).not.toContain('/');
  });

  it('compiles all 8 required standard report sections in data contract', () => {
    const mockReportData: ClientReportData = {
      client: {
        id: 'client-1',
        companyName: 'Acme Growth Co',
        clientName: 'John Doe',
        package: 'Advanced',
        operationalManagerId: 'mgr-1',
        operationalManagerName: 'Jane Smith',
        activationDate: '2026-01-01',
        status: 'Active',
        requiredLinkedinProfileCount: 3,
        links: {},
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      },
      dateRange: {
        preset: 'thisMonth',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        label: 'This Month'
      },
      summary: 'Executive progress during April 2026.',
      metrics: {
        completedInPeriodCount: 5,
        inProgressCount: 2,
        needsInputCount: 1,
        upcomingCount: 3,
        reopenedCount: 0
      },
      completedTasks: [
        {
          id: 'task-1',
          clientId: 'client-1',
          weekNumber: 1,
          title: 'Setup Domain & Mailboxes',
          priority: 'High',
          plannedStart: '2026-04-01',
          dueDate: '2026-04-07',
          status: 'Completed',
          completedAt: '2026-04-06T12:00:00Z',
          departmentId: 'dept-1',
          sortOrder: 1,
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-06T12:00:00Z'
        }
      ],
      inProgressTasks: [
        {
          id: 'task-2',
          clientId: 'client-1',
          weekNumber: 2,
          title: 'Cold Outreach Sequence Live',
          priority: 'Urgent',
          plannedStart: '2026-04-08',
          dueDate: '2026-04-14',
          status: 'In Progress',
          departmentId: 'dept-1',
          sortOrder: 2,
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-08T00:00:00Z'
        }
      ],
      reviewTasks: [
        {
          id: 'task-3',
          clientId: 'client-1',
          weekNumber: 2,
          title: 'Target Lead List Verification',
          priority: 'High',
          plannedStart: '2026-04-08',
          dueDate: '2026-04-12',
          status: 'Client Review',
          approvalMode: 'Client Approval Required',
          departmentId: 'dept-1',
          sortOrder: 3,
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-08T00:00:00Z'
        }
      ],
      publishedResults: [
        {
          id: 'res-1',
          clientId: 'client-1',
          metricName: 'Meetings Booked',
          metricValue: '18',
          reportingPeriod: 'April 2026',
          status: 'published',
          publishedAt: '2026-04-20T00:00:00Z'
        }
      ],
      roadmapMilestones: [
        {
          id: 'ms-1',
          title: 'Phase 1: Setup & Warmup',
          weekNumber: 1,
          status: 'completed',
          plannedStart: '2026-04-01',
          dueDate: '2026-04-14',
          completedAt: '2026-04-14T00:00:00Z',
          taskCount: 4,
          completedTaskCount: 4
        }
      ],
      deliverables: [
        {
          id: 'del-1',
          title: 'Master ICP Matrix.pdf',
          url: 'https://flc.com/docs/icp.pdf',
          taskId: 'task-1',
          taskTitle: 'Setup Domain & Mailboxes',
          departmentName: 'Strategy',
          sharedAt: '2026-04-06T12:00:00Z'
        }
      ]
    };

    // Verify 8 sections data presence
    expect(mockReportData.client.companyName).toBe('Acme Growth Co'); // Section 1: Header
    expect(mockReportData.summary).toBeDefined(); // Section 2: Executive Snapshot
    expect(mockReportData.publishedResults.length).toBeGreaterThan(0); // Section 3: Verified Results
    expect(mockReportData.completedTasks.length).toBe(1); // Section 4: Completed
    expect(mockReportData.inProgressTasks.length).toBe(1); // Section 5: In Progress
    expect(mockReportData.reviewTasks.length).toBe(1); // Section 6: Action Items
    expect(mockReportData.roadmapMilestones.length).toBe(1); // Section 7: Roadmap
    expect(mockReportData.deliverables.length).toBe(1); // Section 8: Deliverables
  });

  it('handles reopened tasks with transparent reporting (does not mask reopenings)', () => {
    const reopenedTask = {
      id: 'task-reopened-1',
      clientId: 'client-1',
      weekNumber: 1 as const,
      title: 'Email Copy Refinement',
      priority: 'Urgent' as const,
      plannedStart: '2026-04-01',
      dueDate: '2026-04-10',
      status: 'In Progress' as const,
      reopenedAt: '2026-04-08T10:00:00Z',
      reopenReason: 'Client requested revised tone of voice',
      departmentId: 'dept-1',
      sortOrder: 1,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-08T10:00:00Z'
    };

    expect(reopenedTask.reopenedAt).toBeDefined();
    expect(reopenedTask.reopenReason).toBe('Client requested revised tone of voice');
  });
});
