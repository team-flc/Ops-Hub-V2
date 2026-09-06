import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Clock, ShieldCheck, CheckCircle2, AlertCircle, ChevronRight, MessageSquare, ArrowRight } from 'lucide-react';
import { taskManagementService } from '../../lib/taskManagementService';
import { ClientTask, ClientRecord } from '../../types';
import { supabase } from '../../lib/supabase';

const ClientTaskDetailsModal = React.lazy(() =>
  import('../tasks/ClientTaskDetailsModal').then((m) => ({ default: m.ClientTaskDetailsModal }))
);

export const ClientPortalHoldingPage: React.FC = () => {
  const { profile: userProfile, signOut } = useAuth();
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [clientRecord, setClientRecord] = useState<ClientRecord | null>(null);
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const orgId = userProfile?.organizationId;
    if (!orgId) return;

    const loadClientData = async () => {
      setIsLoading(true);
      try {
        if (supabase) {
          const { data: cData } = await supabase
            .from('clients')
            .select('id, company_name, client_name, package, status, activation_date, required_linkedin_profile_count, operational_manager_id, operational_manager_name, links, created_at, updated_at')
            .eq('id', orgId)
            .maybeSingle();

          if (cData) {
            setClientRecord({
              id: cData.id,
              companyName: cData.company_name,
              clientName: cData.client_name,
              package: cData.package,
              status: cData.status,
              activationDate: cData.activation_date,
              requiredLinkedinProfileCount: cData.required_linkedin_profile_count || 3,
              operationalManagerId: cData.operational_manager_id || '',
              operationalManagerName: cData.operational_manager_name || undefined,
              links: cData.links || {},
              createdAt: cData.created_at,
              updatedAt: cData.updated_at
            });
          }
        }

        const res = await taskManagementService.fetchClientTasks(orgId);
        if (res.data) {
          setTasks(res.data);
        }
      } catch {
        // Non-blocking fallback
      } finally {
        setIsLoading(false);
      }
    };

    loadClientData();
  }, [userProfile?.organizationId]);

  const reviewTasks = tasks.filter((t) => t.status === 'Client Review');
  const otherTasks = tasks.filter((t) => t.status !== 'Client Review');

  const handleTaskUpdated = (updatedTask: ClientTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    if (selectedTask?.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-50 flex flex-col justify-between items-center p-6 font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Faseeh Lall & Co."
            className="h-8 w-auto object-contain"
          />
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-2xl py-8 space-y-6 my-auto animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-card text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center mx-auto shadow-sm">
            <Clock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>Client Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Client Portal
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
              Your secure client workspace is being prepared.
            </p>
          </div>
        </div>

        {/* Deliverables for Review */}
        {reviewTasks.length > 0 && (
          <div className="bg-white border border-brand-200 rounded-3xl p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-900">
                  Deliverables Awaiting Your Review ({reviewTasks.length})
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
                Action Required
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {reviewTasks.map((t) => (
                <div
                  key={t.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {t.title}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-100 text-brand-700">
                        Client Review
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span>Week {t.weekNumber}</span>
                      <span>•</span>
                      <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedTask(t)}
                    className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-colors min-h-[40px] sm:min-h-[36px] cursor-pointer"
                  >
                    <span>Review & Approve</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Workspace Deliverables */}
        {otherTasks.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-card space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Workspace Deliverables ({otherTasks.length})
            </h2>
            <div className="divide-y divide-slate-100">
              {otherTasks.map((t) => (
                <div
                  key={t.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate">
                    <span className="font-semibold text-slate-800">{t.title}</span>
                    <span className="ml-2 text-[10px] text-slate-400">Week {t.weekNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {t.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTask(t)}
                      className="text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1"
                    >
                      <span>Feed</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center py-4 text-xs text-slate-400 border-t border-slate-200">
        © {new Date().getFullYear()} Faseeh Lall & Co. All rights reserved.
      </footer>

      {/* Task Details & Conversation Feed Drawer */}
      {selectedTask && (
        <React.Suspense fallback={null}>
          <ClientTaskDetailsModal
            isOpen={true}
            onClose={() => setSelectedTask(null)}
            task={selectedTask}
            client={clientRecord || {
              id: userProfile?.organizationId || selectedTask.clientId,
              companyName: 'Client Workspace',
              clientName: 'Client',
              package: 'Advanced',
              status: 'Active',
              activationDate: '',
              requiredLinkedinProfileCount: 3,
              operationalManagerId: '',
              links: {},
              createdAt: '',
              updatedAt: ''
            }}
            currentUser={userProfile}
            isClientPortal={true}
            onTaskUpdated={handleTaskUpdated}
          />
        </React.Suspense>
      )}
    </div>
  );
};
