import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { 
  Search, CheckSquare, BookOpen, Layers, Zap, Plus, 
  ArrowRight, Moon, Sun, RefreshCw, Download 
} from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const isCommandPaletteOpen = useOpsStore((state) => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useOpsStore((state) => state.setCommandPaletteOpen);
  const tasks = useOpsStore((state) => state.tasks);
  const spaces = useOpsStore((state) => state.spaces);
  const docs = useOpsStore((state) => state.docs);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);
  const setSelectedDocId = useOpsStore((state) => state.setSelectedDocId);
  const setActiveSelection = useOpsStore((state) => state.setActiveSelection);
  const setCreateTaskModalOpen = useOpsStore((state) => state.setCreateTaskModalOpen);
  const setAutomationsModalOpen = useOpsStore((state) => state.setAutomationsModalOpen);
  const exportDataAsJSON = useOpsStore((state) => state.exportDataAsJSON);

  const [query, setQuery] = useState('');

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const q = query.toLowerCase();

  // Matched Tasks
  const matchedTasks = tasks
    .filter((t) => t.title.toLowerCase().includes(q) || t.taskNumber.toLowerCase().includes(q))
    .slice(0, 4);

  // Matched SOP Docs
  const matchedDocs = docs
    .filter((d) => d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q))
    .slice(0, 3);

  // Matched Spaces
  const matchedSpaces = spaces
    .filter((s) => s.name.toLowerCase().includes(q))
    .slice(0, 3);

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setCommandPaletteOpen(false);
  };

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    setViewMode('docs');
    setCommandPaletteOpen(false);
  };

  const handleSelectSpace = (spaceId: string) => {
    setActiveSelection(spaceId);
    setViewMode('list');
    setCommandPaletteOpen(false);
  };

  const handleExportBackup = () => {
    const json = exportDataAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OpsHub_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setCommandPaletteOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={() => setCommandPaletteOpen(false)}
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-dark-200 rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border z-10 overflow-hidden animate-scale-up">
        {/* Search Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-100 dark:border-dark-border">
          <Search className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search tasks, SOPs, or jump to space (Ctrl+K)..."
            className="w-full bg-transparent border-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-300 text-gray-400 border border-gray-200 dark:border-dark-border">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-4 text-xs">
          {/* Quick Actions */}
          {!query && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Quick Actions
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    setCreateTaskModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Plus className="w-4 h-4 text-brand-500" />
                    <span className="font-semibold">Create New Operations Task</span>
                  </div>
                  <span className="text-[11px] text-gray-400">New Task</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    setViewMode('dashboard');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold">Open Executive Dashboard</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Analytics</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    setAutomationsModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-brand-500" />
                    <span className="font-semibold">Manage Automations & Workflows</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Rules</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Download className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold">Export JSON System Backup</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Backup</span>
                </button>
              </div>
            </div>
          )}

          {/* Tasks Results */}
          {matchedTasks.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Tasks ({matchedTasks.length})
              </div>
              <div className="space-y-1">
                {matchedTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTask(t.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckSquare className="w-4 h-4 text-brand-500 flex-shrink-0" />
                      <span className="font-bold text-gray-400 flex-shrink-0">{t.taskNumber}</span>
                      <span className="font-medium truncate">{t.title}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SOP Docs Results */}
          {matchedDocs.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                SOPs & Knowledge Docs ({matchedDocs.length})
              </div>
              <div className="space-y-1">
                {matchedDocs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleSelectDoc(d.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="font-medium truncate">{d.title}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{d.category}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Spaces Results */}
          {matchedSpaces.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Spaces ({matchedSpaces.length})
              </div>
              <div className="space-y-1">
                {matchedSpaces.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSpace(s.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-semibold">{s.name}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
