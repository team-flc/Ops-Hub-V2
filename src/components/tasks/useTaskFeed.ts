import { useState, useEffect } from 'react';
import { TaskMessage, ClientTaskEvent, UserProfile } from '../../types';
import { taskManagementService } from '../../lib/taskManagementService';

interface UseTaskFeedProps {
  taskId?: string;
  activeUser?: UserProfile | null;
  isOpen: boolean;
}

export function useTaskFeed({ taskId, activeUser, isOpen }: UseTaskFeedProps) {
  const [feed, setFeed] = useState<Array<{ type: 'message' | 'event'; data: TaskMessage | ClientTaskEvent; timestamp: string; id?: string }>>([]);
  const [events, setEvents] = useState<ClientTaskEvent[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(false);
  const [nextCursor, setNextCursor] = useState<{ timestamp: string; id: string } | null>(null);

  const loadInitialFeed = async (id: string) => {
    setIsLoadingFeed(true);
    try {
      const feedRes = await taskManagementService.fetchTaskFeed(id, undefined, 30);
      setFeed(feedRes.combinedFeed);
      setEvents(feedRes.events);
      setHasMoreFeed(feedRes.hasMore);
      setNextCursor(feedRes.nextCursor);
    } catch {
      setFeed([]);
      setEvents([]);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const loadOlderFeed = async () => {
    if (!taskId || !nextCursor || isLoadingFeed) return;
    setIsLoadingFeed(true);
    try {
      const feedRes = await taskManagementService.fetchTaskFeed(
        taskId,
        nextCursor.timestamp,
        30,
        nextCursor.id
      );
      setFeed((prev) => {
        const combined = [...feedRes.combinedFeed, ...prev];
        combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return combined;
      });
      setHasMoreFeed(feedRes.hasMore);
      setNextCursor(feedRes.nextCursor);
    } catch {
      // Keep existing feed on error
    } finally {
      setIsLoadingFeed(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      loadInitialFeed(taskId);
      taskManagementService.markTaskRead(taskId, activeUser?.id);

      // Exactly one Realtime subscription per open task, cleanly removed on task change, modal close, and unmount
      const unsubscribe = taskManagementService.subscribeToTaskFeed(taskId, () => {
        loadInitialFeed(taskId);
        taskManagementService.markTaskRead(taskId, activeUser?.id);
      });

      return () => {
        unsubscribe();
      };
    } else {
      setFeed([]);
      setEvents([]);
      setHasMoreFeed(false);
      setNextCursor(null);
    }
  }, [isOpen, taskId, activeUser?.id]);

  return {
    feed,
    events,
    isLoadingFeed,
    hasMoreFeed,
    loadOlderFeed,
    refreshFeed: () => taskId && loadInitialFeed(taskId)
  };
}
