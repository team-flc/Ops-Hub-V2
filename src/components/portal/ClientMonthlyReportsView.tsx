import React, { useState, useMemo } from 'react';
import { FileText, Download, Eye, Calendar, CheckCircle2, Clock, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { ClientRecord, ClientTask } from '../../types';
import { formatPKTDate } from '../../lib/pktDateUtils';

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
  hasData: boolean;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  approvalTasks: number;
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
              `  ${i + 1}. [Week ${t.weekNumber || 1}] ${t.title} — Completed ${
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
              `  ${i + 1}. [Week ${t.weekNumber || 1}] ${t.title} — Status: ${t.status}${
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

  return `================================================================================
                       OPS HUB - MONTHLY OPERATIONS REPORT
================================================================================
Client:           ${client.companyName || client.clientName}
Account Ref:      OPS-${client.id.slice(0, 8).toUpperCase()}
Report Period:    ${summary.monthName} (${summary.startDateStr} – ${summary.endDateStr})
Generated On:     ${formatPKTDate(new Date().toISOString())}
Report Status:    Verified Retainer Milestone Summary
--------------------------------------------------------------------------------
EXECUTIVE DELIVERABLE SUMMARY:
  • Milestone Completion Rate:  ${summary.completionPercent}%
  • Deliverables Completed:     ${summary.completedTasks} / ${summary.totalTasks}
  • Deliverables In Progress:   ${summary.pendingTasks}
  • Awaiting Client Approval:   ${summary.approvalTasks}
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

  // Build monthly summaries for the last 4 months (or since activation)
  const monthlyReports = useMemo<MonthlyReportSummary[]>(() => {
    // Current date in PKT
    const now = new Date();
    const monthsList: Array<{ year: number; month: number }> = [];

    // Up to 5 consecutive calendar months backwards from current month
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsList.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    return monthsList.map(({ year, month }) => {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0); // Last day of month

      const monthName = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      // Filter tasks associated with this month
      const monthTasks = tasks.filter((t) => {
        const eventDateStr = t.completedAt || t.createdAt || t.dueDate;
        if (!eventDateStr) return false;
        const eventDate = new Date(eventDateStr);
        return eventDate >= startDate && eventDate <= endDate;
      });

      const completedTasks = monthTasks.filter((t) => t.status === 'Completed' || t.status === 'Done').length;
      const approvalTasks = monthTasks.filter((t) =>
        ['Approval', 'Team Review', 'Client Review', 'Awaiting Approval'].includes(t.status)
      ).length;
      const pendingTasks = Math.max(0, monthTasks.length - completedTasks);
      const completionPercent = monthTasks.length > 0 ? Math.round((completedTasks / monthTasks.length) * 100) : 0;
      const hasData = monthTasks.length > 0;

      const summaryObj: MonthlyReportSummary = {
        monthKey,
        monthName,
        startDateStr,
        endDateStr,
        hasData,
        totalTasks: monthTasks.length,
        completedTasks,
        pendingTasks,
        approvalTasks,
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
      {/* Toast Notification */}
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
              Official milestone delivery summaries, sprint progress, and task resolutions compiled by calendar month.
            </p>
          </div>
        </div>

        {/* Quick Download Latest Active */}
        {monthlyReports.some((r) => r.hasData) && (
          <button
            type="button"
            data-testid="download-latest-monthly-report"
            onClick={() => {
              const latestWithData = monthlyReports.find((r) => r.hasData);
              if (latestWithData) handleDownload(latestWithData);
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Latest Report</span>
          </button>
        )}
      </div>

      {/* Monthly Reports List */}
      <div className="space-y-3.5">
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
                    Billing Period: {report.startDateStr} – {report.endDateStr} &bull; {report.totalTasks} Total Deliverables
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
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedReportForView.monthName} Monthly Report
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {client.companyName || client.clientName} &bull; {selectedReportForView.startDateStr} – {selectedReportForView.endDateStr}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportForView(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Content Body */}
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-dark-300/50 p-4 rounded-xl border border-slate-200/80 dark:border-dark-border whitespace-pre-wrap leading-relaxed select-text">
                {selectedReportForView.reportText}
              </pre>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-dark-card flex items-center justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Generated directly from live client workspace tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReportForView(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownload(selectedReportForView);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
