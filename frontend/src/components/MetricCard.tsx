import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  change,
  changeType = 'neutral',
  icon
}) => {
  return (
    <div className="glass-panel p-5 rounded-xl transition-all duration-200 glass-panel-hover">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
        {icon && <div className="p-2 rounded-lg bg-slate-800/80 text-indigo-400">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        {change && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              changeType === 'positive'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                : changeType === 'negative'
                ? 'bg-rose-950/80 text-rose-400 border border-rose-800/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {change}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-2 font-mono">{subtitle}</p>}
    </div>
  );
};
