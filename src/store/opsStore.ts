import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  Task, Space, User, SOPDocument, AutomationRule, ClientVendor, 
  ViewMode, FilterState, Priority, Subtask
} from '../types';
import { 
  INITIAL_USERS, INITIAL_SPACES, INITIAL_TASKS, 
  INITIAL_DOCS, INITIAL_AUTOMATIONS, INITIAL_CLIENTS_VENDORS 
} from './initialData';
import { supabaseService } from '../lib/supabaseService';

interface ActiveTimer {
  taskId: string;
  taskTitle: string;
  startTime: number; // Date.now() timestamp
  elapsedSeconds: number;
}

interface OpsStore {
  // Navigation & Hierarchy
  spaces: Space[];
  activeSpaceId: string | null; // null means 'All Spaces / Everything'
  activeFolderId: string | null;
  activeListId: string | null;
  setActiveSelection: (spaceId: string | null, folderId?: string | null, listId?: string | null) => void;
  createSpace: (name: string, icon: string, color: string, description: string) => void;
  updateSpace: (id: string, updates: Partial<Space>) => void;
  deleteSpace: (id: string) => void;
  createFolder: (spaceId: string, name: string) => void;
  createList: (spaceId: string, folderId: string | undefined, name: string, color?: string) => void;
  deleteList: (listId: string) => void;

