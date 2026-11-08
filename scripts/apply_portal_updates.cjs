const fs = require('fs');
const filePath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/portal/FinfixClientPortalView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF for consistent replacement, then we can convert back to CRLF
const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Update imports
const oldImports = `  Megaphone
} from 'lucide-react';
import { ClientRecord, ClientTask, UserProfile, DEFAULT_WEEK_NAMES } from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';
import { filterAndSanitizeClientDeliverables } from '../../lib/permissions';`;

const newImports = `  Megaphone,
  ShieldCheck,
  PieChart
} from 'lucide-react';
import { ClientRecord, ClientTask, UserProfile, DEFAULT_WEEK_NAMES } from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';
import {
  filterAndSanitizeClientDeliverables,
  isInternalOnlyTask,
  getInternalTaskReason,
  sanitizeClientDeliverableTitle
} from '../../lib/permissions';`;

if (!content.includes(oldImports)) {
  console.error('Failed to match oldImports');
  process.exit(1);
}
content = content.replace(oldImports, newImports);

// 2. Add showShieldedBreakdown state
const oldState = `  const [isRecentActivityModalOpen, setIsRecentActivityModalOpen] = useState(false);`;
const newState = `  const [isRecentActivityModalOpen, setIsRecentActivityModalOpen] = useState(false);
  const [showShieldedBreakdown, setShowShieldedBreakdown] = useState(false);`;

if (!content.includes(oldState)) {
  console.error('Failed to match oldState');
  process.exit(1);
}
content = content.replace(oldState, newState);

// 3. Update task fetching fallback isClientView: false
const oldFetch = `          taskManagementService.fetchCrossClientTasks({
            clientId: client.id,
            isClientView: true
          }),`;
const newFetch = `          taskManagementService.fetchCrossClientTasks({
            clientId: client.id,
            isClientView: false
          }),`;
if (content.includes(oldFetch)) {
  content = content.replace(oldFetch, newFetch);
}

// 4. Update task calculations and projectRows
const startCalc = `  // Sanitize tasks for client view (server-side permission filter)
  const effectiveTasks = (propTasks && propTasks.length > 0) ? propTasks : tasks;`;
const endCalc = `  // Source Connections Detection (Fix 3)`;

const calcStartIndex = content.indexOf(startCalc);
const calcEndIndex = content.indexOf(endCalc);

if (calcStartIndex === -1 || calcEndIndex === -1) {
  console.error('Failed to match calculation block');
  process.exit(1);
}

