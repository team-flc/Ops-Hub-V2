import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useOpsStore } from '../../store/opsStore';
import { Folder, Activity, Truck, Headphones, Cpu, Users, Layers, ShieldCheck, Box, Zap } from 'lucide-react';

const COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#ef4444'  // Red
];

const ICONS = [
  { name: 'Activity', icon: Activity },
  { name: 'Truck', icon: Truck },
  { name: 'Headphones', icon: Headphones },
  { name: 'Cpu', icon: Cpu },
  { name: 'Users', icon: Users },
  { name: 'Layers', icon: Layers },
  { name: 'ShieldCheck', icon: ShieldCheck },
  { name: 'Box', icon: Box },
  { name: 'Zap', icon: Zap },
  { name: 'Folder', icon: Folder }
];

export const NewSpaceModal: React.FC = () => {
  const isNewSpaceModalOpen = useOpsStore((state) => state.isNewSpaceModalOpen);
  const setNewSpaceModalOpen = useOpsStore((state) => state.setNewSpaceModalOpen);
  const createSpace = useOpsStore((state) => state.createSpace);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState('Activity');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createSpace(name.trim(), selectedIcon, selectedColor, description.trim());
    setName('');
    setDescription('');
    setNewSpaceModalOpen(false);
  };

  return (
    <Modal
      isOpen={isNewSpaceModalOpen}
      onClose={() => setNewSpaceModalOpen(false)}
      title="Create New Operations Space"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Space Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Field Operations, QA Audits, Dispatch"
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Describe the operational workflows and team responsibilities..."
            className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Select Color Theme
          </label>
          <div className="flex items-center gap-2.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${
                  selectedColor === c ? 'scale-125 ring-2 ring-offset-2 ring-brand-500 dark:ring-offset-dark-200' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Select Icon
          </label>
          <div className="grid grid-cols-5 gap-2">
            {ICONS.map(({ name: iconName, icon: IconComponent }) => (
              <button
                key={iconName}
                type="button"
                onClick={() => setSelectedIcon(iconName)}
                className={`flex items-center justify-center p-2.5 rounded-xl border transition-all ${
                  selectedIcon === iconName
                    ? 'border-brand-500 bg-brand-500/10 text-brand-500 dark:text-brand-400 font-bold'
                    : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-100'
                }`}
              >
                <IconComponent className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-border">
          <button
            type="button"
            onClick={() => setNewSpaceModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-lg shadow-brand-500/25 transition-colors"
          >
            Create Space
          </button>
        </div>
      </form>
    </Modal>
  );
};
