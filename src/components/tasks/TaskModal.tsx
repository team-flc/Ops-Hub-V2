import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { Priority, Task } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { 
  X, CheckSquare, Plus, Trash2, Clock, Play, Square, 
  MessageSquare, History, Tag, DollarSign, 
  ShieldAlert, Send, Sparkles, AlertCircle
} from 'lucide-react';
import { formatDate, formatTimeMinutes, formatSecondsToDigital, triggerConfetti } from '../../utils/helpers';

export const TaskModal: React.FC = () => {
  const selectedTaskId = useOpsStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useOpsStore((state) => state.setSelectedTaskId);
  const tasks = useOpsStore((state) => state.tasks);
  const spaces = useOpsStore((state) => state.spaces);
  const users = useOpsStore((state) => state.users);
  const currentUser = useOpsStore((state) => state.currentUser);
  const updateTask = useOpsStore((state) => state.updateTask);
  const deleteTask = useOpsStore((state) => state.deleteTask);
  const toggleSubtask = useOpsStore((state) => state.toggleSubtask);
  const addSubtask = useOpsStore((state) => state.addSubtask);
  const deleteSubtask = useOpsStore((state) => state.deleteSubtask);
  const addComment = useOpsStore((state) => state.addComment);
  const addTimeLog = useOpsStore((state) => state.addTimeLog);
  const activeTimer = useOpsStore((state) => state.activeTimer);
  const startTimer = useOpsStore((state) => state.startTimer);
  const stopTimer = useOpsStore((state) => state.stopTimer);

  const [activeTab, setActiveTab] = useState<'details' | 'time' | 'activity'>('details');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [commentText, setCommentText] = useState('');
  const [logMinutes, setLogMinutes] = useState(30);
  const [logDesc, setLogDesc] = useState('');
  const [isBillable, setIsBillable] = useState(false);
  const [elapsedTimerSecs, setElapsedTimerSecs] = useState(0);

  const task = tasks.find((t) => t.id === selectedTaskId);
  const space = spaces.find((s) => s.id === task?.spaceId);

  // Live timer interval calculation
  useEffect(() => {
    let interval: any = null;
    if (activeTimer && activeTimer.taskId === task?.id) {
      interval = setInterval(() => {
        setElapsedTimerSecs(Math.floor((Date.now() - activeTimer.startTime) / 1000));
      }, 1000);
    } else {
      setElapsedTimerSecs(0);
    }
    return () => clearInterval(interval);
  }, [activeTimer, task?.id]);

  if (!task || !selectedTaskId) return null;

  const totalTimeLogged = task.timeLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const subtasksCompleted = task.subtasks.filter((st) => st.completed).length;
  const subtaskProgress = task.subtasks.length > 0 ? Math.round((subtasksCompleted / task.subtasks.length) * 100) : 0;

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val && val !== task.title) {
      updateTask(task.id, { title: val });
    }
  };

  const handleDescBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val !== task.description) {
      updateTask(task.id, { description: val });
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  const handleToggleSubtaskCheck = (stId: string) => {
    toggleSubtask(task.id, stId);
    if (subtaskProgress >= 80) {
      triggerConfetti();
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(task.id, commentText.trim());
    setCommentText('');
  };

  const handleAddManualTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (logMinutes <= 0) return;
    addTimeLog(task.id, logMinutes, logDesc || 'Manual time entry', isBillable);
    setLogDesc('');
  };

  const isTimerRunningOnThisTask = activeTimer?.taskId === task.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={() => setSelectedTaskId(null)}
      />

      <div className="relative w-full max-w-5xl bg-white dark:bg-dark-300 rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border z-10 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 dark:border-dark-border bg-gray-50/70 dark:bg-dark-200/50">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">
              {task.taskNumber}
            </span>
            <span className="text-gray-400">/</span>
            <div className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: space?.color || '#6366f1' }} />
              <span>{space?.name || 'Operations'}</span>
            </div>
            {task.customFields?.slaStatus && (
              <span
                className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${
                  task.customFields.slaStatus === 'breached'
                    ? 'bg-red-500/20 text-red-500'
                    : task.customFields.slaStatus === 'at_risk'
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-emerald-500/20 text-emerald-500'
                }`}
              >
                SLA: {task.customFields.slaStatus.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Live Stopwatch Quick Button in Header */}
            {isTimerRunningOnThisTask ? (
              <button
                type="button"
                onClick={stopTimer}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-semibold shadow hover:bg-red-600 transition-colors animate-pulse"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop ({formatSecondsToDigital(elapsedTimerSecs)})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startTimer(task.id)}
                className="flex items-center gap-1.5 px-3 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-lg text-xs font-semibold transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Timer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to delete this task?')) {
                  deleteTask(task.id);
                }
              }}
              title="Delete Task"
              className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-dark-border">
          {/* Left / Main Column (2 cols) */}
          <div className="lg:col-span-2 p-6 space-y-6">
            {/* Title */}
            <div>
              <input
                type="text"
                defaultValue={task.title}
                onBlur={handleTitleBlur}
                className="w-full text-xl sm:text-2xl font-bold bg-transparent border-none text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-500/50 rounded p-1 -ml-1 transition-all"
                placeholder="Task title..."
              />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-dark-border pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'details'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Task Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('time')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'time'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Time Tracking ({formatTimeMinutes(totalTimeLogged)})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'activity'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit & Comments ({task.comments.length})</span>
              </button>
            </div>

            {/* TAB: Details */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                    Description & Operating Notes
                  </label>
                  <textarea
                    defaultValue={task.description}
                    onBlur={handleDescBlur}
                    rows={4}
                    placeholder="Enter full operational details, SOP references, or delivery instructions..."
                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-border text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed resize-y"
                  />
                </div>

                {/* Subtask Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Subtasks & Checklist
                      </span>
                      <span className="text-xs font-semibold text-gray-500">
                        {subtasksCompleted}/{task.subtasks.length} ({subtaskProgress}%)
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-gray-100 dark:bg-dark-200 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full transition-all duration-300 ${
                        subtaskProgress === 100 ? 'bg-emerald-500' : 'bg-brand-500'
                      }`}
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>

                  {/* Subtask Items */}
                  <div className="space-y-1.5">
                    {task.subtasks.map((st) => (
                      <div
                        key={st.id}
                        className="group flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-200 border border-transparent hover:border-gray-200 dark:hover:border-dark-border transition-all"
                      >
                        <div className="flex items-center gap-2.5 flex-1 mr-2">
                          <input
                            type="checkbox"
                            checked={st.completed}
                            onChange={() => handleToggleSubtaskCheck(st.id)}
                            className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-gray-300 dark:border-dark-border dark:bg-dark-400 cursor-pointer"
                          />
                          <span
                            className={`text-sm ${
                              st.completed
                                ? 'line-through text-gray-400 dark:text-gray-500'
                                : 'text-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {st.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteSubtask(task.id, st.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 rounded transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Quick Add Subtask */}
                    <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                      <Plus className="w-4 h-4 text-gray-400 ml-2" />
                      <input
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="Add new checklist item..."
                        className="flex-1 bg-transparent border-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none py-1.5"
                      />
                      {newSubtaskTitle.trim() && (
                        <button
                          type="submit"
                          className="px-3 py-1 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 shadow"
                        >
                          Add
                        </button>
                      )}
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Time Tracking */}
            {activeTab === 'time' && (
              <div className="space-y-6">
                {/* Stopwatch Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-500/10 to-indigo-500/5 dark:from-brand-500/20 dark:to-dark-200 border border-brand-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase text-brand-600 dark:text-brand-400">
                      Live Operations Stopwatch
                    </div>
                    <div className="text-3xl font-mono font-extrabold text-gray-900 dark:text-gray-100 mt-1">
                      {isTimerRunningOnThisTask ? formatSecondsToDigital(elapsedTimerSecs) : '00:00:00'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {isTimerRunningOnThisTask ? 'Timer actively recording...' : 'Click start to track ongoing operational time'}
                    </div>
                  </div>

                  <div>
                    {isTimerRunningOnThisTask ? (
                      <button
                        type="button"
                        onClick={stopTimer}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        <span>Stop & Log Time</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startTimer(task.id)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/25 transition-all"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Stopwatch</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Manual Log Form */}
                <form onSubmit={handleAddManualTime} className="p-4 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-border space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Add Manual Time Entry
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Duration (Minutes)</label>
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={logMinutes}
                        onChange={(e) => setLogMinutes(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Work Note</label>
                      <input
                        type="text"
                        value={logDesc}
                        onChange={(e) => setLogDesc(e.target.value)}
                        placeholder="e.g. Conducted site audit and verified telemetry"
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isBillable}
                        onChange={(e) => setIsBillable(e.target.checked)}
                        className="rounded text-brand-500"
                      />
                      <span>Billable to client</span>
                    </label>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 shadow"
                    >
                      Log Time
                    </button>
                  </div>
                </form>

                {/* Logged History List */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                    Time Entry History ({task.timeLogs.length})
                  </div>
                  {task.timeLogs.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4 italic">
                      No time entries recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {task.timeLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border"
                        >
                          <div>
                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                              {log.description}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              Logged by <span className="text-brand-500 font-medium">{log.userName}</span> on {new Date(log.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 font-mono">
                              {formatTimeMinutes(log.durationMinutes)}
                            </span>
                            {log.billable && (
                              <span className="block text-[10px] text-emerald-500 font-semibold uppercase">
                                Billable
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: Activity & Comments */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                {/* Post Comment */}
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <textarea
                      rows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write an operational update, tag @member, or leave a handover note..."
                      className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-border text-gray-800 dark:text-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    />
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="submit"
                        disabled={!commentText.trim()}
                        className="flex items-center gap-1 px-3.5 py-1.5 bg-brand-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 transition-all"
                      >
                        <Send className="w-3 h-3" />
                        <span>Comment</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Discussion Feed
                  </div>
                  {task.comments.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-3 italic">
                      No comments yet. Start the conversation!
                    </div>
                  ) : (
                    task.comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border flex gap-3"
                      >
                        <img
                          src={c.userAvatar}
                          alt={c.userName}
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                              {c.userName}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                            {c.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* System Activity Trail */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                    System Audit Trail
                  </div>
                  <div className="space-y-2 border-l-2 border-gray-200 dark:border-dark-border pl-3 ml-2 text-xs">
                    {task.activityLogs.map((act) => (
                      <div key={act.id} className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-200">{act.userName}</span>{' '}
                        {act.action}{' '}
                        <span className="text-[10px] text-gray-400">
                          ({new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Metadata, Custom Fields & Properties (1 col) */}
          <div className="p-6 bg-gray-50/50 dark:bg-dark-200/30 space-y-5">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Operational Properties
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                Workflow Status
              </label>
              <StatusBadge
                statusId={task.status}
                space={space}
                onChange={(newStatus) => updateTask(task.id, { status: newStatus })}
                size="md"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                Priority
              </label>
              <PriorityBadge
                priority={task.priority}
                onChange={(newPriority: Priority) => updateTask(task.id, { priority: newPriority })}
                size="md"
              />
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                Assigned Team
              </label>
              <div className="space-y-1">
                {users.map((u) => {
                  const isAssigned = task.assigneeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        const newAssignees = isAssigned
                          ? task.assigneeIds.filter((id) => id !== u.id)
                          : [...task.assigneeIds, u.id];
                        if (newAssignees.length > 0) {
                          updateTask(task.id, { assigneeIds: newAssignees });
                        }
                      }}
                      className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors ${
                        isAssigned
                          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                          : 'hover:bg-gray-100 dark:hover:bg-dark-100 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img src={u.avatar} alt={u.name} className="w-5 h-5 rounded-full object-cover" />
                        <span>{u.name}</span>
                      </div>
                      {isAssigned && <span className="text-[10px] bg-brand-500 text-white px-1.5 rounded">Active</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due Date & Estimates */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Est. Hours
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={task.estimatedHours || 0}
                  onChange={(e) => updateTask(task.id, { estimatedHours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-xs"
                />
              </div>
            </div>

            {/* Custom Fields Section */}
            <div className="pt-3 border-t border-gray-200 dark:border-dark-border space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                <span>Ops Custom Fields</span>
              </div>

              {/* SLA Status Field */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  SLA Health Status
                </label>
                <select
                  value={task.customFields?.slaStatus || 'within_sla'}
                  onChange={(e) =>
                    updateTask(task.id, {
                      customFields: { ...task.customFields, slaStatus: e.target.value as any }
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-xs font-medium"
                >
                  <option value="within_sla">🟢 Within Target SLA</option>
                  <option value="at_risk">🟡 At Risk (Near Threshold)</option>
                  <option value="breached">🔴 Breached (Escalated)</option>
                </select>
              </div>

              {/* Client / Account Field */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Client / Account
                </label>
                <input
                  type="text"
                  value={task.customFields?.clientName || ''}
                  onChange={(e) =>
                    updateTask(task.id, {
                      customFields: { ...task.customFields, clientName: e.target.value }
                    })
                  }
                  placeholder="e.g. Apex Global Logistics"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-xs"
                />
              </div>

              {/* Risk Level */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Operational Risk Level
                </label>
                <select
                  value={task.customFields?.riskLevel || 'Low'}
                  onChange={(e) =>
                    updateTask(task.id, {
                      customFields: { ...task.customFields, riskLevel: e.target.value as any }
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-xs"
                >
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                  <option value="Critical">Critical Risk</option>
                </select>
              </div>

              {/* Budget & Cost */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Budget ($)
                  </label>
                  <input
                    type="number"
                    value={task.customFields?.budget || ''}
                    onChange={(e) =>
                      updateTask(task.id, {
                        customFields: { ...task.customFields, budget: parseFloat(e.target.value) || 0 }
                      })
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Cost ($)
                  </label>
                  <input
                    type="number"
                    value={task.customFields?.cost || ''}
                    onChange={(e) =>
                      updateTask(task.id, {
                        customFields: { ...task.customFields, cost: parseFloat(e.target.value) || 0 }
                      })
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-1">
                {task.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-dark-100 text-[10px] font-medium text-gray-700 dark:text-gray-300"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
