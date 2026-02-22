import React from 'react';
import { Activity, AudioWaveform } from 'lucide-react';

interface HeaderProps {
  page: 'upload' | 'algorithm';
  onNav: (p: 'upload' | 'algorithm') => void;
}

export const Header: React.FC<HeaderProps> = ({ page, onNav }) => {
  return (
    <header className="flex-none h-12 bg-card border-b border-border flex items-center justify-between px-5">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <AudioWaveform className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
        </div>
        <span className="text-sm font-bold text-foreground tracking-tight font-sans">NEURO-MASTER</span>
        <span className="tag tag-gray">v2.5</span>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1">
        {([['upload', 'Master'], ['algorithm', 'Algorithm & Pricing']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              page === id
                ? 'bg-foreground/[0.08] text-foreground'
                : 'text-muted-foreground hover:text-foreground/80 hover:bg-foreground/[0.04]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Status */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <span className="status-dot status-online" />
          <span className="mono text-muted-foreground">Engine Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-muted-foreground/60" strokeWidth={1.5} />
          <span className="mono text-muted-foreground">Gemini 2.5-Flash</span>
        </div>
      </div>
    </header>
  );
};
