import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useOpsStore } from '../../store/opsStore';
import { AutomationRule } from '../../types';
import { Zap, Plus, Trash2, CheckCircle2, AlertCircle, ArrowRight, ToggleLeft, ToggleRight } from 'lucide-react';

export const AutomationsModal: React.FC = () => {
  const isAutomationsModalOpen = useOpsStore((state) => state.isAutomationsModalOpen);
  const setAutomationsModalOpen = useOpsStore((state) => state.setAutomationsModalOpen);
  const automations = useOpsStore((state) => state.automations);
  const toggleAutomation = useOpsStore((state) => state.toggleAutomation);
  const createAutomation = useOpsStore((state) => state.createAutomation);
  const deleteAutomation = useOpsStore((state) => state.deleteAutomation);
  const users = useOpsStore((state) => state.users);

  const [isCreating, setIsCreating] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [trigger, setTrigger] = useState<AutomationRule['trigger']>('PRIORITY_URGENT');
  const [actionType, setActionType] = useState<'ASSIGN_USER' | 'CHANGE_STATUS' | 'ADD_TAG' | 'SET_SLA_RISK'>('ASSIGN_USER');
  const [actionValue, setActionValue] = useState(users[0]?.id || 'user-1');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    createAutomation({
      name: ruleName.trim(),
      description: ruleDesc.trim() || `When ${trigger} occurs -> Perform ${actionType}`,
      trigger,
      actions: [{ type: actionType, value: actionValue }],
      enabled: true
    });

    setRuleName('');
    setRuleDesc('');
    setIsCreating(false);
  };

  const getTriggerLabel = (trig: AutomationRule['trigger']) => {
    switch (trig) {
      case 'PRIORITY_URGENT':
        return 'Task priority is changed to Urgent';
      case 'CHECKLIST_COMPLETE':
        return 'All subtasks/checklist items are 100% completed';
      case 'TASK_CREATED':
        return 'A new operations task is created';
      case 'STATUS_CHANGE':
        return 'Task workflow status changes';
      case 'SLA_BREACH':
        return 'SLA threshold warning is triggered';
    }
  };

  const getActionLabel = (act: AutomationRule['actions'][0]) => {
    if (act.type === 'ASSIGN_USER') {
      const u = users.find((user) => user.id === act.value);
      return `Auto-assign to ${u?.name || 'Operations Lead'}`;
    }
    if (act.type === 'CHANGE_STATUS') {
      return `Auto-move status to "${act.value.replace('_', ' ').toUpperCase()}"`;
    }
    if (act.type === 'ADD_TAG') {
      return `Add tag #${act.value}`;
    }
    if (act.type === 'SET_SLA_RISK') {
      return `Flag operational risk as ${act.value}`;
    }
    return act.type;
  };

  return (
    <Modal
      isOpen={isAutomationsModalOpen}
      onClose={() => setAutomationsModalOpen(false)}
      title="Ops Hub Workflow Automations"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Header Intro */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Automatically trigger status updates, notifications, and assignees based on operational events.
          </div>
          {!isCreating && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 shadow transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Rule</span>
            </button>
          )}
        </div>

        {/* Rule Builder Form */}
        {isCreating && (
          <form onSubmit={handleCreate} className="p-4 bg-brand-500/5 dark:bg-brand-500/10 rounded-2xl border border-brand-500/30 space-y-4 animate-scale-up">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Create New Automation Rule
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Rule Name *
              </label>
              <input
                type="text"
                required
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. When Priority is Urgent -> Auto-assign Operations Lead"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Trigger */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  WHEN (Trigger)
                </label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl font-medium"
                >
                  <option value="PRIORITY_URGENT">Priority becomes Urgent</option>
                  <option value="CHECKLIST_COMPLETE">All Checklist Subtasks Done</option>
                  <option value="TASK_CREATED">New Task is Created</option>
                  <option value="STATUS_CHANGE">Status Changes</option>
                </select>
              </div>

              {/* Action */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  THEN (Action)
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl font-medium"
                >
                  <option value="ASSIGN_USER">Auto-Assign Team Member</option>
                  <option value="CHANGE_STATUS">Change Workflow Status</option>
                  <option value="ADD_TAG">Add Tag</option>
                  <option value="SET_SLA_RISK">Set SLA Risk Level</option>
                </select>
              </div>
            </div>

            {/* Action Value Configuration */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Action Value
              </label>
              {actionType === 'ASSIGN_USER' && (
                <select
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              )}

              {actionType === 'CHANGE_STATUS' && (
                <select
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl"
                >
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="under_review">Under Review</option>
                  <option value="blocked">Blocked / Escalated</option>
                </select>
              )}

              {actionType === 'ADD_TAG' && (
                <input
                  type="text"
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  placeholder="e.g. Critical-Ops"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl"
                />
              )}

              {actionType === 'SET_SLA_RISK' && (
                <select
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 shadow"
              >
                Save Automation
              </button>
            </div>
          </form>
        )}

        {/* Existing Automations List */}
        <div className="space-y-3">
          {automations.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-2xl border transition-all ${
                rule.enabled
                  ? 'bg-white dark:bg-dark-200 border-gray-200 dark:border-dark-border shadow-sm'
                  : 'bg-gray-50/50 dark:bg-dark-400/40 border-gray-100 dark:border-dark-border/40 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl mt-0.5 ${
                      rule.enabled ? 'bg-brand-500/10 text-brand-500' : 'bg-gray-200 dark:bg-dark-100 text-gray-400'
                    }`}
                  >
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{rule.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{rule.description}</p>

                    {/* Visual workflow step */}
                    <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-dark-border">
                        {getTriggerLabel(rule.trigger)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                        {getActionLabel(rule.actions[0])}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Toggle & Stats */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleAutomation(rule.id)}
                    className="transition-transform"
                    title={rule.enabled ? 'Disable automation' : 'Enable automation'}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-7 h-7 text-brand-500" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-gray-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteAutomation(rule.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-dark-border/60 flex items-center justify-between text-[10px] text-gray-400">
                <span>Executed <strong>{rule.executionCount}</strong> times</span>
                {rule.lastExecutedAt && (
                  <span>Last run {new Date(rule.lastExecutedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