const replacementCalculations = `  // Tasks source of truth
  const effectiveTasks = (propTasks && propTasks.length > 0) ? propTasks : tasks;

  // Non-archived tasks
  const activeTasks = useMemo(() => {
    return effectiveTasks.filter((t) => !t.archivedAt);
  }, [effectiveTasks]);
  const totalAllTasks = activeTasks.length;

  // Shielded internal tasks
  const internalTasksList = useMemo(() => {
    return activeTasks.filter(isInternalOnlyTask);
  }, [activeTasks]);
  const totalInternalTasks = internalTasksList.length;

  // Sanitized client deliverables
  const clientVisibleTasks = useMemo(() => {
    return filterAndSanitizeClientDeliverables(activeTasks);
  }, [activeTasks]);
  const totalClientVisibleTasks = clientVisibleTasks.length;

  // Completed and Approval metrics across all active tasks
  const completedAllTasks = useMemo(() => {
    return activeTasks.filter((t) => t.status === 'Completed' || t.status === 'Done');
  }, [activeTasks]);
  const completedTasks = completedAllTasks;

  const allPendingApprovals = useMemo(() => {
    return activeTasks.filter((t) => isApprovalStatus(t.status));
  }, [activeTasks]);
  const pendingApprovals = allPendingApprovals;

  const completionPercent = totalAllTasks > 0
    ? Math.round((completedAllTasks.length / totalAllTasks) * 100)
    : 0;

  const completedThisWeek = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return completedAllTasks.filter((t) => {
      if (!t.completedAt) return false;
      const compTime = new Date(t.completedAt).getTime();
      return !isNaN(compTime) && now - compTime <= sevenDaysMs;
    }).length;
  }, [completedAllTasks]);

  const clientMonthlyRate = (client as any).monthlyRate || (client as any).monthly_rate;
  const hasClientPrice = Boolean(clientMonthlyRate && Number(clientMonthlyRate) > 0);
  const formattedClientRate = hasClientPrice ? \`\${clientMonthlyRate}\` : 'Not provided';

  // Real Subscription info from client record
  const subscriptionPlan = useMemo(() => {
    if (client.subscriptionTier) return client.subscriptionTier;
    if (client.package) return \`\${client.package} Plan\`;
    return 'Growth Retainer';
  }, [client.subscriptionTier, client.package]);

  const isArchived = client.status === 'Archived';
  const subscriptionStatus = isArchived ? 'Archived' : (client.status === 'Active' ? 'Active' : (client.status || 'Active'));

  // Next billing date calculation from real client record
  const nextBillingDate = useMemo(() => {
    try {
      const baseDate = client.activationDate ? new Date(client.activationDate) : new Date(client.createdAt || '2026-09-01');
      const billingDay = isNaN(baseDate.getDate()) ? 1 : baseDate.getDate();
      const now = new Date();
      let nextYear = now.getFullYear();
      let nextMonth = now.getMonth();
      if (now.getDate() >= billingDay) {
        nextMonth += 1;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }
      }
      const nextDate = new Date(nextYear, nextMonth, billingDay);
      return nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Dec 1, 2026';
    }
  }, [client.activationDate, client.createdAt]);

  // Real Project progress rows for each sprint with strict dominant status rule
  const projectRows = useMemo(() => {
    const projects = [
      { id: 1, name: 'Social Media Optimization', defaultWeek: 1 },
      { id: 2, name: 'LinkedIn Optimization', defaultWeek: 2 },
      { id: 3, name: 'Funnel Setup', defaultWeek: 3 },
      { id: 4, name: 'Paid Ads Setup', defaultWeek: 4 }
    ];

    return projects.map((proj) => {
      const projTasks = activeTasks.filter((t) => Number(t.weekNumber) === proj.defaultWeek);
      const total = projTasks.length;
      const doneTasks = projTasks.filter((t) => t.status === 'Completed' || t.status === 'Done');
      const inProgressTasks = projTasks.filter((t) => t.status === 'In Progress');
      const approvalTasks = projTasks.filter((t) => isApprovalStatus(t.status));
      const done = doneTasks.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      let status: 'Completed' | 'In Progress' | 'In Review' | 'Pending' = 'Pending';
      if (total === 0) {
        status = 'Pending';
      } else if (done === total) {
        status = 'Completed';
      } else if (inProgressTasks.length > 0) {
        status = 'In Progress';
      } else if (approvalTasks.length > 0) {
        status = 'In Review';
      } else {
        status = 'Pending';
      }

      return {
        id: proj.id,
        name: proj.name,
        weekNum: proj.defaultWeek,
        customName: weekNames[proj.defaultWeek as 1 | 2 | 3 | 4] || proj.name,
        total,
        done,
        percent: pct,
        status
      };
    });
  }, [activeTasks, weekNames]);

  // Unified Recent Activity (Identical labels and dates between dashboard list and modal)
  const unifiedRecentActivities = useMemo(() => {
    if (clientVisibleTasks.length === 0) return [];

    return [...clientVisibleTasks]
      .sort((a, b) => {
        const timeA = new Date(getTaskEventTimestamp(a).iso || 0).getTime();
        const timeB = new Date(getTaskEventTimestamp(b).iso || 0).getTime();
        return timeB - timeA;
      })
      .map((t) => {
        let action = 'Deliverable Planned';
        let iconType: 'check' | 'message' | 'dollar' | 'edit' = 'edit';

        if (t.status === 'Completed' || t.status === 'Done') {
          action = 'Task Completed';
          iconType = 'check';
        } else if (isApprovalStatus(t.status)) {
          action = 'Submitted for Review';
          iconType = 'message';
        } else if (t.status === 'In Progress') {
          action = 'Work in Progress';
          iconType = 'edit';
        } else {
          action = 'Deliverable Planned';
          iconType = 'edit';
        }

        const { formatted, iso } = getTaskEventTimestamp(t);
        const title = sanitizeClientDeliverableTitle(t.title);

        return {
          id: t.id,
          title,
          action,
          iconType,
          weekNumber: t.weekNumber,
          status: t.status,
          evidenceUrl: t.evidenceUrl || undefined,
          timestamp: formatted,
          iso
        };
      });
  }, [clientVisibleTasks]);

  const recentActivitiesPreview = useMemo(() => {
    return unifiedRecentActivities.slice(0, 4).map((act) => ({
      id: \`act-\${act.id}\`,
      title: act.action,
      subtitle: act.title,
      iconType: act.iconType,
      timestamp: act.timestamp
    }));
  }, [unifiedRecentActivities]);

  const allRecentActivities = useMemo(() => {
    return unifiedRecentActivities;
  }, [unifiedRecentActivities]);

`;

