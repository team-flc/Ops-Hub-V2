export type Priority = 'urgent' | 'high' | 'normal' | 'low';

export type StatusCategory = 'todo' | 'inprogress' | 'done' | 'blocked';

export interface StatusConfig {
  id: string;
  label: string;
  color: string; // Tailwind color or hex
  category: StatusCategory;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assigneeId?: string;
  dueDate?: string;
}

export interface TimeLog {
  id: string;
  userId: string;
  userName: string;
  durationMinutes: number;
  description: string;
  createdAt: string;
  billable?: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
  reactions?: { emoji: string; count: number; users: string[] }[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  type: 'status' | 'priority' | 'assignee' | 'comment' | 'time' | 'subtask' | 'general';
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'currency' | 'dropdown' | 'date' | 'progress';
  options?: string[];
}

export interface Task {
  id: string;
  taskNumber: string; // e.g. "OPS-101"
  title: string;
  description: string;
  status: string; // matches StatusConfig.id
  priority: Priority;
  spaceId: string;
  folderId?: string;
  listId: string;
  assigneeIds: string[];
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  subtasks: Subtask[];
  tags: string[];
  customFields: {
    slaStatus?: 'within_sla' | 'at_risk' | 'breached';
    clientName?: string;
    department?: string;
    budget?: number;
    cost?: number;
    riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
    [key: string]: any;
  };
  timeLogs: TimeLog[];
  comments: Comment[];
  activityLogs: ActivityLog[];
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  dependencies?: {
    blockedBy?: string[];
    blocking?: string[];
  };
  attachments?: Attachment[];
}

export interface List {
  id: string;
  spaceId: string;
  folderId?: string;
  name: string;
  color?: string;
  icon?: string;
  description?: string;
}

export interface Folder {
  id: string;
  spaceId: string;
  name: string;
  icon?: string;
  color?: string;
  lists: List[];
}

export interface Space {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  statuses: StatusConfig[];
  folders: Folder[];
  lists: List[];
}

export type UserRole = 'owner' | 'operational_manager' | 'team_member' | 'client';
export type AccountStatus = 'active' | 'inactive' | 'suspended';

export const STAFF_ROLES: readonly UserRole[] = ['owner', 'operational_manager', 'team_member'] as const;
export const CLIENT_ROLES: readonly UserRole[] = ['client'] as const;

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  owner: 'Owner',
  operational_manager: 'Operational Manager',
  team_member: 'Team Member',
  client: 'Client'
};

export const isStaffRole = (role?: string): role is 'owner' | 'operational_manager' | 'team_member' => {
  return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);
};

export const isClientRole = (role?: string): role is 'client' => {
  return role === 'client';
};

