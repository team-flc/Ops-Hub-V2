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
    t.includes('asset bank ke baad')
  );
}

/**
 * Sanitizes operational/internal/financial task titles for client presentation.
 */
export function sanitizeClientDeliverableTitle(title: string = ''): string {
  if (!title) return 'Client Deliverable';
  let t = title.trim();

  // 1. Direct high-precision mappings for known deliverable suites
  if (/statics?\s*\+\s*carousel/i.test(t)) {
    return 'Static Creatives & Carousel Assets';
  }
  if (/ads\s+live.*report/i.test(t) || /paid\s+ads.*report/i.test(t) || /paid\s+ads\s+strategic\s+plan/i.test(t)) {
    return 'Paid Ads Campaign Launch & Performance Report';
  }
  if (/linkedin.*assets.*optimize/i.test(t) || (/linkedin/i.test(t) && /optimize\s+karo/i.test(t))) {
    return 'LinkedIn Profile & Digital Assets Optimization';
  }
  if (/icp\s+final/i.test(t) || /icp\/offer/i.test(t) || /pehli\s+audience/i.test(t) || /icp.*strategy/i.test(t)) {
    return 'Ideal Customer Profile (ICP) Strategy';
  }
  if (/video\s+approval/i.test(t) || /vsl\s+video/i.test(t) || /animation\s+style/i.test(t) || /reference\s+video/i.test(t)) {
    return 'Promotional Video Asset Review';
  }
  if (/setup\s+clean\/organize/i.test(t) || /organize.*drive.*socials/i.test(t)) {
    return 'Workspace Organization & Social Channels Setup';
  }
  if (/9-post\s+grid|grid\s+doc/i.test(t)) {
    return 'Social Media Grid Strategy & Designs';
  }
  if (/variations/i.test(t)) {
    return 'Creative & Copy Variations Planning';
  }
  if (/vsl\s+script/i.test(t)) {
    return 'Video Sales Letter (VSL) Script';
  }
  if (/social\s+media\s+complete/i.test(t)) {
    return 'Social Media Management & Assets';
  }
  if (/asset\s+bank/i.test(t)) {
    return 'Digital Asset Bank Compilation';
  }
  if (/portfolio\s*\+\s*pricing/i.test(t)) {
    return 'Agency Portfolio & Service Offerings';
  }
  if (/booking\s+link|featured\s+section/i.test(t)) {
    return 'Booking Link & Featured Content Setup';
  }
  if (/learn\s+framework/i.test(t)) {
    return 'Client Strategy Framework Documentation';
  }
  if (/strategy\s+session/i.test(t)) {
    return 'Strategic Planning Session';
  }
  if (/procedure.*kaam\s+start/i.test(t)) {
    return 'Operations Onboarding & Kickoff';
  }
  if (/requirements\/proposals|mushahid.*mirza.*requirements/i.test(t)) {
    return 'Technical Requirements & Proposals Scoping';
  }
  if (/profile\s+pics/i.test(t) || /dp\s+redo/i.test(t)) {
    return 'Professional Profile Photography & Graphics';
  }
  if (/ghl\s+lifecycle/i.test(t) || /active\s+calendars/i.test(t)) {
    return 'CRM & Calendar Automation Setup';
  }

  // 2. Purely operational reminders / shift chatter fallback
  if (/^remind\s+/i.test(t) || (/shift\b/i.test(t) && /remind/i.test(t)) || /yaad\s+dilao/i.test(t) || /prep:/i.test(t)) {
    return 'Operations Workflow Coordination';
  }

  // 3. Remove client prefixes like "Maven: ", "Maven prep: ", "Cloud ZTech: ", "PPC: ", etc.
  t = t.replace(/^(maven|cloud\s+ztech|bizease|ppc|solid\s+books|o2ocon|accelera\s+ops|axioware|danything|mirai\s+studios|wise360|finfix|pixel\s+algo)(\s+prep)?:?\s*/gi, '');

  // 4. Strip financial references (e.g., PKR 18,300 or $5,000)
  t = t.replace(/pkr\s*[\d,]+(\.\d+)?/gi, '').replace(/\$[\d,]+(\.\d+)?/g, '').trim();
  t = t.replace(/\b(invoice\s+payment|invoice|payment|billing|fee)\b/gi, '').trim();

  // 5. Strip raw filenames like (13-9-2026 Mp.mp4) or (firstlogin102@gmail.com)
  t = t.replace(/\([^\)]*\.(mp4|pdf|mov|png|jpg)[^\)]*\)/gi, '').trim();
  t = t.replace(/\([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\)/gi, '').trim();

  // 6. Strip staff names followed by particles or colons (e.g. "Haider se", "Faseeh ko", "Maaz:")
  t = t.replace(/\b(faseeh|haider|maaz|taha|zohaib|mushahid|mirza|shariq|latif|saad|atif|zain|jhanzaib|ahmad|umair|omer|abdulrauf|sana|mushtaq)\s*(se|ko|ne|ki|ka|ke|:)?\b/gi, '').trim();

  // 7. Strip internal process wording and Urdu directives
  t = t.replace(/\b(kahan se aaya|remind\s+[\w\s]+shift|internal\s+ops|approve karo|review karo|confirm karo|decide karo|verify karo|fix karo|update karo|expand karo|complete karo|start karo|optimize karo|asset bank ke baad|login\/hosting|zain se|confirmation lo|ready rakho|yaad dilao|karna ya nahi|verdicts do|go-ahead do|answers do|bhejo|banao|lo|do|prep|purana|delete)\b/gi, '').trim();

  // 8. Clean up punctuation, double spaces, and dashes
  t = t.replace(/^[-–—:\s/]+|[-–—:\s/]+$/g, '').trim();
  t = t.replace(/\s{2,}/g, ' ');

  // 9. Capitalize first letter of deliverable title
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }

  return t || 'Client Deliverable';
}