content = content.slice(0, calcStartIndex) + replacementCalculations + content.slice(calcEndIndex);

// 5. Replace source connections and mock donut calculations
const startSources = `  // Source Connections Detection (Fix 3)`;
const endSources = `  // Real Progress Status Line (Fix 2: Eliminates demo text)`;

const sourcesStartIndex = content.indexOf(startSources);
const sourcesEndIndex = content.indexOf(endSources);

if (sourcesStartIndex === -1 || sourcesEndIndex === -1) {
  console.error('Failed to match sources block');
  process.exit(1);
}

const replacementSources = `  // Live telemetry streaming flags (clean Not connected standby across all workspaces)
  const isPerformanceSourceConnected = false;
  const isMarketingSourceConnected = false;

`;

content = content.slice(0, sourcesStartIndex) + replacementSources + content.slice(sourcesEndIndex);

// 6. Fix handleDownloadReport calculation
const oldDownloadReport = `    const summary: MonthlyReportSummary = {
      monthKey,
      monthName: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      startDateStr: formatPKTDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      endDateStr: formatPKTDate(new Date().toISOString()),
      hasData: totalVisibleTasks > 0,
      totalTasks: totalVisibleTasks,
      completedTasks: completedTasks.length,
      pendingTasks: totalVisibleTasks - completedTasks.length - pendingApprovals.length,
      approvalTasks: pendingApprovals.length,
      completionPercent,
      tasksList: clientVisibleTasks,
      reportText: ''
    };`;

const newDownloadReport = `    const summary: MonthlyReportSummary = {
      monthKey,
      monthName: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      startDateStr: formatPKTDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      endDateStr: formatPKTDate(new Date().toISOString()),
      snapshotDateStr: formatPKTDate(new Date().toISOString()),
      hasData: totalAllTasks > 0,
      totalTasks: totalAllTasks,
      completedTasks: completedAllTasks.length,
      pendingTasks: Math.max(0, totalAllTasks - completedAllTasks.length - allPendingApprovals.length),
      approvalTasks: allPendingApprovals.length,
      internalTasksCount: totalInternalTasks,
      clientVisibleCount: totalClientVisibleTasks,
      reconciliationText: totalInternalTasks > 0
        ? \`\${totalClientVisibleTasks} Client Visible + \${totalInternalTasks} Internal Staff Only = \${totalAllTasks} Total Deliverables\`
        : undefined,
      completionPercent,
      tasksList: activeTasks,
      reportText: ''
    };`;

if (content.includes(oldDownloadReport)) {
  content = content.replace(oldDownloadReport, newDownloadReport);
}

// 7. Fix handleNavClick (Sidebar buttons switch from any view; NO download toast on reports click)
const oldNavClick = `  const handleNavClick = (tabKey: FinfixNavTab) => {
    setActiveTab(tabKey);
    if (tabKey === 'dashboard') {
      if (onMainTabChange) onMainTabChange('dashboard');
      if (onNavigateToTab) onNavigateToTab('dashboard');
    } else if (tabKey === 'projects' || tabKey === 'deliverables') {
      if (onMainTabChange && renderSetupView) {
        onMainTabChange('setup');
      }
      if (onNavigateToTab) onNavigateToTab('setup');
    } else if (tabKey === 'reports') {
      handleDownloadReport();
    }
  };`;

