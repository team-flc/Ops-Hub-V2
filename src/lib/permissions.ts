import { UserProfile, ClientTask } from '../types';

/**
 * Role & Designation Permission Matrix
 * Enforces strict operational governance across Ops Hub.
 *
 * Rules:
 * 1. Interns see neither Add Client nor Add Task anywhere in the app.
 * 2. Add Client: ONLY Owner/Founder, Manager, and Team Leads.
 * 3. Add Task: ONLY decision makers (Team Lead, Team Manager, Owner/Founder, CFO).
 */

export function isIntern(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  const desig = (profile.designationName || '').toLowerCase().trim();
  const role = (profile.role || '').toLowerCase().trim();
  return desig.includes('intern') || role.includes('intern');
}

export function canAddClient(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.role === 'client') return false;

  // Interns must NOT see or execute Add Client
  if (isIntern(profile)) return false;

  // Owner/Founder and Operational Manager
  if (
    profile.role === 'owner' ||
    profile.role === 'operational_manager' ||
    (profile.role as string) === 'admin' ||
    (profile.role as string) === 'manager'
  ) {
    return true;
  }

  // Team Leads (designation-based check for team_member role)
  const desig = (profile.designationName || '').toLowerCase().trim();
  if (
    desig.includes('team lead') ||
    desig.includes('lead') ||
    desig.includes('team manager') ||
    desig.includes('manager') ||
    desig.includes('founder') ||
    desig.includes('owner') ||
    desig.includes('head')
  ) {
    return true;
  }

  return false;
}

export function canAddTask(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.role === 'client') return false;

  // Interns must NOT see or execute Add Task
  if (isIntern(profile)) return false;

  // Decision makers: Owner/Founder, Manager, CFO
  if (
    profile.role === 'owner' ||
    profile.role === 'operational_manager' ||
    (profile.role as string) === 'admin' ||
    (profile.role as string) === 'cfo' ||
    (profile.role as string) === 'manager'
  ) {
    return true;
  }

  // Decision makers: Team Lead, Team Manager, Owner/Founder, CFO, Director, Head
  const desig = (profile.designationName || '').toLowerCase().trim();
  if (
    desig.includes('team lead') ||
    desig.includes('lead') ||
    desig.includes('team manager') ||
    desig.includes('manager') ||
    desig.includes('cfo') ||
    desig.includes('chief financial officer') ||
    desig.includes('founder') ||
    desig.includes('owner') ||
    desig.includes('head') ||
    desig.includes('director') ||
    desig.includes('decision maker')
  ) {
    return true;
  }

  return false;
}

/**
 * Whitelist of link keys that a client is permitted to view in client view, preview, or client sidebar.
 * All internal links (Google Drive, GoHighLevel, Slack, WhatsApp, POC WhatsApp, POC Email,
 * Proposal / Contract, Important Documents, Master Business Document) are strictly restricted
 * to staff (Owner and Manager).
 */
export const CLIENT_PERMITTED_LINK_KEYS = new Set<string>([
  'website',
  'flc_landing_page',
  'brand_identity',
  'static_creatives',
  'videos',
  'variations',
  'grid',
  'vsl',
  'testimonials',
  'reviews',
  'case_studies',
  'requirement_docs',
  'social_media_management',
  'linkedin_management',
  'seo_management',
  'email_marketing_management',
  'paid_ads_management',
  'linkedin_company_page',
  'facebook',
  'instagram'
]);

/**
 * Checks if a URL points to an internal tool, messaging invite, or exposes raw Drive/Sheets IDs.
 */
export function isInternalOrSensitiveUrl(url?: string | null): boolean {
  if (!url) return false;
  const u = url.toLowerCase().trim();
  return (
    u.includes('slack.com') ||
    u.includes('whatsapp.com') ||
    u.includes('chat.whatsapp.com') ||
    u.includes('wa.me') ||
    u.includes('gohighlevel.com') ||
    u.includes('leadconnectorhq.com') ||
    u.includes('drive.google.com') ||
    u.includes('docs.google.com') ||
    /id=[a-zA-Z0-9_-]{15,}/.test(url) ||
    /\/d\/[a-zA-Z0-9_-]{15,}/.test(url) ||
    /\/folders\/[a-zA-Z0-9_-]{15,}/.test(url)
  );
}

/**
 * Strips Google Drive, Google Sheets, Slack, WhatsApp, and GoHighLevel URLs and raw Drive/Sheets IDs.
 */
export function sanitizeEvidenceUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (isInternalOrSensitiveUrl(url)) {
    return undefined;
  }
  return url.trim();
}

/**
 * Checks if title contains financial or internal operational words.
 */
