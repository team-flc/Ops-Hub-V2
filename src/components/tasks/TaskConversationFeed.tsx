import React from 'react';
import { MessageSquare, Link as LinkIcon, ExternalLink, History } from 'lucide-react';
import { TaskMessage, ClientTaskEvent } from '../../types';

interface TaskConversationFeedProps {
  feed: Array<{ type: 'message' | 'event'; data: TaskMessage | ClientTaskEvent; timestamp: string; id?: string }>;
  events: ClientTaskEvent[];
  isLoadingFeed: boolean;
  hasMoreFeed: boolean;
  onLoadOlderFeed: () => void;
  isClient: boolean;
  formatDatetime: (dateStr: string) => string;
  feedEndRef?: React.RefObject<HTMLDivElement | null>;
}

export const TaskConversationFeed: React.FC<TaskConversationFeedProps> = ({
  feed,
  events,
  isLoadingFeed,
  hasMoreFeed,
  onLoadOlderFeed,
  isClient,
  formatDatetime,
  feedEndRef
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
          <span>Task Conversation Feed</span>
        </span>

        {hasMoreFeed && (
          <button
            type="button"
            onClick={onLoadOlderFeed}
            disabled={isLoadingFeed}
            className="text-[11px] font-bold text-brand-600 hover:text-brand-700 disabled:opacity-50 cursor-pointer"
          >
            {isLoadingFeed ? 'Loading older...' : 'Load older messages'}
          </button>
        )}
      </div>

      {/* Feed List */}
      <div className="space-y-3">
        {feed.length === 0 && !isLoadingFeed && (
          <div className="text-center py-6 border border-dashed border-gray-200 dark:border-dark-border rounded-xl text-gray-400 text-xs">
            No conversation messages or events recorded yet.
          </div>
        )}

        {feed.map((item, idx) => {
          if (item.type === 'message') {
            const msg = item.data as TaskMessage;
            const isInternal = msg.visibility === 'internal_note';

            // Safeguard: Never render internal notes to clients
            if (isClient && isInternal) return null;

            return (
              <div
                key={msg.id || idx}
                className={`p-3.5 rounded-xl border transition-all ${
                  isInternal
                    ? 'bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40'
                    : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {msg.authorName || 'User'}
                    </span>
                    <span className="text-[10px] text-gray-400 capitalize">
                      ({msg.authorRole?.replace(/_/g, ' ') || 'staff'})
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                      isInternal
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300'
                    }`}>
                      {isInternal ? 'Internal Note' : 'Shared with Client'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {formatDatetime(msg.createdAt)}
                  </span>
                </div>

                <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                  {msg.content}
                </p>

                {/* Attached Links */}
                {msg.links && msg.links.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-dark-border space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                      Attached Links ({msg.links.length}/5):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.links.map((link, lIdx) => (
                        <a
                          key={lIdx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-dark-100 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/40 text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border transition-colors max-w-full sm:max-w-xs truncate"
                        >
                          <LinkIcon className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{link.title || link.url}</span>
                          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // Lifecycle / Audit Event
          const evt = item.data as ClientTaskEvent;
          return (
            <div key={evt.id || idx} className="flex items-start gap-2 text-[11px] py-1 text-gray-500 dark:text-gray-400 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700 dark:text-gray-300 capitalize">
                    {evt.eventType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatDatetime(evt.createdAt)}</span>
                </div>
                {evt.notes && (
                  <p className="text-[10px] text-gray-500 italic mt-0.5 break-words">{evt.notes}</p>
                )}
              </div>
            </div>
          );
        })}
        {feedEndRef && <div ref={feedEndRef} />}
      </div>

      {/* Immutable Audit History Snapshot */}
      <div className="pt-3 border-t border-gray-100 dark:border-dark-border">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <History className="w-3.5 h-3.5" />
          <span>Immutable Task Audit History</span>
        </span>
        <div className="space-y-1.5 border-l-2 border-gray-100 dark:border-dark-border pl-3 ml-1.5">
          {events.length === 0 && !isLoadingFeed && (
            <p className="text-gray-400 text-xs italic">No previous events recorded.</p>
          )}
          {events.slice(0, 5).map((evt) => (
            <div key={evt.id} className="text-[10px] text-gray-500">
              <span className="font-bold text-gray-700 dark:text-gray-300">{evt.actorName}:</span>{' '}
              <span className="capitalize">{evt.eventType.replace(/_/g, ' ')}</span>{' '}
              <span className="text-gray-400">({formatDatetime(evt.createdAt)})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