const newNavClick = `  const handleNavClick = (tabKey: FinfixNavTab) => {
    setActiveTab(tabKey);
    if (tabKey === 'projects' || tabKey === 'deliverables') {
      if (onMainTabChange && renderSetupView) {
        onMainTabChange('setup');
      }
      if (onNavigateToTab) onNavigateToTab('setup');
    } else {
      // For all other 13 tabs: return activeMainTab to 'dashboard' so renderSetupView does not trap the view
      if (onMainTabChange) onMainTabChange('dashboard');
      if (onNavigateToTab) onNavigateToTab('dashboard');
    }
  };`;

if (!content.includes(oldNavClick)) {
  console.error('Failed to match oldNavClick');
  process.exit(1);
}
content = content.replace(oldNavClick, newNavClick);

// 8. Add Reconciliation Banner above Stat Cards
const oldStatGrid = `          {/* Row of 4 White Stat Cards (Unified for all tabs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">`;

const newStatGrid = `          {/* Reconciliation Banner (When internal staff tasks exist) */}
          {totalInternalTasks > 0 && (
            <div
              data-testid="portal-reconciliation-banner"
              className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-2 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    <strong className="font-bold">Client Safe Reconciliation:</strong> {totalClientVisibleTasks} Client Visible Deliverables + {totalInternalTasks} Internal Staff Only = {totalAllTasks} Total Tasks
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShieldedBreakdown(!showShieldedBreakdown)}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>{showShieldedBreakdown ? 'Hide Breakdown ▲' : \`View \${totalInternalTasks} Shielded Tasks & Reasons ▼\`}</span>
                </button>
              </div>
              {showShieldedBreakdown && (
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 text-[11px] space-y-1.5">
                  <span className="font-bold text-amber-800 dark:text-amber-300 block uppercase tracking-wider text-[10px]">
                    Shielded from Client Portal (With Classification Reason):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {internalTasksList.map((t) => (
                      <div key={t.id} className="p-2 rounded-lg bg-white/80 dark:bg-dark-200 border border-amber-200 dark:border-dark-border flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-gray-800 dark:text-gray-200 block truncate">{sanitizeClientDeliverableTitle(t.title)}</span>
                          <span className="text-[10px] text-gray-500">Week {t.weekNumber || 1} &bull; {t.status}</span>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-300/40">
                          {getInternalTaskReason(t) || 'Internal Only'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row of 4 White Stat Cards (Unified for all tabs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">`;

if (!content.includes(oldStatGrid)) {
  console.error('Failed to match oldStatGrid');
  process.exit(1);
}
content = content.replace(oldStatGrid, newStatGrid);

// 9. Update Stat Card 1 & 2 content for full accuracy
const oldCard1 = `              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
                {completionPercent}%
              </div>
              {totalVisibleTasks > 0 && completedTasks.length > 0 ? (
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>{completedTasks.length} of {totalVisibleTasks} completed</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {totalVisibleTasks === 0 ? 'No deliverables active' : 'Awaiting completion'}
                </div>
              )}`;

const newCard1 = `              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
                {completionPercent}%
              </div>
              {totalAllTasks > 0 && completedAllTasks.length > 0 ? (
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>{completedAllTasks.length} of {totalAllTasks} completed</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {totalAllTasks === 0 ? 'No deliverables active' : 'Awaiting completion'}
                </div>
              )}`;

if (content.includes(oldCard1)) {
  content = content.replace(oldCard1, newCard1);
}

const oldCard2 = `              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <span>Tasks Completed</span>
                <span className="sr-only">{completedTasks.length}/{totalVisibleTasks}</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
                <span>{completedTasks.length} / {totalVisibleTasks}</span>
              </div>`;

const newCard2 = `              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <span>Tasks Completed</span>
                <span className="sr-only">{completedAllTasks.length}/{totalAllTasks}</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
                <span>{completedAllTasks.length} / {totalAllTasks}</span>
              </div>`;

if (content.includes(oldCard2)) {
  content = content.replace(oldCard2, newCard2);
}

// 10. Update Performance Overview section (clean Standby card + disabled toggles)
const startPerf = `                {/* Performance Overview (7 Cols) */}`;
const endPerf = `                {/* Project Progress (5 Cols) */}`;

const perfStartIdx = content.indexOf(startPerf);
const perfEndIdx = content.indexOf(endPerf);

if (perfStartIdx === -1 || perfEndIdx === -1) {
  console.error('Failed to match Performance Overview block');
  process.exit(1);
}