export function isFinancialOrInternalTitle(title: string = ''): boolean {
  const t = title.toLowerCase();
  return (
    /pkr\s*[\d,]+|invoice|payment|billing|fee|\$[\d,]+|salary|payroll|profit|margin|internal chat|gmail notes/i.test(t) ||
    t.includes('zain se') ||
    t.includes('login/hosting') ||
    t.includes('approve karo') ||
    t.includes('asset bank ke baad') ||
    t.includes('sales navigator')
  );
}

/**
 * Sanitizes operational/internal/financial task titles for client presentation.
 */
export function sanitizeClientDeliverableTitle(title: string = ''): string {
  if (!title) return 'Client Deliverable';
  let t = title.trim();

  // Clean up Maven ICP final -> Ideal Customer Profile (ICP) Strategy
  if (/maven\s+icp\s+final/i.test(t) || /icp\s+final/i.test(t) || /maven\s+icp/i.test(t)) {
    return 'Ideal Customer Profile (ICP) Strategy';
  }

  // Purely operational reminders / shift chatter
  if (/^remind\s+/i.test(t) || (/shift\b/i.test(t) && /remind/i.test(t))) {
    return 'Operations Workflow Coordination';
  }

  // Strip financial references (e.g., PKR 18,300 or $5,000)
  t = t.replace(/pkr\s*[\d,]+(\.\d+)?/gi, '').replace(/\$[\d,]+(\.\d+)?/g, '').trim();

  // Strip invoice / payment / billing if left over
  t = t.replace(/\b(invoice\s+payment|invoice|payment|billing|fee)\b/gi, '').trim();

  // Clean internal phrases and chatter
  t = t.replace(/\b(kahan se aaya|remind\s+[\w\s]+shift|internal\s+ops|approve karo|asset bank ke baad|login\/hosting|zain se|sales navigator)\b/gi, '').trim();

  // Remove leading/trailing punctuation and whitespace
  t = t.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();

  return t || 'Client Deliverable';
}

/**
 * Detects whether a task is strictly internal-only and should never be visible to clients.
 * Rules:
 * 1. Explicit internal flag (isInternalOnly === true)
 * 2. Explicit approvalMode === 'Internal Only'
 * 3. Title contains invoice, billing, payment, fee, salary, payroll, internal admin, or operational chat
 */
export function isInternalOnlyTask(task: {
  title?: string;
  approvalMode?: string;
  isInternalOnly?: boolean;
}): boolean {
  if (!task) return false;
  if (task.isInternalOnly) return true;
  if (task.approvalMode === 'Internal Only') return true;

  const t = (task.title || '').toLowerCase().trim();
  if (
    /invoice|billing|payment|salary|payroll|pkr\s*[\d,]+|\$[\d,]+|\bfee\b|internal\s+admin|admin\s+task|internal\s+ops|gmail\s+notes|internal\s+chat/i.test(t)
  ) {
    return true;
  }

  return false;
}

/**
 * Returns a human-readable categorization reason for why a task is shielded from client views.
 */
export function getInternalTaskReason(task: {
  title?: string;
  approvalMode?: string;
  isInternalOnly?: boolean;
}): string | null {
  if (!task) return null;
  if (task.isInternalOnly) return 'Marked as Internal Only';
  if (task.approvalMode === 'Internal Only') return 'Approval Mode: Internal Only';
  const t = (task.title || '').toLowerCase().trim();
  if (/invoice|billing|payment|fee/i.test(t)) return 'Financial / Invoice / Billing';
  if (/salary|payroll/i.test(t)) return 'Staff Payroll / Salary';
  if (/pkr\s*[\d,]+|\$[\d,]+/i.test(t)) return 'Financial figures in title';
  if (/internal\s+admin|admin\s+task|internal\s+ops/i.test(t)) return 'Internal Administration';
  if (/gmail\s+notes|internal\s+chat/i.test(t)) return 'Internal notes / chatter';
  if (t.includes('sales navigator')) return 'Sales Navigator credentials';
  if (t.includes('login/hosting') || t.includes('zain se') || t.includes('asset bank ke baad')) return 'Internal operational coordination';
  if (isInternalOnlyTask(task)) return 'Internal Operations Only';
  return null;
}

export function filterAndSanitizeClientDeliverables(tasks: ClientTask[]): ClientTask[] {
  return tasks
    .filter((t) => !t.archivedAt && !isInternalOnlyTask(t))
    .map((t) => ({
      ...t,
      title: sanitizeClientDeliverableTitle(t.title),
      details: undefined,
      completionNotes: undefined,
      feedback: undefined,
      blockedReason: undefined,
      reopenReason: undefined,
      archiveReason: undefined,
      timerStartedAt: null,
      timeSpentSeconds: undefined,
      pausedSeconds: undefined,
      assigneeId: undefined,
      assigneeName: undefined,
      assigneeAvatar: undefined,
      assigneeRole: undefined,
      assignee: undefined,
      evidenceUrl: sanitizeEvidenceUrl(t.evidenceUrl)
    }))
    .filter((t) => Boolean(t.title && t.title.trim()));
}
