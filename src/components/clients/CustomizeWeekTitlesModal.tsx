import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X, Sparkles, RotateCcw, Check, Edit3 } from 'lucide-react';
import { ClientRecord } from '../../types';

interface CustomizeWeekTitlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientRecord;
  onSave: (customTitles: Record<number, string>) => void;
}

const AGENCY_PRESET: Record<number, string> = {
  1: 'Social Media Optimization',
  2: 'LinkedIn Optimization + 1 Reporting',
  3: 'SEO Optimization + 2 Reportings',
  4: 'Paid Ads Optimization + 3 Reportings'
};

export const CustomizeWeekTitlesModal: React.FC<CustomizeWeekTitlesModalProps> = ({
  isOpen,
  onClose,
  client,
  onSave
}) => {
  const existing = client.customWeekTitles || {};
  const [w1, setW1] = useState(existing[1] || existing['1'] || '');
  const [w2, setW2] = useState(existing[2] || existing['2'] || '');
  const [w3, setW3] = useState(existing[3] || existing['3'] || '');
  const [w4, setW4] = useState(existing[4] || existing['4'] || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = client.customWeekTitles || {};
      setW1(current[1] || current['1'] || '');
      setW2(current[2] || current['2'] || '');
      setW3(current[3] || current['3'] || '');
      setW4(current[4] || current['4'] || '');
    }
  }, [isOpen, client.customWeekTitles]);

  if (!isOpen) return null;

  const handleApplyPreset = () => {
    setW1(AGENCY_PRESET[1]);
    setW2(AGENCY_PRESET[2]);
    setW3(AGENCY_PRESET[3]);
    setW4(AGENCY_PRESET[4]);
  };

  const handleResetDefaults = () => {
    setW1('');
    setW2('');
    setW3('');
    setW4('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: Record<number, string> = {};
      if (w1.trim()) updated[1] = w1.trim();
      if (w2.trim()) updated[2] = w2.trim();
      if (w3.trim()) updated[3] = w3.trim();
      if (w4.trim()) updated[4] = w4.trim();

      onSave(updated);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-300/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Customize 30-Day Setup Week Titles
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure descriptive milestone names for {client.companyName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Quick Preset Action Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-500/20">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
              <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
              <span>Agency Marketing Preset</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyPreset}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-brand-500 hover:bg-brand-600 text-white shadow-xs transition-colors cursor-pointer"
              >
                Apply Preset
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-dark-200 transition-colors cursor-pointer"
                title="Reset to default Week 1 - 4 titles"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Week 1 Input */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
              <span>Week 1 Milestone</span>
              <span className="text-[11px] font-normal text-gray-400">Default: Week 1</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={w1}
                onChange={(e) => setW1(e.target.value)}
                placeholder="e.g. Social Media Optimization"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-dark-sidebar border border-gray-200 dark:border-dark-border rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Week 2 Input */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
              <span>Week 2 Milestone</span>
              <span className="text-[11px] font-normal text-gray-400">Default: Week 2</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={w2}
                onChange={(e) => setW2(e.target.value)}
                placeholder="e.g. LinkedIn Optimization + 1 Reporting"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-dark-sidebar border border-gray-200 dark:border-dark-border rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Week 3 Input */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
              <span>Week 3 Milestone</span>
              <span className="text-[11px] font-normal text-gray-400">Default: Week 3</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={w3}
                onChange={(e) => setW3(e.target.value)}
                placeholder="e.g. SEO Optimization + 2 Reportings"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-dark-sidebar border border-gray-200 dark:border-dark-border rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Week 4 Input */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
              <span>Week 4 Milestone</span>
              <span className="text-[11px] font-normal text-gray-400">Default: Week 4</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={w4}
                onChange={(e) => setW4(e.target.value)}
                placeholder="e.g. Paid Ads Optimization + 3 Reportings"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-dark-sidebar border border-gray-200 dark:border-dark-border rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl shadow-md shadow-brand-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Save Week Titles</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