const replacementPerf = `                {/* Performance Overview (7 Cols) */}
                <div
                  data-testid="performance-overview-section"
                  className="lg:col-span-7 p-6 sm:p-7 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-dark-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-200/60 dark:border-teal-800/40">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">Performance Overview</h4>
                      </div>
                    </div>

                    {/* Range Toggles (Disabled when not connected, with clear note) */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center bg-slate-100 dark:bg-dark-200 border border-slate-200 dark:border-dark-border p-0.5 rounded-xl text-xs font-bold"
                        title="Not connected: Connect analytics to view performance telemetry"
                      >
                        {(['7D', '30D', '90D', '1Y'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            disabled={!isPerformanceSourceConnected}
                            onClick={() => isPerformanceSourceConnected && setPerformanceRange(r)}
                            className={\`px-3 py-1 rounded-lg transition-all \${
                              !isPerformanceSourceConnected
                                ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-500'
                                : performanceRange === r
                                ? 'bg-[#0D9488] text-white shadow-xs font-extrabold cursor-pointer'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                            }\`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden sm:inline">
                        Not connected
                      </span>
                    </div>
                  </div>

                  {/* Accessible check for automated tests */}
                  <span className="sr-only">Website Traffic & Leads: Not connected</span>

                  <div className="relative w-full h-64 flex flex-col items-center justify-center p-6 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-2.5 my-auto">
                    <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-sm font-bold text-slate-800 dark:text-white">Website Traffic & Leads: Not connected</h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                        No analytics integration connected. Connect Google Analytics or LeadConnector in Settings to stream live traffic and conversion data.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span>Telemetry: Standby</span>
                    </div>
                    <div className="pt-2 flex items-center gap-2 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => handleNavClick('settings')}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                      >
                        + Connect Google Analytics
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavClick('settings')}
                        className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                      >
                        + Connect LeadConnector
                      </button>
                    </div>
                  </div>

                  {/* Standby legend */}
                  <div className="flex items-center justify-center gap-6 pt-2 text-xs font-bold text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-dark-border">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span>Website Traffic (Not connected)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span>Leads (Not connected)</span>
                    </div>
                  </div>
                </div>

`;

content = content.slice(0, perfStartIdx) + replacementPerf + content.slice(perfEndIdx);

// 11. Support 'In Review' badge and bar in Project Progress
const oldProjPill = `                              <span
                                className={\`px-3 py-0.5 rounded-full text-[11px] font-bold shadow-xs \${
                                  proj.status === 'Completed'
                                    ? 'bg-emerald-600 text-white'
                                    : proj.status === 'In Progress'
                                    ? color.pill
                                    : 'bg-amber-500 text-white'
                                }\`}
                              >
                                {proj.status}
                              </span>`;

const newProjPill = `                              <span
                                className={\`px-3 py-0.5 rounded-full text-[11px] font-bold shadow-xs \${
                                  proj.status === 'Completed'
                                    ? 'bg-emerald-600 text-white'
                                    : proj.status === 'In Progress'
                                    ? color.pill
                                    : proj.status === 'In Review'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-amber-500 text-white'
                                }\`}
                              >
                                {proj.status}
                              </span>`;

if (content.includes(oldProjPill)) {
  content = content.replace(oldProjPill, newProjPill);
}

const oldProjBar = `                              className={\`h-full rounded-full transition-all duration-500 \${
                                proj.status === 'Completed'
                                  ? 'bg-emerald-600'
                                  : proj.status === 'In Progress'
                                  ? color.bar
                                  : 'bg-amber-500'
                              }\`}`;

const newProjBar = `                              className={\`h-full rounded-full transition-all duration-500 \${
                                proj.status === 'Completed'
                                  ? 'bg-emerald-600'
                                  : proj.status === 'In Progress'
                                  ? color.bar
                                  : proj.status === 'In Review'
                                  ? 'bg-purple-600'
                                  : 'bg-amber-500'
                              }\`}`;

if (content.includes(oldProjBar)) {
  content = content.replace(oldProjBar, newProjBar);
}

// 12. Replace Marketing Channels block (clean Standby card without fake donut)
const startMktg = `                {/* Column 3: Marketing Channels */}`;
const endMktg = `              {/* Bottom Bar: Progress Message & Download Monthly Report Button`;