export interface Department {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'archived';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Designation {
  id: string;
  name: string;
  status: 'active' | 'archived';
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileDepartment {
  profileId: string;
  departmentId: string;
  departmentName?: string;
  createdAt: string;
}

export interface ProfileClientAccess {
  profileId: string;
  clientId: string;
  clientName?: string;
  grantedBy?: string | null;
  createdAt: string;
}

export interface TeamMemberRecord {
  id: string;
  fullName: string;
  workEmail: string;
  phone?: string | null;
  role: UserRole;
  status: AccountStatus;
  designationId?: string | null;
  designationName?: string;
  reportingManagerId?: string | null;
  reportingManagerName?: string;
  startDate: string;
  suspendedAt?: string | null;
  suspendedBy?: string | null;
  departments: Department[];
  clientAccessCount: number;
  clientIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName?: string;
  targetUserId: string;
  targetUserName?: string;
  action: string;
  safeChanges: Record<string, any>;
  createdAt: string;
}

export interface UserProfile {
  id: string; // UUID references auth.users
  email?: string;
  workEmail?: string;
  fullName: string;
  phone?: string | null;
  backupPhone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
  contactEmail?: string | null;
  role: UserRole;
  status: AccountStatus;
  designationId?: string | null;
  designationName?: string;
  reportingManagerId?: string | null;
  reportingManagerName?: string;
  startDate?: string;
  suspendedAt?: string | null;
  suspendedBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  previousStatus?: string | null;
  organizationId?: string | null;
  departmentIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'Ops Director' | 'Operations Lead' | 'Ops Specialist' | 'Support Lead' | 'Logistics Coordinator';
  department: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  initials: string;
}

export interface SOPDocument {
  id: string;
  title: string;
  category: string;
  spaceId?: string;
  content: string;
  authorId: string;
  authorName: string;
  tags: string[];
  version: string;
  updatedAt: string;
  starred?: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: 'STATUS_CHANGE' | 'PRIORITY_URGENT' | 'CHECKLIST_COMPLETE' | 'TASK_CREATED' | 'SLA_BREACH';
  triggerValue?: string;
  actions: {
    type: 'CHANGE_STATUS' | 'ASSIGN_USER' | 'ADD_TAG' | 'SEND_NOTIFICATION' | 'SET_SLA_RISK';
    value: any;
  }[];
  enabled: boolean;
  executionCount: number;
  lastExecutedAt?: string;
}

export interface ClientVendor {
  id: string;
  name: string;
  type: 'client' | 'vendor' | 'partner';
  contactPerson: string;
  email: string;
  phone: string;
  slaTier: string;
  status: 'active' | 'pending' | 'review';
  activeContracts: number;
  monthlyValue: string;
  notes: string;
}

export type ViewMode =
  | 'list'
  | 'board'
  | 'calendar'
  | 'timeline'
  | 'table'
  | 'dashboard'
  | 'docs'
  | 'directory'
  | 'clients'
  | 'client_workspace'
  | 'automations'
  | 'settings'
  | 'profile'
  | 'employee_dashboard'
  | 'employee_operations'
  | 'employee_dossier';

export type SettingsTab = 'team' | 'clients' | 'templates' | 'archive' | 'audit';

export type GroupByOption = 'status' | 'priority' | 'assignee' | 'dueDate' | 'none';

export interface FilterState {
  searchQuery: string;
  priorityFilter: Priority | 'all';
  statusFilter: string | 'all';
  assigneeFilter: string | 'all';
  tagFilter: string | 'all';
  slaFilter: string | 'all';
  groupBy: GroupByOption;
}

// --- PHASE 2B: CLIENT MANAGEMENT TYPES ---
export type ClientPackage = 'Basic' | 'Intermediate' | 'Advanced';
export type ClientStatus = 'Onboarding' | 'Active' | 'Paused' | 'Archived';
export type ClientPauseReason = 'Payment overdue' | 'Client request' | 'Operational reason' | 'Other';
export type ClientLinkType =
  | 'website'
  | 'google_drive'
  | 'facebook'
  | 'instagram'
  | 'linkedin_company_page'
  | 'slack_channel'
  | 'whatsapp_group';

export interface ClientLink {
  id?: string;
  clientId: string;
  linkType: ClientLinkType;
  url: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientLinkedInProfile {
  id: string;
  clientId: string;
  profileLabel: string;
  profileUrl: string;
  salesNavigatorActive: boolean;
  salesNavigatorActivatedOn?: string | null;
  sortOrder: number;
  status: 'active' | 'archived';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface LinkedInReadiness {
  totalAdded: number;
  requiredCount: number;
  salesNavActiveCount: number;
  isProfileCountComplete: boolean;
  isSalesNavComplete: boolean;
  isComplete: boolean;
  statusText: string;
  summaryLabel: string;
}

export interface ClientRecord {
  id: string;
  companyName: string;
  clientName: string;
  businessBio?: string | null;
  industry?: string | null;
  logoUrl?: string | null;
  package: ClientPackage;
  operationalManagerId: string;
  operationalManagerName?: string;
  activationDate: string;
  status: ClientStatus;
  previousStatus?: string | null;
  pauseReason?: ClientPauseReason | null;
  requiredLinkedinProfileCount: number;
  linkedinProfiles?: ClientLinkedInProfile[];
  sourceClientId?: string | null;
  sourceCompanyName?: string | null;
  links: Partial<Record<ClientLinkType, string>>;
  assignedTeamMemberIds?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
}

export interface ClientAuditEntry {
  id: string;
  clientId?: string;
  linkedinProfileId?: string;
  actorId?: string;
  actorName?: string;
  action: string;
  changedField?: string;
  previousValue?: string;
  newValue?: string;
  safeMetadata?: Record<string, any>;
  createdAt: string;
}

// --- PHASE 3A & 3B: OPERATIONAL TASK MANAGEMENT & REVIEW TYPES ---
export type ClientTaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type ClientTaskStatus =
  | 'Draft'
  | 'Assigned'
  | 'In Progress'
  | 'Blocked'
  | 'Team Review'
  | 'Client Review'
  | 'Completed';

export type TaskApprovalMode = 'Internal Only' | 'Client Approval Required';
export type TaskMessageVisibility = 'internal_note' | 'shared_with_client';

export interface TaskExternalLink {
  url: string;
  title?: string;
}

export interface TaskMessage {
  id: string;
  taskId: string;
  clientId: string;
  authorId: string;
  authorName?: string;
  authorRole?: string;
  visibility: TaskMessageVisibility;
  content: string;
  links: TaskExternalLink[];
  createdAt: string;
}

export interface TaskReadState {
  id: string;
  taskId: string;
  profileId: string;
  lastReadAt: string;
  updatedAt: string;
}

export interface ClientTask {
  id: string;
  clientId: string;
  weekNumber: 1 | 2 | 3 | 4;
  title: string;
  details?: string | null;
  departmentId: string;
  departmentName?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
  assigneeRole?: string | null;
  isAssigneeEligible?: boolean;
  priority: ClientTaskPriority;
  plannedStart: string;
  dueDate: string;
  status: ClientTaskStatus;
  approvalMode?: TaskApprovalMode;
  completedAt?: string | null;
  completedBy?: string | null;
  completedByName?: string | null;
  reopenedAt?: string | null;
  reopenedBy?: string | null;
  reopenedByName?: string | null;
  reopenReason?: string | null;
  blockedReason?: string | null;
  sortOrder: number;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  isOverdue?: boolean;
  sourceTemplateId?: string | null;
  sourceTemplateVersion?: number | null;
  planId?: string | null;
  planWeek?: number | null;
  occurrenceId?: string | null;
  launchBatchId?: string | null;
  unreadCount?: number;
  hasUnread?: boolean;
}

// --- PHASE 3C: TASK TEMPLATES SYSTEM TYPES ---
export type TaskTemplateStatus = 'Active' | 'Archived';

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string | null;
  departmentId: string;
  departmentName?: string;
  defaultTaskTitle: string;
  taskDetails?: string | null;
  defaultPriority: ClientTaskPriority;
  defaultApprovalMode: TaskApprovalMode;
  suggestedDurationDays: number;
  status: TaskTemplateStatus;
  sortOrder: number;
  version: number;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskTemplateInput {
  name: string;
  description?: string;
  departmentId: string;
  defaultTaskTitle: string;
  taskDetails?: string;
  defaultPriority?: ClientTaskPriority;
  defaultApprovalMode?: TaskApprovalMode;
  suggestedDurationDays?: number;
  sortOrder?: number;
}

export interface UpdateTaskTemplateInput {
  name?: string;
  description?: string;
  departmentId?: string;
  defaultTaskTitle?: string;
  taskDetails?: string;
  defaultPriority?: ClientTaskPriority;
  defaultApprovalMode?: TaskApprovalMode;
  suggestedDurationDays?: number;
  sortOrder?: number;
  expectedVersion?: number;
}

// --- PHASE 3D: MULTI-TASK SERVICE TEMPLATES & 90-DAY WORK PLANS ---
export interface ServiceTemplateTask {
  id?: string;
  definitionId: string;
  title: string;
  description?: string | null;
  departmentId: string;
  departmentName?: string;
  priority: ClientTaskPriority;
  approvalMode: TaskApprovalMode;
  plannedOffsetDays: number;
  durationBusinessDays: number;
  displayOrder: number;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  serviceLabel: string;
  description?: string | null;
  status: TaskTemplateStatus;
  version: number;
  sortOrder: number;
  tasks: ServiceTemplateTask[];
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceTemplateInput {
  name: string;
  serviceLabel: string;
  description?: string;
  tasks: Omit<ServiceTemplateTask, 'id'>[];
}

export interface UpdateServiceTemplateInput {
  name?: string;
  serviceLabel?: string;
  description?: string;
  tasks?: Omit<ServiceTemplateTask, 'id'>[];
  expectedVersion?: number;
}

export type WorkPlanStatus = 'Draft' | 'Launched' | 'Archived';

export interface WorkPlanOccurrence {
  occurrenceId: string;
  templateId: string;
  templateName: string;
  serviceLabel: string;
  templateVersion: number;
  tasks: ServiceTemplateTask[];
}

export interface WorkPlanWeek {
  weekNumber: number; // 1..13
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  occurrences: WorkPlanOccurrence[];
  customTasks: ServiceTemplateTask[];
}

export interface ClientWorkPlan {
  id: string;
  clientId: string;
  name: string;
  status: WorkPlanStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (startDate + 89 days)
  revision: number;
  weeks: WorkPlanWeek[];
  launchSnapshot?: any;
  launchedAt?: string | null;
  launchedBy?: string | null;
  launchBatchId?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLaunchBatchResult {
  success: boolean;
  batchId?: string;
  taskCount?: number;
  taskIds?: string[];
  error?: string;
  idempotentReplay?: boolean;
}

export interface ClientTaskEvent {
  id: string;
  taskId: string;
  clientId: string;
  actorId?: string | null;
  actorName?: string | null;
  eventType:
    | 'created'
    | 'field_updated'
    | 'assigned'
    | 'reassigned'
    | 'status_changed'
    | 'blocked'
    | 'unblocked'
    | 'submitted_for_review'
    | 'review_returned'
    | 'changes_requested'
    | 'client_review_submitted'
    | 'client_approved'
    | 'client_changes_requested'
    | 'completed'
    | 'reopened'
    | 'archived'
    | 'restored';
  previousState?: any;
  newState?: any;
  notes?: string | null;
  createdAt: string;
}

// --- PHASE 3A.1: SYSTEM AUDIT & ARCHIVE TYPES ---
export type AuditEntityType =
  | 'client'
  | 'team_member'
  | 'task'
  | 'profile'
  | 'client_link'
  | 'linkedin_profile'
  | 'department'
  | 'designation'
  | 'task_template';

export type AuditEventAction =
  | 'user_created'
  | 'user_updated'
  | 'user_suspended'
  | 'user_reactivated'
  | 'user_archived'
  | 'user_restored'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'profile_updated'
  | 'avatar_updated'
  | 'client_access_granted'
  | 'client_access_revoked'
  | 'client_created'
  | 'client_updated'
  | 'client_paused'
  | 'client_resumed'
  | 'client_archived'
  | 'client_restored'
  | 'client_duplicated'
  | 'client_logo_updated'
  | 'client_links_updated'
  | 'task_created'
  | 'task_updated'
  | 'task_assigned'
  | 'task_reassigned'
  | 'task_status_changed'
  | 'task_archived'
  | 'task_restored'
  | 'template_created'
  | 'template_updated'
  | 'template_duplicated'
  | 'template_archived'
  | 'template_restored'
  | 'task_created_from_template';

export interface SystemAuditEvent {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: AuditEventAction | string;
  entityType: AuditEntityType | string;
  entityId: string;
  entityName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  previousState?: Record<string, any> | null;
  newState?: Record<string, any> | null;
  reason?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface ArchivedRecord {
  id: string;
  entityType: 'client' | 'team_member' | 'task';
  entityName: string;
  clientId?: string | null;
  clientName?: string | null;
  archivedBy?: string | null;
  archivedByName?: string | null;
  archivedAt: string;
  archiveReason: string;
  previousStatus: string;
  metadata?: Record<string, any> | null;
}

// ==============================================================================
// CLIENT EXPERIENCE PORTAL TYPES
// ==============================================================================

export interface ClientPortalRecipient {
  id: string;
  clientId: string;
  profileId?: string | null;
  email: string;
  fullName: string;
  status: 'active' | 'revoked';
  lastSignInAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPublishedResult {
  id: string;
  clientId: string;
  metricName: string;
  metricValue: string;
  metricDefinition: string;
  reportingPeriod: string;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  source: string;
  publishedAt: string;
  publishedBy?: string | null;
  status: 'published' | 'archived';
}

export type PortalDateRangePreset = 'this_week' | 'this_month' | 'last_month' | 'custom';

export interface PortalDateRange {
  preset: PortalDateRangePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string;
}

export interface ClientDeliverableItem {
  id: string;
  title: string;
  url: string;
  taskId: string;
  taskTitle: string;
  departmentName: string;
  sharedAt: string;
}

export interface ClientRoadmapMilestone {
  id: string;
  title: string;
  weekNumber: number;
  status: 'completed' | 'in_progress' | 'upcoming';
  plannedStart: string;
  dueDate: string;
  completedAt?: string | null;
  taskCount: number;
  completedTaskCount: number;
}

export interface ClientPortalOverviewData {
  client: ClientRecord;
  factualSummary: string;
  completedInPeriodCount: number;
  inProgressCount: number;
  needsInputCount: number;
  upcomingCount: number;
  publishedResults: ClientPublishedResult[];
  publishedDeliverablesRatio: { completed: number; total: number };
}

// ==============================================================================
// EMPLOYEE OPERATIONS SYSTEM TYPES
// ==============================================================================

export type EmploymentType = 'full_time' | 'part_time' | 'contractor' | 'contract' | 'intern' | 'probation';
export type EmploymentStatus = 'active' | 'inactive' | 'probation' | 'resigned' | 'terminated' | 'suspended';

export interface WorkShift {
  id: string;
  name: string;
  code: string;
  startTime: string; // HH:mm:ss
  endTime: string; // HH:mm:ss
  crossesMidnight: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyWorkSchedule {
  id: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null;
  workingDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat (Sunday=0/7)
  description?: string;
  createdAt: string;
  createdBy?: string | null;
}

export interface EmployeeRecord {
  id: string; // maps 1:1 to profile.id
  employeeId?: string | null;
  employmentType: EmploymentType;
  dateOfBirth?: string | null; // YYYY-MM-DD
  salary: number; // Gross monthly salary in PKR
  jobDescription?: string | null;
  shiftId?: string | null;
  shift?: WorkShift | null;
  customCheckInTime?: string | null; // HH:mm
  customCheckOutTime?: string | null; // HH:mm
  employmentStatus: EmploymentStatus;
  sopAcknowledged: boolean;
  sopAcknowledgedAt?: string | null;
  sopVersion?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type AttendanceStatus = 'on_time' | 'present' | 'late' | 'absent' | 'incomplete' | 'early_checkout' | 'corrected';
export type AttendanceEvidenceType = 'screen_capture' | 'manual_upload';

export interface EmployeeAttendance {
  id: string;
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  shiftId?: string | null;
  shift?: WorkShift | null;
  scheduledCheckIn: string;
  scheduledCheckOut: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status: AttendanceStatus;
  minutesLate: number;
  lateDeduction: number; // PKR 500 when late
  absenceDeduction: number; // Monthly salary / actual month calendar days
  checkInScreenshotPath?: string | null;
  checkOutScreenshotPath?: string | null;
  screenCaptureUrl?: string | null;
  checkInEvidenceType?: AttendanceEvidenceType | null;
  checkOutEvidenceType?: AttendanceEvidenceType | null;
  checkInMetadata?: any;
  checkOutMetadata?: any;
  totalHours?: number;
  workMode?: string;
  earlyCheckoutReason?: string | null;
  earlyCheckoutStatus?: 'pending_review' | 'approved' | 'warning_issued' | 'deduction_applied' | null;
  correctionReason?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AssetStatus = 'assigned' | 'receipt_pending' | 'received' | 'returned' | 'damaged' | 'lost' | 'available';

export interface CompanyAsset {
  id: string;
  employeeId: string;
  assignedTo?: string;
  itemName: string;
  assetName?: string;
  assetTag?: string;
  serialNumber?: string;
  category?: string;
  condition?: string;
  issueDate: string; // YYYY-MM-DD
  price: number;
  replacementValue?: number;
  status: AssetStatus;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  returnDate?: string | null;
  damageLossReason?: string | null;
  damageLossEvidenceUrl?: string | null;
  financialRecoveryApproved: boolean;
  financialRecoveryAmount: number;
  recoveryPayrollPeriod?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface EmployeeBankDetails {
  id: string;
  employeeId: string;
  bankName: string;
  accountTitle: string;
  accountNumberOrIban: string;
  accountNumber?: string;
  iban?: string;
  branchCode?: string;
  status: 'active' | 'pending_change' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface EmployeeProfileChangeRequest {
  id: string;
  employeeId: string;
  requestType: 'profile_details' | 'bank_details' | 'contact_info' | 'emergency_contact' | 'bank_info' | 'tax_info';
  requestedChanges: Record<string, any>;
  currentValues?: Record<string, any> | null;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PayrollStatus = 'Draft' | 'Under Review' | 'Approved' | 'Paid' | 'Concern Raised' | 'draft' | 'under_review' | 'approved' | 'paid' | 'concern_raised';

export interface EmployeePayrollRecord {
  id: string;
  employeeId: string;
  payrollPeriod: string; // YYYY-MM
  payrollMonth?: string;
  grossSalary: number;
  baseSalary?: number;
  lateDeductionsTotal: number;
  lateDeductions?: number;
  absenceDeductionsTotal: number;
  unapprovedAbsenceDeductions?: number;
  manualAdjustmentsTotal: number;
  bonuses?: number;
  allowances?: number;
  otherAdjustments?: number;
  assetRecoveryDeduction: number;
  assetDeductions?: number;
  netPayable: number;
  scheduledPaymentDate: string; // YYYY-MM-DD (15th of next month)
  status: PayrollStatus;
  paymentProofPath?: string | null;
  paymentProofUrl?: string | null;
  paymentDate?: string | null;
  paidAt?: string | null;
  paidBy?: string | null;
  managementNotes?: string | null;
  notes?: string | null;
  concernNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type PerformanceRecordType = 
  | 'goal' 
  | 'achievement' 
  | 'incident_coaching' 
  | 'incident'
  | 'coaching'
  | 'commendation'
  | 'warning' 
  | 'salary_hike' 
  | 'contract_document' 
  | 'status_change' 
  | 'exit_settlement';

export interface EmployeePerformanceRecord {
  id: string;
  employeeId: string;
  recordType: PerformanceRecordType;
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  documentUrl?: string | null;
  previousSalary?: number | null;
  newSalary?: number | null;
  rating?: number | null;
  actionPlan?: string | null;
  status: 'active' | 'acknowledged' | 'resolved' | 'cancelled';
  concernStatus: 'none' | 'concern_raised' | 'concern_resolved' | 'concern_rejected';
  concernText?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

export type EmployeeTaskType = 
  | 'missing_checkin_60m' 
  | 'early_checkout_review' 
  | 'missing_checkout' 
  | 'employee_concern' 
  | 'profile_change_request' 
  | 'payroll_approval' 
  | 'asset_review';

export interface EmployeeManagementTask {
  id: string;
  taskType: EmployeeTaskType;
  employeeId: string;
  employeeName?: string;
  title: string;
  description?: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'completed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  referenceId?: string | null;
  assignedTo?: string | null;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeFinalSettlement {
  id: string;
  employeeId: string;
  lastWorkingDate: string; // YYYY-MM-DD
  noticePeriodStatus: 'served' | 'waived' | 'short' | 'not_served';
  pendingEarnedSalary: number;
  currentAccruedAmount: number;
  approvedDeductions: number;
  assetClearanceStatus: 'pending' | 'cleared' | 'charges_applied';
  finalPayableAmount: number;
  netFinalPayable?: number | null;
  separationReason?: string | null;
  paymentProofPath?: string | null;
  status: 'draft' | 'under_review' | 'approved' | 'settled';
  settledAt?: string | null;
  settledBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeFullDossier {
  profile: UserProfile;
  employeeRecord: EmployeeRecord | null;
  record?: EmployeeRecord | null;
  bankDetails: EmployeeBankDetails | null;
  attendanceHistory: EmployeeAttendance[];
  attendance?: EmployeeAttendance[];
  assets: CompanyAsset[];
  payrollRecords: EmployeePayrollRecord[];
  payroll?: EmployeePayrollRecord[];
  performanceRecords: EmployeePerformanceRecord[];
  performance?: EmployeePerformanceRecord[];
  changeRequests: EmployeeProfileChangeRequest[];
  tasks: EmployeeManagementTask[];
  settlement: EmployeeFinalSettlement | null;
}


