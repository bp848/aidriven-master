
import React, { useState } from 'react';
import { Header } from './components/Header';
import { MasteringFlow } from './components/MasteringFlow';
import { AnalysisView } from './components/AnalysisView';
import { AgentConsensus } from './components/AgentConsensus';
import { AudioComparisonPlayer } from './components/AudioComparisonPlayer';
import { MasteringState } from './types';
import { Download, RefreshCw, CheckCircle2, Waves, AlertCircle, Mail, Clock } from 'lucide-react';
import { supabase } from './services/supabaseClient';

const idleState: MasteringState = {
  step: 'idle',
  progress: 0,
  fileName: null,
  analysis: null,
  consensus: null,
  finalParams: null,
  outputUrl: null,
  originalBuffer: null,
  masteredBuffer: null,
  userEmail: null,
  error: null,
};

export default function App() {
  const [state, setState] = useState<MasteringState>({ ...idleState });
  const [submittedJob, setSubmittedJob] = useState<{ id: string; fileName: string } | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [audioContext] = useState(() => new (window.AudioContext || (window as any).webkitAudioContext)());

  React.useEffect(() => {
    if (!activeJobId) return;

    const fetchAndDecodeMaster = async (url: string) => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(buf);
        setState(prev => ({ ...prev, masteredBuffer: decoded }));
      } catch (e) {
        console.error('Failed to decode mastered audio:', e);
      }
    };

    const checkInitialStatus = async () => {
      const { data: job } = await supabase
        .from('mastering_jobs').select('*').eq('id', activeJobId).single();
      if (!job) return;
      if (job.status === 'failed') {
        setState(prev => ({ ...prev, step: 'idle', error: job.error_message }));
        return;
      }
      const publicUrl = job.output_path
        ? job.output_path.replace('gs://', 'https://storage.googleapis.com/')
        : null;
      setState(prev => ({
        ...prev, step: job.status as any, analysis: job.metrics,
        consensus: job.consensus_opinions, finalParams: job.final_params,
        outputUrl: publicUrl, userEmail: job.user_email,
        progress: job.status === 'completed' ? 100 : 20,
      }));
    };
    checkInitialStatus();

    const channel = supabase.channel(`job-${activeJobId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mastering_jobs', filter: `id=eq.${activeJobId}` },
        (payload) => {
          const job = payload.new;
          const publicUrl = job.output_path
            ? job.output_path.replace('gs://', 'https://storage.googleapis.com/')
            : null;
          if (job.status === 'failed') {
            setState(prev => ({ ...prev, step: 'idle', progress: 0, error: job.error_message || 'Processing failed.' }));
            setActiveJobId(null);
            channel.unsubscribe();
            return;
          }
          setState(prev => ({
            ...prev, step: job.status, analysis: job.metrics,
            consensus: job.consensus_opinions, finalParams: job.final_params,
            outputUrl: publicUrl, userEmail: job.user_email, error: null,
            progress: job.status === 'completed' ? 100 : 20,
          }));
          if (job.status === 'completed' && publicUrl) {
            fetchAndDecodeMaster(publicUrl);
            channel.unsubscribe();
          }
        }
      ).subscribe();

    return () => { channel.unsubscribe(); };
  }, [activeJobId, audioContext]);

  const handleUpload = async (file: File, email: string) => {
    setState(prev => ({ ...prev, step: 'uploading', progress: 5, fileName: file.name, userEmail: email }));
    try {
      const { data: job, error: jobErr } = await supabase
        .from('mastering_jobs')
        .insert({ file_name: file.name, status: 'uploading', input_path: '', user_email: email })
        .select().single();
      if (jobErr) throw jobErr;
      setActiveJobId(job.id);

      file.arrayBuffer()
        .then(buf => audioContext.decodeAudioData(buf))
        .then(decoded => setState(prev => ({ ...prev, originalBuffer: decoded })))
        .catch(e => console.error('Non-blocking decode failed:', e));

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, jobId: job.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Server Error (${response.status})`);
      if (!data?.url) throw new Error('Invalid server response: Missing signed upload URL.');

      const { url, path: remotePath } = data;
      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-goog-meta-jobId': job.id },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`GCS Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);

      const { error: updateErr } = await supabase
        .from('mastering_jobs').update({ input_path: remotePath }).eq('id', job.id);
      if (updateErr) throw updateErr;

      setSubmittedJob({ id: job.id, fileName: file.name });
      setActiveJobId(null);
      setState(idleState);
    } catch (error: any) {
      console.error('Mastering failed:', error);
      setState(prev => ({ ...prev, step: 'idle', progress: 0, error: error.message || 'An unexpected error occurred.' }));
    }
  };

  const reset = () => {
    setSubmittedJob(null);
    setActiveJobId(null);
    setState({ ...idleState });
  };

  const isProcessing = state.step === 'uploading';

  // ─── Uploading / Mission Received Screen ───────────────────────────────────
  if (state.step === 'uploading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center cyber-grid">
        <div className="text-center space-y-6 animate-fade-up px-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
            <Waves className="w-8 h-8 text-indigo-400 animate-pulse-slow" />
          </div>
          <div>
            <p className="text-xs font-mono text-indigo-400 uppercase tracking-[0.3em] mb-2">Uploading</p>
            <h2 className="text-3xl font-bold text-white">{state.fileName}</h2>
          </div>
          <div className="w-64 h-1 bg-white/5 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-shimmer rounded-full" style={{ width: `${state.progress}%`, transition: 'width 0.4s ease' }} />
          </div>
          <p className="text-xs text-gray-500">{state.progress}% — sending to cloud storage</p>
        </div>
      </div>
    );
  }

  // ─── In Progress: Analyzing / Processing ───────────────────────────────────
  if (['analyzing', 'consensus', 'processing'].includes(state.step)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center cyber-grid">
        <div className="glass-card p-10 max-w-md w-full mx-6 text-center space-y-6 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-mono uppercase tracking-widest">
            <span className="status-dot bg-green-500 animate-pulse-slow" /> Accepted
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">AI Mastering in Progress</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Our neural agents are working on your track. You can safely close this tab — we'll email the result when it's done.
            </p>
          </div>
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-gray-400"><Mail className="w-3 h-3" /> Deliver to</span>
              <span className="text-white font-mono truncate max-w-[180px]">{state.userEmail}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-gray-400"><Clock className="w-3 h-3" /> ETA</span>
              <span className="text-indigo-400 font-mono">≈ 2 min</span>
            </div>
            <div className="pt-1 text-[10px] font-mono text-gray-600 text-left">
              JOB: {activeJobId}
            </div>
          </div>
          <p className="text-[10px] text-gray-600">
            If no email after 15 min,{' '}
            <button onClick={reset} className="text-indigo-400 underline hover:text-indigo-300">try again</button>
            {' '}or paste the Job ID above into support.
          </p>
        </div>
      </div>
    );
  }

  // ─── Completed Screen ───────────────────────────────────────────────────────
  if (state.step === 'completed') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex-none h-14 glass border-b border-white/5 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-indigo-600 rounded-md flex items-center justify-center">
              <Waves className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">NEURO-MASTER</span>
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all">
              <RefreshCw className="w-3 h-3" /> New Session
            </button>
            <a href={state.outputUrl!} download
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold transition-all neon-glow">
              <Download className="w-3 h-3" /> Download Master
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-none" />
              <div>
                <h2 className="text-lg font-bold text-white">Master Complete — Beatport Top 10 Verified</h2>
                <p className="text-xs text-gray-500 font-mono">{state.fileName}</p>
              </div>
            </div>
            {state.originalBuffer && state.masteredBuffer && (
              <AudioComparisonPlayer original={state.originalBuffer} mastered={state.masteredBuffer} />
            )}
            {state.analysis && <AnalysisView metrics={state.analysis} />}
            {state.consensus && state.finalParams && (
              <AgentConsensus opinions={state.consensus} finalParams={state.finalParams} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Idle / Upload Screen ──────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col cyber-grid">
      {/* Header */}
      <Header />

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        <div className="w-full max-w-lg space-y-8 animate-fade-up">

          {/* Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border-indigo-500/20 text-indigo-400 text-[10px] font-mono uppercase tracking-[0.3em]">
              <Waves className="w-3 h-3" /> Multi-Agent AI Mastering
            </div>
          </div>

          {/* Headline */}
          <div className="text-center">
            <h1 className="text-5xl font-black tracking-tighter leading-none text-white mb-3">
              NEURO<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-500 glow-text">MASTER</span>
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
              Upload your track. Our AI agents master it to Beatport Top 10 standard. Result delivered by email.
            </p>
          </div>

          {/* Success notice */}
          {submittedJob && (
            <div className="glass-card p-4 border-green-500/20 bg-green-500/5 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-none" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-300 truncate">{submittedJob.fileName}</p>
                <p className="text-xs text-gray-400 mt-0.5">Queued for mastering. Check your email in ~2 minutes.</p>
                <p className="text-[10px] font-mono text-gray-600 mt-1">JOB: {submittedJob.id}</p>
              </div>
            </div>
          )}

          {/* Error notice */}
          {state.error && (
            <div className="glass-card p-4 border-red-500/20 bg-red-500/5 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-none" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-300">{state.error}</p>
              </div>
              <button onClick={() => setState(p => ({ ...p, error: null }))} className="text-red-500/50 hover:text-red-400 text-lg leading-none flex-none">×</button>
            </div>
          )}

          {/* Upload form */}
          <MasteringFlow onComplete={handleUpload} isProcessing={isProcessing} />
        </div>
      </div>

      {/* Footer status bar */}
      <div className="flex-none h-9 glass border-t border-white/5 flex items-center justify-between px-6">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
            <span className="status-dot bg-green-500 animate-pulse-slow" /> GCS Connected
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
            <span className="status-dot bg-indigo-500 animate-pulse-slow" /> Gemini 2.5-Flash
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-700 uppercase tracking-widest">© 2025 NEURO-MASTER</span>
      </div>
    </div>
  );
}
