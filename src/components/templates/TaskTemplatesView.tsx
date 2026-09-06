import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, Plus, BookTemplate, Eye, Edit3, Copy, Archive, RotateCcw,
  Clock, ShieldCheck, Tag, AlertTriangle, Loader2, Sparkles, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { TaskTemplate, Department, UserProfile } from '../../types';
import { taskTemplateService } from '../../lib/taskTemplateService';
import { taskManagementService } from '../../lib/taskManagementService';
import { CreateEditTemplateModal } from './CreateEditTemplateModal';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { ArchiveTemplateModal } from './ArchiveTemplateModal';

interface TaskTemplatesViewProps {
  currentUserProfile?: UserProfile | null;
}

export const TaskTemplatesView: React.FC<TaskTemplatesViewProps> = ({ currentUserProfile }) => {
  const isOwner = currentUserProfile?.role === 'owner';
  const isManager = currentUserProfile?.role === 'operational_manager';
  const hasAccess = isOwner || isManager;

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TaskTemplate | null>(null);
  const [archivingTemplate, setArchivingTemplate] = useState<TaskTemplate | null>(null);
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
        taskTemplateService.fetchTemplates(isOwner), // Owner fetches both, Manager active
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
      setError(err?.message || 'Failed to load task templates.');
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
          The Task Template Library is governed by organization management. You do not have permissions to access template configurations.
        </p>
      </div>
    );
  }

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      // Tab filter
      if (activeTab === 'active' && tpl.status !== 'Active') return false;
      if (activeTab === 'archived' && tpl.status !== 'Archived') return false;

      // Department filter
      if (selectedDepartmentId !== 'all' && tpl.departmentId !== selectedDepartmentId) {
        return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = tpl.name.toLowerCase().includes(q);
        const matchTitle = tpl.defaultTaskTitle.toLowerCase().includes(q);
        const matchDesc = tpl.description?.toLowerCase().includes(q) || false;
        const matchDetails = tpl.taskDetails?.toLowerCase().includes(q) || false;
        const matchDept = tpl.departmentName?.toLowerCase().includes(q) || false;
        if (!matchName && !matchTitle && !matchDesc && !matchDetails && !matchDept) {
          return false;
        }
      }

      return true;
    });
  }, [templates, activeTab, selectedDepartmentId, searchQuery]);

  // Handlers
  const handleCreateNew = () => {
    setEditingTemplate(null);
    setIsCreateEditOpen(true);
  };

  const handleEdit = (tpl: TaskTemplate) => {
    setEditingTemplate(tpl);
    setIsCreateEditOpen(true);
  };

  const handleDuplicate = async (tpl: TaskTemplate) => {
    if (!isOwner) return;
    setIsActionLoading(true);
    try {
      const res = await taskTemplateService.duplicateTemplate(tpl.id);
      if (res.error || !res.data) {
        setError(res.error || 'Failed to duplicate template.');
      } else {
        setTemplates((prev) => [res.data!, ...prev]);
        showToast(`Duplicated "${tpl.name}" as new template.`);
      }
    } catch (err: any) {
      setError(err?.message || 'Error duplicating template.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmArchive = async (reason: string) => {
    if (!archivingTemplate || !isOwner) return;
    const res = await taskTemplateService.archiveTemplate(archivingTemplate.id, reason);
    if (res.error || !res.data) {
      throw new Error(res.error || 'Failed to archive template.');
    } else {
      setTemplates((prev) => prev.map((t) => (t.id === res.data!.id ? res.data! : t)));
      showToast(`Archived template "${archivingTemplate.name}".`);
    }
  };

  const handleRestore = async (tpl: TaskTemplate) => {
    if (!isOwner) return;
    setIsActionLoading(true);
    try {
      const res = await taskTemplateService.restoreTemplate(tpl.id);
      if (res.error || !res.data) {
        setError(res.error || 'Failed to restore template.');
      } else {
        setTemplates((prev) => prev.map((t) => (t.id === res.data!.id ? res.data! : t)));
        showToast(`Restored template "${tpl.name}" to Active.`);
      }
    } catch (err: any) {
      setError(err?.message || 'Error restoring template.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleModalSuccess = (saved: TaskTemplate) => {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      if (exists) {
        return prev.map((t) => (t.id === saved.id ? saved : t));
      }
      return [saved, ...prev];
    });
    showToast(editingTemplate ? 'Template updated successfully.' : 'Template created successfully.');
  };

  const activeCount = templates.filter((t) => t.status === 'Active').length;
  const archivedCount = templates.filter((t) => t.status === 'Archived').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold shadow-2xl border border-gray-700/30">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookTemplate className="w-5 h-5 text-brand-500" />
            <span>Task Templates & SOPs</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Standard operating procedures with pre-configured approval rules and business-day SLAs.
          </p>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Template</span>
          </button>
        )}
      </div>

      {/* Backend Unavailable Notice */}
      {isUnavailable && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
          <div className="text-xs">
            <p className="font-bold">Template backend table is currently offline or awaiting database migration.</p>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              Task creation in client workspaces will continue to function normally via blank manual entry.
            </p>
          </div>
        </div>
      )}

      {error && !isUnavailable && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl">
          {error}
        </div>
      )}

      {/* Controls Bar: Tabs, Search, Department Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-dark-card p-3 rounded-2xl border border-gray-200 dark:border-dark-border shadow-sm">
        {/* Active vs. Archived Tabs (Archived visible to Owner only) */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-dark-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'active'
                ? 'bg-white dark:bg-dark-card text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Active ({activeCount})
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'archived'
                  ? 'bg-white dark:bg-dark-card text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Archived ({archivedCount})
            </button>
          )}
        </div>

        {/* Search & Department Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search templates or SOP text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              aria-label="Filter templates by department"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          <span className="text-xs font-medium">Loading templates...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-border p-6 space-y-3">
          <BookTemplate className="w-8 h-8 mx-auto text-gray-400 opacity-60" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
            {activeTab === 'archived' ? 'No archived templates' : 'No templates found'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {searchQuery || selectedDepartmentId !== 'all'
              ? 'Try modifying your search keywords or department filter.'
              : activeTab === 'active' && isOwner
              ? 'Get started by creating your first standard operating procedure.'
              : 'No templates are currently available.'}
          </p>
          {isOwner && activeTab === 'active' && !searchQuery && selectedDepartmentId === 'all' && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Template</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`p-4 rounded-2xl border bg-white dark:bg-dark-card flex flex-col justify-between shadow-sm transition-all hover:shadow-md ${
                template.status === 'Archived'
                  ? 'border-gray-200 dark:border-dark-border opacity-75 bg-gray-50/50 dark:bg-dark-100/30'
                  : 'border-gray-200 dark:border-dark-border hover:border-brand-500/40'
              }`}
            >
              <div className="space-y-2.5">
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-dark-100 text-gray-700 dark:text-gray-300">
                    {template.departmentName || 'Department'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-400">
                      v{template.version}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        template.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {template.status}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                    {template.name}
                  </h3>
                  {template.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>
                  )}
                </div>

                {/* Default Title Preview */}
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-100 dark:border-dark-border text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Default Title</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{template.defaultTaskTitle}</span>
                </div>

                {/* Specs Pills */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {template.suggestedDurationDays} Business Days
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      template.defaultApprovalMode === 'Client Approval Required'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <ShieldCheck className="w-2.5 h-2.5" /> {template.defaultApprovalMode}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" /> {template.defaultPriority}
                  </span>
                </div>

                {/* Archive Info if Archived */}
                {template.status === 'Archived' && template.archiveReason && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                    <span className="font-bold block">Archive Reason:</span>
                    <span className="italic">{template.archiveReason}</span>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3.5 mt-3 border-t border-gray-100 dark:border-dark-border flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(template)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                {isOwner && (
                  <div className="flex items-center gap-1">
                    {template.status === 'Active' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(template)}
                          disabled={isActionLoading}
                          className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 rounded-lg transition-colors"
                          title="Duplicate template"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(template)}
                          className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-500/10 rounded-lg transition-colors"
                          title="Edit template"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchivingTemplate(template)}
                          className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Archive template"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestore(template)}
                        disabled={isActionLoading}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateEditTemplateModal
        isOpen={isCreateEditOpen}
        onClose={() => setIsCreateEditOpen(false)}
        onSuccess={handleModalSuccess}
        template={editingTemplate}
        departments={departments}
      />

      <TemplatePreviewModal
        isOpen={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        template={previewTemplate}
      />

      <ArchiveTemplateModal
        isOpen={Boolean(archivingTemplate)}
        onClose={() => setArchivingTemplate(null)}
        onConfirm={handleConfirmArchive}
        template={archivingTemplate}
      />
    </div>
  );
};
