import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useOpsStore } from '../../store/opsStore';

export const NewListModal: React.FC = () => {
  const isNewListModalOpen = useOpsStore((state) => state.isNewListModalOpen);
  const setNewListModalOpen = useOpsStore((state) => state.setNewListModalOpen);
  const spaces = useOpsStore((state) => state.spaces);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeFolderId = useOpsStore((state) => state.activeFolderId);
  const createList = useOpsStore((state) => state.createList);

  const [name, setName] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState(activeSpaceId || spaces[0]?.id || '');
  const [selectedFolderId, setSelectedFolderId] = useState(activeFolderId || '');

  const currentSpace = spaces.find((s) => s.id === selectedSpaceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedSpaceId) return;
    createList(selectedSpaceId, selectedFolderId || undefined, name.trim(), currentSpace?.color);
    setName('');
    setNewListModalOpen(false);
  };

  return (
    <Modal
      isOpen={isNewListModalOpen}
      onClose={() => setNewListModalOpen(false)}
      title="Create New List"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            List Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily Dispatch, Critical Incidents, Weekly Audits"
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Select Space *
          </label>
          <select
            value={selectedSpaceId}
            onChange={(e) => {
              setSelectedSpaceId(e.target.value);
              setSelectedFolderId('');
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {currentSpace && currentSpace.folders.length > 0 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Folder (Optional)
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">No Folder (Root level in Space)</option>
              {currentSpace.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-border">
          <button
            type="button"
            onClick={() => setNewListModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-lg shadow-brand-500/25 transition-colors"
          >
            Create List
          </button>
        </div>
      </form>
    </Modal>
  );
};
