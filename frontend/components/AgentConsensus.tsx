import React from 'react';
import { AgentOpinion, MasteringParams } from '../types';
import { Users, Terminal, Shield, BrainCircuit, Sliders } from 'lucide-react';

interface Props {
  opinions: AgentOpinion[];
  finalParams: MasteringParams;
}

const roleConfig = {
  Audience: { icon: Users, accent: 'primary', bgClass: 'bg-primary/8', borderClass: 'border-primary/20', textClass: 'text-primary' },
  'A&R': { icon: Shield, accent: 'accent', bgClass: 'bg-accent/8', borderClass: 'border-accent/20', textClass: 'text-accent' },
  Engineer: { icon: Terminal, accent: 'success', bgClass: 'bg-success/8', borderClass: 'border-success/20', textClass: 'text-success' },
} as const;

export const AgentConsensus: React.FC<Props> = ({ opinions, finalParams }) => {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
            <BrainCircuit className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">AI Consensus</h3>
            <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider">Tri-Agent Parameter Negotiation</p>
          </div>
        </div>
        <div className="tag tag-green">
          <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
          Agreement Reached
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {opinions.map((agent, i) => {
          const config = roleConfig[agent.role] || roleConfig.Audience;
          const Icon = config.icon;
          return (
            <div key={i} className="surface-1 rounded-xl p-5 flex flex-col hover:border-primary/15 transition-all duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bgClass} border ${config.borderClass}`}>
                  <Icon className={`w-4.5 h-4.5 ${config.textClass}`} />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{agent.role}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Agent v2.5</p>
                </div>
              </div>

              <p className="text-sm text-foreground/70 leading-relaxed flex-1 italic mb-5">
                {'"'}{agent.comment}{'"'}
              </p>

              <div className="pt-4 border-t border-border flex flex-col gap-2">
                {Object.entries(agent.suggestedParams).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded font-mono">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Final Parameters */}
      <div className="surface-2 rounded-xl p-8 relative overflow-hidden">
        <div className="absolute top-4 right-4 opacity-[0.03]">
          <Sliders className="w-32 h-32" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-8">
          <div>
            <h4 className="text-xl font-bold text-foreground mb-1 tracking-tight">Final DSP Parameters</h4>
            <p className="text-primary font-mono text-xs uppercase tracking-[0.2em]">Optimized for Beatport Top 10</p>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-8 w-full">
            {[
              { label: 'Tube Saturation', val: finalParams.tube_drive_amount, max: 1, unit: '' },
              { label: 'Pultec Low Boost', val: finalParams.low_contour_amount, max: 2.5, unit: 'dB' },
              { label: 'Limiter Ceiling', val: finalParams.limiter_ceiling_db, max: 2, unit: 'dB', isNeg: true }
            ].map((p, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{p.label}</span>
                  <span className="text-lg font-bold text-foreground font-mono">{p.val.toFixed(2)}{p.unit}</span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{
                      width: `${(p.isNeg ? (1 - Math.abs(p.val) / p.max) : (p.val / p.max)) * 100}%`,
                      boxShadow: '0 0 8px rgba(59,130,246,0.4)'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
