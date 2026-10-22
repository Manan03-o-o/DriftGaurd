import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = (status || '').toUpperCase();
  const py = size === 'sm' ? 'py-0.5 px-2 text-xs' : 'py-1 px-2.5 text-xs font-medium';

  if (norm === 'NONE' || norm === 'HEALTHY' || norm === 'OPERATIONAL') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 ${py}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        {norm}
      </span>
    );
  }

  if (norm === 'LOW') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-blue-950/70 text-blue-400 border border-blue-800/60 ${py}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
        LOW DRIFT
      </span>
    );
  }

  if (norm === 'MEDIUM' || norm === 'DEGRADED') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-950/70 text-amber-400 border border-amber-800/60 ${py}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        {norm === 'MEDIUM' ? 'MODERATE DRIFT' : norm}
      </span>
    );
  }

  if (norm === 'HIGH' || norm === 'CRITICALLY_DEGRADED' || norm === 'CRITICAL') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-950/70 text-rose-400 border border-rose-800/60 ${py}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
        {norm === 'HIGH' ? 'HIGH DRIFT' : norm}
      </span>
    );
  }

  if (norm === 'RETRAINED' || norm === 'GATED_ACCEPTED') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-violet-950/70 text-violet-300 border border-violet-800/60 ${py}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
        {norm}
      </span>
    );
  }

  if (norm === 'GATED_REJECTED') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-orange-950/70 text-orange-400 border border-orange-800/60 ${py}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
        REJECTED (GATE)
      </span>
    );
  }

  // Default neutral
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 ${py}`}>
      {status}
    </span>
  );
};
