import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Database, CheckCircle2, AlertCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySql = async () => {
    try {
      const response = await fetch('/supabase_schema.sql');
      const text = await response.text();
      navigator.clipboard.writeText(text);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supabase Backend Integration"
      maxWidth="xl"
    >
      <div className="space-y-5 text-xs">
        {/* Status Card */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          isSupabaseConfigured
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isSupabaseConfigured ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">
                {isSupabaseConfigured ? 'Supabase Backend Connected' : 'Local Storage Mode (Ready for Supabase)'}
              </div>
              <div className="text-[11px] opacity-80">
                {isSupabaseConfigured
                  ? 'All tasks and spaces are synced in real-time to PostgreSQL.'
                  : 'Follow the 3 quick steps below to connect your free Supabase cloud database.'}
              </div>
            </div>
          </div>
          {isSupabaseConfigured && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
        </div>

        {/* 3 Step Guide */}
        <div className="space-y-4 pt-2">
          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[11px]">1</span>
                <span>Create a Free Project on Supabase</span>
              </span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-brand-500 hover:underline font-semibold"
              >
                <span>supabase.com</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-[11px]">
              Go to Supabase Dashboard $\rightarrow$ Click <strong>"New Project"</strong> $\rightarrow$ Name it <strong>"Ops-Hub"</strong>.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[11px]">2</span>
                <span>Run SQL Database Schema</span>
              </span>
              <span className="text-[11px] text-gray-400 font-mono">supabase_schema.sql</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-[11px]">
              Open the <strong>SQL Editor</strong> tab in your Supabase project, paste the contents of <code>supabase_schema.sql</code> (in the project root), and click <strong>RUN</strong>.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-200 border border-gray-100 dark:border-dark-border space-y-2">
            <span className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[11px]">3</span>
              <span>Add Environment Variables in <code>.env</code></span>
            </span>
            <p className="text-gray-500 dark:text-gray-400 text-[11px]">
              In Supabase $\rightarrow$ <strong>Project Settings $\rightarrow$ API</strong> $\rightarrow$ copy your URL and Anon Key into <code>.env</code>:
            </p>
            <div className="bg-gray-900 text-gray-200 p-3 rounded-lg font-mono text-[11px] select-all space-y-1">
              <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
              <div>VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 shadow"
          >
            Got It
          </button>
        </div>
      </div>
    </Modal>
  );
};
