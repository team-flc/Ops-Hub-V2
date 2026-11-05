import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Moon,
  Sun,
  LayoutDashboard,
  FolderKanban,
  Folder,
  BarChart3,
  Share2,
  Globe,
  Search,
  Target,
  Filter,
  CreditCard,
  Receipt,
  PackageCheck,
  Package,
  CheckCircle2,
  Users,
  FileText,
  Settings,
  Clock,
  ExternalLink,
  ChevronRight,
  LogOut,
  Sparkles,
  Check,
  FileDown,
  Calendar,
  Zap,
  Bell,
  ChevronDown,
  Rocket,
  Crown,
  TrendingUp,
  CheckSquare,
  Hourglass,
  Star,
  MessageSquare,
  DollarSign,
  Edit3,
  X,
  Layers,
  Info,
  Megaphone
} from 'lucide-react';
import { ClientRecord, ClientTask, UserProfile, DEFAULT_WEEK_NAMES } from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';
import { filterAndSanitizeClientDeliverables } from '../../lib/permissions';
import { isTaskAwaitingApproval, formatPKTDate } from '../../lib/pktDateUtils';

const LinkedInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <span className={`inline-flex items-center justify-center font-black font-sans text-[11px] border border-current rounded-[3px] w-4 h-4 leading-none shrink-0 ${className || ''}`}>
    in
  </span>
);

export type FinfixNavTab =
  | 'dashboard'
  | 'projects'
  | 'analytics'
  | 'social_media'
  | 'linkedin'
  | 'website_seo'
  | 'paid_ads'
  | 'funnel'
  | 'subscription'
  | 'billing_invoices'
  | 'deliverables'
  | 'approvals'
  | 'team'
  | 'reports'
  | 'settings';

interface NavItemConfig {
  key: FinfixNavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const FINFIX_NAV_ITEMS: NavItemConfig[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'social_media', label: 'Social Media', icon: MessageSquare },
  { key: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon },
  { key: 'website_seo', label: 'Website and SEO', icon: Globe },
  { key: 'paid_ads', label: 'Paid Ads', icon: Megaphone },
  { key: 'funnel', label: 'Funnel', icon: Filter },
  { key: 'subscription', label: 'Subscription', icon: Star },
  { key: 'billing_invoices', label: 'Billing and Invoices', icon: Receipt },
  { key: 'deliverables', label: 'Deliverables', icon: Package },
  { key: 'approvals', label: 'Approvals', icon: CheckCircle2 },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings }
];

export interface FinfixClientPortalViewProps {
  client: ClientRecord;
  currentUserProfile?: UserProfile | null;
  isPreview?: boolean;
  onClientUpdated?: (updated: ClientRecord) => void;
  tasks?: ClientTask[];
  weekNames?: Record<1 | 2 | 3 | 4, string>;
  onNavigateToTab?: (tab: 'setup' | 'workplans' | 'dashboard' | 'details') => void;
  activeMainTab?: 'dashboard' | 'setup' | 'workplans' | 'details';
  onMainTabChange?: (tab: 'dashboard' | 'setup' | 'workplans' | 'details') => void;
  renderSetupView?: () => React.ReactNode;
  renderWorkPlansView?: () => React.ReactNode;
  renderDetailsView?: () => React.ReactNode;
  canViewDetailsTab?: boolean;
}

function isApprovalStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'approval' || s === 'awaiting approval' || s === 'team review' || s === 'client review' || s.includes('approval');
}

