import React, { useState } from 'react';
import { 
  Calendar, Info, BarChart3, Plus, CheckCircle2, 
  Clock, AlertCircle, Layers, Sparkles 
} from 'lucide-react';
import { ClientRecord, UserProfile } from '../../types';
import { SelectedClientHeader } from './SelectedClientHeader';
import { ClientDetailsTab } from './ClientDetailsTab';

interface ClientWorkspaceViewProps {
  client: ClientRecord;
  currentUserProfile?: UserProfile | null;
  eligibleManagers: UserProfile[];
  onClientUpdated: (updated: ClientRecord) => void;
}

type MainTab = 'setup' | 'details' | 'reporting';
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

  const weekTabs: { id: WeekTab; label: string; sub: string }[] = [
    { id: 'week1', label: 'Week 1', sub: 'Kickoff & Foundation Setup' },
    { id: 'week2', label: 'Week 2', sub: 'Asset Gathering & Infrastructure' },
    { id: 'week3', label: 'Week 3', sub: 'Execution & Campaigns Staging' },
    { id: 'week4', label: 'Week 4', sub: 'Review, Optimization & Handover' }
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-gray-50/50 dark:bg-dark-400 select-none">
      {/* 1. Selected Client Top Header */}
      <SelectedClientHeader client={client} />

      {/* 2. Top-Level Tab Navigation */}
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
            <span>30-Day Setup Workspace</span>
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

          <button
            type="button"
            onClick={() => setActiveTab('reporting')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'reporting'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Reporting</span>
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
            {/* 4 Weekly Sub-Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {weekTabs.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setActiveWeek(w.id)}
                  className={`p-3.5 rounded-2xl text-left border transition-all ${
                    activeWeek === w.id
                      ? 'bg-brand-500/10 border-brand-500/40 shadow-sm'
                      : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-black uppercase tracking-wider ${
                      activeWeek === w.id ? 'text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {w.label}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-brand-500/40" />
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium truncate">
                    {w.sub}
                  </div>
                </button>
              ))}
            </div>

            {/* Selected Week Tasks Panel */}
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-6 shadow-sm min-h-[300px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                      {weekTabs.find((w) => w.id === activeWeek)?.label} Operations Checklist
                    </h3>
                    <p className="text-xs text-gray-500">
                      {weekTabs.find((w) => w.id === activeWeek)?.sub}
                    </p>
                  </div>
                </div>

                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-dark-200 text-gray-400 flex items-center justify-center border border-gray-200 dark:border-dark-border">
                    <Layers className="w-6 h-6 text-brand-500/70" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      Initial 30-Day Setup Plan
                    </h4>
                    <p className="text-xs text-gray-400 max-w-sm mt-1">
                      Task template execution and operational checklists will be connected in the upcoming Task Management release.
                    </p>
                  </div>
                </div>
              </div>

              {/* Single Clean Control: + Add Task Placeholder */}
              <div className="pt-4 border-t border-gray-100 dark:border-dark-border flex justify-start">
                <button
                  type="button"
                  onClick={handleAddTaskClick}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-200 dark:hover:bg-dark-100 text-gray-800 dark:text-gray-200 text-xs font-bold border border-gray-200 dark:border-dark-border transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Plus className="w-4 h-4 text-brand-500" />
                  <span>+ Add Task</span>
                </button>
              </div>
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

        {/* TAB 3: REPORTING PLACEHOLDER */}
        {activeTab === 'reporting' && (
          <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-12 text-center shadow-sm space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto border border-brand-500/20">
                <BarChart3 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Client Operations Reporting
                </h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1.5">
                  Recurring operations, monthly retainer SLAs, and automated performance reports for <strong className="text-gray-700 dark:text-gray-300">{client.companyName}</strong> will become active following the initial 30-day setup phase.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
