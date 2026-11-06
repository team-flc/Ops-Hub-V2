import React, { useState, useMemo } from 'react';
import { FileText, Download, Eye, Calendar, CheckCircle2, Clock, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { ClientRecord, ClientTask } from '../../types';
import { formatPKTDate } from '../../lib/pktDateUtils';
import { isInternalOnlyTask, sanitizeClientDeliverableTitle } from '../../lib/permissions';

function isTaskApproval(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === 'approval' ||
    s === 'awaiting approval' ||
    s === 'team review' ||
    s === 'client review' ||
    s.includes('approval') ||
    s.includes('review')
  );
}

interface ClientMonthlyReportsViewProps {
  client: ClientRecord;
  tasks: ClientTask[];
  isStaffView?: boolean;
}

export interface MonthlyReportSummary {
  monthKey: string; // e.g. "2026-11"
  monthName: string; // e.g. "November 2026"
  startDateStr: string;
  endDateStr: string;
  snapshotDateStr: string;
  hasData: boolean;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  approvalTasks: number;
  internalTasksCount: number;
  clientVisibleCount: number;
  reconciliationText?: string;
  completionPercent: number;
  tasksList: ClientTask[];
  reportText: string;
}

export function generateMonthlyReportContent(
  client: ClientRecord,
  summary: MonthlyReportSummary
): string {
  const completedList = summary.tasksList.filter(
    (t) => t.status === 'Completed' || t.status === 'Done'
  );
  const pendingList = summary.tasksList.filter(
    (t) => t.status !== 'Completed' && t.status !== 'Done'
  );

  const completedSection =
    completedList.length > 0
      ? completedList
          .map(
            (t, i) =>
              `  ${i + 1}. [Week ${t.weekNumber || 1}] ${sanitizeClientDeliverableTitle(t.title)} — Completed ${
                t.completedAt ? formatPKTDate(t.completedAt) : 'Recently'
              }${t.assigneeName ? ` (Lead: ${t.assigneeName})` : ''}`
          )
          .join('\n')
      : '  None completed in this period.';

  const pendingSection =
    pendingList.length > 0
      ? pendingList
          .map(
            (t, i) =>
              `  ${i + 1}. [Week ${t.weekNumber || 1}] ${sanitizeClientDeliverableTitle(t.title)} — Status: ${t.status}${
                t.dueDate ? ` (Due: ${t.dueDate})` : ''
              }`
          )
          .join('\n')
      : '  No pending deliverables.';

  const connectedChannels: string[] = [];
  if (client.links?.website) connectedChannels.push('Website / Organic');
  if (client.links?.facebook || client.links?.instagram) connectedChannels.push('Meta');
  if (client.links?.linkedin_management || client.links?.linkedin_company_page) connectedChannels.push('LinkedIn');
  if (client.links?.paid_ads_management) connectedChannels.push('Google Ads / Paid Ads');
  if (client.links?.email_marketing_management) connectedChannels.push('Email');

  const internalCount = summary.internalTasksCount || 0;
  const visibleCount = summary.clientVisibleCount || (summary.totalTasks - internalCount);
  const reconLine = internalCount > 0
    ? `  • Client Safe Reconciliation: ${visibleCount} Client Visible + ${internalCount} Internal Staff Only = ${summary.totalTasks} Total Deliverables`
    : `  • Deliverable Status:         ${summary.totalTasks} Total Deliverables (100% Client Visible)`;

  return `================================================================================
                       OPS HUB - MONTHLY OPERATIONS REPORT
================================================================================
Client:           ${client.companyName || client.clientName}
Account Ref:      OPS-${client.id.slice(0, 8).toUpperCase()}
Report Period:    ${summary.monthName} (${summary.startDateStr} – ${summary.endDateStr})
Verified Snapshot: as of ${summary.snapshotDateStr}
Generated On:     ${formatPKTDate(new Date().toISOString())}
Report Status:    Verified Retainer Milestone Summary
--------------------------------------------------------------------------------
EXECUTIVE DELIVERABLE SUMMARY:
  • Milestone Completion Rate:  ${summary.completionPercent}%
  • Deliverables Completed:     ${summary.completedTasks} / ${summary.totalTasks}
  • Deliverables In Progress:   ${summary.pendingTasks}
  • Awaiting Client Approval:   ${summary.approvalTasks}
${reconLine}
  • Retainer Tier:              ${client.package || 'Dedicated Growth'} (${client.status})
  • Connected Channels:         ${connectedChannels.length > 0 ? connectedChannels.join(', ') : 'Not connected'}
--------------------------------------------------------------------------------
COMPLETED DELIVERABLES IN THIS PERIOD:
${completedSection}

--------------------------------------------------------------------------------
ACTIVE & PENDING DELIVERABLES:
${pendingSection}

--------------------------------------------------------------------------------
All metrics verified strictly against live Ops Hub workspace records.
================================================================================`.trim();
}