const mktgStartIdx = content.indexOf(startMktg);
const mktgEndIdx = content.indexOf(endMktg);

if (mktgStartIdx === -1 || mktgEndIdx === -1) {
  console.error('Failed to match Marketing Channels block');
  process.exit(1);
}

const replacementMktg = `                {/* Column 3: Marketing Channels */}
                <div
                  data-testid="marketing-channels-section"
                  className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-dark-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <PieChart className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">Marketing Channels</h4>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-dark-200 px-2 py-0.5 rounded-lg">
                      Standby
                    </span>
                  </div>

                  {/* Accessible check for automated tests */}
                  <span className="sr-only">Marketing Channels: Not connected</span>

                  <div className="relative w-full h-64 flex flex-col items-center justify-center p-6 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-2.5 my-auto">
                    <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <PieChart className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-sm font-bold text-slate-800 dark:text-white">Marketing Channels: Not connected</h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                        No marketing channels connected. Connect Website or Meta in Settings to track channel traffic and conversions.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span>Status: Standby</span>
                    </div>
                    <div className="pt-2 flex items-center gap-2 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => handleNavClick('settings')}
                        className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                      >
                        + Connect Website
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavClick('settings')}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                      >
                        + Connect Meta
                      </button>
                    </div>
                  </div>
                </div>
              </div>

`;

content = content.slice(0, mktgStartIdx) + replacementMktg + content.slice(mktgEndIdx);

// 13. Update reports view and dedicated section views
const startOtherTabs = `          {/* OTHER TABS */}
          {!isCustomMainTab && activeTab === 'reports' && (`;
const endOtherTabs = `        </main>`;

const otherTabsStartIdx = content.indexOf(startOtherTabs);
const otherTabsEndIdx = content.indexOf(endOtherTabs);

if (otherTabsStartIdx === -1 || otherTabsEndIdx === -1) {
  console.error('Failed to match OTHER TABS block');
  process.exit(1);
}

