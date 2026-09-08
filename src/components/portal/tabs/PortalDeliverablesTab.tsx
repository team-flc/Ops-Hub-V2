import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, Search } from 'lucide-react';
import { ClientDeliverableItem } from '../../../types';

interface PortalDeliverablesTabProps {
  deliverables: ClientDeliverableItem[];
}

export const PortalDeliverablesTab: React.FC<PortalDeliverablesTabProps> = ({ deliverables }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  const departments = ['All', ...Array.from(new Set(deliverables.map((d) => d.departmentName || 'Operations')))];

  const filtered = deliverables.filter((d) => {
    if (selectedDept !== 'All' && (d.departmentName || 'Operations') !== selectedDept) return false;
    if (!searchQuery.trim()) return true;
    return d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.taskTitle.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search & Departments */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-4 sm:p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {departments.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedDept === dept
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-300'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets & deliverables..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center text-gray-400 text-xs bg-white dark:bg-dark-card rounded-3xl border border-gray-200 dark:border-dark-border">
            No published deliverables found in this category.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-3xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-card flex flex-col justify-between space-y-4 hover:border-brand-500/40 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                    {item.departmentName || 'Operations'}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Delivered</span>
                  </span>
                </div>

                <h4 className="text-sm font-black text-gray-900 dark:text-gray-100">
                  {item.title}
                </h4>

                {item.taskTitle && (
                  <p className="text-[11px] text-gray-400 truncate">
                    From task: {item.taskTitle}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-dark-border flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  {item.sharedAt ? new Date(item.sharedAt).toLocaleDateString() : 'Active'}
                </span>

                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    <span>View Asset</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-[11px] text-gray-400">Archived in Portal</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
