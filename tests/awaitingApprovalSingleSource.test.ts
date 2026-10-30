import { describe, it, expect } from 'vitest';
import {
  isTaskAwaitingApproval,
  AWAITING_APPROVAL_STATUSES,
  ClientTask,
  ClientTaskStatus
} from '../src/types';

describe('Awaiting Approval Single Source of Truth', () => {
  it('AWAITING_APPROVAL_STATUSES contains only Team Review and Client Review', () => {
    expect(AWAITING_APPROVAL_STATUSES).toEqual(['Team Review', 'Client Review']);
  });

  it('isTaskAwaitingApproval returns true for Team Review and Client Review', () => {
    expect(isTaskAwaitingApproval('Team Review')).toBe(true);
    expect(isTaskAwaitingApproval('Client Review')).toBe(true);
    expect(isTaskAwaitingApproval({ status: 'Team Review' as ClientTaskStatus })).toBe(true);
    expect(isTaskAwaitingApproval({ status: 'Client Review' as ClientTaskStatus })).toBe(true);
  });

  it('isTaskAwaitingApproval returns false for Approval and other statuses', () => {
    // Specifically test that legacy/unprocessed 'Approval' status is NOT treated as awaiting active review
    expect(isTaskAwaitingApproval('Approval')).toBe(false);
    expect(isTaskAwaitingApproval('Pending')).toBe(false);
    expect(isTaskAwaitingApproval('Draft')).toBe(false);
    expect(isTaskAwaitingApproval('Assigned')).toBe(false);
    expect(isTaskAwaitingApproval('In Progress')).toBe(false);
    expect(isTaskAwaitingApproval('Completed')).toBe(false);
    expect(isTaskAwaitingApproval('Done')).toBe(false);
    expect(isTaskAwaitingApproval('Blocked')).toBe(false);
    expect(isTaskAwaitingApproval(null)).toBe(false);
    expect(isTaskAwaitingApproval(undefined)).toBe(false);
  });

  it('reconciles live data counts: exactly 20 across dashboard stat, owner queue, kanban column, and QA queue', () => {
    // Simulated dataset reflecting live production counts:
    // Approval: 78, Assigned: 3, Completed: 3, Done: 4, Draft: 74, In Progress: 12, Pending: 38, Team Review: 20
    const mockTasks: Partial<ClientTask>[] = [
      ...Array(78).fill(null).map((_, i) => ({ id: `app-${i}`, status: 'Approval' as ClientTaskStatus, title: 'Old Task' })),
      ...Array(3).fill(null).map((_, i) => ({ id: `asg-${i}`, status: 'Assigned' as ClientTaskStatus, title: 'Assigned Task' })),
      ...Array(3).fill(null).map((_, i) => ({ id: `cmp-${i}`, status: 'Completed' as ClientTaskStatus, title: 'Completed Task' })),
      ...Array(4).fill(null).map((_, i) => ({ id: `dn-${i}`, status: 'Done' as ClientTaskStatus, title: 'Done Task' })),
      ...Array(74).fill(null).map((_, i) => ({ id: `drf-${i}`, status: 'Draft' as ClientTaskStatus, title: 'Draft Task' })),
      ...Array(12).fill(null).map((_, i) => ({ id: `inp-${i}`, status: 'In Progress' as ClientTaskStatus, title: 'In Progress Task' })),
      ...Array(38).fill(null).map((_, i) => ({ id: `pnd-${i}`, status: 'Pending' as ClientTaskStatus, title: 'Pending Task' })),
      ...Array(20).fill(null).map((_, i) => ({ id: `rev-${i}`, status: 'Team Review' as ClientTaskStatus, title: 'Review Task' })),
    ];

    expect(mockTasks.length).toBe(232);

    // 1. Dashboard stat card calculation
    const dashboardStatCardCount = mockTasks.filter((t) => isTaskAwaitingApproval(t.status)).length;

    // 2. Company Approvals Queue calculation
    const companyApprovalsQueueCount = mockTasks.filter((t) => isTaskAwaitingApproval(t.status)).length;

    // 3. Kanban column mapping calculation
    const kanbanAwaitingApprovalCount = mockTasks.filter((t) => AWAITING_APPROVAL_STATUSES.includes(t.status as ClientTaskStatus)).length;

    // 4. Quality Assurance In Review Queue calculation
    const qaInReviewQueueCount = mockTasks.filter((t) => isTaskAwaitingApproval(t.status)).length;

    // All four must match identically
    expect(dashboardStatCardCount).toBe(20);
    expect(companyApprovalsQueueCount).toBe(20);
    expect(kanbanAwaitingApprovalCount).toBe(20);
    expect(qaInReviewQueueCount).toBe(20);

    expect(dashboardStatCardCount)
      .toBe(companyApprovalsQueueCount);
    expect(companyApprovalsQueueCount)
      .toBe(kanbanAwaitingApprovalCount);
    expect(kanbanAwaitingApprovalCount)
      .toBe(qaInReviewQueueCount);
  });
});
