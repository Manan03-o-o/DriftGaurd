import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  Activity,
  FlaskConical,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import type { SystemStatus } from '../types';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  systemStatus: SystemStatus | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  systemStatus
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'models', label: 'Model Registry', icon: Cpu },
    { id: 'drift', label: 'Drift Monitor', icon: Activity },
    { id: 'experiments', label: 'Experiment Center', icon: FlaskConical },
    { id: 'quality', label: 'Model Quality', icon: CheckCircle2 },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              DriftGuard
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/50 font-mono">
                MLOps
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Reliability & Retraining</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Platform Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Status Footbar */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-900/40">
        <div className="rounded-xl p-3 bg-slate-900/80 border border-slate-800 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-mono text-[11px]">Backend API</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  systemStatus?.status === 'operational'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-semibold text-slate-300">
                {systemStatus?.status === 'operational' ? 'Live' : 'Connecting'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Storage:</span>
            <span className="font-mono text-slate-300">
              {systemStatus?.details?.database_url_type || 'SQLite'}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
          <span>DriftGuard v1.0</span>
          <span className="text-emerald-400 font-semibold">Production</span>
        </div>
      </div>
    </aside>
  );
};
