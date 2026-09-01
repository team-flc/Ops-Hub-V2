import React, { useState } from 'react';
import { Calendar, Info, Plus, Sparkles } from 'lucide-react';
import { ClientRecord, UserProfile } from '../../types';
import { SelectedClientHeader } from './SelectedClientHeader';
import { ClientDetailsTab } from './ClientDetailsTab';

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

  const handleAddTaskClick = () => {
    setToastMessage('Task creation will be configured in the next phase.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const weekTabs: { id: WeekTab; label: string }[] = [
    { id: 'week1', label: 'Week 1' },
    { id: 'week2', label: 'Week 2' },
    { id: 'week3', label: 'Week 3' },
    { id: 'week4', label: 'Week 4' }
  ];

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

            {/* Selected Week Tasks Card containing only one centered + Add Task placeholder */}
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-12 shadow-sm min-h-[260px] flex items-center justify-center">
              <button
                type="button"
                onClick={handleAddTaskClick}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-200 dark:hover:bg-dark-100 text-gray-800 dark:text-gray-200 text-xs font-bold border border-gray-200 dark:border-dark-border transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 text-brand-500" />
                <span>+ Add Task</span>
              </button>
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
    </div>
  );
};
