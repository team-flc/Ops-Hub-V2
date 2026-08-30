import React, { useState } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { 
  Activity, Truck, Headphones, Cpu, Users, Layers, 
  ChevronDown, ChevronRight, Plus, Folder, List as ListIcon, 
  BookOpen, Zap, Building2, BarChart3, Settings, ChevronsLeft, 
  ChevronsRight, ShieldCheck, Sparkles, Database, Trash2, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DISPLAY_NAMES } from '../../types';

const ICON_MAP: Record<string, any> = {
  Activity,
  Truck,
  Headphones,
  Cpu,
  Users,
  Layers,
  Folder
};

export const Sidebar: React.FC = () => {
  const spaces = useOpsStore((state) => state.spaces);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeFolderId = useOpsStore((state) => state.activeFolderId);
  const activeListId = useOpsStore((state) => state.activeListId);
  const setActiveSelection = useOpsStore((state) => state.setActiveSelection);
  const viewMode = useOpsStore((state) => state.viewMode);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const sidebarCollapsed = useOpsStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useOpsStore((state) => state.toggleSidebar);
  const setNewSpaceModalOpen = useOpsStore((state) => state.setNewSpaceModalOpen);
  const setNewListModalOpen = useOpsStore((state) => state.setNewListModalOpen);
  const setAutomationsModalOpen = useOpsStore((state) => state.setAutomationsModalOpen);
  const deleteSpace = useOpsStore((state) => state.deleteSpace);
  const deleteList = useOpsStore((state) => state.deleteList);
  const currentUser = useOpsStore((state) => state.currentUser);
  const tasks = useOpsStore((state) => state.tasks);
  const { signOut, profile, user } = useAuth();
  const displayName = profile?.fullName || user?.email?.split('@')[0] || currentUser.name || 'Team Member';
  const displayRole = profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'Team Member';
  const displayInitials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'FL';

  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({
    'space-1': true,
    'space-2': true,
    'space-3': true
  });
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'folder-1-1': true,
    'folder-2-1': true
  });

  const toggleSpaceExpand = (spaceId: string) => {
    setExpandedSpaces((prev) => ({ ...prev, [spaceId]: !prev[spaceId] }));
  };

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  if (sidebarCollapsed) {
    return (
      <aside className="w-16 bg-white dark:bg-dark-sidebar border-r border-gray-200 dark:border-dark-border h-screen flex flex-col items-center py-4 justify-between z-30 flex-shrink-0 select-none">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-gray-100 hover:scale-105 transition-transform"
            title="Expand Sidebar"
          >
            <img src="/logo.png" alt="Faseeh Lall Logo" className="w-8 h-8 object-contain" />
          </button>

          {/* Quick Icons */}
          <button
            type="button"
            onClick={() => {
              setActiveSelection(null);
              setViewMode('list');
            }}
            className={`p-2.5 rounded-xl transition-colors ${
              viewMode === 'list' && activeSpaceId === null
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
            }`}
            title="All Tasks"
          >
            <Layers className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={`p-2.5 rounded-xl transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
            }`}
            title="Dashboard"
          >
            <BarChart3 className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setViewMode('clients')}
            className={`p-2.5 rounded-xl transition-colors ${
              viewMode === 'clients'
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
            }`}
            title="Clients & Accounts"
          >
            <Building2 className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setViewMode('docs')}
            className={`p-2.5 rounded-xl transition-colors ${
              viewMode === 'docs'
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
            }`}
            title="Docs & SOPs"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title="Expand Sidebar"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white dark:bg-dark-sidebar border-r border-gray-200 dark:border-dark-border h-screen flex flex-col justify-between z-30 flex-shrink-0 select-none">
      {/* Top Organization Header */}
      <div>
        <div className="p-3.5 border-b border-gray-100 dark:border-dark-border/60 flex items-center justify-between bg-white dark:bg-dark-card/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 max-w-[160px] flex items-center">
              <img src="/logo.png" alt="FASEEH LALL & CO." className="h-7 w-auto object-contain" />
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Global Navigation Section */}
        <div className="p-3 space-y-1 border-b border-gray-100 dark:border-dark-border/60 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveSelection(null, null, null);
              if (['docs', 'directory', 'dashboard'].includes(viewMode)) {
                setViewMode('list');
              }
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
              activeSpaceId === null && !['docs', 'directory', 'dashboard'].includes(viewMode)
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-brand-500" />
              <span>Everything (All Tasks)</span>
            </div>
            <span className="text-[11px] font-bold text-gray-400">{tasks.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
              viewMode === 'dashboard'
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 font-medium'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-500" />
            <span>Executive Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('docs')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
              viewMode === 'docs'
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 font-medium'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <span>SOPs & Playbooks</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('clients')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
              viewMode === 'clients'
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-brand-500" />
              <span>Clients & Accounts</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600">
              {useOpsStore.getState().clientsVendors.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('directory')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
              viewMode === 'directory'
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 font-medium'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-500" />
            <span>Team & SLA Directory</span>
          </button>

          <button
            type="button"
            onClick={() => setAutomationsModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-all font-medium"
          >
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-purple-500" />
              <span>Automations Engine</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
              Active
            </span>
          </button>
        </div>

        {/* Spaces Hierarchy */}
        <div className="p-3">
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Operations Spaces
            </span>
            <button
              type="button"
              onClick={() => setNewSpaceModalOpen(true)}
              className="p-1 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
              title="Add New Space"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
            {spaces.map((space) => {
              const isExpanded = expandedSpaces[space.id];
              const isSpaceActive = activeSpaceId === space.id && !activeFolderId && !activeListId;
              const IconComp = ICON_MAP[space.icon] || Folder;
              const spaceTasksCount = tasks.filter((t) => t.spaceId === space.id).length;

              return (
                <div key={space.id} className="space-y-0.5">
                  {/* Space Row */}
                  <div
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                      isSpaceActive
                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100'
                    }`}
                    onClick={() => {
                      setActiveSelection(space.id, null, null);
                      if (['docs', 'directory', 'dashboard'].includes(viewMode)) {
                        setViewMode('list');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSpaceExpand(space.id);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: space.color }}
                      />

                      <span className="truncate font-semibold">{space.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 group-hover:hidden">
                        {spaceTasksCount}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSelection(space.id);
                          setNewListModalOpen(true);
                        }}
                        title="Add List in Space"
                        className="hidden group-hover:block p-0.5 text-gray-400 hover:text-brand-500"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Folders & Lists Inside Space */}
                  {isExpanded && (
                    <div className="pl-6 space-y-0.5 text-xs">
                      {/* Folders */}
                      {space.folders.map((folder) => {
                        const isFolderExp = expandedFolders[folder.id];
                        return (
                          <div key={folder.id} className="space-y-0.5">
                            <div
                              onClick={() => toggleFolderExpand(folder.id)}
                              className="flex items-center gap-1.5 py-1 px-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100"
                            >
                              {isFolderExp ? (
                                <ChevronDown className="w-3 h-3 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-gray-400" />
                              )}
                              <Folder className="w-3.5 h-3.5 text-amber-500" />
                              <span className="truncate font-medium">{folder.name}</span>
                            </div>

                            {/* Lists in Folder */}
                            {isFolderExp && (
                              <div className="pl-4 space-y-0.5">
                                {folder.lists.map((list) => {
                                  const isListActive = activeListId === list.id;
                                  return (
                                    <div
                                      key={list.id}
                                      onClick={() => {
                                        setActiveSelection(space.id, folder.id, list.id);
                                        if (['docs', 'directory', 'dashboard'].includes(viewMode)) {
                                          setViewMode('list');
                                        }
                                      }}
                                      className={`flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer transition-colors ${
                                        isListActive
                                          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <ListIcon className="w-3 h-3 text-gray-400" />
                                        <span className="truncate">{list.name}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Loose Lists */}
                      {space.lists.map((list) => {
                        const isListActive = activeListId === list.id;
                        return (
                          <div
                            key={list.id}
                            onClick={() => {
                              setActiveSelection(space.id, null, list.id);
                              if (['docs', 'directory', 'dashboard'].includes(viewMode)) {
                                setViewMode('list');
                              }
                            }}
                            className={`flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer transition-colors ${
                              isListActive
                                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ListIcon className="w-3 h-3 text-gray-400" />
                              <span className="truncate">{list.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom User Pill */}
      <div className="p-3 border-t border-gray-100 dark:border-dark-border/60 bg-gray-50/60 dark:bg-dark-sidebar flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-brand-500/20">
            {displayInitials}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
              {displayName}
            </div>
            <div className="text-[10px] text-gray-400 font-medium truncate">{displayRole}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-dark-100 rounded-lg transition-colors"
          title="Sign out of Ops Hub"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
