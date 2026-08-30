import React, { useState, useRef, useEffect } from 'react';
import { Priority } from '../../types';
import { Flag, ChevronDown, Check } from 'lucide-react';
import { getPriorityBadge } from '../../utils/helpers';

interface PriorityBadgeProps {
  priority: Priority;
  onChange?: (newPriority: Priority) => void;
  size?: 'sm' | 'md';
  readonly?: boolean;
  showLabel?: boolean;
}

const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: 'urgent', label: 'Urgent', color: '#ef4444' },
  { id: 'high', label: 'High', color: '#f59e0b' },
  { id: 'normal', label: 'Normal', color: '#3b82f6' },
  { id: 'low', label: 'Low', color: '#94a3b8' }
];

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  onChange,
  size = 'sm',
  readonly = false,
  showLabel = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const badgeInfo = getPriorityBadge(priority);

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
        className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-all ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
        } ${badgeInfo.bgColor} ${badgeInfo.textColor} ${
          readonly || !onChange ? 'cursor-default' : 'hover:opacity-80 cursor-pointer'
        }`}
        title={`Priority: ${badgeInfo.label}`}
      >
        <Flag className={`w-3.5 h-3.5 fill-current`} />
        {showLabel && <span>{badgeInfo.label}</span>}
        {!readonly && onChange && <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />}
      </button>

      {isOpen && onChange && (
        <div className="absolute left-0 mt-1.5 w-36 bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-border rounded-xl shadow-xl z-50 py-1.5 text-xs animate-scale-up">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Set Priority
          </div>
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(p.id);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5" style={{ color: p.color, fill: p.color }} />
                <span className="font-medium">{p.label}</span>
              </div>
              {p.id === priority && <Check className="w-3.5 h-3.5 text-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
