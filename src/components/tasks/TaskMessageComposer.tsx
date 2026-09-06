import React, { useState } from 'react';
import { Send, Link as LinkIcon, Plus, Trash2, Loader2 } from 'lucide-react';
import { TaskMessageVisibility, TaskExternalLink } from '../../types';
import { taskManagementService, validateHttpsLink } from '../../lib/taskManagementService';

interface TaskMessageComposerProps {
  taskId: string;
  clientId: string;
  isClient: boolean;
  isOwnerOrManager: boolean;
  isTaskArchived: boolean;
  isClientArchived: boolean;
  isClientPaused: boolean;
  onMessageSent: () => void;
}

export const TaskMessageComposer: React.FC<TaskMessageComposerProps> = ({
  taskId,
  clientId,
  isClient,
  isOwnerOrManager,
  isTaskArchived,
  isClientArchived,
  isClientPaused,
  onMessageSent
}) => {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<TaskMessageVisibility>(isClient ? 'shared_with_client' : 'internal_note');
  const [links, setLinks] = useState<TaskExternalLink[]>([]);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddLink = () => {
    setLinkError(null);
    if (!linkUrlInput.trim()) {
      setLinkError('Please enter a URL.');
      return;
    }
    if (links.length >= 5) {
      setLinkError('Maximum of 5 external links per item.');
      return;
    }

    const validation = validateHttpsLink(linkUrlInput.trim());
    if (!validation.valid) {
      setLinkError(validation.error || 'Invalid HTTPS URL.');
      return;
    }

    setLinks((prev) => [
      ...prev,
      {
        url: validation.sanitized!,
        title: linkTitleInput.trim() || undefined
      }
    ]);
    setLinkUrlInput('');
    setLinkTitleInput('');
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = content.trim();
    if (!trimmed) return;

    if (trimmed.length > 5000) {
      setError('Message exceeds maximum limit of 5,000 characters.');
      return;
    }

    if (isTaskArchived || isClientArchived) {
      setError('This task is archived. Conversations are read-only.');
      return;
    }

    if (isClientPaused) {
      if (!isOwnerOrManager) {
        setError('Client is paused. Operational conversation is paused.');
        return;
      }
      if (visibility !== 'internal_note') {
        setError('Only internal administrative notes are allowed for paused clients.');
        return;
      }
    }

    setIsSending(true);
    try {
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('msg_' + Date.now());
      const res = await taskManagementService.createTaskMessage({
        taskId,
        clientId,
        visibility: isClient ? 'shared_with_client' : visibility,
        content: trimmed,
        links,
        idempotencyKey
      });

      if (res.error) {
        setError(res.error);
        return;
      }

      setContent('');
      setLinks([]);
      setLinkUrlInput('');
      setLinkTitleInput('');
      onMessageSent();
    } catch (err: any) {
      setError(err?.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50/90 dark:bg-dark-card/90 flex-shrink-0 space-y-2.5">
      {error && (
        <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-600 dark:text-rose-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {isTaskArchived || isClientArchived ? (
        <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-dark-100 text-center text-gray-500 text-xs font-medium">
          This task was archived. Conversation feed is strictly read-only.
        </div>
      ) : isClientPaused && !isOwnerOrManager ? (
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-center text-amber-700 dark:text-amber-300 text-xs font-medium">
          Client is paused. Feed is read-only for Team Members and clients.
        </div>
      ) : (
        <>
          {isClientPaused && isOwnerOrManager && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-medium text-center">
              Client is paused. Only Internal administrative notes may be posted.
            </div>
          )}
          <form onSubmit={handleSendMessage} className="space-y-2.5">
            {/* Visibility Selector & Character Counter */}
            <div className="flex items-center justify-between">
              {!isClient ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setVisibility('internal_note')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      visibility === 'internal_note'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-dark-100 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    Internal Note
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility('shared_with_client')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      visibility === 'shared_with_client'
                        ? 'bg-brand-500 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-dark-100 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    Shared with Client
                  </button>
                </div>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-800 text-[10px] font-bold border border-cyan-300">
                  Shared with Team
                </span>
              )}

              <span className={`text-[10px] font-semibold ${
                content.length > 4500 ? 'text-rose-500 font-bold' : 'text-gray-400'
              }`}>
                {content.length} / 5,000
              </span>
            </div>

            {/* Message Textarea */}
            <textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                isClient
                  ? 'Message your delivery team regarding this deliverable...'
                  : visibility === 'internal_note'
                  ? 'Write an internal note (hidden from client)...'
                  : 'Message visible to client and team...'
              }
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none transition-all placeholder:text-gray-400"
            />

            {/* Attached Links Chips */}
            {links.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {links.map((link, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-200 dark:bg-dark-200 text-[11px] font-semibold text-gray-700 dark:text-gray-300"
                  >
                    <LinkIcon className="w-3 h-3 text-brand-500" />
                    <span className="max-w-[150px] truncate">{link.title || link.url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="text-gray-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Link Inputs and Send Button */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="url"
                  value={linkUrlInput}
                  onChange={(e) => setLinkUrlInput(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  disabled={links.length >= 5}
                  className="flex-1 min-w-0 px-2.5 py-2 sm:py-1 rounded-lg bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-brand-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={linkTitleInput}
                    onChange={(e) => setLinkTitleInput(e.target.value)}
                    placeholder="Link Title (optional)"
                    disabled={links.length >= 5}
                    className="flex-1 sm:w-36 min-w-0 px-2.5 py-2 sm:py-1 rounded-lg bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-border text-xs text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddLink}
                    disabled={links.length >= 5}
                    className="px-3 py-2 sm:py-1 bg-gray-200 dark:bg-dark-200 hover:bg-gray-300 dark:hover:bg-dark-100 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer min-h-[36px]"
                    title="Add Link"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Link</span>
                  </button>
                </div>
              </div>

              {linkError && (
                <p className="text-[11px] text-rose-500 font-semibold">{linkError}</p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSending || !content.trim()}
                  className="flex items-center justify-center gap-1.5 w-full sm:w-auto px-5 py-2.5 sm:py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 min-h-[44px] sm:min-h-[36px] cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