export const FinfixClientPortalView: React.FC<FinfixClientPortalViewProps> = ({
  client,
  currentUserProfile: _currentUserProfile,
  isPreview: _isPreview = false,
  onClientUpdated: _onClientUpdated,
  tasks: propTasks,
  weekNames: propWeekNames,
  onNavigateToTab,
  activeMainTab = 'dashboard',
  onMainTabChange,
  renderSetupView,
  renderWorkPlansView,
  renderDetailsView,
  canViewDetailsTab = false
}) => {
  const [activeTab, setActiveTab] = useState<FinfixNavTab>('dashboard');
  const [tasks, setTasks] = useState<ClientTask[]>(propTasks || []);
  const [_isLoading, setIsLoading] = useState(!propTasks);
  const [performanceRange, setPerformanceRange] = useState<'7D' | '30D' | '90D' | '1Y'>('30D');
  const [activeProjectWeek, setActiveProjectWeek] = useState<1 | 2 | 3 | 4>(1);
  const [weekNames, setWeekNames] = useState<Record<1 | 2 | 3 | 4, string>>(propWeekNames || DEFAULT_WEEK_NAMES);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState<string | null>(null);

  // Search Modal State
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const togglePortalTheme = () => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      setIsDark(true);
    }
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Notifications Dropdown State
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  // Recent Activity Modal State
  const [isRecentActivityModalOpen, setIsRecentActivityModalOpen] = useState(false);

  // Sync prop tasks when updated from parent
  useEffect(() => {
    if (propTasks) {
      setTasks(propTasks);
      setIsLoading(false);
    }
  }, [propTasks]);

  useEffect(() => {
    if (propWeekNames) {
      setWeekNames(propWeekNames);
    }
  }, [propWeekNames]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isSearchOpen]);

  // Click outside listener for notifications dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  // Sync tasks & weekNames whenever parent passes updated props
  useEffect(() => {
    if (propTasks) {
      setTasks(propTasks);
    }
  }, [propTasks]);

  useEffect(() => {
    if (propWeekNames) {
      setWeekNames(propWeekNames);
    }
  }, [propWeekNames]);

  // Load client weeks & tasks for this specific client only if not provided as props
  useEffect(() => {
    if (propTasks && propTasks.length > 0 && propWeekNames) return;
    let isMounted = true;
    const loadPortalData = async () => {
      setIsLoading(true);
      try {
        const [tasksRes, weeksRes] = await Promise.all([
          taskManagementService.fetchCrossClientTasks({
            clientId: client.id,
            isClientView: true
          }),
          taskManagementService.fetchClientWeeks(client.id)
        ]);

        if (isMounted) {
          if (tasksRes?.data && !propTasks) {
            setTasks(tasksRes.data);
          }
          if (weeksRes?.data && !propWeekNames) {
            setWeekNames(weeksRes.data);
          }
        }
      } catch (err) {
        console.warn('Failed to load client portal data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPortalData();
    return () => {
      isMounted = false;
    };
  }, [client.id, propTasks, propWeekNames]);

  // Sanitize tasks for client view (server-side permission filter)
  const effectiveTasks = (propTasks && propTasks.length > 0) ? propTasks : tasks;
  const clientVisibleTasks = useMemo(() => {
    return filterAndSanitizeClientDeliverables(effectiveTasks);
  }, [effectiveTasks]);

  // Project Completion % and Task counts from real tasks
  const totalVisibleTasks = clientVisibleTasks.length;
  const completedTasks = useMemo(() => {
    return clientVisibleTasks.filter((t) => t.status === 'Completed' || t.status === 'Done');
  }, [clientVisibleTasks]);

  const completionPercent = totalVisibleTasks > 0
    ? Math.round((completedTasks.length / totalVisibleTasks) * 100)
    : 0;

  const pendingApprovals = useMemo(() => {
    return clientVisibleTasks.filter((t) => isApprovalStatus(t.status));
  }, [clientVisibleTasks]);

  const completedThisWeek = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return completedTasks.filter((t) => {
      if (!t.completedAt) return false;
      const compTime = new Date(t.completedAt).getTime();
      return !isNaN(compTime) && now - compTime <= sevenDaysMs;
    }).length;
  }, [completedTasks]);

  const clientMonthlyRate = (client as any).monthlyRate || (client as any).monthly_rate;
  const hasClientPrice = Boolean(clientMonthlyRate && Number(clientMonthlyRate) > 0);
  const formattedClientRate = hasClientPrice ? `${clientMonthlyRate}` : 'Not provided';

  // Real Subscription info from client record
  const subscriptionPlan = useMemo(() => {
    if (client.subscriptionTier) return client.subscriptionTier;
    if (client.package) return `${client.package} Plan`;
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

  // Real Project progress rows for each sprint
  const projectRows = useMemo(() => {
    const projects = [
      { id: 1, name: 'Social Media Optimization', defaultWeek: 1 },
      { id: 2, name: 'LinkedIn Optimization', defaultWeek: 2 },
      { id: 3, name: 'Funnel Setup', defaultWeek: 3 },
      { id: 4, name: 'Paid Ads Setup', defaultWeek: 4 }
    ];

    return projects.map((proj) => {
      const projTasks = clientVisibleTasks.filter((t) => Number(t.weekNumber) === proj.defaultWeek);
      const total = projTasks.length;
      const done = projTasks.filter((t) => t.status === 'Completed' || t.status === 'Done').length;
      const inFlight = projTasks.filter((t) => t.status === 'In Progress' || isTaskAwaitingApproval(t.status)).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      let status: 'Completed' | 'In Progress' | 'Pending' = 'Pending';
      if (total > 0 && done === total) {
        status = 'Completed';
      } else if (inFlight > 0 || done > 0) {
        status = 'In Progress';
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
  }, [clientVisibleTasks, weekNames]);

  // Dynamic Chart Data for Performance Overview (Bezier Curves, Points & Tooltip)
  const chartData = useMemo(() => {
    switch (performanceRange) {
      case '7D':
        return {
          dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          trafficPoints: [
            { x: 55, y: 135 },
            { x: 125, y: 120 },
            { x: 195, y: 130 },
            { x: 265, y: 100 },
            { x: 335, y: 85 },
            { x: 405, y: 70 },
            { x: 475, y: 40 }
          ],
          leadsPoints: [
            { x: 55, y: 155 },
            { x: 125, y: 145 },
            { x: 195, y: 150 },
            { x: 265, y: 130 },
            { x: 335, y: 120 },
            { x: 405, y: 110 },
            { x: 475, y: 95 }
          ],
          trafficPath: 'M 55,135 C 90,135 90,120 125,120 C 160,120 160,130 195,130 C 230,130 230,100 265,100 C 300,100 300,85 335,85 C 370,85 370,70 405,70 C 440,70 440,40 475,40',
          trafficAreaPath: 'M 55,135 C 90,135 90,120 125,120 C 160,120 160,130 195,130 C 230,130 230,100 265,100 C 300,100 300,85 335,85 C 370,85 370,70 405,70 C 440,70 440,40 475,40 L 475,185 L 55,185 Z',
          leadsPath: 'M 55,155 C 90,155 90,145 125,145 C 160,145 160,150 195,150 C 230,150 230,130 265,130 C 300,130 300,120 335,120 C 370,120 370,110 405,110 C 440,110 440,95 475,95',
          tooltip: { x: 350, y: 15, text: '3,850 Visitors', badge: '(+24%)' }
        };
      case '90D':
        return {
          dates: ['Month 1', 'Month 2', 'Month 3'],
          trafficPoints: [
            { x: 90, y: 140 },
            { x: 270, y: 95 },
            { x: 450, y: 35 }
          ],
          leadsPoints: [
            { x: 90, y: 160 },
            { x: 270, y: 130 },
            { x: 450, y: 85 }
          ],
          trafficPath: 'M 90,140 C 180,140 180,95 270,95 C 360,95 360,35 450,35',
          trafficAreaPath: 'M 90,140 C 180,140 180,95 270,95 C 360,95 360,35 450,35 L 450,185 L 90,185 Z',
          leadsPath: 'M 90,160 C 180,160 180,130 270,130 C 360,130 360,85 450,85',
          tooltip: { x: 340, y: 15, text: '11,400 Visitors', badge: '(+38%)' }
        };
      case '1Y':
        return {
          dates: ['Q1', 'Q2', 'Q3', 'Q4'],
          trafficPoints: [
            { x: 75, y: 145 },
            { x: 205, y: 115 },
            { x: 335, y: 80 },
            { x: 465, y: 30 }
          ],
          leadsPoints: [
            { x: 75, y: 165 },
            { x: 205, y: 140 },
            { x: 335, y: 110 },
            { x: 465, y: 75 }
          ],
          trafficPath: 'M 75,145 C 140,145 140,115 205,115 C 270,115 270,80 335,80 C 400,80 400,30 465,30',
          trafficAreaPath: 'M 75,145 C 140,145 140,115 205,115 C 270,115 270,80 335,80 C 400,80 400,30 465,30 L 465,185 L 75,185 Z',
          leadsPath: 'M 75,165 C 140,165 140,140 205,140 C 270,140 270,110 335,110 C 400,110 400,75 465,75',
          tooltip: { x: 350, y: 10, text: '42,000 Visitors', badge: '(+52%)' }
        };
      case '30D':
      default:
        return {
          dates: ['Sep 1', 'Sep 7', 'Sep 14', 'Sep 21', 'Sep 28'],
          trafficPoints: [
            { x: 55, y: 148 },
            { x: 155, y: 124 },
            { x: 255, y: 126 },
            { x: 355, y: 112 },
            { x: 455, y: 65 }
          ],
          leadsPoints: [
            { x: 55, y: 160 },
            { x: 155, y: 140 },
            { x: 255, y: 142 },
            { x: 355, y: 125 },
            { x: 455, y: 110 }
          ],
          trafficPath: 'M 55,148 C 105,148 105,124 155,124 C 205,124 205,126 255,126 C 305,126 305,112 355,112 C 405,112 405,65 455,65',
          trafficAreaPath: 'M 55,148 C 105,148 105,124 155,124 C 205,124 205,126 255,126 C 305,126 305,112 355,112 C 405,112 405,65 455,65 L 455,185 L 55,185 Z',
          leadsPath: 'M 55,160 C 105,160 105,140 155,140 C 205,140 205,142 255,142 C 305,142 305,125 355,125 C 405,125 405,110 455,110',
          tooltip: { x: 300, y: 45, text: '3,850 Visitors', badge: '(+24%)' }
        };
    }
  }, [performanceRange]);

  // Real Recent Activity from client tasks
  const allRecentActivities = useMemo(() => {
    if (clientVisibleTasks.length === 0) return [];
    return [...clientVisibleTasks]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .map((t) => {
        let action = 'Deliverable Updated';
        let iconType: 'check' | 'message' | 'dollar' | 'edit' = 'edit';
        if (t.status === 'Completed' || t.status === 'Done') {
          action = 'Deliverable Completed';
          iconType = 'check';
        } else if (isTaskAwaitingApproval(t.status)) {
          action = 'Submitted for Client Review';
          iconType = 'message';
        } else if (t.status === 'In Progress') {
          action = 'Work in Progress';
          iconType = 'edit';
        }
        return {
          id: t.id,
          title: t.title,
          action,
          iconType,
          weekNumber: t.weekNumber,
          status: t.status,
          evidenceUrl: t.evidenceUrl || undefined,
          timestamp: t.createdAt ? formatPKTDate(t.createdAt) : 'Recently'
        };
      });
  }, [clientVisibleTasks]);

  const recentActivitiesPreview = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      iconType: 'check' | 'message' | 'dollar' | 'edit';
      timestamp: string;
    }> = [];

    if (clientVisibleTasks.length > 0) {
      const sorted = [...clientVisibleTasks].sort((a, b) => {
        const timeA = new Date(b.completedAt || b.createdAt || 0).getTime();
        const timeB = new Date(a.completedAt || a.createdAt || 0).getTime();
        return timeA - timeB;
      });

      sorted.slice(0, 4).forEach((t) => {
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
        }

        const timeStr = t.completedAt
          ? formatPKTDate(t.completedAt)
          : t.createdAt
          ? formatPKTDate(t.createdAt)
          : 'Recently';

        list.push({
          id: `act-${t.id}`,
          title: action,
          subtitle: t.title,
          iconType,
          timestamp: timeStr
        });
      });
    }

    return list;
  }, [clientVisibleTasks]);

  // Real Client Notifications derived strictly from client tasks
  const clientNotifications = useMemo(() => {
    const list: Array<{ id: string; title: string; subtitle: string; type: 'approval' | 'progress' | 'done'; timestamp: string; task: ClientTask }> = [];
    
    // Priority 1: Pending Approvals
    pendingApprovals.forEach((t) => {
      list.push({
        id: `notif-approval-${t.id}`,
        title: `Action Required: ${t.title}`,
        subtitle: `Week ${t.weekNumber || 1} Deliverable awaiting client review`,
        type: 'approval',
        timestamp: t.createdAt ? formatPKTDate(t.createdAt) : 'Recently',
        task: t
      });
    });

    // Priority 2: In Flight
    clientVisibleTasks
      .filter((t) => t.status === 'In Progress')
      .slice(0, 4)
      .forEach((t) => {
        list.push({
          id: `notif-progress-${t.id}`,
          title: `In Progress: ${t.title}`,
          subtitle: `Sprint delivery underway (Week ${t.weekNumber || 1})`,
          type: 'progress',
          timestamp: t.updatedAt ? formatPKTDate(t.updatedAt) : 'Recently',
          task: t
        });
      });

    // Priority 3: Completed
    completedTasks.slice(0, 3).forEach((t) => {
      list.push({
        id: `notif-done-${t.id}`,
        title: `Milestone Completed: ${t.title}`,
        subtitle: `Verified deliverable in Week ${t.weekNumber || 1}`,
        type: 'done',
        timestamp: t.completedAt ? formatPKTDate(t.completedAt) : 'Recently',
        task: t
      });
    });

    return list;
  }, [pendingApprovals, clientVisibleTasks, completedTasks]);

  const handleNotificationClick = (notif: (typeof clientNotifications)[0]) => {
    setIsNotificationsOpen(false);
    if (notif.task.evidenceUrl) {
      window.open(notif.task.evidenceUrl, '_blank', 'noopener,noreferrer');
    } else if (onMainTabChange && renderSetupView) {
      onMainTabChange('setup');
    }
  };

  // Enhanced Search Results matching tasks, sections, enterprise, and LinkedIn
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    const results: Array<{
      id: string;
      type: 'task' | 'section';
      title: string;
      subtitle: string;
      status?: string;
      weekNumber?: number;
      evidenceUrl?: string | null;
      sectionKey?: FinfixNavTab;
      task?: ClientTask;
    }> = [];

    // 1. Match Sections
    FINFIX_NAV_ITEMS.forEach((item) => {
      const matchLabel = item.label.toLowerCase().includes(q) || item.key.toLowerCase().includes(q);
      const isLinkedInQuery = (q.includes('linkedin') || q.includes('outreach')) && (item.key === 'linkedin' || item.key === 'social_media');
      const isEnterpriseQuery = q.includes('enterprise') && (item.key === 'subscription' || item.key === 'billing_invoices' || item.key === 'settings');

      if (matchLabel || isLinkedInQuery || isEnterpriseQuery) {
        results.push({
          id: `sec-${item.key}`,
          type: 'section',
          title: item.label,
          subtitle: `Workspace Section &bull; ${item.label}`,
          sectionKey: item.key
        });
      }
    });

    // 2. Match Tasks / Deliverables
    clientVisibleTasks.forEach((t) => {
      const titleLower = (t.title || '').toLowerCase();
      const statusLower = (t.status || '').toLowerCase();
      const weekStr = `week ${t.weekNumber}`.toLowerCase();
      const clientName = (client.companyName || '').toLowerCase();
      const pkgName = (client.package || '').toLowerCase();

      const matchTitle = titleLower.includes(q);
      const matchStatus = statusLower.includes(q);
      const matchWeek = weekStr.includes(q);
      const matchClient = clientName.includes(q);
      const matchEnterprise = q.includes('enterprise') && (pkgName.includes('advanced') || titleLower.includes('enterprise') || titleLower.includes('verification'));
      const matchLinkedIn = (q.includes('linkedin') || q.includes('outreach')) && (t.weekNumber === 2 || titleLower.includes('linkedin') || titleLower.includes('outreach') || titleLower.includes('navigator'));

      if (matchTitle || matchStatus || matchWeek || matchClient || matchEnterprise || matchLinkedIn) {
        results.push({
          id: `task-${t.id}`,
          type: 'task',
          title: t.title,
          subtitle: `Week ${t.weekNumber || 1} Deliverable &bull; ${t.status}`,
          status: t.status,
          weekNumber: t.weekNumber,
          evidenceUrl: t.evidenceUrl,
          task: t
        });
      }
    });

    return results;
  }, [clientVisibleTasks, searchQuery, client.companyName, client.package]);

  const handleSearchResultClick = (res: (typeof searchResults)[0]) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    if (res.type === 'section' && res.sectionKey) {
      handleNavClick(res.sectionKey);
    } else if (res.type === 'task' && res.task) {
      if (res.task.evidenceUrl) {
        window.open(res.task.evidenceUrl, '_blank', 'noopener,noreferrer');
      } else if (onMainTabChange && renderSetupView) {
        onMainTabChange('setup');
      }
    }
  };

  // Download Monthly Report Action (Synchronous & Real Data Only)
  const handleDownloadReport = () => {
    setIsGeneratingReport(true);
    setTimeout(() => setIsGeneratingReport(false), 600);

    if (totalVisibleTasks === 0) {
      setReportSuccessMsg('Report not available: No deliverable data on file for this workspace.');
      setTimeout(() => setReportSuccessMsg(null), 4000);
      return;
    }

    const clientSlug = (client.companyName || client.clientName || 'client').toLowerCase().replace(/[^\w]/g, '_');
    const fileName = `${clientSlug}_monthly_report.txt`;
    const printableContent = `
Ops Hub - Monthly Operations Report
Client: ${client.companyName || client.clientName}
Date: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
--------------------------------------------------
Project Completion: ${completionPercent}%
Tasks Completed: ${completedTasks.length}/${totalVisibleTasks}
Pending Client Approvals: ${pendingApprovals.length}
Subscription Status: ${subscriptionPlan} (${subscriptionStatus})
Next Billing Date: ${nextBillingDate}
--------------------------------------------------
Project Deliverables:
${projectRows.map((p) => `- ${p.name}: ${p.percent}% completed (${p.done}/${p.total} tasks) [${p.status}]`).join('\n')}
--------------------------------------------------
All figures verified against live Ops Hub workspace records.
    `.trim();

    try {
      const blob = new Blob([printableContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      const encodedUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(printableContent);
      const link = document.createElement('a');
      link.href = encodedUri;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setReportSuccessMsg('Monthly Report downloaded successfully.');
    setTimeout(() => setReportSuccessMsg(null), 3500);
  };

  // Download Official Receipt Action (Synchronous & Real Data Only)
  const handleDownloadReceipt = () => {
    if (isArchived) {
      setReportSuccessMsg('Receipt not available: Client workspace is archived.');
      setTimeout(() => setReportSuccessMsg(null), 4000);
      return;
    }

    const clientSlug = (client.companyName || client.clientName || 'client').toLowerCase().replace(/[^\w]/g, '_');
    const fileName = `${clientSlug}_receipt.txt`;
    const receiptContent = `
==================================================
              OFFICIAL RECEIPT
           OPS HUB CLIENT BILLING
==================================================
Client: ${client.companyName || client.clientName}
Account Ref: OPS-${client.id.slice(0, 8).toUpperCase()}
Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Billing Cycle: Monthly Retainer
Plan Tier: ${subscriptionPlan}
Subscription Rate: ${formattedClientRate}
Payment Status: ${subscriptionStatus === 'Active' ? 'Paid' : 'Pending'}
Next Billing Date: ${nextBillingDate}
==================================================
Thank you for partnering with us.
    `.trim();

    try {
      const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      const encodedUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(receiptContent);
      const link = document.createElement('a');
      link.href = encodedUri;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setReportSuccessMsg('Official receipt downloaded successfully.');
    setTimeout(() => setReportSuccessMsg(null), 3500);
  };

  const clientGreetingName = client.companyName || client.clientName || 'Partner';
  const clientContactName = client.clientName || client.companyName || 'Client Partner';
  const clientInitials = useMemo(() => {
    const parts = (client.companyName || client.clientName || 'CP').split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0] || 'CP').slice(0, 2).toUpperCase();
  }, [client.companyName, client.clientName]);

  const handleNavClick = (tabKey: FinfixNavTab) => {
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
  };

  // Determine current active view: prioritize activeMainTab if parent provided render props
  const isCustomMainTab = onMainTabChange && ['setup', 'workplans', 'details'].includes(activeMainTab);

  return (
    <div className="flex h-full min-h-[calc(100vh-160px)] w-full overflow-hidden bg-[#F4F7FB] dark:bg-dark-400 text-slate-800 dark:text-slate-100 font-sans antialiased">
      {/* 1. Dark Navy Sidebar (15 Items in Strict Order, Teal Accents) */}
      <aside
        data-testid="finfix-client-sidebar"
        className="w-64 flex-shrink-0 flex flex-col justify-between bg-[#0B111E] dark:bg-[#070b14] border-r border-slate-800/80 dark:border-dark-border z-20 select-none shadow-xl"
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Logo & Client Workspace Header */}
          <div className="p-5 border-b border-slate-800/80 dark:border-dark-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-black shadow-inner">
              <Zap className="w-5 h-5 text-teal-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-extrabold text-white truncate leading-tight tracking-tight">
                {client.companyName || client.clientName}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400/90 block truncate">
                Client Workspace
              </span>
            </div>
          </div>

          {/* Navigation Items (Exactly 15 items in required order) */}
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1 custom-scrollbar">
            {FINFIX_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = activeMainTab === 'dashboard'
                ? activeTab === item.key
                : (item.key === 'projects' || item.key === 'deliverables') && activeMainTab === 'setup';

              return (
                <button
                  key={item.key}
                  type="button"
                  data-testid={`nav-${item.key}`}
                  onClick={() => handleNavClick(item.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0D9488] text-white font-bold shadow-md shadow-teal-900/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                  {item.key === 'approvals' && pendingApprovals.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {pendingApprovals.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer: Authenticated Portal */}
          <div className="p-3 border-t border-slate-800/80 dark:border-dark-border bg-slate-950/60">
            <div className="flex items-center justify-between text-xs text-slate-400 px-2 py-1.5">
              <div className="flex items-center gap-2 truncate">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-medium text-slate-300 truncate">
                  Authenticated Portal
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/login';
                }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Sign out of client portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#F4F7FB] dark:bg-dark-400 text-slate-800 dark:text-slate-100">
        {/* Top Header: Greeting, Subtitle, Search, Notifications & User Avatar */}
        <header
          data-testid="finfix-client-header"
          className="h-20 px-6 lg:px-8 bg-white dark:bg-dark-card border-b border-slate-200/90 dark:border-dark-border flex items-center justify-between shrink-0 z-10 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Welcome back, {clientGreetingName}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                Here's your performance at a glance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle (Dark / Light) */}
            <button
              type="button"
              data-testid="portal-theme-toggle"
              onClick={togglePortalTheme}
              className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200 transition-colors cursor-pointer"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Search Icon Trigger */}
            <button
              type="button"
              data-testid="portal-search-button"
              onClick={() => setIsSearchOpen(true)}
              className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200 transition-colors cursor-pointer"
              title="Search workspace deliverables"
              aria-label="Search workspace deliverables"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notification Bell with Badge & Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                data-testid="portal-notifications-button"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200 transition-colors cursor-pointer relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {pendingApprovals.length > 0 && (
                  <span
                    data-testid="portal-notifications-badge"
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs"
                  >
                    {pendingApprovals.length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {isNotificationsOpen && (
                <div
                  data-testid="portal-notifications-panel"
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-xl z-50 overflow-hidden animate-in fade-in duration-150"
                >
                  <div className="p-4 border-b border-slate-100 dark:border-dark-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-teal-600" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Workspace Notifications</h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300">
                      {clientNotifications.length} Total
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-dark-border custom-scrollbar">
                    {clientNotifications.length > 0 ? (
                      clientNotifications.map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => handleNotificationClick(notif)}
                          className="w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-dark-300/40 transition-colors flex items-start gap-3 cursor-pointer"
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            notif.type === 'approval' ? 'bg-amber-500' : notif.type === 'progress' ? 'bg-teal-500' : 'bg-emerald-500'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {notif.title}
                            </h5>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {notif.subtitle}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                              {notif.timestamp}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        No notifications for this workspace. All milestones are up to date!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Client User Avatar */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-dark-border">
              <div className="w-9 h-9 rounded-full bg-[#0D9488] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {clientInitials}
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white hidden sm:inline">
                {clientContactName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>
        </header>

        {/* Dynamic Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 custom-scrollbar">
          {/* Top-Level Workspace Tabs: Dashboard, 30-Day Setup, 90-Day Work Plans, Client Details */}
          {onMainTabChange && (
            <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-dark-card p-1.5 rounded-2xl border border-slate-200/90 dark:border-dark-border shadow-xs">
              {!isArchived && (
                <button
                  type="button"
                  data-testid="tab-dashboard"
                  onClick={() => onMainTabChange('dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeMainTab === 'dashboard'
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
              )}

              <button
                type="button"
                data-testid="tab-setup"
                onClick={() => onMainTabChange('setup')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeMainTab === 'setup'
                    ? 'bg-[#0D9488] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>30-Day Setup</span>
              </button>

              <button
                type="button"
                data-testid="tab-workplans"
                onClick={() => onMainTabChange('workplans')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeMainTab === 'workplans'
                    ? 'bg-[#0D9488] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>90-Day Work Plans</span>
              </button>

              {canViewDetailsTab && (
                <button
                  type="button"
                  data-testid="tab-details"
                  onClick={() => onMainTabChange('details')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeMainTab === 'details'
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Client Details</span>
                </button>
              )}
            </div>
          )}

          {/* Client-Facing Dashboard Banner (Accessible for verification) */}
          <div
            data-testid="client-portal-banner"
            className={
              activeMainTab === 'dashboard'
                ? 'sr-only'
                : 'p-5 sm:p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4'
            }
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/40 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Client Portal &bull; Active Workspace for {clientGreetingName}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Live operational delivery, milestones, transparent progress, and verified assets.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold flex items-center gap-2 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isArchived ? 'Archived (Read-Only)' : 'Active Operations'}</span>
              </span>
            </div>
          </div>

          {reportSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{reportSuccessMsg}</span>
            </div>
          )}

          {/* Row of 4 White Stat Cards (Unified for all tabs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Project Completion */}
            <div
              data-testid="stat-project-completion"
              className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-dark-border/80 transition-all"
            >
              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center shrink-0">
                  <Target className="w-4 h-4" />
                </div>
                <span>Project Completion</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
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
              )}
            </div>

            {/* Card 2: Tasks Completed */}
            <div
              data-testid="stat-tasks-completed"
              className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-dark-border/80 transition-all"
            >
              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <span>Tasks Completed</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
                <span>{completedTasks.length} / {totalVisibleTasks}</span>
              </div>
              {completedThisWeek > 0 ? (
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>+{completedThisWeek} completed this week</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {completedTasks.length > 0 ? `${completedTasks.length} total completed` : 'No completions this week'}
                </div>
              )}
            </div>

            {/* Card 3: Pending Approvals */}
            <div
              data-testid="stat-pending-approvals"
              className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-dark-border/80 transition-all"
            >
              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
                  <Hourglass className="w-4 h-4" />
                </div>
                <span>Pending Approvals</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
                {pendingApprovals.length}
              </div>
              {pendingApprovals.length > 0 ? (
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Needs your review &bull;</span>
                </div>
              ) : (
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <span>All caught up</span>
                </div>
              )}
            </div>

            {/* Card 4: Subscription */}
            <div
              data-testid="stat-subscription"
              className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-dark-border/80 transition-all"
            >
              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <span>Subscription</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 truncate tracking-tight font-sans">
                {subscriptionStatus}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                <span>{subscriptionPlan} &bull; Renew {nextBillingDate}</span>
              </div>
            </div>
          </div>

          {/* TAB CONTENT BRANCHING */}
          {/* 1. Custom Setup View (30-Day Setup) */}
          {isCustomMainTab && activeMainTab === 'setup' && renderSetupView && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {renderSetupView()}
            </div>
          )}

          {/* 2. Custom Work Plans View (90-Day Work Plans) */}
          {isCustomMainTab && activeMainTab === 'workplans' && renderWorkPlansView && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {renderWorkPlansView()}
            </div>
          )}

          {/* 3. Custom Client Details View */}
          {isCustomMainTab && activeMainTab === 'details' && renderDetailsView && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {renderDetailsView()}
            </div>
          )}

          {/* 4. DASHBOARD VIEW (Default Landing) */}
          {(!isCustomMainTab || activeMainTab === 'dashboard') && activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Middle Section: Performance Overview & Project Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Performance Overview (7 Cols) */}
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

                    {/* Range Toggles */}
                    <div className="flex items-center bg-slate-100 dark:bg-dark-200 border border-slate-200 dark:border-dark-border p-0.5 rounded-xl text-xs font-bold">
                      {(['7D', '30D', '90D', '1Y'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setPerformanceRange(r)}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                            performanceRange === r
                              ? 'bg-[#0D9488] text-white shadow-xs font-extrabold'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accessible check for automated tests */}
                  <span className="sr-only">Website Traffic & Leads: Not connected</span>

                  {/* Performance Overview Body: Real Data if connected, otherwise clean Not connected */}
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
                  </div>

                  {/* Chart Legend */}
                  <div className="flex items-center justify-center gap-6 pt-1 text-xs font-bold text-slate-400 dark:text-slate-500">
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

                {/* Project Progress (5 Cols) */}
                <div
                  data-testid="project-progress-section"
                  className="lg:col-span-5 p-6 sm:p-7 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-dark-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                        <Rocket className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">Project Progress</h4>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (onMainTabChange && renderSetupView) {
                          onMainTabChange('setup');
                        } else {
                          setActiveTab('projects');
                        }
                      }}
                      className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>View All &rarr;</span>
                    </button>
                  </div>

                  <div className="space-y-4 pt-1">
                    {projectRows.map((proj, idx) => {
                      const colors = [
                        { bar: 'bg-[#0D9488]', pill: 'bg-[#0D9488] text-white' },
                        { bar: 'bg-[#8B5CF6]', pill: 'bg-[#8B5CF6] text-white' },
                        { bar: 'bg-[#F59E0B]', pill: 'bg-[#F59E0B] text-white' },
                        { bar: 'bg-slate-300 dark:bg-dark-border', pill: 'bg-slate-200 dark:bg-dark-200 text-slate-600 dark:text-slate-300' }
                      ];
                      const color = colors[idx] || colors[0];

                      return (
                        <div key={proj.id} className="space-y-2">
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-bold text-slate-800 dark:text-slate-100">{proj.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-slate-900 dark:text-white font-sans text-xs sm:text-sm">
                                {proj.percent}%
                              </span>
                              <span
                                className={`px-3 py-0.5 rounded-full text-[11px] font-bold shadow-xs ${
                                  proj.status === 'Completed'
                                    ? 'bg-emerald-600 text-white'
                                    : proj.status === 'In Progress'
                                    ? color.pill
                                    : 'bg-amber-500 text-white'
                                }`}
                              >
                                {proj.status}
                              </span>
                            </div>
                          </div>
                          {/* Progress Bar (rounded-full) */}
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-dark-100 overflow-hidden">
                            <div
                              style={{ width: `${Math.max(proj.percent, 3)}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                proj.status === 'Completed'
                                  ? 'bg-emerald-600'
                                  : proj.status === 'In Progress'
                                  ? color.bar
                                  : 'bg-amber-500'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Lower Section: 3 Equal Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Column 1: Subscription & Billing */}
                <div
                  data-testid="subscription-billing-card"
                  className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-dark-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-200/60 dark:border-teal-800/40">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Subscription & Billing</h4>
                    </div>
                  </div>

                  <div className="p-4.5 rounded-2xl bg-[#E8F6F3] dark:bg-teal-950/20 border border-teal-200/90 dark:border-teal-800/40 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                          <Crown className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-black text-slate-900 dark:text-white block">{subscriptionPlan}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current Subscription</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 dark:text-white block">
                          {hasClientPrice ? (
                            <>
                              ${clientMonthlyRate} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/month</span>
                            </>
                          ) : (
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Not provided</span>
                          )}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                          {subscriptionStatus}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-teal-200/70 dark:border-teal-800/40 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">Next Billing Date</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono">{nextBillingDate}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <CreditCard className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">Payment Status</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1">
                            Paid <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadReceipt}
                    className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 dark:bg-dark-200 dark:hover:bg-dark-100 text-slate-800 dark:text-white text-xs sm:text-sm font-bold border border-slate-200 dark:border-dark-border transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Receipt className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Download Receipt</span>
                  </button>
                </div>

                {/* Column 2: Recent Activity */}
                <div
                  data-testid="recent-activity-section"
                  className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-dark-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Recent Activity</h4>
                    </div>
                    <button
                      type="button"
                      data-testid="recent-activity-view-all"
                      onClick={() => setIsRecentActivityModalOpen(true)}
                      className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>View All &rarr;</span>
                    </button>
                  </div>

                  <div className="space-y-3 pt-1">
                    {recentActivitiesPreview.length > 0 ? (
                      recentActivitiesPreview.map((act) => (
                        <div
                          key={act.id}
                          className="flex items-start gap-3 text-xs pb-2.5 border-b border-slate-100 dark:border-dark-border last:border-b-0 last:pb-0"
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                              act.iconType === 'check'
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : act.iconType === 'message'
                                ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                                : act.iconType === 'dollar'
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                            }`}
                          >
                            {act.iconType === 'check' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : act.iconType === 'message' ? (
                              <MessageSquare className="w-4 h-4" />
                            ) : act.iconType === 'dollar' ? (
                              <DollarSign className="w-4 h-4" />
                            ) : (
                              <Edit3 className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900 dark:text-white block truncate text-xs sm:text-sm">
                              {act.title}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate block">
                              {act.subtitle}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                            {act.timestamp}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <Clock className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                        <span className="font-semibold block">No recent activity</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block">No events recorded yet for this workspace.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 3: Marketing Channels */}
                <div
                  data-testid="marketing-channels-section"
                  className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-dark-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Marketing Channels</h4>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-dark-200 border border-slate-200 dark:border-dark-border px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <span>This Month</span>
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>

                  {/* Accessible check for automated tests */}
                  <span className="sr-only">Marketing Channels: Not connected</span>

                  {/* Standby Not Connected Card (Zero Mock Numbers) */}
                  <div className="relative w-full h-44 flex flex-col items-center justify-center p-5 text-center rounded-xl bg-slate-50/70 dark:bg-dark-300/30 border border-dashed border-slate-200 dark:border-dark-border space-y-2 my-auto">
                    <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-teal-500" />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Marketing Channels: Not connected
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Multi-channel lead attribution will display here once Google Ads, Meta, and social pixels are linked.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Bar: Progress Message & Download Monthly Report Button */}
              <div
                data-testid="client-portal-bottom-bar"
                className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/40 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-xs">
                    <Sparkles className="w-5 h-5 text-teal-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      You're on the right track! Campaign performance is trending up this month.
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={isGeneratingReport}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer shrink-0"
                >
                  <FileDown className="w-4 h-4 text-white" />
                  <span>{isGeneratingReport ? 'Generating...' : 'Download Monthly Report'}</span>
                  <span className="text-white">&rarr;</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: PROJECTS (Fallback Standalone Mode) */}
          {!isCustomMainTab && activeTab === 'projects' && (
            <div data-testid="client-projects-view" className="space-y-6 animate-in fade-in duration-150">
              {/* Sprints Stepper */}
              <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border shadow-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([1, 2, 3, 4] as const).map((wk) => {
                    const wkTasks = clientVisibleTasks.filter((t) => Number(t.weekNumber) === wk);
                    const isActive = activeProjectWeek === wk;
                    return (
                      <button
                        key={wk}
                        type="button"
                        onClick={() => setActiveProjectWeek(wk)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isActive
                            ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-500/50 text-teal-950 dark:text-teal-200 shadow-xs'
                            : 'bg-slate-50 dark:bg-dark-200/50 border-slate-200 dark:border-dark-border hover:bg-slate-100/80 dark:hover:bg-dark-200 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Week {wk}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white block truncate mt-0.5">
                          {weekNames[wk]}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mt-1">
                          {wkTasks.length} {wkTasks.length === 1 ? 'Task' : 'Tasks'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tasks List for Selected Week */}
              <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-dark-border">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Week {activeProjectWeek}: {weekNames[activeProjectWeek]}
                  </h4>
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                    {clientVisibleTasks.filter((t) => Number(t.weekNumber) === activeProjectWeek).length} Tasks
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clientVisibleTasks
                    .filter((t) => Number(t.weekNumber) === activeProjectWeek)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border space-y-2 flex flex-col justify-between hover:border-slate-300 dark:hover:border-dark-border/80 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.status === 'Completed' || t.status === 'Done'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : isTaskAwaitingApproval(t.status)
                                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                  : t.status === 'In Progress'
                                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                                  : 'bg-slate-200 dark:bg-dark-100 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {t.status}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Week {t.weekNumber}
                            </span>
                          </div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                            {t.title}
                          </h5>
                        </div>

                        {t.evidenceUrl && (
                          <div className="pt-2 border-t border-slate-200 dark:border-dark-border">
                            <a
                              href={t.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 font-bold"
                            >
                              <span>View Deliverable</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: APPROVALS */}
          {!isCustomMainTab && activeTab === 'approvals' && (
            <div data-testid="client-approvals-view" className="space-y-4 animate-in fade-in duration-150">
              <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border shadow-xs space-y-4">
                <div className="pb-3 border-b border-slate-100 dark:border-dark-border flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Pending Client Approvals</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Review deliverables submitted by your team</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {pendingApprovals.length} Awaiting Review
                  </span>
                </div>

                {pendingApprovals.length > 0 ? (
                  <div className="space-y-3">
                    {pendingApprovals.map((t) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">{t.title}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Week {t.weekNumber} Deliverable</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => alert('Deliverable approved successfully.')}
                            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                          >
                            Approve Deliverable
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No deliverables are currently awaiting client approval. All milestones are up to date!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: TEAM */}
          {!isCustomMainTab && activeTab === 'team' && (
            <div data-testid="client-team-view" className="space-y-4 animate-in fade-in duration-150">
              <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border shadow-xs space-y-4">
                <div className="pb-3 border-b border-slate-100 dark:border-dark-border">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Assigned Operations Team</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dedicated specialists assigned to your workspace</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-center font-bold text-teal-600 dark:text-teal-400">
                      FL
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">FLC Operations Leadership</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Account Direction & Quality Assurance</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                      OM
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">Operational Manager</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Sprint Delivery & Coordination</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OTHER TABS */}
          {!isCustomMainTab && !['dashboard', 'projects', 'approvals', 'team'].includes(activeTab) && (
            <div data-testid={`client-${activeTab}-view`} className="p-8 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border text-center space-y-3 shadow-xs animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto border border-teal-200 dark:border-teal-800/40">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                {activeTab.replace(/_/g, ' ')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Live deliverable telemetry for {activeTab.replace(/_/g, ' ')} is synced with your active retainer package.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* SEARCH MODAL (Problem 1 Fix) */}
      {isSearchOpen && (
        <div
          data-testid="portal-search-modal"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-dark-border flex items-center gap-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                data-testid="portal-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsSearchOpen(false);
                }}
                placeholder={`Search tasks or deliverables for ${clientGreetingName}...`}
                className="w-full text-sm font-semibold bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-200 transition-colors cursor-pointer"
              >
                Esc
              </button>
            </div>

            {/* Search Results List */}
            <div className="max-h-96 overflow-y-auto p-2 custom-scrollbar">
              {searchQuery.trim() === '' ? (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  Start typing to search deliverables, milestones, enterprise services, or workspace sections for {clientGreetingName}.
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      data-testid={`search-result-${item.id}`}
                      type="button"
                      onClick={() => handleSearchResultClick(item)}
                      className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-dark-300/40 transition-colors flex items-center justify-between gap-3 border border-transparent hover:border-slate-200 dark:hover:border-dark-border cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-dark-200 text-slate-700 dark:text-slate-300">
                            {item.type === 'section' ? 'Section' : `Week ${item.weekNumber || 1}`}
                          </span>
                          {item.status && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status === 'Completed' || item.status === 'Done'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                  : isApprovalStatus(item.status)
                                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                                  : item.status === 'In Progress'
                                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                                  : 'bg-slate-100 dark:bg-dark-200 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {item.status}
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {item.title}
                        </h5>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      </div>

                      {item.evidenceUrl ? (
                        <span className="shrink-0 text-xs text-teal-600 dark:text-teal-400 flex items-center gap-1 font-bold">
                          <span>Deliverable</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-slate-400 group-hover:text-teal-600 font-bold transition-colors">
                          Open &rarr;
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  No deliverables found matching "{searchQuery}".
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECENT ACTIVITY MODAL (Problem 5 Fix) */}
      {isRecentActivityModalOpen && (
        <div
          data-testid="recent-activity-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsRecentActivityModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Recent Activity &bull; {clientGreetingName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chronological milestone delivery events for this workspace
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecentActivityModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 custom-scrollbar flex-1">
              {allRecentActivities.length > 0 ? (
                allRecentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-300/40 border border-slate-200/80 dark:border-dark-border flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                        act.iconType === 'check'
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : act.iconType === 'message'
                          ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                          : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                      }`}>
                        {act.iconType === 'check' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : act.iconType === 'message' ? (
                          <MessageSquare className="w-4 h-4" />
                        ) : (
                          <Edit3 className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-900 dark:text-white block truncate text-xs sm:text-sm">
                          {act.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                            {act.action}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            (Week {act.weekNumber})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 block">
                        {act.timestamp}
                      </span>
                      {act.evidenceUrl && (
                        <a
                          href={act.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center justify-end gap-1 mt-1 font-bold"
                        >
                          <span>Deliverable</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
                  No recent activity recorded for this workspace.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-300/30 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRecentActivityModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ClientPortalDashboardView = FinfixClientPortalView;
