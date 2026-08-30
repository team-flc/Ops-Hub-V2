import { supabase, isSupabaseConfigured } from './supabase';
import { Task, Space, SOPDocument, AutomationRule, ClientVendor, User } from '../types';

export function mapDbTaskToTask(dbRow: any): Task {
  return {
    id: dbRow.id,
    taskNumber: dbRow.task_number || dbRow.taskNumber || 'OPS-000',
    title: dbRow.title,
    description: dbRow.description || '',
    status: dbRow.status || 'todo',
    priority: dbRow.priority || 'normal',
    spaceId: dbRow.space_id || dbRow.spaceId || 'space-1',
    folderId: dbRow.folder_id || dbRow.folderId || undefined,
    listId: dbRow.list_id || dbRow.listId || 'list-1',
    assigneeIds: Array.isArray(dbRow.assignee_ids) ? dbRow.assignee_ids : [],
    dueDate: dbRow.due_date || dbRow.dueDate || undefined,
    startDate: dbRow.start_date || dbRow.startDate || undefined,
    estimatedHours: Number(dbRow.estimated_hours || dbRow.estimatedHours || 0),
    subtasks: Array.isArray(dbRow.subtasks) ? dbRow.subtasks : [],
    tags: Array.isArray(dbRow.tags) ? dbRow.tags : [],
    customFields: dbRow.custom_fields || dbRow.customFields || {},
    timeLogs: Array.isArray(dbRow.time_logs) ? dbRow.time_logs : [],
    comments: Array.isArray(dbRow.comments) ? dbRow.comments : [],
    activityLogs: Array.isArray(dbRow.activity_logs) ? dbRow.activity_logs : [],
    order: dbRow.order_index || dbRow.order || 0,
    createdAt: dbRow.created_at || new Date().toISOString(),
    updatedAt: dbRow.updated_at || new Date().toISOString(),
    completedAt: dbRow.completed_at || undefined
  };
}

export function mapDbClientToClient(dbRow: any): ClientVendor {
  return {
    id: dbRow.id,
    name: dbRow.name,
    type: dbRow.type || 'client',
    contactPerson: dbRow.contact_person || dbRow.contactPerson || '',
    email: dbRow.email || '',
    phone: dbRow.phone || '',
    slaTier: dbRow.sla_tier || dbRow.slaTier || 'Standard',
    status: dbRow.status || 'active',
    activeContracts: Number(dbRow.active_contracts || dbRow.activeContracts || 1),
    monthlyValue: dbRow.monthly_value || dbRow.monthlyValue || '',
    notes: dbRow.notes || ''
  };
}

export const supabaseService = {
  isConfigured: () => isSupabaseConfigured,

  // Fetch all operational data
  async fetchAllData() {
    if (!supabase) return null;

    try {
      const [
        { data: spaces },
        { data: tasks },
        { data: docs },
        { data: automations },
        { data: clients },
        { data: users }
      ] = await Promise.all([
        supabase.from('spaces').select('*'),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('sop_documents').select('*'),
        supabase.from('automation_rules').select('*'),
        supabase.from('clients_vendors').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('*')
      ]);

      const mappedTasks = tasks ? tasks.map(mapDbTaskToTask) : null;
      const mappedClients = clients ? clients.map(mapDbClientToClient) : null;

      return {
        spaces: (spaces && spaces.length > 0) ? (spaces as Space[]) : null,
        tasks: mappedTasks,
        docs: (docs && docs.length > 0) ? (docs as SOPDocument[]) : null,
        automations: (automations && automations.length > 0) ? (automations as AutomationRule[]) : null,
        clientsVendors: mappedClients,
        users: (users && users.length > 0) ? (users as User[]) : null
      };
    } catch (error) {
      console.warn('Supabase fetch error, fallback to local cache:', error);
      return null;
    }
  },

  // Task CRUD
  async upsertTask(task: Task) {
    if (!supabase) return;
    try {
      await supabase.from('tasks').upsert({
        id: task.id,
        task_number: task.taskNumber,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        space_id: task.spaceId,
        folder_id: task.folderId || null,
        list_id: task.listId,
        assignee_ids: task.assigneeIds || [],
        due_date: task.dueDate || null,
        start_date: task.startDate || null,
        estimated_hours: task.estimatedHours || 0,
        subtasks: task.subtasks || [],
        tags: task.tags || [],
        custom_fields: task.customFields || {},
        time_logs: task.timeLogs || [],
        comments: task.comments || [],
        activity_logs: task.activityLogs || [],
        order_index: task.order || 0,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error syncing task to Supabase:', err);
    }
  },

  async deleteTask(taskId: string) {
    if (!supabase) return;
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
    } catch (err) {
      console.error('Error deleting task on Supabase:', err);
    }
  },

  // Client CRUD
  async upsertClientVendor(cv: ClientVendor) {
    if (!supabase) return;
    try {
      await supabase.from('clients_vendors').upsert({
        id: cv.id,
        name: cv.name,
        type: cv.type,
        contact_person: cv.contactPerson,
        email: cv.email,
        phone: cv.phone,
        sla_tier: cv.slaTier,
        status: cv.status,
        active_contracts: cv.activeContracts,
        monthly_value: cv.monthlyValue,
        notes: cv.notes,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error syncing client to Supabase:', err);
    }
  },

  async deleteClientVendor(id: string) {
    if (!supabase) return;
    try {
      await supabase.from('clients_vendors').delete().eq('id', id);
    } catch (err) {
      console.error('Error deleting client from Supabase:', err);
    }
  },

  // Realtime Subscriptions
  subscribeToTasks(onUpdate: (payload: any) => void) {
    if (!supabase) return () => {};

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  },

  subscribeToClients(onUpdate: (payload: any) => void) {
    if (!supabase) return () => {};

    const channel = supabase
      .channel('clients-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients_vendors' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }
};
