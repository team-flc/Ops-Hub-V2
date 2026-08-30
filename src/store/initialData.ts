import { Space, User, Task, SOPDocument, AutomationRule, ClientVendor } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Atif Khan',
    email: 'atif@faseehlall.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Ops Director',
    department: 'Operations & Strategy',
    status: 'online',
    initials: 'AK'
  }
];

export const INITIAL_SPACES: Space[] = [
  {
    id: 'space-ops-1',
    name: 'Marketing & Operations',
    icon: 'Layers',
    color: '#e62e43', // Brand Crimson
    description: 'Primary workspace for marketing campaigns, client deliverables, and team operations.',
    statuses: [
      { id: 'todo', label: 'To Do', color: '#94a3b8', category: 'todo' },
      { id: 'in_progress', label: 'In Progress', color: '#e62e43', category: 'inprogress' },
      { id: 'under_review', label: 'Under Review', color: '#f59e0b', category: 'inprogress' },
      { id: 'blocked', label: 'Blocked', color: '#ef4444', category: 'blocked' },
      { id: 'completed', label: 'Completed', color: '#10b981', category: 'done' }
    ],
    folders: [],
    lists: [
      { id: 'list-ops-active', spaceId: 'space-ops-1', name: 'Active Tasks Queue', color: '#e62e43' },
      { id: 'list-ops-backlog', spaceId: 'space-ops-1', name: 'Backlog & Ideas', color: '#64748b' }
    ]
  }
];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_DOCS: SOPDocument[] = [];

export const INITIAL_AUTOMATIONS: AutomationRule[] = [];

export const INITIAL_CLIENTS_VENDORS: ClientVendor[] = [];
