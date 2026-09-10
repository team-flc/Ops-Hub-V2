// ==============================================================================
// COMPONENT: ClientReportModal
// Location: src/components/portal/reports/ClientReportModal.tsx
// Phase: Custom-Date PDF Reporting Launcher
// ==============================================================================

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, FileDown, Calendar, AlertCircle, 
  CheckCircle2, Loader2, Sparkles 
} from 'lucide-react';
import { 
  ClientRecord, 
  ClientTask, 
  ClientPublishedResult, 
  ClientDeliverableItem, 
  ClientRoadmapMilestone, 
  PortalDateRange 
} from '../../../types';
import { 
  clientPdfReportService, 
  getPresetDateRanges, 
  validateDateRange, 
  formatReportDate 
} from '../../../lib/clientPdfReportService';

interface ClientReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientRecord;
  tasks: ClientTask[];
  publishedResults: ClientPublishedResult[];
  deliverables: ClientDeliverableItem[];
  roadmapMilestones: ClientRoadmapMilestone[];
  currentDateRange: PortalDateRange;
}

export const ClientReportModal: React.FC<ClientReportModalProps> = ({
  isOpen,
  onClose,
  client,
  tasks,
  publishedResults,
  deliverables,
  roadmapMilestones,
  currentDateRange
}) => {
  const presets = getPresetDateRanges();

  const [selectedPreset, setSelectedPreset] = useState<'this_week' | 'this_month' | 'last_month' | 'custom'>(currentDateRange.preset);
  const [customStart, setCustomStart] = useState<string>(currentDateRange.startDate);
  const [customEnd, setCustomEnd] = useState<string>(currentDateRange.endDate);

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successFilename, setSuccessFilename] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: 'this_week' | 'this_month' | 'last_month' | 'custom') => {
    setSelectedPreset(preset);
    setErrorMessage(null);
    if (preset === 'this_week') {
      setCustomStart(presets.thisWeek.startDate);
      setCustomEnd(presets.thisWeek.endDate);
    } else if (preset === 'this_month') {
      setCustomStart(presets.thisMonth.startDate);
      setCustomEnd(presets.thisMonth.endDate);
    } else if (preset === 'last_month') {
      setCustomStart(presets.lastMonth.startDate);
      setCustomEnd(presets.lastMonth.endDate);
    }
  };

  const getEffectiveRange = (): PortalDateRange => {
    if (selectedPreset === 'this_week') return presets.thisWeek;
    if (selectedPreset === 'this_month') return presets.thisMonth;
    if (selectedPreset === 'last_month') return presets.lastMonth;
    return {
      preset: 'custom',
      startDate: customStart,
      endDate: customEnd,
      label: `${formatReportDate(customStart)} – ${formatReportDate(customEnd)}`
    };
  };

  const handleGenerate = async () => {
    setErrorMessage(null);
    setSuccessFilename(null);

    const range = getEffectiveRange();
    const val = validateDateRange(range.startDate, range.endDate);
    if (!val.valid) {
      setErrorMessage(val.error || 'Invalid date range.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await clientPdfReportService.generateClientReportPdf({
        client,
        dateRange: range,
        tasks,
        publishedResults,
        deliverables,
        roadmapMilestones
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to generate PDF document.');
      } else {
        setSuccessFilename(res.filename || 'report.pdf');
        setTimeout(() => {
          onClose();
        }, 2200);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected failure while generating PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const effectiveRange = getEffectiveRange();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        role="dialog"
        aria-labelledby="report-modal-title"
        className="w-full max-w-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/20">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 id="report-modal-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
                Download Client Progress Report
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Factual executive summary, verified outcomes, and deliverable indices
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
              Reporting Period
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('this_week')}
                className={`py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedPreset === 'this_week'
                    ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                    : 'bg-white dark:bg-dark-100 border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-200'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('this_month')}
                className={`py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedPreset === 'this_month'
                    ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                    : 'bg-white dark:bg-dark-100 border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-200'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('last_month')}
                className={`py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedPreset === 'last_month'
                    ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                    : 'bg-white dark:bg-dark-100 border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-200'
                }`}
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedPreset === 'custom'
                    ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                    : 'bg-white dark:bg-dark-100 border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-200'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Custom Date Inputs */}
          {selectedPreset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                  Start Date (Inclusive)
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 font-medium min-h-[44px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                  End Date (Inclusive)
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 font-medium min-h-[44px]"
                />
              </div>
            </div>
          )}

          {/* Report Metadata Summary Preview */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Inclusive Window:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {formatReportDate(effectiveRange.startDate)} – {formatReportDate(effectiveRange.endDate)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Business Timezone:</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Asia/Karachi (PKT UTC+5)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Sections Included:</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                8 standard sections
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div 
              role="alert"
              className="flex items-start gap-2 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-shake"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {successFilename && (
            <div 
              role="status"
              className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-fade-in"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Downloaded {successFilename}!</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-100 dark:border-dark-border flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-dark-card/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Document...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Download Report (PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
