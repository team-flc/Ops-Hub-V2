import React, { useState } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { SOPDocument } from '../../types';
import { 
  BookOpen, Plus, Star, Search, Trash2, Edit3, 
  Eye, Tag, User, Clock, Download, FileText, Check 
} from 'lucide-react';

export const DocsView: React.FC = () => {
  const docs = useOpsStore((state) => state.docs);
  const selectedDocId = useOpsStore((state) => state.selectedDocId);
  const setSelectedDocId = useOpsStore((state) => state.setSelectedDocId);
  const createDoc = useOpsStore((state) => state.createDoc);
  const updateDoc = useOpsStore((state) => state.updateDoc);
  const deleteDoc = useOpsStore((state) => state.deleteDoc);
  const toggleStarDoc = useOpsStore((state) => state.toggleStarDoc);

  const [searchDoc, setSearchDoc] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isPreview, setIsPreview] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Standard Operating Procedures');

  const selectedDoc = docs.find((d) => d.id === selectedDocId) || docs[0];

  const categories = ['all', ...Array.from(new Set(docs.map((d) => d.category)))];

  const filteredDocs = docs.filter((doc) => {
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false;
    if (searchDoc) {
      const q = searchDoc.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchContent = doc.content.toLowerCase().includes(q);
      const matchTag = doc.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchTag) return false;
    }
    return true;
  });

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newDoc = createDoc(
      newTitle.trim(),
      newCategory,
      `# ${newTitle.trim()}\n\n## 1. Objective & Scope\nDescribe the purpose of this SOP...\n\n## 2. Operational Procedures\n- Step 1: Initialize checklist\n- Step 2: Notify on-duty lead\n`,
      ['SOP', 'Operations']
    );
    setNewTitle('');
    setIsCreatingNew(false);
    setSelectedDocId(newDoc.id);
  };

  const handleDownloadMarkdown = () => {
    if (!selectedDoc) return;
    const blob = new Blob([selectedDoc.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedDoc.title.replace(/[^a-z0-9]/gi, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-[calc(100vh-140px)] p-6 max-w-7xl mx-auto flex gap-6">
      {/* Left Sidebar: Document Tree */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-dark-300 rounded-2xl border border-gray-200 dark:border-dark-border p-4 shadow-sm overflow-hidden">
        {/* Header & Add Button */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-500" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">SOP Knowledge Hub</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingNew(true)}
            className="p-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 shadow transition-colors"
            title="Create new SOP document"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="my-3 relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchDoc}
            onChange={(e) => setSearchDoc(e.target.value)}
            placeholder="Search playbooks & SOPs..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 dark:bg-dark-200 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-100'
              }`}
            >
              {cat === 'all' ? 'All Docs' : cat}
            </button>
          ))}
        </div>

        {/* Doc List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {isCreatingNew && (
            <form onSubmit={handleCreateNew} className="p-3 bg-brand-500/5 dark:bg-brand-500/10 rounded-xl border border-brand-500/30 space-y-2 mb-2">
              <input
                type="text"
                autoFocus
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Document title (e.g. SOP-005 Incident Flow)"
                className="w-full text-xs font-semibold bg-white dark:bg-dark-200 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border"
              />
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category (e.g. Daily Operations)"
                className="w-full text-xs bg-white dark:bg-dark-200 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-[11px] text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-brand-500 text-white rounded text-[11px] font-semibold hover:bg-brand-600"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {filteredDocs.map((doc) => {
            const isSelected = selectedDoc?.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`group p-3 rounded-xl cursor-pointer transition-all flex items-start justify-between gap-2 border ${
                  isSelected
                    ? 'bg-brand-500/10 border-brand-500/30 text-brand-700 dark:text-brand-300 shadow-sm'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-brand-500' : 'text-gray-400'}`} />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold truncate leading-tight">
                      {doc.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                      <span>{doc.category}</span>
                      <span>•</span>
                      <span>v{doc.version}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStarDoc(doc.id);
                  }}
                  className="text-gray-300 hover:text-amber-400 p-0.5 transition-colors"
                >
                  <Star className={`w-3.5 h-3.5 ${doc.starred ? 'text-amber-400 fill-amber-400' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Area: Document Editor & Viewer */}
      {selectedDoc ? (
        <div className="flex-1 flex flex-col bg-white dark:bg-dark-300 rounded-2xl border border-gray-200 dark:border-dark-border p-6 shadow-sm overflow-hidden">
          {/* Doc Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-dark-border">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[11px] font-semibold">
                  {selectedDoc.category}
                </span>
                <span className="text-xs text-gray-400">Version {selectedDoc.version}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-400">Updated {new Date(selectedDoc.updatedAt).toLocaleDateString()}</span>
              </div>
              <input
                type="text"
                value={selectedDoc.title}
                onChange={(e) => updateDoc(selectedDoc.id, { title: e.target.value })}
                className="text-xl font-bold text-gray-900 dark:text-gray-50 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-brand-500 rounded p-1 -ml-1 w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreview(!isPreview)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  isPreview
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-200'
                }`}
              >
                {isPreview ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{isPreview ? 'Edit Markdown' : 'Preview SOP'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                title="Download as Markdown"
                className="p-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this SOP document?')) {
                    deleteDoc(selectedDoc.id);
                  }
                }}
                title="Delete SOP"
                className="p-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Doc Content Area */}
          <div className="flex-1 overflow-y-auto py-4">
            {isPreview ? (
              <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed p-4 bg-gray-50/50 dark:bg-dark-200/40 rounded-xl border border-gray-100 dark:border-dark-border/60">
                <div className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">
                  {selectedDoc.content}
                </div>
              </div>
            ) : (
              <textarea
                value={selectedDoc.content}
                onChange={(e) => updateDoc(selectedDoc.id, { content: e.target.value })}
                className="w-full h-full p-4 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none leading-relaxed"
                placeholder="Write SOP documentation in Markdown..."
              />
            )}
          </div>

          {/* Footer: Tags & Author */}
          <div className="pt-3 border-t border-gray-100 dark:border-dark-border flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-brand-500" />
              <span>Author: <strong className="text-gray-700 dark:text-gray-300">{selectedDoc.authorName}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              {selectedDoc.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-200 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-dark-300 rounded-2xl border border-gray-200 dark:border-dark-border p-12 text-center text-gray-400">
          <div>
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h4 className="text-base font-bold text-gray-700 dark:text-gray-300">No SOP Document Selected</h4>
            <p className="text-xs text-gray-400 mt-1">Select an existing playbook from the left sidebar or create a new SOP.</p>
          </div>
        </div>
      )}
    </div>
  );
};
