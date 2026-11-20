import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  UploadCloud,
  RotateCcw,
  Clock
} from 'lucide-react';
import type { DataQualityAudit, ModelRegistration } from '../types';
import { api } from '../services/api';

interface DataQualityPageProps {
  model: ModelRegistration | null;
  models: ModelRegistration[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
}

export const DataQualityPage: React.FC<DataQualityPageProps> = ({
  model,
  models: _models,
  selectedModelId,
  onSelectModel: _onSelectModel
}) => {
  const [audits, setAudits] = useState<DataQualityAudit[]>([]);
  const [activeAudit, setActiveAudit] = useState<DataQualityAudit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeModelId = selectedModelId || model?.id;

  const loadQualityHistory = useCallback(async () => {
    if (!activeModelId) return;
    try {
      setIsLoading(true);
      const history = await api.getDataQualityHistory(activeModelId, 15);
      setAudits(history);
      if (history.length > 0) {
        setActiveAudit(history[0]);
      } else {
        // Trigger initial audit if none exist
        const initial = await api.runDataQualityAudit({ model_id: activeModelId });
        setAudits([initial]);
        setActiveAudit(initial);
      }
    } catch (err: any) {
      console.error('Failed to load quality history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeModelId]);

  useEffect(() => {
    loadQualityHistory();
  }, [loadQualityHistory]);

  const handleRunBaselineAudit = async () => {
    if (!activeModelId) return;
    try {
      setIsLoading(true);
      const audit = await api.runDataQualityAudit({ model_id: activeModelId });
      setAudits((prev) => [audit, ...prev]);
      setActiveAudit(audit);
    } catch (err: any) {
      console.error('Audit run failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeModelId) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      const audit = await api.uploadDataQualityCsv(activeModelId, file);
      setAudits((prev) => [audit, ...prev]);
      setActiveAudit(audit);
    } catch (err: any) {
      setUploadError(`CSV upload & audit failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return { text: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/40' };
    if (score >= 75) return { text: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-800/40' };
    return { text: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-800/40' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            Data Quality Monitor
          </h3>
          <p className="text-xs text-slate-400">
            Validates incoming datasets and stream batches for missingness, duplicate observations, IQR numerical outliers, and schema drift.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !activeModelId}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <UploadCloud className="w-4 h-4 text-cyan-400" />
            <span>{isUploading ? 'Auditing CSV...' : 'Upload CSV for Audit'}</span>
          </button>

          <button
            onClick={handleRunBaselineAudit}
            disabled={isLoading || !activeModelId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Audit Baseline Dataset</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Audit History Selector Strip */}
      {audits.length > 0 && (
        <div className="flex items-center justify-between gap-4 glass-panel p-3.5 rounded-2xl">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Selected Audit:
            </span>
            <select
              value={activeAudit?.id || ''}
              onChange={(e) => {
                const found = audits.find((a) => a.id === e.target.value);
                if (found) setActiveAudit(found);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white outline-none cursor-pointer"
            >
              {audits.map((a, idx) => (
                <option key={a.id} value={a.id}>
                  #{idx + 1}: {a.dataset_name} ({a.overall_score}%) - {a.records_count} rows - {new Date(a.created_at).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400 font-mono">
            {audits.length} recorded audit{audits.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {activeAudit ? (
        <>
          {/* Main Score & Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Overall Score */}
            <div className={`glass-panel p-5 rounded-2xl col-span-2 md:col-span-1 border ${getScoreColor(activeAudit.overall_score).border}`}>
              <span className="text-xs text-slate-400 font-mono">DATA QUALITY SCORE</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-3xl font-extrabold ${getScoreColor(activeAudit.overall_score).text}`}>
                  {activeAudit.overall_score.toFixed(1)}%
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {activeAudit.overall_score >= 90 ? 'High Production Quality' : activeAudit.overall_score >= 70 ? 'Moderate Quality Risk' : 'High Quality Degraded'}
              </span>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">RECORDS AUDITED</span>
              <p className="text-2xl font-bold text-white mt-1">
                {activeAudit.records_count.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-500 font-mono">rows analyzed</span>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">MISSING CELLS</span>
              <p className="text-2xl font-bold text-white mt-1">
                {activeAudit.missing_values_count}{' '}
                <span className="text-xs font-normal text-slate-400">({activeAudit.missing_percentage.toFixed(2)}%)</span>
              </p>
              <span className="text-[10px] text-slate-500">NaN / null values</span>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">DUPLICATE ROWS</span>
              <p className="text-2xl font-bold text-white mt-1">
                {activeAudit.duplicate_rows_count}
              </p>
              <span className="text-[10px] text-slate-500">Exact duplicate records</span>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">IQR OUTLIERS</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {activeAudit.outlier_count}
              </p>
              <span className="text-[10px] text-slate-500">&gt; 1.5x IQR boundary</span>
            </div>
          </div>

          {/* Validation Errors / Diagnostic Notices */}
          {activeAudit.validation_errors.length > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-amber-900/40 bg-amber-950/15">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Quality Diagnostic Notices ({activeAudit.validation_errors.length})
                </h4>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                {activeAudit.validation_errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Feature-Level Quality Scores Table */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  Per-Feature Quality & Data Health Audit
                </h4>
                <p className="text-xs text-slate-400">
                  Individual feature completeness, outlier concentration, and range validity
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {Object.keys(activeAudit.feature_scores || {}).length} features
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Feature</th>
                    <th className="px-4 py-3">Quality Score</th>
                    <th className="px-4 py-3">Missing Values</th>
                    <th className="px-4 py-3">IQR Outliers</th>
                    <th className="px-4 py-3">Invalid Ranges</th>
                    <th className="px-4 py-3">Unexpected Categories</th>
                    <th className="px-4 py-3">Health Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {Object.entries(activeAudit.feature_scores || {}).map(([feat, fScore]) => {
                    const colColor = getScoreColor(fScore.score);
                    return (
                      <tr key={feat} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 font-semibold text-white">{feat}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${colColor.text}`}>{fScore.score}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full ${
                                  fScore.score >= 90
                                    ? 'bg-emerald-500'
                                    : fScore.score >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${fScore.score}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={fScore.missing_count > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                            {fScore.missing_count} ({fScore.missing_pct}%)
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={fScore.outlier_count > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                            {fScore.outlier_count} ({fScore.outlier_pct}%)
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={fScore.invalid_range_count > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                            {fScore.invalid_range_count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {fScore.unexpected_categories && fScore.unexpected_categories.length > 0 ? (
                            <span className="text-rose-400 font-bold">
                              {fScore.unexpected_categories.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              fScore.status === 'EXCELLENT'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                : fScore.status === 'ACCEPTABLE'
                                ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                                : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                            }`}
                          >
                            {fScore.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-panel p-12 text-center rounded-2xl">
          <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-white">No Data Quality Audits Available</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Audit the registered baseline tabular dataset or upload a custom CSV file to inspect schema conformity,
            missingness, and outlier metrics.
          </p>
          <button
            onClick={handleRunBaselineAudit}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
          >
            Audit Baseline Dataset
          </button>
        </div>
      )}
    </div>
  );
};
