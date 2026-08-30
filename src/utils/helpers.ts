import { Priority, StatusCategory } from '../types';
import confetti from 'canvas-confetti';

export function getPriorityBadge(priority: Priority): {
  label: string;
  bgColor: string;
  textColor: string;
  dotColor: string;
} {
  switch (priority) {
    case 'urgent':
      return {
        label: 'Urgent',
        bgColor: 'bg-red-500/10 dark:bg-red-500/20',
        textColor: 'text-red-600 dark:text-red-400',
        dotColor: 'bg-red-500'
      };
    case 'high':
      return {
        label: 'High',
        bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
        textColor: 'text-amber-600 dark:text-amber-400',
        dotColor: 'bg-amber-500'
      };
    case 'normal':
      return {
        label: 'Normal',
        bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
        textColor: 'text-blue-600 dark:text-blue-400',
        dotColor: 'bg-blue-500'
      };
    case 'low':
      return {
        label: 'Low',
        bgColor: 'bg-gray-500/10 dark:bg-gray-500/20',
        textColor: 'text-gray-600 dark:text-gray-400',
        dotColor: 'bg-gray-400'
      };
    default:
      return {
        label: 'Normal',
        bgColor: 'bg-gray-500/10',
        textColor: 'text-gray-500',
        dotColor: 'bg-gray-400'
      };
  }
}

export function getStatusCategoryBadge(category: StatusCategory): {
  bgColor: string;
  textColor: string;
} {
  switch (category) {
    case 'todo':
      return { bgColor: 'bg-slate-500/10 dark:bg-slate-500/20', textColor: 'text-slate-600 dark:text-slate-400' };
    case 'inprogress':
      return { bgColor: 'bg-blue-500/10 dark:bg-blue-500/20', textColor: 'text-blue-600 dark:text-blue-400' };
    case 'blocked':
      return { bgColor: 'bg-rose-500/10 dark:bg-rose-500/20', textColor: 'text-rose-600 dark:text-rose-400' };
    case 'done':
      return { bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20', textColor: 'text-emerald-600 dark:text-emerald-400' };
  }
}

export function formatTimeMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) return `${hours}h ${remainingMinutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${remainingMinutes}m`;
}

export function formatSecondsToDigital(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hours = Math.floor(mins / 60);
  const displayMins = mins % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${displayMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${displayMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'No due date';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

export function isOverdue(dateString?: string, status?: string): boolean {
  if (!dateString || status === 'completed') return false;
  const today = new Date().toISOString().split('T')[0];
  return dateString < today;
}

export function triggerConfetti() {
  confetti({
    particleCount: 75,
    spread: 60,
    origin: { y: 0.8 },
    colors: ['#7b68ee', '#38bdf8', '#10b981', '#f59e0b']
  });
}
