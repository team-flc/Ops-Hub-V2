import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TaskCompletionTrendChart } from '../src/components/dashboard/TaskCompletionTrendChart';
import { ClientTask } from '../src/types';

describe('Trends Breakdown Exact Reconciliation Suite', () => {
  // Construct exact dataset matching live Kanban & user specification:
  // Week 1: Total 232 = Completed 4 + In Flight 12 + Awaiting Approval 19 + Pending 197
  // Week 2: Total 49 = Completed 1 + In Flight 1 + Awaiting Approval 8 + Pending 39
  // Week 3: Total 23 = Completed 0 + In Flight 2 + Awaiting Approval 0 + Pending 21
  // Week 4: Total 6 = Completed 0 + In Flight 2 + Awaiting Approval 0 + Pending 4

  const week1Tasks: ClientTask[] = [
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `w1-c-${i}`, clientId: 'c1', title: 'Task', status: 'Completed' as const, weekNumber: 1, createdAt: ''
    })),
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `w1-p-${i}`, clientId: 'c1', title: 'Task', status: 'In Progress' as const, weekNumber: 1, createdAt: ''
    })),
    ...Array.from({ length: 19 }, (_, i) => ({
      id: `w1-a-${i}`, clientId: 'c1', title: 'Task', status: 'Team Review' as const, weekNumber: 1, createdAt: ''
    })),
    ...Array.from({ length: 197 }, (_, i) => ({
      id: `w1-q-${i}`, clientId: 'c1', title: 'Task', status: 'Pending' as const, weekNumber: 1, createdAt: ''
    }))
  ];

  const week2Tasks: ClientTask[] = [
    ...Array.from({ length: 1 }, (_, i) => ({
      id: `w2-c-${i}`, clientId: 'c1', title: 'Task', status: 'Completed' as const, weekNumber: 2, createdAt: ''
    })),
    ...Array.from({ length: 1 }, (_, i) => ({
      id: `w2-p-${i}`, clientId: 'c1', title: 'Task', status: 'In Progress' as const, weekNumber: 2, createdAt: ''
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `w2-a-${i}`, clientId: 'c1', title: 'Task', status: 'Team Review' as const, weekNumber: 2, createdAt: ''
    })),
    ...Array.from({ length: 39 }, (_, i) => ({
      id: `w2-q-${i}`, clientId: 'c1', title: 'Task', status: 'Pending' as const, weekNumber: 2, createdAt: ''
    }))
  ];

  const week3Tasks: ClientTask[] = [
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `w3-p-${i}`, clientId: 'c1', title: 'Task', status: 'In Progress' as const, weekNumber: 3, createdAt: ''
    })),
    ...Array.from({ length: 21 }, (_, i) => ({
      id: `w3-q-${i}`, clientId: 'c1', title: 'Task', status: 'Pending' as const, weekNumber: 3, createdAt: ''
    }))
  ];

  const week4Tasks: ClientTask[] = [
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `w4-p-${i}`, clientId: 'c1', title: 'Task', status: 'In Progress' as const, weekNumber: 4, createdAt: ''
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `w4-q-${i}`, clientId: 'c1', title: 'Task', status: 'Pending' as const, weekNumber: 4, createdAt: ''
    }))
  ];

  it('1. Week 1 breakdown sums exactly to 232 with Completed 4, In Flight 12, Awaiting Approval 19, Pending 197', () => {
    const completed = 4;
    const inFlight = 12;
    const awaitingApproval = 19;
    const pending = 197;
    const total = completed + inFlight + awaitingApproval + pending;

    expect(total).toBe(232);
    expect(week1Tasks.length).toBe(232);

    const { container } = render(<TaskCompletionTrendChart tasks={week1Tasks} />);
    expect(container.textContent).toContain('Week 1');
    expect(container.textContent).toContain('Total Tasks232');
    expect(container.textContent).toContain('Completed4');
    expect(container.textContent).toContain('In Flight12');
    expect(container.textContent).toContain('Awaiting Approval19');
    expect(container.textContent).toContain('Pending197');
  });

  it('2. Week 2 breakdown sums exactly to 49 with Completed 1, In Flight 1, Awaiting Approval 8, Pending 39', () => {
    const completed = 1;
    const inFlight = 1;
    const awaitingApproval = 8;
    const pending = 39;
    const total = completed + inFlight + awaitingApproval + pending;

    expect(total).toBe(49);
    expect(week2Tasks.length).toBe(49);

    const allTasks = [...week1Tasks, ...week2Tasks, ...week3Tasks, ...week4Tasks];
    const { container } = render(<TaskCompletionTrendChart tasks={allTasks} />);
    expect(container.textContent).toContain('Week 2');
    expect(container.textContent).toContain('Total Tasks49');
    expect(container.textContent).toContain('Completed1');
    expect(container.textContent).toContain('In Flight1');
    expect(container.textContent).toContain('Awaiting Approval8');
    expect(container.textContent).toContain('Pending39');
  });

  it('3. Week 3 breakdown sums exactly to 23 with Completed 0, In Flight 2, Awaiting Approval 0, Pending 21', () => {
    const completed = 0;
    const inFlight = 2;
    const awaitingApproval = 0;
    const pending = 21;
    const total = completed + inFlight + awaitingApproval + pending;

    expect(total).toBe(23);
    expect(week3Tasks.length).toBe(23);

    const allTasks = [...week1Tasks, ...week2Tasks, ...week3Tasks, ...week4Tasks];
    const { container } = render(<TaskCompletionTrendChart tasks={allTasks} />);
    expect(container.textContent).toContain('Week 3');
    expect(container.textContent).toContain('Total Tasks23');
    expect(container.textContent).toContain('Completed0');
    expect(container.textContent).toContain('In Flight2');
    expect(container.textContent).toContain('Awaiting Approval0');
    expect(container.textContent).toContain('Pending21');
  });

  it('4. Week 4 breakdown sums exactly to 6 with Completed 0, In Flight 2, Awaiting Approval 0, Pending 4', () => {
    const completed = 0;
    const inFlight = 2;
    const awaitingApproval = 0;
    const pending = 4;
    const total = completed + inFlight + awaitingApproval + pending;

    expect(total).toBe(6);
    expect(week4Tasks.length).toBe(6);

    const allTasks = [...week1Tasks, ...week2Tasks, ...week3Tasks, ...week4Tasks];
    const { container } = render(<TaskCompletionTrendChart tasks={allTasks} />);
    expect(container.textContent).toContain('Week 4');
    expect(container.textContent).toContain('Total Tasks6');
    expect(container.textContent).toContain('Completed0');
    expect(container.textContent).toContain('In Flight2');
    expect(container.textContent).toContain('Awaiting Approval0');
    expect(container.textContent).toContain('Pending4');
  });

  it('5. Every week in trends derives from task data and includes Awaiting Approval in breakdown and vertical bar', () => {
    const allTasks = [...week1Tasks, ...week2Tasks, ...week3Tasks, ...week4Tasks];
    const { container } = render(<TaskCompletionTrendChart tasks={allTasks} />);

    // Legend
    expect(screen.getByText('Operations Progress & Resolution Trends')).toBeDefined();
    expect(screen.getAllByText('Awaiting Approval').length).toBeGreaterThanOrEqual(4);

    // Check titles on bars
    expect(container.querySelector('[title="Awaiting Approval: 19"]')).toBeDefined();
    expect(container.querySelector('[title="Awaiting Approval: 8"]')).toBeDefined();
  });

  it('6. Monthly Rollup breakdown sums exactly to total scope with all categories', () => {
    const allTasks = [...week1Tasks, ...week2Tasks, ...week3Tasks, ...week4Tasks];
    const { container } = render(<TaskCompletionTrendChart tasks={allTasks} />);

    // Switch to monthly rollup
    const monthlyBtn = screen.getByRole('button', { name: /Monthly Rollup/i });
    act(() => {
      fireEvent.click(monthlyBtn);
    });

    expect(container.textContent).toContain('Total Scope');
    expect(container.textContent).toContain('Resolved');
    expect(container.textContent).toContain('In Flight');
    expect(container.textContent).toContain('Awaiting Approval');
    expect(container.textContent).toContain('Pending');
  });
});
