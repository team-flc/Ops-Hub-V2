import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, FileDown, LogOut, ArrowLeft,
  LayoutDashboard, CheckSquare, Map, FolderOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  ClientTask, 
  PortalDateRange 
} from '../../types';
import { PortalDataResult } from '../../lib/clientPortalService';
import { PortalOverviewTab } from './tabs/PortalOverviewTab';
import { PortalTasksTab } from './tabs/PortalTasksTab';
import { PortalRoadmapTab } from './tabs/PortalRoadmapTab';
import { PortalDeliverablesTab } from './tabs/PortalDeliverablesTab';
import { ClientReportModal } from './reports/ClientReportModal';
import { clientPortalService } from '../../lib/clientPortalService';

interface ClientPortalLayoutProps {
  portalData: PortalDataResult;
  isReadOnlyPreview: boolean;
  dateRange: PortalDateRange;
  onDateRangeChange: (range: PortalDateRange) => void;
  onRefresh: () => Promise<void>;
}

type TabType = 'overview' | 'tasks' | 'roadmap' | 'deliverables';

export const ClientPortalLayout: React.FC<ClientPortalLayoutProps> = ({ 
  portalData, 
  isReadOnlyPreview,
  dateRange,
  onDateRangeChange,
  onRefresh 
}) => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const client = portalData.client;
  if (!client) return null;

  const reviewTasksCount = (portalData.tasks || []).filter((t: ClientTask) => t.status === 'Client Review').length;

  const handleApproveTask = async (taskId: string) => {
    await clientPortalService.submitClientTaskDecision(
      taskId, 
      'approve', 
      undefined, 
      profile, 
      isReadOnlyPreview
    );
    await onRefresh();
  };

  const handleRequestChanges = async (taskId: string, feedback: string) => {
    await clientPortalService.submitClientTaskDecision(
      taskId, 
      'request_changes', 
      feedback, 
      profile, 
      isReadOnlyPreview
    );
    await onRefresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-400 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-b border-gray-200 dark:border-dark-border px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        {/* Left: Branding & Client Badge */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-black text-sm tracking-tight text-gray-900 dark:text-gray-100">
              Ops Hub
            </span>
          </div>

          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">•</span>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand-500 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
              {client.companyName ? client.companyName[0].toUpperCase() : 'C'}
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 truncate block">
                {client.companyName}
              </span>
            </div>
          </div>
        </div>

        {/* Center / Navigation Tabs (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-dark-200 p-1 rounded-2xl border border-gray-200 dark:border-dark-border">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Deliverables</span>
            {reviewTasksCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'roadmap'
                ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Roadmap</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deliverables')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'deliverables'
                ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Assets</span>
          </button>
        </nav>

        {/* Right Actions: Download PDF Report & Sign Out / Exit Preview */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-xs font-bold transition-colors shadow-xs cursor-pointer"
            title="Download Custom-Date Client Report (PDF)"
          >
            <FileDown className="w-3.5 h-3.5 text-brand-500" />
            <span className="hidden sm:inline">Download Report</span>
            <span className="sm:hidden">Report</span>
          </button>

          {isReadOnlyPreview ? (
            <button
              type="button"
              onClick={() => navigate(`/clients/${client.id}`)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
              title="Return to Internal Workspace"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit Preview</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-dark-200 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-around bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-2 py-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`p-2 rounded-xl ${activeTab === 'overview' ? 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-500'}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`p-2 rounded-xl relative ${activeTab === 'tasks' ? 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-500'}`}
        >
          Deliverables
          {reviewTasksCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roadmap')}
          className={`p-2 rounded-xl ${activeTab === 'roadmap' ? 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-500'}`}
        >
          Roadmap
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('deliverables')}
          className={`p-2 rounded-xl ${activeTab === 'deliverables' ? 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-500'}`}
        >
          Assets
        </button>
      </div>

      {/* Main Workspace Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {activeTab === 'overview' && (
          <PortalOverviewTab
            client={client}
            overview={portalData.overview}
            tasks={portalData.tasks}
            milestones={portalData.roadmapMilestones}
            deliverables={portalData.deliverables}
            isReadOnlyPreview={isReadOnlyPreview}
            currentUserProfile={profile}
            onSelectTab={setActiveTab}
            onApproveTask={handleApproveTask}
            onRequestChanges={handleRequestChanges}
            onSelectTask={(task) => {
              setSelectedTask(task);
              setActiveTab('tasks');
            }}
          />
        )}

        {activeTab === 'tasks' && (
          <PortalTasksTab
            tasks={portalData.tasks}
            isReadOnlyPreview={isReadOnlyPreview}
            onApproveTask={handleApproveTask}
            onRequestChanges={handleRequestChanges}
            selectedTask={selectedTask}
            onSelectTask={setSelectedTask}
          />
        )}

        {activeTab === 'roadmap' && (
          <PortalRoadmapTab milestones={portalData.roadmapMilestones} />
        )}

        {activeTab === 'deliverables' && (
          <PortalDeliverablesTab deliverables={portalData.deliverables} />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card py-6 px-4 text-center text-xs text-gray-400 space-y-1">
        <p>© {new Date().getFullYear()} Faseeh Lall & Co. Enterprise Operations Hub.</p>
        <p className="text-[11px] text-gray-400">
          Strict role isolation and encryption enforced. Data is strictly confidential to {client.companyName}.
        </p>
      </footer>

      {/* PDF Report Generation Modal */}
      {isReportModalOpen && (
        <ClientReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          client={client}
          tasks={portalData.tasks}
          publishedResults={portalData.overview?.publishedResults || []}
          deliverables={portalData.deliverables}
          roadmapMilestones={portalData.roadmapMilestones}
          currentDateRange={dateRange}
        />
      )}
    </div>
  );
};
