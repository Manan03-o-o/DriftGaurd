import React from 'react';
import { RefreshCw, Play, PlusCircle, Database } from 'lucide-react';
import type { ModelRegistration } from '../types';

interface HeaderProps {
  title: string;
  subtitle: string;
  models: ModelRegistration[];
  selectedModelId: string;
  onModelSelect: (id: string) => void;
  onRefresh: () => void;
  onOpenReplayModal: () => void;
  onOpenTrainModal: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  models,
  selectedModelId,
  onModelSelect,
  onRefresh,
  onOpenReplayModal,
  onOpenTrainModal,
  isRefreshing
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-8 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Page Title */}
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Model Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs text-slate-400 font-medium">Model:</span>
            <select
              value={selectedModelId}
              onChange={(e) => onModelSelect(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer max-w-[180px] truncate"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                  {m.name} ({m.version})
                </option>
              ))}
            </select>
          </div>

          {/* Action: Replay Stream */}
          <button
            onClick={onOpenReplayModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/30 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Replay Stream</span>
          </button>

          {/* Action: Train Model */}
          <button
            onClick={onOpenTrainModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-semibold transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Train Baseline</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
