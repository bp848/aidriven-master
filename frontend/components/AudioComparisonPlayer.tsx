import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Zap } from 'lucide-react';

interface Props {
  original: AudioBuffer;
  mastered: AudioBuffer;
}

export const AudioComparisonPlayer: React.FC<Props> = ({ original, mastered }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMastered, setIsMastered] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainOriginalRef = useRef<GainNode | null>(null);
  const gainMasteredRef = useRef<GainNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);
  const animationRef = useRef<number>(0);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyzerRef.current = audioCtxRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      gainOriginalRef.current = audioCtxRef.current.createGain();
      gainMasteredRef.current = audioCtxRef.current.createGain();
      gainOriginalRef.current.connect(analyzerRef.current);
      gainMasteredRef.current.connect(analyzerRef.current);
      analyzerRef.current.connect(audioCtxRef.current.destination);
    }
  }, []);

  const startPlayback = (offset: number) => {
    if (!audioCtxRef.current) return;
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
    }
    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = isMastered ? mastered : original;
    source.connect(isMastered ? gainMasteredRef.current! : gainOriginalRef.current!);
    gainMasteredRef.current!.gain.value = isMastered ? 1 : 0;
    gainOriginalRef.current!.gain.value = isMastered ? 0 : 1;
    source.start(0, offset);
    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;
    setIsPlaying(true);
  };

  const togglePlay = () => {
    initAudio();
    if (isPlaying) {
      offsetRef.current = audioCtxRef.current!.currentTime - startTimeRef.current;
      sourceRef.current?.stop();
      setIsPlaying(false);
    } else {
      startPlayback(offsetRef.current % original.duration);
    }
  };

  const toggleMode = () => {
    const wasPlaying = isPlaying;
    const currentOffset = isPlaying
      ? (audioCtxRef.current!.currentTime - startTimeRef.current)
      : offsetRef.current;
    setIsMastered(!isMastered);
    if (wasPlaying) {
      startPlayback(currentOffset % original.duration);
    } else {
      offsetRef.current = currentOffset;
    }
  };

  // Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (isPlaying && audioCtxRef.current) {
        const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
        const p = (elapsed % original.duration) / original.duration;
        setProgress(p * 100);
        setCurrentTime(elapsed % original.duration);
      }

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (analyzerRef.current) {
        const bufferLength = analyzerRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyzerRef.current.getByteFrequencyData(dataArray);

        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = 70;
        const radius = baseRadius + (dataArray[0] / 255) * 15;

        // Outer ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = isMastered ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isMastered ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Frequency bars
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * 40;
          const angle = (i / bufferLength) * Math.PI * 2;
          const x1 = centerX + Math.cos(angle) * (radius + 4);
          const y1 = centerY + Math.sin(angle) * (radius + 4);
          const x2 = centerX + Math.cos(angle) * (radius + 4 + barHeight);
          const y2 = centerY + Math.sin(angle) * (radius + 4 + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          const alpha = dataArray[i] / 255;
          ctx.strokeStyle = isMastered
            ? `rgba(59, 130, 246, ${alpha * 0.8})`
            : `rgba(255, 255, 255, ${alpha * 0.3})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, isMastered, original.duration]);

  const formatTime = (t: number) => new Date(t * 1000).toISOString().substr(14, 5);

  return (
    <div className="surface-1 rounded-xl p-8 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className={`absolute inset-0 opacity-[0.04] transition-colors duration-700 ${isMastered ? 'bg-primary' : 'bg-foreground'}`} />

      <div className="relative z-10 flex flex-col items-center">
        {/* Visualizer */}
        <div className="relative mb-8">
          <canvas ref={canvasRef} width={320} height={320} className="w-52 h-52 md:w-64 md:h-64" />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={togglePlay}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 ${
                isMastered
                  ? 'bg-primary/20 border border-primary/30 hover:bg-primary/30'
                  : 'bg-foreground/5 border border-border hover:bg-foreground/10'
              }`}
            >
              {isPlaying
                ? <Pause className="w-6 h-6 text-foreground fill-current" />
                : <Play className="w-6 h-6 text-foreground fill-current ml-0.5" />
              }
            </button>
          </div>
        </div>

        {/* A/B Toggle */}
        <div className="flex items-center gap-6 mb-8">
          <button
            onClick={() => isMastered && toggleMode()}
            className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 border ${
              !isMastered
                ? 'bg-foreground/[0.08] border-foreground/20 text-foreground'
                : 'bg-transparent border-border text-muted-foreground hover:text-foreground/70'
            }`}
          >
            Original
          </button>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em]">A/B</span>
            <button
              onClick={toggleMode}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                isMastered ? 'bg-primary/25' : 'bg-border'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full transition-all duration-300 flex items-center justify-center ${
                isMastered
                  ? 'translate-x-7 bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                  : 'translate-x-0 bg-muted-foreground'
              }`}>
                <Zap className={`w-3 h-3 ${isMastered ? 'text-primary-foreground' : 'text-background'}`} />
              </div>
            </button>
          </div>

          <button
            onClick={() => !isMastered && toggleMode()}
            className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 border ${
              isMastered
                ? 'bg-primary/10 border-primary/25 text-primary'
                : 'bg-transparent border-border text-muted-foreground hover:text-foreground/70'
            }`}
          >
            Mastered
          </button>
        </div>

        {/* Progress */}
        <div className="w-full max-w-lg flex flex-col gap-2">
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            <span>{formatTime(currentTime)}</span>
            <span className={isMastered ? 'text-primary' : 'text-muted-foreground'}>
              {isMastered ? 'Mastered' : 'Bypass'}
            </span>
            <span>{formatTime(original.duration)}</span>
          </div>
          <div className="relative h-1.5 w-full bg-border rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-100 ${
                isMastered ? 'bg-primary' : 'bg-foreground/30'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
