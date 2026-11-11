import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  isPositive?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  isPositive = true,
}) => {
  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-[#0f172a]/60 hover:border-slate-700/80 transition-all shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">{title}</span>
        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3">
        <h3 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">{value}</h3>
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center space-x-2 text-xs">
            {trend && (
              <span className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {trend}
              </span>
            )}
            {subtitle && <span className="text-slate-500">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
