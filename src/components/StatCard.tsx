import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  accent?: 'cyan' | 'blue' | 'green' | 'amber' | 'red';
  subtitle?: string;
}

const ACCENT_STYLES = {
  cyan: 'from-cyan-500/10 to-cyan-500/5 text-cyan-600 border-cyan-500/20',
  blue: 'from-accent-500/10 to-accent-500/5 text-accent-600 border-accent-500/20',
  green: 'from-green-500/10 to-green-500/5 text-green-600 border-green-500/20',
  amber: 'from-amber-500/10 to-amber-500/5 text-amber-600 border-amber-500/20',
  red: 'from-red-500/10 to-red-500/5 text-red-600 border-red-500/20',
};

export default function StatCard({
  label,
  value,
  unit,
  icon,
  accent = 'cyan',
  subtitle,
}: StatCardProps) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-card border border-navy-100 hover:shadow-card-hover transition bg-gradient-to-br ${ACCENT_STYLES[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">
            {value}
            {unit && <span className="text-sm font-medium text-navy-400 ml-1">{unit}</span>}
          </p>
          {subtitle && <p className="mt-1 text-xs text-navy-400">{subtitle}</p>}
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
      </div>
    </div>
  );
}
