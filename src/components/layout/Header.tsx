import React, { useState, useEffect } from 'react';
import { useSafeNavigate } from '../../lib/safeRouterHooks';
import { useOpsStore } from '../../store/opsStore';
import { Moon, Sun, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ProfileDropdown } from '../profile/ProfileDropdown';

export const Header: React.FC = () => {
  const navigate = useSafeNavigate();
  const viewMode = useOpsStore((state) => state.viewMode);
  const clients = useOpsStore((state) => state.clients);
  const selectedClientId = useOpsStore((state) => state.selectedClientId);
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const toggleMobileSidebar = useOpsStore((state) => state.toggleMobileSidebar);
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

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;
  const isSettings = viewMode === 'settings';
  const isProfile = viewMode === 'profile';
  const isTeamManagement = viewMode === 'directory';

  let sectionName = 'Client Workspace';
  if (isSettings) {
    sectionName = 'Settings & Governance';
  } else if (isProfile) {
    sectionName = 'My Profile';
  } else if (isTeamManagement) {
    sectionName = profile?.role === 'owner' || profile?.role === 'operational_manager' ? 'Team Management' : 'Team Directory';
  }

  const handleReturnToWorkspace = () => {
    navigate(selectedClientId ? `/clients/${selectedClientId}` : '/');
    setViewMode('client_workspace');
  };

  return (
    <header className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between select-none">
      {/* Contextual Breadcrumb & Current Workspace Title */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs min-w-0 pr-2">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="md:hidden p-2 -ml-1 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors touch-target flex items-center justify-center flex-shrink-0"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleReturnToWorkspace}
          className="text-brand-600 font-bold tracking-tight hover:underline focus:outline-none truncate"
        >
          <span className="hidden sm:inline">FASEEH LALL & CO.</span>
          <span className="sm:hidden">FLC</span>
        </button>
        <span className="hidden sm:inline text-gray-300 dark:text-gray-600">/</span>
        <button
          type="button"
          onClick={handleReturnToWorkspace}
          className="hidden sm:inline text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors focus:outline-none"
        >
          Ops Hub
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200 truncate">
          <span className="truncate">{sectionName}</span>
          {!isTeamManagement && !isSettings && !isProfile && selectedClient && (
            <>
              <span className="text-gray-300 dark:text-gray-600 hidden xs:inline">/</span>
              <span className="text-brand-600 dark:text-brand-400 font-bold truncate hidden xs:inline">{selectedClient.companyName}</span>
            </>
          )}
        </div>
      </div>

      {/* Right Controls: Theme Toggle & Top-Right Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 sm:p-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors touch-target sm:touch-auto flex items-center justify-center"
          title="Toggle Dark / Light Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
        </button>

        {/* Authenticated Staff Profile Menu with Single Sign Out */}
        <ProfileDropdown />
      </div>
    </header>
  );
};

