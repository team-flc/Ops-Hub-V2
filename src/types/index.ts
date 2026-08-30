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

export interface UserProfile {
  id: string; // UUID references auth.users
  email?: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  organizationId?: string | null;
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
  | 'automations';

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