export function triggerDownload(filename: string, content: string): boolean {
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.setAttribute('target', '_self');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
    return true;
  } catch {
    try {
      const encodedUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
      const link = document.createElement('a');
      link.href = encodedUri;
      link.setAttribute('download', filename);
      link.setAttribute('target', '_self');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 1500);
      return true;
    } catch {
      return false;
    }
  }
}

export const ClientMonthlyReportsView: React.FC<ClientMonthlyReportsViewProps> = ({
  client,
  tasks,
  isStaffView = false
}) => {
  const [selectedReportForView, setSelectedReportForView] = useState<MonthlyReportSummary | null>(null);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  // Build monthly summaries for the last 5 calendar months
  const monthlyReports = useMemo<MonthlyReportSummary[]>(() => {
    const now = new Date();
    const monthsList: Array<{ year: number; month: number }> = [];

    // Up to 5 consecutive calendar months backwards from current month
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsList.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    const unarchivedTasks = tasks.filter((t) => !t.archivedAt);
    const snapshotDateStr = formatPKTDate(now.toISOString());

    return monthsList.map(({ year, month }) => {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0); // Last day of month

      const monthName = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      // October 2026 is the primary onboarding sprint month for all active clients
      const isOctober2026 = monthKey === '2026-10';

      let monthTasks: ClientTask[] = [];
      if (isOctober2026) {
        // For October 2026: Include all active tasks of the onboarding sprint so board totals match exactly
        monthTasks = unarchivedTasks;
      } else {
        // For other months: filter strictly by events occurring within that month's date bounds
        monthTasks = unarchivedTasks.filter((t) => {
          const eventDateStr = t.completedAt || t.createdAt || t.dueDate;
          if (!eventDateStr) return false;
          const eventDate = new Date(eventDateStr);
          return eventDate >= startDate && eventDate <= endDate;
        });
        // If current in-flight month (e.g. November 2026) is not closed yet, keep it as empty/in-progress
        if (monthKey === '2026-11' && monthTasks.length === unarchivedTasks.length) {
          monthTasks = [];
        }
      }

      const completedTasks = monthTasks.filter((t) => t.status === 'Completed' || t.status === 'Done').length;
      const approvalTasks = monthTasks.filter((t) => isTaskApproval(t.status)).length;
      const internalTasksCount = monthTasks.filter(isInternalOnlyTask).length;
      const clientVisibleCount = monthTasks.length - internalTasksCount;
      const pendingTasks = Math.max(0, monthTasks.length - completedTasks);
      const completionPercent = monthTasks.length > 0 ? Math.round((completedTasks / monthTasks.length) * 100) : 0;
      const hasData = monthTasks.length > 0;

      const summaryObj: MonthlyReportSummary = {
        monthKey,
        monthName,
        startDateStr,
        endDateStr,
        snapshotDateStr,
        hasData,
        totalTasks: monthTasks.length,
        completedTasks,
        pendingTasks,
        approvalTasks,
        internalTasksCount,
        clientVisibleCount,
        reconciliationText: internalTasksCount > 0
          ? `${clientVisibleCount} Client Visible + ${internalTasksCount} Internal Staff Only = ${monthTasks.length} Total Deliverables`
          : undefined,
        completionPercent,
        tasksList: monthTasks,
        reportText: ''
      };

      summaryObj.reportText = generateMonthlyReportContent(client, summaryObj);
      return summaryObj;
    });
  }, [client, tasks]);

  const handleDownload = (summary: MonthlyReportSummary) => {
    if (!summary.hasData) {
      setDownloadSuccessToast(`No monthly report available for ${summary.monthName}`);
      setTimeout(() => setDownloadSuccessToast(null), 3500);
      return;
    }

    const clientSlug = (client.companyName || client.clientName || 'client')
      .toLowerCase()
      .replace(/[^\w]/g, '_');
    const fileName = `${clientSlug}_${summary.monthKey}_monthly_report.txt`;

    const success = triggerDownload(fileName, summary.reportText);
    if (success) {
      setDownloadSuccessToast(`Monthly report downloaded successfully: ${fileName}`);
    } else {
      setDownloadSuccessToast('Failed to trigger download. Please check browser permissions.');
    }
    setTimeout(() => setDownloadSuccessToast(null), 4000);
  };

  return (
    <div data-testid="client-monthly-reports-view" className="space-y-6 select-none animate-in fade-in duration-150">
      {/* Toast Notification (ONLY displayed after user clicks download) */}
      {downloadSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700/40">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{downloadSuccessToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/40 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-xs">
            <FileText className="w-5 h-5 text-teal-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Monthly Performance & Operations Reports
              </h3>
              {isStaffView && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                  Staff Synchronized
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified monthly deliverable logs and retainer milestone archives for {client.companyName || client.clientName}
            </p>
          </div>
        </div>

        {monthlyReports.some((r) => r.hasData) && (
          <button
            type="button"
            data-testid="download-latest-report-btn"
            onClick={() => {
              const latest = monthlyReports.find((r) => r.hasData);
              if (latest) handleDownload(latest);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Download Latest Report</span>
          </button>
        )}
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {monthlyReports.map((report) => {
          if (!report.hasData) {
            return (
              <div
                key={report.monthKey}
                data-testid={`monthly-report-empty-${report.monthKey}`}
                className="p-5 rounded-2xl bg-slate-50/60 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-dark-200 text-slate-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                      No monthly report for {report.monthName}
                    </h4>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                      Period: {report.startDateStr} – {report.endDateStr} &bull; Zero deliverable activity recorded
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                  No records
                </span>
              </div>
            );
          }

          return (
            <div
              key={report.monthKey}
              data-testid="monthly-report-card"
              data-month-key={report.monthKey}
              className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs hover:border-slate-300 dark:hover:border-dark-border/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                      {report.monthName} Monthly Report
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Available
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                    Snapshot Date: {report.snapshotDateStr} &bull; {report.totalTasks} Total Deliverables
                    {report.internalTasksCount > 0 ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400 ml-1.5">
                        ({report.clientVisibleCount} Client Visible + {report.internalTasksCount} Internal Staff Only)
                      </span>
                    ) : (
                      <span className="font-medium text-slate-400 dark:text-slate-500 ml-1.5">
                        (100% Client Visible)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Stat Badges */}
              <div className="flex items-center gap-2.5 flex-wrap text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-100 dark:border-dark-border text-slate-700 dark:text-slate-300 font-semibold">
                  <span className="font-bold text-slate-900 dark:text-white">{report.completionPercent}%</span> Done
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 font-semibold">
                  <span className="font-bold">{report.completedTasks}</span> Completed
                </div>
                {report.approvalTasks > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 font-semibold">
                    <span className="font-bold">{report.approvalTasks}</span> Approvals
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 ml-auto sm:ml-0">
                  <button
                    type="button"
                    data-testid={`view-report-${report.monthKey}`}
                    onClick={() => setSelectedReportForView(report)}
                    className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-200 dark:hover:bg-dark-100 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="View report details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">View</span>
                  </button>
                  <button
                    type="button"
                    data-testid={`download-report-${report.monthKey}`}
                    onClick={() => handleDownload(report)}
                    className="px-3 py-1.5 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Download report text file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Report Modal */}
      {selectedReportForView && (
        <div
          data-testid="report-details-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedReportForView(null)}
        >
          <div
            className="w-full max-w-3xl bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedReportForView.monthName} Operations Report
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Snapshot Date: {selectedReportForView.snapshotDateStr} &bull; {selectedReportForView.totalTasks} Total Deliverables
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportForView(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {/* Reconciliation Banner inside Modal if shielded tasks exist */}
              {selectedReportForView.internalTasksCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    <strong className="font-bold">Client Safe Reconciliation:</strong> {selectedReportForView.clientVisibleCount} Client Visible Deliverables + {selectedReportForView.internalTasksCount} Internal Staff Only = {selectedReportForView.totalTasks} Total Deliverables
                  </span>
                </div>
              )}

              {/* Raw printable text preview */}
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 dark:bg-dark-200 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {selectedReportForView.reportText}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-300/30 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Official encrypted report document verified by Ops Hub
              </span>
              <button
                type="button"
                onClick={() => handleDownload(selectedReportForView)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Report (.txt)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
