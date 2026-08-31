import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { ViewMode, Priority, GroupByOption } from '../../types';
import { 
  List as ListIcon, Kanban, Calendar as CalendarIcon, 
  Clock, Table as TableIcon, Search, Plus, Filter, 
  Moon, Sun, RotateCcw, Play, Square, Sparkles, SlidersHorizontal, Database, Building2, LogOut 
} from 'lucide-react';
import { formatSecondsToDigital } from '../../utils/helpers';
import { SupabaseModal } from '../settings/SupabaseModal';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
  const spaces = useOpsStore((state) => state.spaces);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeListId = useOpsStore((state) => state.activeListId);
  const viewMode = useOpsStore((state) => state.viewMode);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const filter = useOpsStore((state) => state.filter);
  const setFilter = useOpsStore((state) => state.setFilter);
  const resetFilter = useOpsStore((state) => state.resetFilter);
  const setCreateTaskModalOpen = useOpsStore((state) => state.setCreateTaskModalOpen);
  const setCommandPaletteOpen = useOpsStore((state) => state.setCommandPaletteOpen);
  const resetToDemoData = useOpsStore((state) => state.resetToDemoData);
  const activeTimer = useOpsStore((state) => state.activeTimer);
  const stopTimer = useOpsStore((state) => state.stopTimer);
  const users = useOpsStore((state) => state.users);
  const { signOut } = useAuth();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [elapsedTimerSecs, setElapsedTimerSecs] = useState(0);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Initialize light mode by default
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Live timer tick
  useEffect(() => {
    let interval: any = null;
    if (activeTimer) {
      interval = setInterval(() => {
        setElapsedTimerSecs(Math.floor((Date.now() - activeTimer.startTime) / 1000));
      }, 1000);
    } else {
      setElapsedTimerSecs(0);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      html.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  const currentSpace = spaces.find((s) => s.id === activeSpaceId);

  const views: { id: ViewMode; label: string; icon: any }[] = [
    { id: 'list', label: 'List', icon: ListIcon },
    { id: 'board', label: 'Board', icon: Kanban },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'table', label: 'Table', icon: TableIcon }
  ];

  const hasActiveFilters =
    filter.priorityFilter !== 'all' ||
    filter.statusFilter !== 'all' ||
    filter.assigneeFilter !== 'all' ||
    filter.slaFilter !== 'all' ||
    Boolean(filter.searchQuery);

  return (
    <header className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 py-2.5 flex flex-col gap-3 select-none">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Breadcrumb Info */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-brand-600 font-bold tracking-tight">FASEEH LALL & CO.</span>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="text-gray-500 font-medium">Ops Hub</span>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200">
            {currentSpace ? (
              <>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: currentSpace.color }}
                />
                <span>{currentSpace.name}</span>
              </>
            ) : (
              <span>All Workspaces & Tasks</span>
            )}
          </div>
        </div>

        {/* Global Search & Command Bar & Timer */}
        <div className="flex items-center gap-3">
          {/* Live Global Stopwatch Pill */}
          {activeTimer && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 font-mono font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>{formatSecondsToDigital(elapsedTimerSecs)}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
                {activeTimer.taskTitle}
              </span>
              <button
                type="button"
                onClick={stopTimer}
                title="Stop Timer"
                className="p-1 hover:bg-red-500/20 rounded text-red-600 dark:text-red-400"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            </div>
          )}

          {/* Quick Search trigger (opens Ctrl+K) */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-dark-200 border border-gray-200 dark:border-dark-border text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-brand-500/50 transition-colors w-48 sm:w-64 justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <span className="truncate">Search or jump to...</span>
            </div>
            <kbd className="hidden sm:inline-block font-mono text-[10px] bg-white dark:bg-dark-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-dark-border text-gray-400">
              Ctrl+K
            </kbd>
          </button>

          {/* Supabase Status Button */}
          <button
            type="button"
            onClick={() => setIsSupabaseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
            title="Supabase Database Backend Integration"
          >
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden md:inline">Supabase</span>
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
            title="Toggle Dark / Light Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Demo Reset - Strictly Local Dev Mode Only (Never in Preview / Production) */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset Ops Hub demo data to default?')) {
                  resetToDemoData();
                }
              }}
              className="p-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
              title="Reset to initial demo data (Dev Only)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Sign Out Action */}
          <button
            type="button"
            onClick={() => signOut()}
            className="p-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
            title="Sign out of Ops Hub"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Primary Create Task Button */}
          <button
            type="button"
            onClick={() => setCreateTaskModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />

      {/* Bottom Tabs & Filter Bar (Only in task views) */}
      {!['docs', 'directory', 'dashboard'].includes(viewMode) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* View Mode Switcher Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {views.map(({ id, label, icon: IconComponent }) => {
              const isActive = viewMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-200'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Filter & Group Controls */}
          <div className="flex items-center gap-2 relative">
            {/* Group By selector */}
            <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 dark:bg-dark-200 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-dark-border">
              <SlidersHorizontal className="w-3 h-3 text-gray-400" />
              <span className="text-[11px] font-medium">Group:</span>
              <select
                value={filter.groupBy}
                onChange={(e) => setFilter({ groupBy: e.target.value as GroupByOption })}
                className="bg-transparent border-none text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="status">Status</option>
                <option value="priority">Priority</option>
              </select>
            </div>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                hasActiveFilters
                  ? 'bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400'
                  : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              )}
            </button>

            {/* Filter Popover Dropdown */}
            {isFilterOpen && (
              <div className="absolute right-0 top-10 w-72 bg-white dark:bg-dark-200 rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border p-4 z-40 space-y-3 text-xs animate-scale-up">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-dark-border font-bold text-gray-800 dark:text-gray-200">
                  <span>Filter Tasks</span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilter}
                      className="text-[11px] text-brand-500 hover:underline"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">Priority</label>
                  <select
                    value={filter.priorityFilter}
                    onChange={(e) => setFilter({ priorityFilter: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                {/* Assignee Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">Assignee</label>
                  <select
                    value={filter.assigneeFilter}
                    onChange={(e) => setFilter({ assigneeFilter: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border"
                  >
                    <option value="all">All Assignees</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SLA Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">SLA Health</label>
                  <select
                    value={filter.slaFilter}
                    onChange={(e) => setFilter({ slaFilter: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border"
                  >
                    <option value="all">All SLA Statuses</option>
                    <option value="within_sla">Within Target SLA</option>
                    <option value="at_risk">At Risk</option>
                    <option value="breached">Breached</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
