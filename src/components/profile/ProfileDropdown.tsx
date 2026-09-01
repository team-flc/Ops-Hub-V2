import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DISPLAY_NAMES } from '../../types';
import { User, LogOut, Mail } from 'lucide-react';
import { useOpsStore } from '../../store/opsStore';

export const ProfileDropdown: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const setViewMode = useOpsStore((state) => state.setViewMode);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.fullName || user?.email?.split('@')[0] || 'Staff Member';
  const displayRole = profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'Team Member';
  const displayEmail = profile?.workEmail || user?.email || 'N/A';
  const avatarUrl = profile?.avatarUrl;

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'FL';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenMyProfile = () => {
    setViewMode('profile');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button: Avatar / Initials */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Staff Profile Menu"
        className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-200 transition-all border border-transparent hover:border-gray-200 dark:border-dark-border"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-xl object-cover border border-gray-200 dark:border-dark-border shadow-sm"
          />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            {initials}
          </div>
        )}
      </button>

      {/* Profile Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-xl z-50 p-2 text-xs animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* User Header */}
          <div className="p-3 border-b border-gray-100 dark:border-dark-border/60 flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-dark-border flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-gray-900 dark:text-gray-100 truncate text-xs">
                {displayName}
              </div>
              <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 inline-block mt-0.5">
                {displayRole}
              </div>
            </div>
          </div>

          {/* Work Email (Read-Only) */}
          <div className="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 border-b border-gray-100 dark:border-dark-border/60">
            <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate font-mono">{displayEmail}</span>
          </div>

          {/* Menu Actions */}
          <div className="p-1 space-y-1">
            <button
              type="button"
              onClick={handleOpenMyProfile}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-100 font-semibold transition-colors text-left"
            >
              <User className="w-4 h-4 text-brand-500" />
              <span>My Profile</span>
            </button>

            {/* Exactly One Sign Out in Authenticated Application */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};