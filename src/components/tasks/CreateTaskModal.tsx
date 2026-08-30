import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useOpsStore } from '../../store/opsStore';
import { Priority } from '../../types';
import { Calendar, User as UserIcon, Tag, Clock, ShieldAlert } from 'lucide-react';

export const CreateTaskModal: React.FC = () => {
  const isCreateTaskModalOpen = useOpsStore((state) => state.isCreateTaskModalOpen);
  const setCreateTaskModalOpen = useOpsStore((state) => state.setCreateTaskModalOpen);
  const spaces = useOpsStore((state) => state.spaces);
  const users = useOpsStore((state) => state.users);
  const currentUser = useOpsStore((state) => state.currentUser);
  const activeSpaceId = useOpsStore((state) => state.activeSpaceId);
  const activeListId = useOpsStore((state) => state.activeListId);
  const createTask = useOpsStore((state) => state.createTask);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);
  const clientsVendors = useOpsStore((state) => state.clientsVendors);
  const createClientVendor = useOpsStore((state) => state.createClientVendor);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState(activeSpaceId || spaces[0]?.id || 'space-1');
  const [listId, setListId] = useState(activeListId || '');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [estimatedHours, setEstimatedHours] = useState(2);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([currentUser.id]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Operations']);
  const [clientName, setClientName] = useState('');
  const [riskLevel, setRiskLevel] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Low');

  // Derive available lists for selected space
  const currentSpace = spaces.find((s) => s.id === spaceId);
  const allListsInSpace = currentSpace
    ? [
        ...currentSpace.lists,
        ...currentSpace.folders.flatMap((f) => f.lists)
      ]
    : [];

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tagInput.trim() && !tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleToggleAssignee = (userId: string) => {
    if (assigneeIds.includes(userId)) {
      if (assigneeIds.length > 1) {
        setAssigneeIds(assigneeIds.filter((id) => id !== userId));
      }
    } else {
      setAssigneeIds([...assigneeIds, userId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const chosenListId = listId || allListsInSpace[0]?.id || 'list-1';

    const newTask = createTask({
      title: title.trim(),
      description: description.trim(),
      spaceId,
      listId: chosenListId,
      priority,
      dueDate,
      estimatedHours: Number(estimatedHours) || 1,
      assigneeIds,
      tags,
      customFields: {
        slaStatus: 'within_sla',
        clientName: clientName.trim() || undefined,
        riskLevel
      }
    });

    // Reset & close
    setTitle('');
    setDescription('');
    setCreateTaskModalOpen(false);
    setSelectedTaskId(newTask.id);
  };

  return (
    <Modal
      isOpen={isCreateTaskModalOpen}
      onClose={() => setCreateTaskModalOpen(false)}
      title="Create Operations Task"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Task Title *
          </label>
          <input
            type="text"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Expedite Freight Clearance at Terminal 2"
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Space & List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Space *
            </label>
            <select
              value={spaceId}
              onChange={(e) => {
                setSpaceId(e.target.value);
                setListId('');
              }}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              List *
            </label>
            <select
              value={listId || allListsInSpace[0]?.id || ''}
              onChange={(e) => setListId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {allListsInSpace.map((l) => (
                <option key={l.id} value={l.id}>
                  📋 {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority & Due Date & Estimate */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            >
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="normal">🔵 Normal</option>
              <option value="low">⚪ Low</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1" /> Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              <Clock className="w-3.5 h-3.5 inline mr-1" /> Est. Hours
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Assignees */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            <UserIcon className="w-3.5 h-3.5 inline mr-1" /> Assign Team Members
          </label>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => {
              const isSelected = assigneeIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleToggleAssignee(u.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-100'
                  }`}
                >
                  <img src={u.avatar} alt={u.name} className="w-4 h-4 rounded-full object-cover" />
                  <span>{u.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Description & Operational Notes
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Outline procedures, checklist steps, or client requirements..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Client & Risk Custom Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Client / Account
            </label>
            <div className="space-y-1.5">
              <select
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Internal / General Ops --</option>
                {clientsVendors.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.slaTier})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Or type custom client name..."
                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              <ShieldAlert className="w-3.5 h-3.5 inline mr-1" /> Risk Level
            </label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="Low">Low Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
              <option value="Critical">Critical Operational Risk</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            <Tag className="w-3.5 h-3.5 inline mr-1" /> Tags (Press Enter)
          </label>
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-dark-100 text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-100"
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag..."
              className="bg-transparent border-none text-xs text-gray-900 dark:text-gray-100 focus:outline-none p-1 flex-1 min-w-[80px]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-border">
          <button
            type="button"
            onClick={() => setCreateTaskModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-lg shadow-brand-500/25 transition-all"
          >
            Create Task
          </button>
        </div>
      </form>
    </Modal>
  );
};
