import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
  const viewMode = useOpsStore((state) => state.viewMode);
  const clients = useOpsStore((state) => state.clients);
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const { profile } = useAuth();

  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize light mode by default
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

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

  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0] || null;
  const isTeamManagement = viewMode === 'directory';

  const sectionName = isTeamManagement 
    ? (profile?.role === 'owner' || profile?.role === 'operational_manager' ? 'Team Management' : 'Team Directory')
    : 'Client Management';

  return (
    <header className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 py-3 flex items-center justify-between select-none">
      {/* Contextual Breadcrumb & Current Workspace Title */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-brand-600 font-bold tracking-tight">FASEEH LALL & CO.</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-500 font-medium">Ops Hub</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200">
          <span>{sectionName}</span>
          {!isTeamManagement && selectedClient && (
            <>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <span className="text-brand-600 dark:text-brand-400 font-bold">{selectedClient.companyName}</span>
            </>
          )}
        </div>
      </div>

      {/* Right Controls: Theme Toggle Only */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
          title="Toggle Dark / Light Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>
    </header>
  );
};
