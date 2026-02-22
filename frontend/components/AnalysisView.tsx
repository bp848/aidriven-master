import React from 'react';
import { AnalysisMetric } from '../types';
import { Activity, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface Props {
  metrics: AnalysisMetric[];
}

const statusColor = (status: string) => {
  if (status === 'optimal') return { bg: 'bg-success/10', border: 'border-success/20', text: 'text-success', bar: 'bg-success' };
  if (status === 'high') return { bg: 'bg-destructive/10', border: 'border-destructive/20', text: 'text-destructive', bar: 'bg-destructive' };
  return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', bar: 'bg-amber-500' };
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'optimal') return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
  if (status === 'high') return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
  return <Info className="w-3.5 h-3.5 text-amber-400" />;
};

export const AnalysisView: React.FC<Props> = ({ metrics }) => {
  const score = Math.round((metrics.filter(m => m.status === 'optimal').length / metrics.length) * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Spectral Analysis</h3>
            <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider">Beatport Top 10 Comparison</p>
          </div>
        </div>

        <div className="surface-1 rounded-lg px-5 py-3 flex items-center gap-6">
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-mono mb-0.5">Score</div>
            <div className="text-2xl font-bold text-primary glow-text">{score}%</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-mono mb-0.5">Status</div>
            <div className={`text-sm font-semibold ${score > 80 ? 'text-success' : 'text-amber-400'}`}>
              {score > 80 ? 'Optimal' : 'Needs Adjustment'}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m, i) => {
          const colors = statusColor(m.status);
          return (
            <div
              key={i}
              className={`surface-1 rounded-lg p-4 hover:border-primary/20 transition-all duration-200 group`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className={`p-1.5 rounded-md ${colors.bg} border ${colors.border}`}>
                  <StatusIcon status={m.status} />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">{m.unit}</span>
              </div>
              <h4 className="text-xs font-semibold text-foreground/80 mb-1 truncate">{m.name}</h4>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-lg font-bold text-foreground">{m.value}</span>
                <span className="text-[10px] text-muted-foreground/60 font-mono">/ {m.target}</span>
              </div>
              <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                  style={{ width: `${Math.min(100, (m.value / m.target) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