/**
 * Detects whether a task is strictly internal-only and should never be visible to clients.
 * Rules:
 * 1. Explicit internal flag (isInternalOnly === true)
 * 2. Operational shift chatter / reminders
 * 3. Title contains invoice, billing, payment, fee, salary, payroll, internal admin, or operational chat
 */
export function isInternalOnlyTask(task: {
  title?: string | null;
  details?: string | null;
  approvalMode?: string | null;
  isInternalOnly?: boolean | null;
  isClientVisible?: boolean | null;
  [key: string]: any;
}): boolean {
  if (!task) return false;
  if (task.isInternalOnly === true || (task as any).is_internal_only === true) return true;

  const t = (task.title || '').toLowerCase().trim();
  const d = (task.details || '').toLowerCase().trim();

  // Purely operational reminders / shift chatter
  if (
    /^remind\s+/i.test(t) ||
    (/shift\b/i.test(t) && /remind/i.test(t)) ||
    /yaad\s+dilao/i.test(t) ||
    /prep:/i.test(t) ||
    /remind.*shift/i.test(d) ||
    /faseeh ko yaad dilao/i.test(d) ||
    /shift ki baat kare/i.test(d)
  ) {
    return true;
  }

  // Internal housekeeping, draft deletions, file cleanup
  if (
    /purana.*draft.*delete|draft.*delete|delete.*draft|delete.*confirm|superseded.*draft/i.test(t) ||
    /purana.*draft.*delete|draft.*delete|delete.*draft|delete.*confirm|superseded.*draft/i.test(d)
  ) {
    return true;
  }

  // Financial references, invoices, salaries, internal operational chatter
  if (
    /invoice|billing|payment|salary|payroll|pkr\s*[\d,]+|\$[\d,]+|\bfee\b|internal\s+admin|admin\s+task|internal\s+ops|gmail\s+notes|internal\s+chat/i.test(t) ||
    t.includes('zain se') ||
    t.includes('login/hosting') ||
    t.includes('naam confirm karo') ||
    t.includes('chhota naming faisla') ||
    t.includes('trial: subscribe karna ya nahi') ||
    t.includes('faseeh one-liner do') ||
    t.includes('go-ahead do') ||
    t.includes('verdicts do') ||
    t.includes('answers do') ||
    t.startsWith('thu meeting:') ||
    t.startsWith('internal:') ||
    t.includes('discrepancy resolve karo') ||
    t.includes('rebuild commission karo') ||
    t.includes('deploy fail') ||
    t.includes('ci fail') ||
    t.includes('drive edit access') ||
    t.includes('whatsapp login lo') ||
    d.includes('faseeh bataye') ||
    d.includes('chhota naming faisla')
  ) {
    return true;
  }

  return false;
}

/**
 * Returns a human-readable categorization reason for why a task is shielded from client views.
 */
export function getInternalTaskReason(task: {
  title?: string | null;
  details?: string | null;
  approvalMode?: string | null;
  isInternalOnly?: boolean | null;
  isClientVisible?: boolean | null;
  [key: string]: any;
}): string | null {
  if (!task) return null;
  if (task.isInternalOnly || (task as any).is_internal_only) return 'Marked as Internal Only';
  const t = (task.title || '').toLowerCase().trim();
  const d = (task.details || '').toLowerCase().trim();
  if (/invoice|billing|payment|fee/i.test(t)) return 'Financial / Invoice / Billing';
  if (/salary|payroll/i.test(t)) return 'Staff Payroll / Salary';
  if (/pkr\s*[\d,]+|\$[\d,]+/i.test(t)) return 'Financial figures in title';
  if (/internal\s+admin|admin\s+task|internal\s+ops/i.test(t) || t.startsWith('internal:')) return 'Internal Administration';
  if (/gmail\s+notes|internal\s+chat/i.test(t)) return 'Internal notes / chatter';
  if (/remind.*shift/i.test(t) || /remind.*shift/i.test(d) || /shift ki baat kare/i.test(d)) return 'Staff Shift Reminder';
  if (/purana.*draft.*delete|draft.*delete|delete.*draft|delete.*confirm|superseded.*draft/i.test(t) || /purana.*draft.*delete|draft.*delete|delete.*draft|delete.*confirm|superseded.*draft/i.test(d)) {
    return 'Internal Housekeeping / Draft Archival';
  }
  if (t.startsWith('thu meeting:')) return 'Internal Staff Meeting';
  if (
    t.includes('confirm karo') ||
    t.includes('naam confirm karo') ||
    t.includes('decide karo') ||
    t.includes('verify karo') ||
    t.includes('faseeh bataye') ||
    t.includes('login/hosting') ||
    t.includes('zain se') ||
    t.includes('asset bank ke baad') ||
    d.includes('chhota naming faisla') ||
    d.includes('faseeh bataye')
  ) {
    return 'Internal Operations Coordination';
  }
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
