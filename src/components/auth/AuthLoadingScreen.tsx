import React from 'react';

export const AuthLoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen w-screen bg-slate-50 dark:bg-dark-400 flex flex-col items-center justify-center p-4 select-none">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="h-12 w-auto flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Faseeh Lall & Co."
            className="h-10 w-auto object-contain animate-pulse"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-gray-400">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping" />
          <span>Verifying secure session...</span>
        </div>
      </div>
    </div>
  );
};
