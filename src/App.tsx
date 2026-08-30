import React, { useEffect } from 'react';
import { useOpsStore } from './store/opsStore';
import { supabaseService, mapDbTaskToTask } from './lib/supabaseService';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ListView } from './components/views/ListView';
import { BoardView } from './components/views/BoardView';
import { CalendarView } from './components/views/CalendarView';
import { TimelineView } from './components/views/TimelineView';
import { TableView } from './components/views/TableView';
import { DashboardView } from './components/views/DashboardView';
import { DocsView } from './components/views/DocsView';
import { OperationsDirectory } from './components/views/OperationsDirectory';
import { ClientsView } from './components/views/ClientsView';
import { TaskModal } from './components/tasks/TaskModal';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';
import { CommandPalette } from './components/layout/CommandPalette';
import { NewSpaceModal } from './components/spaces/NewSpaceModal';
import { NewListModal } from './components/spaces/NewListModal';
import { AutomationsModal } from './components/automations/AutomationsModal';

export const App: React.FC = () => {
  const viewMode = useOpsStore((state) => state.viewMode);

  // Sync with Supabase on mount and listen to realtime updates
  useEffect(() => {
    async function loadSupabase() {
      if (!supabaseService.isConfigured()) return;
      const data = await supabaseService.fetchAllData();
      if (data) {
        useOpsStore.setState((state) => ({
          tasks: data.tasks && data.tasks.length > 0 ? data.tasks : state.tasks,
          spaces: data.spaces && data.spaces.length > 0 ? data.spaces : state.spaces,
          docs: data.docs && data.docs.length > 0 ? data.docs : state.docs,
          automations: data.automations && data.automations.length > 0 ? data.automations : state.automations,
          clientsVendors: data.clientsVendors && data.clientsVendors.length > 0 ? data.clientsVendors : state.clientsVendors,
          users: data.users && data.users.length > 0 ? data.users : state.users
        }));
      }
    }

    loadSupabase();

    // Subscribe to realtime database changes (Tasks & Clients)
    const unsubTasks = supabaseService.subscribeToTasks((payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        const newTask = mapDbTaskToTask(payload.new);
        useOpsStore.setState((state) => {
          if (state.tasks.some((t) => t.id === newTask.id)) return state;
          return { tasks: [newTask, ...state.tasks] };
        });
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        const updatedTask = mapDbTaskToTask(payload.new);
        useOpsStore.setState((state) => ({
          tasks: state.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
        }));
      } else if (payload.eventType === 'DELETE' && payload.old) {
        useOpsStore.setState((state) => ({
          tasks: state.tasks.filter((t) => t.id !== payload.old.id)
        }));
      }
    });

    const unsubClients = supabaseService.subscribeToClients((payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        useOpsStore.setState((state) => {
          if (state.clientsVendors.some((c) => c.id === payload.new.id)) return state;
          return { clientsVendors: [payload.new, ...state.clientsVendors] };
        });
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        useOpsStore.setState((state) => ({
          clientsVendors: state.clientsVendors.map((c) => (c.id === payload.new.id ? payload.new : c))
        }));
      } else if (payload.eventType === 'DELETE' && payload.old) {
        useOpsStore.setState((state) => ({
          clientsVendors: state.clientsVendors.filter((c) => c.id !== payload.old.id)
        }));
      }
    });

    return () => {
      unsubTasks();
      unsubClients();
    };
  }, []);

  const renderActiveView = () => {
    switch (viewMode) {
      case 'list':
        return <ListView />;
      case 'board':
        return <BoardView />;
      case 'calendar':
        return <CalendarView />;
      case 'timeline':
        return <TimelineView />;
      case 'table':
        return <TableView />;
      case 'dashboard':
        return <DashboardView />;
      case 'docs':
        return <DocsView />;
      case 'directory':
        return <OperationsDirectory />;
      case 'clients':
        return <ClientsView />;
      default:
        return <ListView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-dark-400 text-gray-900 dark:text-gray-100 font-sans antialiased">
      {/* ClickUp 3.0 Left Sidebar */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header />

        {/* Dynamic Views Content Container */}
        <main className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-dark-400">
          {renderActiveView()}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <TaskModal />
      <CreateTaskModal />
      <CommandPalette />
      <NewSpaceModal />
      <NewListModal />
      <AutomationsModal />
    </div>
  );
};

export default App;
