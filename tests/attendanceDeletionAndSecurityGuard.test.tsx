import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DeleteAttendanceModal } from '../src/components/employee/DeleteAttendanceModal';
import { formatPKTTimeHHMM } from '../src/lib/pktDateUtils';

describe('Attendance Deletion & Timezone Formatting Governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. formatPKTTimeHHMM converts UTC timestamps to correct AM PKT (Asia/Karachi) times', () => {
    // 20:05 UTC = 01:05 AM PKT (+5 hours)
    expect(formatPKTTimeHHMM('2026-11-09T20:05:59.887035+00:00')).toBe('01:05');
    // 20:06 UTC = 01:06 AM PKT
    expect(formatPKTTimeHHMM('2026-11-09T20:06:45.042692+00:00')).toBe('01:06');
    // 20:10 UTC = 01:10 AM PKT
    expect(formatPKTTimeHHMM('2026-11-09T20:10:23.306335+00:00')).toBe('01:10');
    // 20:11 UTC = 01:11 AM PKT
    expect(formatPKTTimeHHMM('2026-11-09T20:11:32.664743+00:00')).toBe('01:11');
    // 19:56 UTC = 00:56 AM PKT
    expect(formatPKTTimeHHMM('2026-11-09T19:56:05.003005+00:00')).toBe('00:56');
    // 22:49 UTC = 03:49 AM PKT
    expect(formatPKTTimeHHMM('2026-11-09T22:49:33.057934+00:00')).toBe('03:49');
  });

  it('2. DeleteAttendanceModal displays employee details and enforces mandatory reason', () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    const sampleAttendance = {
      id: 'att-12345',
      employeeId: 'emp-999',
      employeeName: 'Faseeh Lall',
      workDate: '2026-11-09',
      checkInTime: '2026-11-09T19:56:05.003005+00:00',
      checkOutTime: '2026-11-09T22:49:33.057934+00:00'
    };

    render(
      <DeleteAttendanceModal
        isOpen={true}
        onClose={handleClose}
        attendance={sampleAttendance}
        callerId="caller-owner"
        onSuccess={handleSuccess}
      />
    );

    // Modal title & Owner badge
    expect(screen.getByText('Delete Attendance Record')).toBeDefined();
    expect(screen.getByText('Owner Only')).toBeDefined();

    // Details card
    expect(screen.getByText('Faseeh Lall')).toBeDefined();
    expect(screen.getByText(/2026-11-09/)).toBeDefined();

    // Reason input & Confirm Delete button
    const reasonInput = screen.getByTestId('delete-attendance-reason-input') as HTMLTextAreaElement;
    expect(reasonInput).toBeDefined();
    expect(reasonInput.required).toBe(true);

    const confirmBtn = screen.getByTestId('confirm-delete-attendance-btn') as HTMLButtonElement;
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn.disabled).toBe(true); // Disabled when reason is empty!
  });
});
