import React from 'react';
import { User } from '../../types';
import { useOpsStore } from '../../store/opsStore';

interface AvatarGroupProps {
  userIds: string[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({ userIds, max = 3, size = 'sm' }) => {
  const users = useOpsStore((state) => state.users);
  const assignedUsers = userIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u));

  const visibleUsers = assignedUsers.slice(0, max);
  const overflow = assignedUsers.length - max;

  const sizeClasses = {
    xs: 'w-5 h-5 min-w-[20px] max-w-[20px] min-h-[20px] max-h-[20px] text-[9px]',
    sm: 'w-6 h-6 min-w-[24px] max-w-[24px] min-h-[24px] max-h-[24px] text-[10px]',
    md: 'w-8 h-8 min-w-[32px] max-w-[32px] min-h-[32px] max-h-[32px] text-xs'
  };

  if (assignedUsers.length === 0) {
    return (
      <span className="text-xs text-gray-400 dark:text-gray-500 italic">Unassigned</span>
    );
  }

  return (
    <div className="flex items-center -space-x-1.5 overflow-hidden">
      {visibleUsers.map((user) => (
        <div
          key={user.id}
          className={`relative inline-flex items-center justify-center rounded-full ring-2 ring-white dark:ring-dark-300 font-semibold uppercase flex-shrink-0 overflow-hidden ${sizeClasses[size]}`}
          title={`${user.name} (${user.role})`}
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-brand-500 text-white flex items-center justify-center">
              {user.initials}
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={`flex items-center justify-center rounded-full bg-gray-200 dark:bg-dark-100 text-gray-700 dark:text-gray-300 font-bold ring-2 ring-white dark:ring-dark-300 flex-shrink-0 ${sizeClasses[size]}`}
          title={`${overflow} more member${overflow > 1 ? 's' : ''}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};
