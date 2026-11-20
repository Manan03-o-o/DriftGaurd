import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  Clock,
  ArrowRight,
  Filter,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import type { Alert, AlertStats, ModelRegistration } from '../types';
import { api } from '../services/api';

interface AlertsCenterPageProps {
  models: ModelRegistration[];
  selectedModelId: string;
  onNavigate: (tab: string) => void;
  onOpenReplayModal: () => void;
  onOpenExperiment: () => void;
}

export const AlertsCenterPage: React.FC<AlertsCenterPageProps> = ({
  models,
  selectedModelId,
  onNavigate,
  onOpenReplayModal,
  onOpenExperiment
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [modelFilter, setModelFilter] = useState<string>('all');

  const loadAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const mId = modelFilter !== 'all' ? modelFilter : undefined;
      const isResolved = statusFilter === 'all' ? undefined : statusFilter === 'resolved';
      const [fetchedAlerts, fetchedStats] = await Promise.all([
        api.getAlerts({
          model_id: mId,
          severity: severityFilter !== 'ALL' ? severityFilter : undefined,
          is_resolved: isResolved,
          limit: 100
        }),
        api.getAlertStats(mId)
      ]);
      setAlerts(fetchedAlerts);
      setStats(fetchedStats);
    } catch (err: any) {
      console.error('Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter, statusFilter, modelFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markAlertRead(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await api.resolveAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_resolved: true, is_read: true } : a))
      );
      if (stats) {
        setStats({ ...stats, unresolved_alerts: Math.max(0, stats.unresolved_alerts - 1) });
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const mId = modelFilter !== 'all' ? modelFilter : undefined;
      await api.markAllAlertsRead(mId);
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          badge: 'bg-rose-950 text-rose-300 border-rose-800',
          border: 'border-l-rose-500',
          dot: 'bg-rose-400'
        };
      case 'HIGH':
        return {
          badge: 'bg-amber-950 text-amber-300 border-amber-800',
          border: 'border-l-amber-500',
          dot: 'bg-amber-400'
        };
      case 'MEDIUM':
        return {
          badge: 'bg-indigo-950 text-indigo-300 border-indigo-800',
          border: 'border-l-indigo-500',
          dot: 'bg-indigo-400'
        };
      case 'LOW':
        return {
          badge: 'bg-cyan-950 text-cyan-300 border-cyan-800',
          border: 'border-l-cyan-500',
          dot: 'bg-cyan-400'
        };
      default:
        return {
          badge: 'bg-slate-900 text-slate-300 border-slate-700',
          border: 'border-l-slate-500',
          dot: 'bg-slate-400'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            Smart Alert Center
          </h3>
          <p className="text-xs text-slate-400">
            Automated alerts triggered by statistical drift, effect-size thresholds, and delayed ground-truth model degradation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold transition"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mark All Read</span>
          </button>
          <button
            onClick={loadAlerts}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            title="Refresh alerts"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-mono">UNRESOLVED</span>
          <p className="text-2xl font-bold text-white mt-1">
            {stats?.unresolved_alerts ?? 0}
          </p>
          <span className="text-[10px] text-slate-500">Requires review</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-rose-900/40 bg-rose-950/10">
          <span className="text-xs text-rose-400 font-mono">CRITICAL</span>
          <p className="text-2xl font-bold text-rose-300 mt-1">
            {stats?.critical_alerts ?? 0}
          </p>
          <span className="text-[10px] text-rose-400/80">Extreme shift / drop</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-amber-900/40 bg-amber-950/10">
          <span className="text-xs text-amber-400 font-mono">HIGH SEVERITY</span>
          <p className="text-2xl font-bold text-amber-300 mt-1">
            {stats?.high_alerts ?? 0}
          </p>
          <span className="text-[10px] text-amber-400/80">PSI ≥ 0.25 / Medium drop</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/10">
          <span className="text-xs text-indigo-400 font-mono">MODERATE</span>
          <p className="text-2xl font-bold text-indigo-300 mt-1">
            {stats?.medium_alerts ?? 0}
          </p>
          <span className="text-[10px] text-indigo-400/80">Statistically drifted</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-mono">TOTAL RECORDED</span>
          <p className="text-2xl font-bold text-slate-300 mt-1">
            {stats?.total_alerts ?? 0}
          </p>
          <span className="text-[10px] text-slate-500">Full audit log</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Status:</span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
              {(['unresolved', 'all', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                    statusFilter === st ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-white outline-none cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Only</option>
              <option value="MEDIUM">Medium Only</option>
              <option value="LOW">Low Only</option>
            </select>
          </div>
        </div>

        {models.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Model:</span>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">All Models</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.version})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Alert Feed */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            Querying persistent smart alert history...
          </div>
        ) : alerts.length > 0 ? (
          alerts.map((alert) => {
            const style = getSeverityStyle(alert.severity);
            const modelName = models.find((m) => m.id === alert.model_id)?.name || alert.model_id;

            return (
              <div
                key={alert.id}
                className={`glass-panel p-5 rounded-2xl border-l-4 ${style.border} transition-all duration-150 ${
                  !alert.is_read ? 'bg-slate-900/90' : 'bg-slate-950/60 opacity-85'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${style.badge}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs font-bold text-white tracking-wide">{alert.title}</span>
                      {alert.affected_feature && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono border border-slate-700">
                          feature: {alert.affected_feature}
                        </span>
                      )}
                      {!alert.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>

                    {/* Metric info pill */}
                    {alert.metric_name && alert.metric_value !== null && alert.metric_value !== undefined && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 mt-1">
                        <span>Metric: <strong className="text-indigo-300">{alert.metric_name}</strong></span>
                        <span>Value: <strong className="text-emerald-400">{alert.metric_value.toFixed(4)}</strong></span>
                        {alert.threshold && (
                          <span>Threshold: <span className="text-slate-400">{alert.threshold}</span></span>
                        )}
                      </div>
                    )}

                    {/* Recommended Action Box */}
                    <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-800/40 mt-3 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5 font-semibold text-indigo-300 mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Recommended Operational Action</span>
                      </div>
                      <p className="text-[11px] text-slate-300/90 leading-relaxed">{alert.recommended_action}</p>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-2 font-mono">
                      <span>Model: {modelName}</span>
                      <span>•</span>
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex md:flex-col items-center md:items-end gap-2 shrink-0">
                    {!alert.is_resolved ? (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Resolved
                      </span>
                    )}

                    {!alert.is_read && (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs transition"
                      >
                        Mark Read
                      </button>
                    )}

                    <button
                      onClick={() => onNavigate(alert.metric_name === 'DELTA_F1' ? 'quality' : 'drift')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <span>Investigate</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="glass-panel p-12 rounded-2xl text-center space-y-3 border border-slate-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">All Systems Operating Normally</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No alerts match your active filter. When input feature drift or predictive quality degradation is flagged,
              deduplicated smart alerts will populate here automatically.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={onOpenReplayModal}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
              >
                Replay Drift Stream
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
