import React, { useState, useEffect, useRef } from 'react';
import { Radio } from 'lucide-react';
import { taskManagementService } from '../../lib/taskManagementService';
import { ClientActiveAnnouncement } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface LiveActivityTickerProps {
  /** Client ID whose announcements this ticker should show */
  clientId: string;
  /** data-testid prefix for automated tests */
  testId?: string;
}

export const LiveActivityTicker: React.FC<LiveActivityTickerProps> = ({
  clientId,
  testId = 'live-activity-ticker'
}) => {
  const [announcements, setAnnouncements] = useState<ClientActiveAnnouncement[]>([]);
  const channelRef = useRef<any>(null);

  // Fetch on mount and restore after reload
  useEffect(() => {
    if (!clientId) return;
    let isMounted = true;

    const load = async () => {
      const res = await taskManagementService.fetchActiveAnnouncements(clientId);
      if (isMounted && !res.error) {
        setAnnouncements(res.data);
      }
    };
    load();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  // Supabase Realtime subscription — strict client isolation via filter
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !clientId) return;
    const sb = supabase; // narrow type to non-null

    if (typeof sb.channel !== 'function') return;

    // Unsubscribe from any previous channel before creating a new one
    if (channelRef.current && typeof sb.removeChannel === 'function') {
      sb.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `client_announcements_${clientId}`;
    const channel = sb
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_active_announcements',
          filter: `client_id=eq.${clientId}`
        },
        (payload: any) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === 'INSERT') {
            const ann = rowToAnnouncement(newRow);
            if (ann.isActive) {
              setAnnouncements((prev) => {
                // Avoid duplicates
                if (prev.some((a) => a.id === ann.id)) return prev;
                return [...prev, ann];
              });
            }
          } else if (eventType === 'UPDATE') {
            const ann = rowToAnnouncement(newRow);
            setAnnouncements((prev) => {
              if (!ann.isActive) {
                // Remove if deactivated
                return prev.filter((a) => a.taskId !== ann.taskId);
              }
              const exists = prev.some((a) => a.id === ann.id);
              if (exists) {
                return prev.map((a) => (a.id === ann.id ? ann : a));
              }
              return [...prev, ann];
            });
          } else if (eventType === 'DELETE') {
            const deletedId = oldRow?.id;
            const deletedTaskId = oldRow?.task_id;
            setAnnouncements((prev) =>
              prev.filter((a) => a.id !== deletedId && a.taskId !== deletedTaskId)
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && typeof sb.removeChannel === 'function') {
        sb.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clientId]);

  // Hide bar when no active announcements
  if (announcements.length === 0) {
    return null;
  }

  // Build ticker text — only message field, never evidence/notes/timer internals
  const tickerText = announcements.map((a) => a.message).join('   ●   ');

  return (
    <div
      data-testid={testId}
      className="w-full bg-emerald-600 dark:bg-emerald-700 text-white overflow-hidden flex items-center gap-3 px-4 py-2 border-b border-emerald-700 dark:border-emerald-800 select-none"
      aria-live="polite"
      aria-label="Live team activity"
    >
      {/* Live indicator icon */}
      <div className="flex items-center gap-1.5 flex-shrink-0 text-emerald-100">
        <Radio className="w-3.5 h-3.5 animate-pulse" />
        <span className="text-[10px] font-black tracking-widest uppercase opacity-90">Live</span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="whitespace-nowrap text-xs font-semibold animate-marquee"
          data-testid={`${testId}-text`}
          style={{
            display: 'inline-block',
            animation: 'marquee 30s linear infinite'
          }}
        >
          {tickerText}
          &nbsp;&nbsp;&nbsp;●&nbsp;&nbsp;&nbsp;
          {tickerText}
        </div>
      </div>

      {/* Inline keyframes injected via style tag */}
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

function rowToAnnouncement(row: any): ClientActiveAnnouncement {
  return {
    id: row.id,
    clientId: row.client_id,
    taskId: row.task_id,
    message: row.message,
    teamMemberId: row.team_member_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
