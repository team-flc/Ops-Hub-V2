import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Clock, ShieldCheck } from 'lucide-react';

export const ClientPortalHoldingPage: React.FC = () => {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen w-screen bg-slate-50 flex flex-col justify-between items-center p-6 font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Faseeh Lall & Co."
            className="h-8 w-auto object-contain"
          />
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-card text-center space-y-5 my-auto">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center mx-auto shadow-sm">
          <Clock className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
            <span>Authorized Client Portal</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Client Portal
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
            Your secure client workspace is being prepared.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500">
          Logged in as <span className="font-semibold text-slate-800">{user?.email}</span>. You will be notified as soon as your client deliverables dashboard is published.
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center py-4 text-xs text-slate-400 border-t border-slate-200">
        © {new Date().getFullYear()} Faseeh Lall & Co. All rights reserved.
      </footer>
    </div>
  );
};
