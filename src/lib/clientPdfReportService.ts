// ==============================================================================
// SERVICE: clientPdfReportService
// Location: src/lib/clientPdfReportService.ts
// Phase: Custom-Date PDF Reporting with Asia/Karachi Timezone
// ==============================================================================

import { 
  ClientRecord, 
  ClientTask, 
  ClientPublishedResult, 
  ClientDeliverableItem, 
  ClientRoadmapMilestone, 
  PortalDateRange 
} from '../types';

export interface ReportGenerationOptions {
  client: ClientRecord;
  dateRange: PortalDateRange;
  tasks: ClientTask[];
  publishedResults: ClientPublishedResult[];
  deliverables: ClientDeliverableItem[];
  roadmapMilestones: ClientRoadmapMilestone[];
}

/**
 * Format a Date or date string to Asia/Karachi (PKT UTC+5) display format
 */
export function formatToKarachiTime(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    }).format(d);
  } catch {
    return d.toUTCString();
  }
}

/**
 * Format YYYY-MM-DD to legible date string
 */
export function formatReportDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(dateObj);
}

/**
 * Calculate Date Ranges in Asia/Karachi
 */
export function getPresetDateRanges(refDate: Date = new Date()): {
  thisWeek: PortalDateRange;
  thisMonth: PortalDateRange;
  lastMonth: PortalDateRange;
} {
  // Convert refDate to Asia/Karachi calendar parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  const parts = formatter.formatToParts(refDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10);
  const day = parseInt(getPart('day'), 10);
  const weekday = getPart('weekday');

  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const currentDayOfWeek = dayMap[weekday] || 1;

  // 1. This Week (Monday to Sunday)
  const monDate = new Date(Date.UTC(year, month - 1, day - (currentDayOfWeek - 1)));
  const sunDate = new Date(Date.UTC(year, month - 1, day + (7 - currentDayOfWeek)));
  const fmtDate = (d: Date) => d.toISOString().split('T')[0];

  const thisWeek: PortalDateRange = {
    preset: 'this_week',
    startDate: fmtDate(monDate),
    endDate: fmtDate(sunDate),
    label: 'This Week'
  };

  // 2. This Month (1st to last day of current month)
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));

  const thisMonth: PortalDateRange = {
    preset: 'this_month',
    startDate: fmtDate(firstOfMonth),
    endDate: fmtDate(lastOfMonth),
    label: 'This Month'
  };

  // 3. Last Month (1st to last day of previous month)
  const firstOfLastMonth = new Date(Date.UTC(year, month - 2, 1));
  const lastOfLastMonth = new Date(Date.UTC(year, month - 1, 0));

  const lastMonth: PortalDateRange = {
    preset: 'last_month',
    startDate: fmtDate(firstOfLastMonth),
    endDate: fmtDate(lastOfLastMonth),
    label: 'Last Month'
  };

  return { thisWeek, thisMonth, lastMonth };
}

/**
 * Validate a date range
 */
export function validateDateRange(startDate: string, endDate: string): { valid: boolean; isValid: boolean; error?: string } {
  if (!startDate || !endDate) {
    return { valid: false, isValid: false, error: 'Start date and end date are both required.' };
  }

  const sTime = new Date(startDate).getTime();
  const eTime = new Date(endDate).getTime();

  if (isNaN(sTime) || isNaN(eTime)) {
    return { valid: false, isValid: false, error: 'Invalid date format. Expected YYYY-MM-DD.' };
  }

  if (startDate > endDate) {
    return { valid: false, isValid: false, error: 'Start date cannot be after end date.' };
  }

  const diffDays = Math.round((eTime - sTime) / (1000 * 60 * 60 * 24));
  if (diffDays > 365) {
    return { valid: false, isValid: false, error: 'Reporting range cannot exceed 365 calendar days.' };
  }

  return { valid: true, isValid: true };
}

/**
 * Sanitize filename for safe downloads
 */
export const sanitizeFilename = (companyName: string, startDate: string, endDate: string) => sanitizeReportFilename(companyName, startDate, endDate);