  // Tasks
  tasks: Task[];
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  createTask: (taskData: Partial<Task>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTaskStatus: (taskId: string, newStatus: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtask: (taskId: string, title: string, assigneeId?: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  addComment: (taskId: string, content: string) => void;
  addTimeLog: (taskId: string, durationMinutes: number, description: string, billable?: boolean) => void;

  // Active Timer
  activeTimer: ActiveTimer | null;
  startTimer: (taskId: string) => void;
  stopTimer: () => void;

  // SOPs / Docs
  docs: SOPDocument[];
  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;
  createDoc: (title: string, category: string, content: string, tags: string[], spaceId?: string) => SOPDocument;
  updateDoc: (id: string, updates: Partial<SOPDocument>) => void;
  deleteDoc: (id: string) => void;
  toggleStarDoc: (id: string) => void;

  // Automations
  automations: AutomationRule[];
  toggleAutomation: (id: string) => void;
  createAutomation: (rule: Omit<AutomationRule, 'id' | 'executionCount'>) => void;
  deleteAutomation: (id: string) => void;
  runAutomationsForTask: (trigger: 'STATUS_CHANGE' | 'PRIORITY_URGENT' | 'CHECKLIST_COMPLETE' | 'TASK_CREATED', task: Task) => void;

  // Clients & Vendors
  clientsVendors: ClientVendor[];
  createClientVendor: (cv: Omit<ClientVendor, 'id'>) => void;
  updateClientVendor: (id: string, updates: Partial<ClientVendor>) => void;
  deleteClientVendor: (id: string) => void;

  // Phase 2B Clients
  clients: import('../types').ClientRecord[];
  selectedClientId: string | null;
  setClients: (clients: import('../types').ClientRecord[]) => void;
  setSelectedClientId: (id: string | null) => void;
  addClientRecord: (client: import('../types').ClientRecord) => void;
  updateClientRecord: (client: import('../types').ClientRecord) => void;

  // Users & Current User
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;

  // Views & Filtering
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  filter: FilterState;
  setFilter: (updates: Partial<FilterState>) => void;
  resetFilter: () => void;

  // UI Modals & Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isCreateTaskModalOpen: boolean;
  setCreateTaskModalOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isNewSpaceModalOpen: boolean;
  setNewSpaceModalOpen: (open: boolean) => void;
  isNewListModalOpen: boolean;
  setNewListModalOpen: (open: boolean) => void;
  isAutomationsModalOpen: boolean;
  setAutomationsModalOpen: (open: boolean) => void;

  // Utility
  resetToDemoData: () => void;
  exportDataAsJSON: () => string;
  importDataFromJSON: (jsonString: string) => boolean;
}

const DEFAULT_FILTER: FilterState = {
  searchQuery: '',
  priorityFilter: 'all',
  statusFilter: 'all',
  assigneeFilter: 'all',
  tagFilter: 'all',
  slaFilter: 'all',
  groupBy: 'status'
};

export const useOpsStore = create<OpsStore>()(
  persist(
    (set, get) => ({
      // State
      spaces: INITIAL_SPACES,
      activeSpaceId: null, // null = All Spaces
      activeFolderId: null,
      activeListId: null,
      tasks: INITIAL_TASKS,
      selectedTaskId: null,
      activeTimer: null,
      docs: INITIAL_DOCS,
      selectedDocId: INITIAL_DOCS[0]?.id || null,
      automations: INITIAL_AUTOMATIONS,
      clientsVendors: INITIAL_CLIENTS_VENDORS,
      clients: [],
      selectedClientId: null,
      users: INITIAL_USERS,
      currentUser: INITIAL_USERS[0],
      viewMode: 'list',
      filter: DEFAULT_FILTER,
      sidebarCollapsed: false,
      isCreateTaskModalOpen: false,
      isCommandPaletteOpen: false,
      isNewSpaceModalOpen: false,
      isNewListModalOpen: false,
      isAutomationsModalOpen: false,

      // Navigation
      setActiveSelection: (spaceId, folderId = null, listId = null) => {
        set({ activeSpaceId: spaceId, activeFolderId: folderId, activeListId: listId });
      },

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      createSpace: (name, icon, color, description) => {
        const newSpace: Space = {
          id: `space-${Date.now()}`,
          name,
          icon: icon || 'Folder',
          color: color || '#6366f1',
          description,
          statuses: [
            { id: 'todo', label: 'To Do', color: '#94a3b8', category: 'todo' },
            { id: 'in_progress', label: 'In Progress', color: '#3b82f6', category: 'inprogress' },
            { id: 'under_review', label: 'Review', color: '#8b5cf6', category: 'inprogress' },
            { id: 'blocked', label: 'Blocked', color: '#ef4444', category: 'blocked' },
            { id: 'completed', label: 'Completed', color: '#10b981', category: 'done' }
          ],
          folders: [],
          lists: [
            { id: `list-${Date.now()}`, spaceId: `space-${Date.now()}`, name: 'General Queue', color }
          ]
        };
        set((state) => ({ spaces: [...state.spaces, newSpace], activeSpaceId: newSpace.id }));
      },

      updateSpace: (id, updates) => {
        set((state) => ({
          spaces: state.spaces.map((s) => (s.id === id ? { ...s, ...updates } : s))
        }));
      },

      deleteSpace: (id) => {
        set((state) => ({
          spaces: state.spaces.filter((s) => s.id !== id),
          tasks: state.tasks.filter((t) => t.spaceId !== id),
          activeSpaceId: state.activeSpaceId === id ? null : state.activeSpaceId
        }));
      },

      createFolder: (spaceId, name) => {
        const folderId = `folder-${Date.now()}`;
        set((state) => ({
          spaces: state.spaces.map((s) => {
            if (s.id !== spaceId) return s;
            return {
              ...s,
              folders: [
                ...s.folders,
                {
                  id: folderId,
                  spaceId,
                  name,
                  lists: [
                    { id: `list-${Date.now()}`, spaceId, folderId, name: 'Default List', color: s.color }
                  ]
                }
              ]
            };
          })
        }));
      },

      createList: (spaceId, folderId, name, color) => {
        const newListId = `list-${Date.now()}`;
        set((state) => ({
          spaces: state.spaces.map((s) => {
            if (s.id !== spaceId) return s;
            if (folderId) {
              return {
                ...s,
                folders: s.folders.map((f) => {
                  if (f.id !== folderId) return f;
                  return {
                    ...f,
                    lists: [...f.lists, { id: newListId, spaceId, folderId, name, color: color || s.color }]
                  };
                })
              };
            } else {
              return {
                ...s,
                lists: [...s.lists, { id: newListId, spaceId, name, color: color || s.color }]
              };
            }
          }),
          activeListId: newListId
        }));
      },

      deleteList: (listId) => {
        set((state) => ({
          spaces: state.spaces.map((s) => ({
            ...s,
            lists: s.lists.filter((l) => l.id !== listId),
            folders: s.folders.map((f) => ({
              ...f,
              lists: f.lists.filter((l) => l.id !== listId)
            }))
          })),
          tasks: state.tasks.filter((t) => t.listId !== listId),
          activeListId: state.activeListId === listId ? null : state.activeListId
        }));
      },

      // Tasks
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),

      createTask: (taskData) => {
        const nextNum = Math.floor(100 + Math.random() * 900);
        const currentSpaceId = taskData.spaceId || get().activeSpaceId || get().spaces[0]?.id || 'space-1';
        const currentListId = taskData.listId || get().activeListId || get().spaces.find(s => s.id === currentSpaceId)?.lists[0]?.id || 'list-1';

        const newTask: Task = {
          id: `task-${Date.now()}`,
          taskNumber: `OPS-${nextNum}`,
          title: taskData.title || 'Untitled Operations Task',
          description: taskData.description || '',
          status: taskData.status || 'todo',
          priority: taskData.priority || 'normal',
          spaceId: currentSpaceId,
          folderId: taskData.folderId || get().activeFolderId || undefined,
          listId: currentListId,
          assigneeIds: taskData.assigneeIds || [get().currentUser.id],
          dueDate: taskData.dueDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          startDate: taskData.startDate || new Date().toISOString().split('T')[0],
          estimatedHours: taskData.estimatedHours || 2,
          subtasks: taskData.subtasks || [],
          tags: taskData.tags || ['Operations'],
          customFields: {
            slaStatus: 'within_sla',
            riskLevel: 'Low',
            ...taskData.customFields
          },
          timeLogs: [],
          comments: [],
          activityLogs: [
            {
              id: `act-${Date.now()}`,
              userId: get().currentUser.id,
              userName: get().currentUser.name,
              action: `Created task "${taskData.title || 'Untitled'}"`,
              timestamp: new Date().toISOString(),
              type: 'general'
            }
          ],
          order: get().tasks.length + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        set((state) => ({ tasks: [newTask, ...state.tasks] }));
        get().runAutomationsForTask('TASK_CREATED', newTask);
        supabaseService.upsertTask(newTask);
        return newTask;
      },

      updateTask: (id, updates) => {
        const prevTask = get().tasks.find((t) => t.id === id);
        if (!prevTask) return;

        const updatedTask: Task = {
          ...prevTask,
          ...updates,
          updatedAt: new Date().toISOString(),
          activityLogs: [
            ...prevTask.activityLogs,
            {
              id: `act-${Date.now()}`,
              userId: get().currentUser.id,
              userName: get().currentUser.name,
              action: updates.status && updates.status !== prevTask.status 
                ? `Changed status to "${updates.status.replace('_', ' ').toUpperCase()}"`
                : updates.priority && updates.priority !== prevTask.priority
                ? `Changed priority to "${updates.priority.toUpperCase()}"`
                : 'Updated task details',
              timestamp: new Date().toISOString(),
              type: updates.status ? 'status' : updates.priority ? 'priority' : 'general'
            }
          ]
        };

        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? updatedTask : t))
        }));

        supabaseService.upsertTask(updatedTask);

        if (updates.status && updates.status !== prevTask.status) {
          get().runAutomationsForTask('STATUS_CHANGE', updatedTask);
        }
        if (updates.priority === 'urgent' && prevTask.priority !== 'urgent') {
          get().runAutomationsForTask('PRIORITY_URGENT', updatedTask);
        }
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId
        }));
        supabaseService.deleteTask(id);
      },

      moveTaskStatus: (taskId, newStatus) => {
        get().updateTask(taskId, {
          status: newStatus,
          completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined
        });
      },

      toggleSubtask: (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;

        const updatedSubtasks = task.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );

        const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every((st) => st.completed);

        get().updateTask(taskId, {
          subtasks: updatedSubtasks,
          ...(allCompleted && task.status !== 'completed' ? { status: 'completed', completedAt: new Date().toISOString() } : {})
        });

        if (allCompleted) {
          get().runAutomationsForTask('CHECKLIST_COMPLETE', { ...task, subtasks: updatedSubtasks });
        }
      },

      addSubtask: (taskId, title, assigneeId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        const newSubtask: Subtask = {
          id: `st-${Date.now()}`,
          title,
          completed: false,
          assigneeId
        };
        get().updateTask(taskId, {
          subtasks: [...task.subtasks, newSubtask]
        });
      },

      deleteSubtask: (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        get().updateTask(taskId, {
          subtasks: task.subtasks.filter((st) => st.id !== subtaskId)
        });
      },

      addComment: (taskId, content) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task || !content.trim()) return;
        const newComment = {
          id: `comment-${Date.now()}`,
          userId: get().currentUser.id,
          userName: get().currentUser.name,
          userAvatar: get().currentUser.avatar,
          content,
          createdAt: new Date().toISOString()
        };
        get().updateTask(taskId, {
          comments: [...task.comments, newComment]
        });
      },

      addTimeLog: (taskId, durationMinutes, description, billable = false) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task || durationMinutes <= 0) return;
        const newLog = {
          id: `timelog-${Date.now()}`,
          userId: get().currentUser.id,
          userName: get().currentUser.name,
          durationMinutes,
          description: description || 'Work on task',
          createdAt: new Date().toISOString(),
          billable
        };
        get().updateTask(taskId, {
          timeLogs: [newLog, ...task.timeLogs]
        });
      },

      // Live Timer
      startTimer: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        set({
          activeTimer: {
            taskId: task.id,
            taskTitle: task.title,
            startTime: Date.now(),
            elapsedSeconds: 0
          }
        });
      },

      stopTimer: () => {
        const timer = get().activeTimer;
        if (!timer) return;
        const totalMinutes = Math.max(1, Math.round((Date.now() - timer.startTime) / 60000));
        get().addTimeLog(timer.taskId, totalMinutes, `Timer recorded: ${totalMinutes}m`);
        set({ activeTimer: null });
      },

      // SOPs / Docs
      setSelectedDocId: (id) => set({ selectedDocId: id }),

      createDoc: (title, category, content, tags, spaceId) => {
        const newDoc: SOPDocument = {
          id: `doc-${Date.now()}`,
          title,
          category: category || 'General SOPs',
          spaceId: spaceId || get().activeSpaceId || undefined,
          content: content || '# ' + title + '\n\nWrite SOP details here...',
          authorId: get().currentUser.id,
          authorName: get().currentUser.name,
          tags: tags || ['SOP'],
          version: '1.0',
          updatedAt: new Date().toISOString(),
          starred: false
        };
        set((state) => ({
          docs: [newDoc, ...state.docs],
          selectedDocId: newDoc.id
        }));
        return newDoc;
      },

      updateDoc: (id, updates) => {
        set((state) => ({
          docs: state.docs.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          )
        }));
      },

      deleteDoc: (id) => {
        set((state) => ({
          docs: state.docs.filter((d) => d.id !== id),
          selectedDocId: state.selectedDocId === id ? (state.docs[0]?.id || null) : state.selectedDocId
        }));
      },

      toggleStarDoc: (id) => {
        set((state) => ({
          docs: state.docs.map((d) => (d.id === id ? { ...d, starred: !d.starred } : d))
        }));
      },

      // Automations
      toggleAutomation: (id) => {
        set((state) => ({
          automations: state.automations.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled } : a
          )
        }));
      },

      createAutomation: (rule) => {
        const newRule: AutomationRule = {
          ...rule,
          id: `auto-${Date.now()}`,
          executionCount: 0
        };
        set((state) => ({ automations: [...state.automations, newRule] }));
      },

      deleteAutomation: (id) => {
        set((state) => ({ automations: state.automations.filter((a) => a.id !== id) }));
      },

      runAutomationsForTask: (trigger, task) => {
        const activeRules = get().automations.filter((a) => a.enabled && a.trigger === trigger);
        if (activeRules.length === 0) return;

        let modifiedTask = { ...task };
        const executedRuleIds: string[] = [];

        activeRules.forEach((rule) => {
          executedRuleIds.push(rule.id);
          rule.actions.forEach((action) => {
            if (action.type === 'ASSIGN_USER') {
              if (!modifiedTask.assigneeIds.includes(action.value)) {
                modifiedTask.assigneeIds = [...modifiedTask.assigneeIds, action.value];
              }
            } else if (action.type === 'CHANGE_STATUS') {
              modifiedTask.status = action.value;
              if (action.value === 'completed') {
                modifiedTask.completedAt = new Date().toISOString();
              }
            } else if (action.type === 'ADD_TAG') {
              if (!modifiedTask.tags.includes(action.value)) {
                modifiedTask.tags = [...modifiedTask.tags, action.value];
              }
            } else if (action.type === 'SET_SLA_RISK') {
              modifiedTask.customFields = {
                ...modifiedTask.customFields,
                riskLevel: action.value
              };
            }
          });
        });

        // Update task and automation execution counters
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === task.id ? modifiedTask : t)),
          automations: state.automations.map((a) =>
            executedRuleIds.includes(a.id)
              ? { ...a, executionCount: a.executionCount + 1, lastExecutedAt: new Date().toISOString() }
              : a
          )
        }));
      },

      // Clients & Vendors
      createClientVendor: (cv) => {
        const newCv: ClientVendor = {
          ...cv,
          id: `cv-${Date.now()}`
        };
        set((state) => ({ clientsVendors: [...state.clientsVendors, newCv] }));
        supabaseService.upsertClientVendor(newCv);
      },

      updateClientVendor: (id, updates) => {
        const prev = get().clientsVendors.find((c) => c.id === id);
        if (!prev) return;
        const updated = { ...prev, ...updates };
        set((state) => ({
          clientsVendors: state.clientsVendors.map((c) => (c.id === id ? updated : c))
        }));
        supabaseService.upsertClientVendor(updated);
      },

      deleteClientVendor: (id) => {
        set((state) => ({ clientsVendors: state.clientsVendors.filter((c) => c.id !== id) }));
        supabaseService.deleteClientVendor(id);
      },

      // Phase 2B Clients Actions
      setClients: (clients) => set({ clients }),
      setSelectedClientId: (id) => set({ selectedClientId: id }),
      addClientRecord: (client) =>
        set((state) => ({
          clients: [client, ...state.clients.filter((c) => c.id !== client.id)],
          selectedClientId: client.id
        })),
      updateClientRecord: (client) =>
        set((state) => ({
          clients: state.clients.map((c) => (c.id === client.id ? client : c))
        })),

      // Users
      setCurrentUser: (user) => set({ currentUser: user }),

      // View & Filters
      setViewMode: (mode) => set({ viewMode: mode }),
      setFilter: (updates) => set((state) => ({ filter: { ...state.filter, ...updates } })),
      resetFilter: () => set({ filter: DEFAULT_FILTER }),

      // Modals
      setCreateTaskModalOpen: (open) => set({ isCreateTaskModalOpen: open }),
      setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
      setNewSpaceModalOpen: (open) => set({ isNewSpaceModalOpen: open }),
      setNewListModalOpen: (open) => set({ isNewListModalOpen: open }),
      setAutomationsModalOpen: (open) => set({ isAutomationsModalOpen: open }),

      // Demo & Backup Utilities
      resetToDemoData: () => {
        set({
          spaces: INITIAL_SPACES,
          tasks: INITIAL_TASKS,
          docs: INITIAL_DOCS,
          automations: INITIAL_AUTOMATIONS,
          clientsVendors: INITIAL_CLIENTS_VENDORS,
          users: INITIAL_USERS,
          currentUser: INITIAL_USERS[0],
          activeSpaceId: null,
          activeFolderId: null,
          activeListId: null,
          activeTimer: null,
          selectedTaskId: null
        });
      },

      exportDataAsJSON: () => {
        const state = get();
        const exportObj = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          spaces: state.spaces,
          tasks: state.tasks,
          docs: state.docs,
          automations: state.automations,
          clientsVendors: state.clientsVendors,
          users: state.users
        };
        return JSON.stringify(exportObj, null, 2);
      },

      importDataFromJSON: (jsonString: string) => {
        try {
          const parsed = JSON.parse(jsonString);
          if (!parsed.spaces || !parsed.tasks) return false;
          set({
            spaces: parsed.spaces || INITIAL_SPACES,
            tasks: parsed.tasks || INITIAL_TASKS,
            docs: parsed.docs || INITIAL_DOCS,
            automations: parsed.automations || INITIAL_AUTOMATIONS,
            clientsVendors: parsed.clientsVendors || INITIAL_CLIENTS_VENDORS,
            users: parsed.users || INITIAL_USERS
          });
          return true;
        } catch {
          return false;
        }
      }
    }),
    {
      name: 'opshub_v2_storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        spaces: state.spaces,
        tasks: state.tasks,
        docs: state.docs,
        automations: state.automations,
        clientsVendors: state.clientsVendors,
        users: state.users,
        currentUser: state.currentUser,
        viewMode: state.viewMode,
        sidebarCollapsed: state.sidebarCollapsed
      })
    }
  )
);
