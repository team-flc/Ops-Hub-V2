import React, { useState, useEffect } from 'react';
import { Calendar, Info, Plus, Sparkles, Loader2, Layers } from 'lucide-react';
import { 
  ClientRecord, 
  ClientTask, 
  ClientTaskStatus, 
  Department, 
  UserProfile 
} from '../../types';
import { SelectedClientHeader } from './SelectedClientHeader';
import { ClientDetailsTab } from './ClientDetailsTab';
import { ClientTaskCard } from '../tasks/ClientTaskCard';
import { CreateClientTaskModal } from '../tasks/CreateClientTaskModal';
import { EditClientTaskModal } from '../tasks/EditClientTaskModal';
import { ClientTaskDetailsModal } from '../tasks/ClientTaskDetailsModal';
import { taskManagementService } from '../../lib/taskManagementService';

interface ClientWorkspaceViewProps {
  client: ClientRecord;
  currentUserProfile?: UserProfile | null;
  eligibleManagers: UserProfile[];
  onClientUpdated: (updated: ClientRecord) => void;
}

type MainTab = 'setup' | 'details';
type WeekTab = 'week1' | 'week2' | 'week3' | 'week4';

export const ClientWorkspaceView: React.FC<ClientWorkspaceViewProps> = ({
  client,
  currentUserProfile,
  eligibleManagers,
  onClientUpdated
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('setup');
  const [activeWeek, setActiveWeek] = useState<WeekTab>('week1');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Phase 3A Tasks State
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Departments & Eligible Assignees
  const [departments, setDepartments] = useState<Department[]>([]);
  const [eligibleAssignees, setEligibleAssignees] = useState<UserProfile[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<ClientTask | null>(null);

  const isOwnerOrManager = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';

  const weekTabs: { id: WeekTab; weekNum: 1 | 2 | 3 | 4; label: string }[] = [
    { id: 'week1', weekNum: 1, label: 'Week 1' },
    { id: 'week2', weekNum: 2, label: 'Week 2' },
    { id: 'week3', weekNum: 3, label: 'Week 3' },
    { id: 'week4', weekNum: 4, label: 'Week 4' }
  ];

  const currentWeekNum = weekTabs.find((w) => w.id === activeWeek)?.weekNum || 1;

  // Load Departments & Eligible Assignees on mount
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const [depts, assignees] = await Promise.all([
          taskManagementService.fetchDepartments(),
          taskManagementService.fetchEligibleAssignees(client.id)
        ]);
        if (isMounted) {
          setDepartments(depts);
          setEligibleAssignees(assignees);
        }
      } catch (err) {
        console.warn('Failed to load task metadata:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [client.id]);

  // Fetch Tasks for the selected week
  const loadTasks = async () => {
    if (!client.id) return;
    setIsLoadingTasks(true);
    setTasksError(null);
    try {
      const res = await taskManagementService.fetchClientTasks(client.id, currentWeekNum);
      if (res.error) {
        setTasksError(res.error);
      } else {
        setTasks(res.data);
      }
    } catch (err: any) {
      setTasksError(err?.message || 'Failed to load tasks.');
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [client.id, currentWeekNum]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTaskCreated = (newTask: ClientTask) => {
    setTasks((prev) => [newTask, ...prev]);
    showToast(`Task "${newTask.title}" created successfully.`);
  };

  const handleTaskUpdated = (updatedTask: ClientTask) => {
    setTasks((prev) => {
      if (updatedTask.archivedAt) {
        return prev.filter((t) => t.id !== updatedTask.id);
      }
      return prev.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    });

    if (selectedTaskDetails?.id === updatedTask.id) {
      setSelectedTaskDetails(updatedTask.archivedAt ? null : updatedTask);
    }
    showToast(`Task updated successfully.`);
  };

  const handleStatusChange = async (task: ClientTask, newStatus: ClientTaskStatus, reason?: string) => {
    try {
      const res = await taskManagementService.updateStatus(task.id, newStatus, reason);
      if (res.error) {
        showToast(`Status update failed: ${res.error}`);
      } else {
        const updated: ClientTask = {
          ...task,
          status: newStatus,
          blockedReason: newStatus === 'Blocked' ? (reason || null) : null
        };
        handleTaskUpdated(updated);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status.');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-gray-50/50 dark:bg-dark-400 select-none">
      {/* 1. Selected Client Top Header */}
      <SelectedClientHeader client={client} />

      {/* 2. Top-Level Tab Navigation (30-Day Setup and Client Details only) */}
      <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'setup'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>30-Day Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'details'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Client Details</span>
          </button>
        </div>
      </div>

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold shadow-2xl border border-gray-700/30">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 3. Main Tab Content */}
      <div className="flex-1 min-w-0">
        {/* TAB 1: 30-DAY SETUP WORKSPACE */}
        {activeTab === 'setup' && (
          <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* 4 Clean Weekly Tabs (Week 1, Week 2, Week 3, Week 4) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {weekTabs.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setActiveWeek(w.id)}
                  className={`py-3 px-4 rounded-xl text-center border transition-all ${
                    activeWeek === w.id
                      ? 'bg-brand-500/10 border-brand-500/40 text-brand-600 dark:text-brand-400 font-bold shadow-sm'
                      : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-dark-200'
                  }`}
                >
                  <span className="text-xs uppercase tracking-wider">{w.label}</span>
                </button>
              ))}
            </div>

            {/* Selected Week Task List Area */}
            <div className="space-y-4">
              {/* Header Action Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Week {currentWeekNum} Tasks ({tasks.length})
                  </span>
                  {isLoadingTasks && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />}
                </div>

                {isOwnerOrManager && (
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Task</span>
                  </button>
                )}
              </div>

              {/* Tasks Content */}
              {tasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tasks.map((task) => (
                    <ClientTaskCard
                      key={task.id}
                      task={task}
                      currentUserProfile={currentUserProfile}
                      onSelectTask={(t) => setSelectedTaskDetails(t)}
                      onOpenEditModal={(t) => setEditingTask(t)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              ) : (
                /* Clean Empty State when no tasks exist (single + Add Task button remains in top-right header) */
                <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-12 shadow-sm min-h-[240px] flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/20">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      No Operational Tasks in Week {currentWeekNum}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      Create operational checklists and deliverables for Week {currentWeekNum} setup using the + Add Task button above.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CLIENT DETAILS */}
        {activeTab === 'details' && (
          <ClientDetailsTab
            client={client}
            currentUserProfile={currentUserProfile}
            eligibleManagers={eligibleManagers}
            onClientUpdated={onClientUpdated}
          />
        )}
      </div>

      {/* Modals */}
      <CreateClientTaskModal
        key={`create-modal-week-${currentWeekNum}`}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleTaskCreated}
        client={client}
        weekNumber={currentWeekNum}
        departments={departments}
        eligibleAssignees={eligibleAssignees}
      />

      {editingTask && (
        <EditClientTaskModal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onSuccess={handleTaskUpdated}
          task={editingTask}
          departments={departments}
        />
      )}

      {selectedTaskDetails && (
        <ClientTaskDetailsModal
          isOpen={Boolean(selectedTaskDetails)}
          onClose={() => setSelectedTaskDetails(null)}
          task={selectedTaskDetails}
          currentUserProfile={currentUserProfile}
          departments={departments}
          eligibleAssignees={eligibleAssignees}
          onTaskUpdated={handleTaskUpdated}
          onOpenEditModal={(t) => setEditingTask(t)}
        />
      )}
    </div>
  );
};