export function sanitizeReportFilename(companyName: string, startDate: string, endDate: string): string {
  const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return `${safeCompany || 'Client'}_Progress_Report_${startDate}_to_${endDate}.pdf`;
}

export const clientPdfReportService = {
  /**
   * Authoritatively generate and download the custom-date PDF progress report
   * Uses dynamic import for jsPDF to keep initial application bundle lightweight
   */
  async generateClientReportPdf(options: ReportGenerationOptions): Promise<{ success: boolean; filename?: string; error?: string }> {
    const { client, dateRange, tasks, publishedResults, deliverables, roadmapMilestones } = options;

    const validation = validateDateRange(dateRange.startDate, dateRange.endDate);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      // Lazy load jsPDF dynamically
      const { jsPDF } = await import('jspdf');

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);
      let currentY = margin;

      const generationTimestamp = formatToKarachiTime(new Date());

      // Filter tasks completed strictly within reporting period
      const periodCompletedTasks = tasks.filter((t) => {
        if (t.status !== 'Completed' || !t.completedAt) return false;
        const compDate = t.completedAt.split('T')[0];
        return compDate >= dateRange.startDate && compDate <= dateRange.endDate;
      });

      // Current ongoing tasks
      const ongoingTasks = tasks.filter((t) => t.status === 'In Progress' || t.status === 'Team Review');

      // Current review queue
      const reviewQueueTasks = tasks.filter((t) => t.status === 'Client Review');

      // Page break check helper
      const ensureSpace = (requiredHeight: number) => {
        if (currentY + requiredHeight > pageHeight - 16) {
          doc.addPage();
          currentY = margin;
          renderPageHeader();
        }
      };

      const renderPageHeader = () => {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, 8, 'F');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'bold');
        doc.text('FASEEH LALL & CO. · CLIENT EXPERIENCE REPORT', margin + 3, currentY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(client.companyName, pageWidth - margin - 3, currentY + 5.5, { align: 'right' });
        currentY += 12;
      };

      // ------------------------------------------------------------------------
      // 1. COVER / PRIMARY HEADER BANNER
      // ------------------------------------------------------------------------
      // Red Accent bar
      doc.setFillColor(190, 18, 60); // Brand Rose #BE123C
      doc.rect(margin, currentY, contentWidth, 2.5, 'F');
      currentY += 5;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(190, 18, 60);
      doc.text('CLIENT EXPERIENCE PROGRESS REPORT', margin, currentY + 3);
      currentY += 6;

      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.setFont('helvetica', 'bold');
      doc.text(client.companyName, margin, currentY + 5);
      currentY += 9;

      // Metadata Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, currentY, contentWidth, 14, 'FD');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Reporting Period:', margin + 4, currentY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`${formatReportDate(dateRange.startDate)} – ${formatReportDate(dateRange.endDate)}`, margin + 32, currentY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Generated At:', margin + 4, currentY + 10.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(generationTimestamp, margin + 26, currentY + 10.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Client Status:', margin + 115, currentY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(client.status, margin + 137, currentY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Package:', margin + 115, currentY + 10.5);
      doc.setFont('helvetica', 'normal');
      doc.text(client.package, margin + 130, currentY + 10.5);

      currentY += 18;

      // ------------------------------------------------------------------------
      // 2. FACTUAL EXECUTIVE SUMMARY
      // ------------------------------------------------------------------------
      ensureSpace(24);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('1. Executive Summary', margin, currentY);
      currentY += 4;

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 4;

      const nextMilestone = roadmapMilestones.find((m) => m.status === 'in_progress' || m.status === 'upcoming');
      const milestoneLabel = nextMilestone ? nextMilestone.title : 'Milestone progression';

      const summaryLines = [
        `During the period from ${formatReportDate(dateRange.startDate)} to ${formatReportDate(dateRange.endDate)}, a total of ${periodCompletedTasks.length} ${periodCompletedTasks.length === 1 ? 'deliverable was' : 'deliverables were'} formally completed and delivered.`,
        `Currently, ${ongoingTasks.length} ${ongoingTasks.length === 1 ? 'operational task is' : 'operational tasks are'} in active execution, and ${reviewQueueTasks.length} ${reviewQueueTasks.length === 1 ? 'deliverable requires' : 'deliverables require'} client review.`,
        `Next scheduled delivery focus: ${milestoneLabel}.`
      ].join(' ');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const splitSummary = doc.splitTextToSize(summaryLines, contentWidth);
      doc.text(splitSummary, margin, currentY);
      currentY += (splitSummary.length * 4.2) + 6;

      // ------------------------------------------------------------------------
      // 3. VERIFIED BUSINESS RESULTS
      // ------------------------------------------------------------------------
      ensureSpace(30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('2. Verified Business Results', margin, currentY);
      currentY += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;

      if (publishedResults.length > 0) {
        publishedResults.forEach((res) => {
          ensureSpace(16);
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, currentY, contentWidth, 13, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(margin, currentY, contentWidth, 13, 'D');

          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(res.metricName, margin + 4, currentY + 5);

          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(190, 18, 60);
          doc.text(res.metricValue, pageWidth - margin - 4, currentY + 5.5, { align: 'right' });

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(`${res.metricDefinition} · Source: ${res.source} · Period: ${res.reportingPeriod}`, margin + 4, currentY + 9.5);

          currentY += 16;
        });
      } else {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, currentY, contentWidth, 9, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('Results report not published yet for this reporting cycle.', margin + 4, currentY + 5.5);
        currentY += 13;
      }

      // ------------------------------------------------------------------------
      // 4. COMPLETED DELIVERABLES IN SELECTED PERIOD
      // ------------------------------------------------------------------------
      ensureSpace(30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`3. Completed Deliverables (${periodCompletedTasks.length})`, margin, currentY);
      currentY += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;

      if (periodCompletedTasks.length > 0) {
        // Table Header
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, currentY, contentWidth, 6.5, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Deliverable / Title', margin + 3, currentY + 4.5);
        doc.text('Service / Dept', margin + 105, currentY + 4.5);
        doc.text('Completed Date', margin + 150, currentY + 4.5);
        currentY += 7.5;

        periodCompletedTasks.forEach((task, idx) => {
          ensureSpace(9);
          const isEven = idx % 2 === 0;
          if (isEven) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, currentY, contentWidth, 7, 'F');
          }

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          const truncatedTitle = task.title.length > 55 ? task.title.slice(0, 52) + '...' : task.title;
          doc.text(truncatedTitle, margin + 3, currentY + 4.5);

          doc.setTextColor(71, 85, 105);
          doc.text(task.departmentName || 'Operations', margin + 105, currentY + 4.5);

          const compStr = task.completedAt ? formatReportDate(task.completedAt.split('T')[0]) : 'Completed';
          doc.text(compStr, margin + 150, currentY + 4.5);

          currentY += 7.5;
        });
        currentY += 3;
      } else {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No deliverables were completed within this specific date range.', margin + 2, currentY + 2);
        currentY += 8;
      }

      // ------------------------------------------------------------------------
      // 5. CURRENT ONGOING WORK
      // ------------------------------------------------------------------------
      ensureSpace(30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`4. Ongoing Execution (Status as of ${generationTimestamp})`, margin, currentY);
      currentY += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;

      if (ongoingTasks.length > 0) {
        ongoingTasks.forEach((task) => {
          ensureSpace(7);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text('• ' + (task.title.length > 60 ? task.title.slice(0, 57) + '...' : task.title), margin + 3, currentY + 3);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          const dueStr = task.dueDate ? `Due: ${formatReportDate(task.dueDate.split('T')[0])}` : 'Active';
          doc.text(`[${task.status === 'Team Review' ? 'Quality Check' : 'In Progress'}] · ${dueStr}`, pageWidth - margin - 3, currentY + 3, { align: 'right' });

          currentY += 6;
        });
        currentY += 3;
      } else {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('All ongoing deliverables for this cycle are up to date.', margin + 2, currentY + 2);
        currentY += 8;
      }

      // ------------------------------------------------------------------------
      // 6. CURRENT CLIENT REVIEW QUEUE
      // ------------------------------------------------------------------------
      ensureSpace(28);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`5. Client Action Items & Input Needed (${reviewQueueTasks.length})`, margin, currentY);
      currentY += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;

      if (reviewQueueTasks.length > 0) {
        reviewQueueTasks.forEach((task) => {
          ensureSpace(12);
          doc.setFillColor(254, 242, 242); // Rose 50
          doc.setDrawColor(254, 205, 211); // Rose 200
          doc.rect(margin, currentY, contentWidth, 10, 'FD');

          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(190, 18, 60);
          doc.text('REVIEW NEEDED: ' + (task.title.length > 55 ? task.title.slice(0, 52) + '...' : task.title), margin + 4, currentY + 4.5);

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          const dueStr = task.dueDate ? formatReportDate(task.dueDate.split('T')[0]) : 'Pending Decision';
          doc.text(`Target Deadline: ${dueStr} · Please review in your Client Portal.`, margin + 4, currentY + 8);

          currentY += 13;
        });
      } else {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No pending items require client input at this time.', margin + 2, currentY + 2);
        currentY += 8;
      }

      // ------------------------------------------------------------------------
      // 7. PUBLISHED UPCOMING MILESTONES
      // ------------------------------------------------------------------------
      ensureSpace(28);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('6. Published Roadmap Milestones', margin, currentY);
      currentY += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;

      if (roadmapMilestones.length > 0) {
        roadmapMilestones.forEach((m) => {
          ensureSpace(10);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(m.title, margin + 3, currentY + 3);

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(m.status === 'completed' ? 16 : m.status === 'in_progress' ? 190 : 100, m.status === 'completed' ? 185 : m.status === 'in_progress' ? 18 : 116, m.status === 'completed' ? 129 : m.status === 'in_progress' ? 60 : 139);
          const statusText = m.status === 'completed' ? '✓ Completed' : m.status === 'in_progress' ? '● In Progress' : '○ Upcoming';
          doc.text(statusText, pageWidth - margin - 3, currentY + 3, { align: 'right' });

          currentY += 6;
        });
        currentY += 3;
      } else {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('Roadmap milestones for next cycle are currently being scheduled.', margin + 2, currentY + 2);
        currentY += 8;
      }

      // ------------------------------------------------------------------------
      // 8. SHARED DELIVERABLES DIRECTORY
      // ------------------------------------------------------------------------
      ensureSpace(28);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`7. Shared Deliverables Index (${deliverables.length})`, margin, currentY);
      currentY += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;

      if (deliverables.length > 0) {
        deliverables.slice(0, 15).forEach((d) => {
          ensureSpace(9);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(190, 18, 60);
          doc.text('🔗 ' + (d.title.length > 45 ? d.title.slice(0, 42) + '...' : d.title), margin + 3, currentY + 3);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text(d.taskTitle.length > 35 ? d.taskTitle.slice(0, 32) + '...' : d.taskTitle, margin + 85, currentY + 3);

          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(formatReportDate(d.sharedAt.split('T')[0]), pageWidth - margin - 3, currentY + 3, { align: 'right' });

          currentY += 6.5;
        });

        ensureSpace(10);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('Note: External services retain their own access permissions. A link directs to the external deliverable but does not grant file-level access.', margin + 3, currentY + 3);
        currentY += 8;
      } else {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No external deliverable links shared in this cycle.', margin + 2, currentY + 2);
        currentY += 8;
      }

      // ------------------------------------------------------------------------
      // FOOTER & PAGE NUMBERING ON ALL PAGES
      // ------------------------------------------------------------------------
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Confidential · Prepared strictly for ${client.companyName}`, margin, pageHeight - 6.5);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
      }

      // Generate sanitized filename and trigger browser download
      const filename = sanitizeReportFilename(client.companyName, dateRange.startDate, dateRange.endDate);
      doc.save(filename);

      return { success: true, filename };
    } catch (err: any) {
      console.error('PDF Report generation failed:', err);
      return { success: false, error: err?.message || 'Failed to generate PDF report.' };
    }
  }
};
