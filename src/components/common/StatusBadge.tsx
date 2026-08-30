import React, { useState, useRef, useEffect } from 'react';
import { Space, StatusConfig } from '../../types';
import { ChevronDown, Check } from 'lucide-react';

interface StatusBadgeProps {
  statusId: string;
  space?: Space;
  allStatuses?: StatusConfig[];
  onChange?: (newStatus: string) => void;
  size?: 'sm' | 'md';
  readonly?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  statusId,
  space,
  allStatuses,
  onChange,
  size = 'sm',
  readonly = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const statuses = space?.statuses || allStatuses || [
    { id: 'todo', label: 'To Do', color: '#94a3b8', category: 'todo' },
    { id: 'in_progress', label: 'In Progress', color: '#3b82f6', category: 'inprogress' },
    { id: 'under_review', label: 'Under Review', color: '#8b5cf6', category: 'inprogress' },
    { id: 'blocked', label: 'Blocked', color: '#ef4444', category: 'blocked' },
    { id: 'completed', label: 'Completed', color: '#10b981', category: 'done' }
  ];

  const currentStatus = statuses.find((s) => s.id === statusId) || {
    id: statusId,
    label: statusId.replace('_', ' ').toUpperCase(),
    color: '#94a3b8',
    category: 'todo'
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        disabled={readonly || !onChange}
        onClick={(e) => {
          e.stopPropagation();
          if (!readonly && onChange) setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center gap-1.5 font-medium rounded-full transition-all border ${
          size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        } ${readonly || !onChange ? 'cursor-default' : 'hover:opacity-90 cursor-pointer shadow-sm'}`}
        style={{
          backgroundColor: `${currentStatus.color}15`,
          borderColor: `${currentStatus.color}40`,
          color: currentStatus.color
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse-subtle"
          style={{ backgroundColor: currentStatus.color }}
        />
        <span className="truncate max-w-[120px]">{currentStatus.label}</span>
        {!readonly && onChange && <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />}
      </button>

      {isOpen && onChange && (
        <div className="absolute left-0 mt-1.5 w-48 bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl shadow-xl z-50 py-1.5 text-xs animate-scale-up">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Select Status
          </div>
          {statuses.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(st.id);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                <span className="font-medium">{st.label}</span>
              </div>
              {st.id === statusId && <Check className="w-3.5 h-3.5 text-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
