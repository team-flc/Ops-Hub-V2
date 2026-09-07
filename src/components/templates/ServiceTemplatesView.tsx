import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, Plus, Layers, Eye, Edit3, Copy, Archive, RotateCcw,
  Clock, ShieldCheck, Building2, Tag, AlertTriangle, Loader2, Sparkles, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { ServiceTemplate, Department, UserProfile } from '../../types';
import { serviceTemplateService } from '../../lib/serviceTemplateService';
import { taskManagementService } from '../../lib/taskManagementService';

const CreateEditServiceTemplateModal = React.lazy(() =>
  import('./CreateEditServiceTemplateModal').then((m) => ({ default: m.CreateEditServiceTemplateModal }))
);
const ServiceTemplatePreviewModal = React.lazy(() =>
  import('./ServiceTemplatePreviewModal').then((m) => ({ default: m.ServiceTemplatePreviewModal }))
);

interface ServiceTemplatesViewProps {
  currentUserProfile?: UserProfile | null;
}

export const ServiceTemplatesView: React.FC<ServiceTemplatesViewProps> = ({ currentUserProfile }) => {
  const isOwner = currentUserProfile?.role === 'owner';
  const isManager = currentUserProfile?.role === 'operational_manager';
  const hasAccess = isOwner || isManager;

  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ServiceTemplate | null>(null);
  const [templateToArchive, setTemplateToArchive] = useState<ServiceTemplate | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setIsUnavailable(false);
    try {
      const [tplRes, depts] = await Promise.all([
        serviceTemplateService.fetchTemplates(isOwner), // Owner fetches active + archived, Manager active
        taskManagementService.fetchDepartments()
      ]);

      if (tplRes.isUnavailable) {
        setIsUnavailable(true);
      }
      if (tplRes.error) {
        setError(tplRes.error);
      }
      setTemplates(tplRes.data || []);
      setDepartments(depts || []);
    } catch (err: any) {
      setIsUnavailable(true);
      setError(err?.message || 'Failed to load service templates.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, isOwner]);

  // Access denial for Clients / Team Members
  if (!hasAccess) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Access Restricted</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          The Service Template Library is governed by organization management. You do not have permissions to access template configurations.
        </p>
      </div>
    );
  }

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.serviceLabel) set.add(t.serviceLabel);
    });
    return Array.from(set).sort();
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesTab = activeTab === 'active' ? t.status !== 'Archived' : t.status === 'Archived';
      if (!matchesTab) return false;

      const matchesSearch =
        searchQuery.trim() === '' ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.serviceLabel && t.serviceLabel.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.tasks.some((tk) => tk.title.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || t.serviceLabel === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [templates, activeTab, searchQuery, selectedCategory]);

  // Actions
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsCreateEditOpen(true);
  };

  const handleOpenEdit = (t: ServiceTemplate) => {
    setEditingTemplate(t);
    setIsCreateEditOpen(true);
  };

  const handleDuplicate = async (t: ServiceTemplate) => {
    setIsActionLoading(true);
    const res = await serviceTemplateService.duplicateTemplate(t.id);
    setIsActionLoading(false);

    if (res.error) {
      showToast(`Duplicate failed: ${res.error}`);
    } else {
      showToast(`Template "${t.name}" duplicated successfully.`);
      loadData();
    }
  };

  const handleArchiveConfirm = async () => {
    if (!templateToArchive || !archiveReason.trim()) return;
    setIsArchiving(true);
    const res = await serviceTemplateService.archiveTemplate(templateToArchive.id, archiveReason);
    setIsArchiving(false);

    if (res.error) {
      showToast(`Archive failed: ${res.error}`);
    } else {
      showToast(`Service template "${templateToArchive.name}" moved to archive.`);
      setTemplateToArchive(null);
      setArchiveReason('');
      loadData();
    }
  };

  const handleRestore = async (t: ServiceTemplate) => {
    setIsActionLoading(true);
    const res = await serviceTemplateService.restoreTemplate(t.id);
    setIsActionLoading(false);

    if (res.error) {
      showToast(`Restore failed: ${res.error}`);
    } else {
      showToast(`Service template "${t.name}" restored to Active.`);
      loadData();
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2 border border-gray-700 animate-bounce">
          <Sparkles className="w-4 h-4 text-brand-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Backend Unavailable / Migration Warning Banner */}
      {isUnavailable && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Notice: Backend Database Migration Pending</div>
            <div className="text-[11px] leading-relaxed opacity-90">
              The remote production database has not deployed Phase 3D migrations yet. Existing single-task templates are safely presented as 1-task Service Templates. Changes created in Preview mode are maintained locally.
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wider">
              Standard Operating Packages
            </span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-brand-500" />
            <span>Service Templates Library</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-2xl">
            Configure multi-task operational service packages (Social Media, Paid Ads, GoHighLevel Setup, Graphic Design) with business-day SLAs and ordered child tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-lg shadow-brand-500/25 transition-all cursor-pointer flex-shrink-0 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>New Service Template</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Active vs Archived Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-100 p-1 rounded-xl w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Active Templates ({templates.filter((t) => t.status !== 'Archived').length})
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'archived'
                  ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Archived ({templates.filter((t) => t.status === 'Archived').length})
            </button>
          )}
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search service templates..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
            />
          </div>

          <div className="relative w-full sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-bold"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Service Templates */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center text-gray-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <span className="text-xs font-semibold">Loading Service Templates...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto border border-brand-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {searchQuery || selectedCategory !== 'all' ? 'No Matching Templates' : 'No Service Templates Found'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {activeTab === 'archived'
              ? 'There are no archived service templates in the repository.'
              : 'Create reusable multi-task packages like Paid Ads, Social Media, or GoHighLevel to launch standardized batches.'}
          </p>
          {activeTab === 'active' && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold shadow-md hover:bg-brand-600 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Service Template</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((template) => {
            const taskCount = template.tasks.length;
            const taskCountLabel = `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;

            return (
              <div
                key={template.id}
                className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Header & Badges */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wider">
                        {template.serviceLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-100 text-gray-600 dark:text-gray-300 text-[10px] font-bold">
                        v{template.version}
                      </span>
                      {template.status === 'Archived' && (
                        <span className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-dark-200 text-gray-600 text-[10px] font-bold">
                          Archived
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-extrabold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-dark-100 px-2 py-0.5 rounded-md flex-shrink-0">
                      {taskCountLabel}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Child Task Preview Summary */}
                <div className="p-3 rounded-2xl bg-gray-50/80 dark:bg-dark-100/40 border border-gray-100 dark:border-dark-border/60 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Package Tasks Preview
                  </div>
                  <div className="space-y-1">
                    {template.tasks.slice(0, 3).map((t, idx) => (
                      <div key={t.id || t.definitionId || idx} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <span className="w-4 h-4 rounded bg-gray-200 dark:bg-dark-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate flex-1 font-medium">{t.title}</span>
                        <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                          {t.durationBusinessDays}d
                        </span>
                      </div>
                    ))}
                    {template.tasks.length > 3 && (
                      <div className="text-[11px] text-brand-600 dark:text-brand-400 font-bold pl-6 pt-0.5">
                        +{template.tasks.length - 3} more tasks in package
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-2 border-t border-gray-100 dark:border-dark-border flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(template)}
                      className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
                      title="Preview Template Package"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {activeTab === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(template)}
                          className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
                          title="Edit Service Template"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicate(template)}
                          disabled={isActionLoading}
                          className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer disabled:opacity-50"
                          title="Duplicate Service Template"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <div>
                    {activeTab === 'active' ? (
                      isOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateToArchive(template);
                            setArchiveReason('');
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800 cursor-pointer"
                        >
                          Archive
                        </button>
                      )
                    ) : (
                      isOwner && (
                        <button
                          type="button"
                          onClick={() => handleRestore(template)}
                          disabled={isActionLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Archive Modal */}
      {templateToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Archive Service Template
                </h3>
                <p className="text-xs text-gray-400">
                  {templateToArchive.name} (v{templateToArchive.version})
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Reason for Archiving <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g. Superseded by 2026 service package update..."
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTemplateToArchive(null)}
                disabled={isArchiving}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                disabled={isArchiving || !archiveReason.trim()}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md disabled:opacity-50"
              >
                {isArchiving ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {isCreateEditOpen && (
        <React.Suspense fallback={null}>
          <CreateEditServiceTemplateModal
            isOpen={isCreateEditOpen}
            onClose={() => setIsCreateEditOpen(false)}
            onSuccess={() => {
              setIsCreateEditOpen(false);
              showToast(editingTemplate ? 'Service template updated.' : 'Service template created.');
              loadData();
            }}
            template={editingTemplate}
            departments={departments}
          />
        </React.Suspense>
      )}

      {previewTemplate && (
        <React.Suspense fallback={null}>
          <ServiceTemplatePreviewModal
            isOpen={Boolean(previewTemplate)}
            onClose={() => setPreviewTemplate(null)}
            template={previewTemplate}
          />
        </React.Suspense>
      )}
    </div>
  );
};