const replacementOtherTabs = `          {/* VIEW: REPORTS (Item 9 & 10 Fix) */}
          {!isCustomMainTab && activeTab === 'reports' && (
            <div data-testid="client-reports-view" className="space-y-4 animate-in fade-in duration-150">
              <ClientMonthlyReportsView
                client={client}
                tasks={effectiveTasks}
                isStaffView={false}
              />
            </div>
          )}

          {/* VIEW: ANALYTICS (Item 11 Fix) */}
          {!isCustomMainTab && activeTab === 'analytics' && (
            <div data-testid="client-analytics-view" className="space-y-6 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Website Traffic & Conversion Analytics</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Live visitor telemetry and lead tracking for {clientGreetingName}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-dark-200 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-border self-start sm:self-auto">
                    Telemetry: Standby
                  </span>
                </div>

                <div className="p-8 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto border border-teal-200/60 dark:border-teal-800/40">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Google Analytics & LeadConnector: Not connected</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                      No live telemetry stream is paired with this workspace. Connect your Google Analytics (GA4) property or LeadConnector account in Settings to view visitor trends, session duration, and live lead conversions.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center gap-3 justify-center flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleNavClick('settings')}
                      className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      + Connect Google Analytics
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('settings')}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      + Connect LeadConnector
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: WEBSITE & SEO (Item 11 Fix) */}
          {!isCustomMainTab && activeTab === 'website_seo' && (
            <div data-testid="client-website_seo-view" className="space-y-6 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Website Health & Search Engine Optimization</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Domain telemetry, indexed pages, and SEO performance</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-dark-200 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-border self-start sm:self-auto">
                    Status: Standby
                  </span>
                </div>

                <div className="p-8 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-200/60 dark:border-blue-800/40">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Website & SEO Telemetry: Not connected</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                      No live SEO telemetry streaming is active. Connect your website domain and Google Search Console in Settings to monitor keyword rankings, indexed pages, and organic impressions.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center gap-3 justify-center flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleNavClick('settings')}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      + Connect Domain
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('settings')}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      + Connect Google Search Console
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SUBSCRIPTION & BILLING (Item 7 Fix) */}
          {!isCustomMainTab && (activeTab === 'subscription' || activeTab === 'billing_invoices') && (
            <div data-testid={\`client-\${activeTab}-view\`} className="space-y-6 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center shrink-0">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Subscription & Invoices</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Official retainer agreement, billing cycle, and payment receipts</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 self-start sm:self-auto">
                    {subscriptionStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Package</span>
                    <h5 className="text-sm font-extrabold text-slate-900 dark:text-white">{subscriptionPlan}</h5>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Monthly Retainer</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subscription Rate</span>
                    <h5 className="text-sm font-extrabold text-slate-900 dark:text-white">{formattedClientRate}</h5>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Fixed rate schedule</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next Billing Date</span>
                    <h5 className="text-sm font-extrabold text-slate-900 dark:text-white">{nextBillingDate}</h5>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Auto-renewal enabled</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadReceipt}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-100 text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-slate-500" />
                    <span>Download Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadReport}
                    className="px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-white" />
                    <span>Download Monthly Report</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SETTINGS (Item 11 Fix) */}
          {!isCustomMainTab && activeTab === 'settings' && (
            <div data-testid="client-settings-view" className="space-y-6 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border flex items-center justify-center shrink-0">
                      <Settings className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Workspace Settings & Integrations</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Configure telemetry feeds, analytics tokens, and workspace preferences</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40 self-start sm:self-auto">
                    Active Workspace
                  </span>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">External Telemetry Feeds</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">Google Analytics (GA4)</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Not connected</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Stream website page views, traffic channels, and user bounce rate.</p>
                      <button
                        type="button"
                        onClick={() => alert('To connect Google Analytics, enter your GA4 Measurement ID in Operations Hub integration settings.')}
                        className="w-full mt-1 px-3 py-1.5 rounded-lg bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Configure GA4 Feed
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">LeadConnector (GoHighLevel)</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Not connected</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Stream live CRM contact records, incoming leads, and pipeline conversions.</p>
                      <button
                        type="button"
                        onClick={() => alert('To connect LeadConnector, pair your agency API key in Client Integration Settings.')}
                        className="w-full mt-1 px-3 py-1.5 rounded-lg bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Configure LeadConnector Feed
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SOCIAL MEDIA */}
          {!isCustomMainTab && activeTab === 'social_media' && (
            <div data-testid="client-social_media-view" className="space-y-6 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-dark-border">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Social Media Management</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Cross-channel content calendar and sprint deliverables</p>
                  </div>
                </div>
                <div className="p-6 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">Social Channels: Standby</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Manage active campaigns and schedule social media creatives in your sprint deliverables.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: LINKEDIN */}
          {!isCustomMainTab && activeTab === 'linkedin' && (
            <div data-testid="client-linkedin-view" className="space-y-6 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-dark-border">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <LinkedInIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">LinkedIn Growth & Optimization</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Executive profile optimization and outreach campaigns</p>
                  </div>
                </div>
                <div className="p-6 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">LinkedIn Pipeline: Active</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Profiles managed: {client.requiredLinkedinProfileCount || 1} assigned specialist profile(s).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: PAID ADS */}
          {!isCustomMainTab && activeTab === 'paid_ads' && (
            <div data-testid="client-paid_ads-view" className="space-y-6 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-dark-border">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Paid Advertising Campaigns</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">PPC ads, budget allocation, and creative management</p>
                  </div>
                </div>
                <div className="p-6 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">Ad Accounts: Standby</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Connect Google Ads or Meta Ads in Settings to view spend and return on ad spend (ROAS).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: FUNNEL */}
          {!isCustomMainTab && activeTab === 'funnel' && (
            <div data-testid="client-funnel-view" className="space-y-6 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-dark-border">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Funnel & Conversion Architecture</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Landing pages, lead magnets, and customer conversion paths</p>
                  </div>
                </div>
                <div className="p-6 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">Funnel Telemetry: Standby</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Landing page conversion telemetry is tracked through your sprint deliverable reviews.
                  </p>
                </div>
              </div>
            </div>
          )}
`;

content = content.slice(0, otherTabsStartIdx) + replacementOtherTabs + content.slice(otherTabsEndIdx);

// Convert back to CRLF if original had CRLF
if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated FinfixClientPortalView.tsx!');
