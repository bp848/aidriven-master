
import React, { useState } from 'react';
import { Header } from './components/Header';
import { MasteringFlow } from './components/MasteringFlow';
import { AnalysisView } from './components/AnalysisView';
import { AgentConsensus } from './components/AgentConsensus';
import { AudioComparisonPlayer } from './components/AudioComparisonPlayer';
import { MasteringState } from './types';
import { Download, RefreshCw, CheckCircle2, Loader2, Waves, AlertCircle } from 'lucide-react';
import { supabase } from './services/supabaseClient';

// Use direct functional component definition to avoid FC type issues
export default function App() {
  const [state, setState] = useState<MasteringState>({
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
  });

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [audioContext] = useState(() => new (window.AudioContext || (window as any).webkitAudioContext)());

  // Subscribe to real-time updates for the active job
  React.useEffect(() => {
    if (!activeJobId) return;

    const fetchAndDecodeMaster = async (url: string) => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(arrayBuffer);
        setState((prev: MasteringState) => ({ ...prev, masteredBuffer: decoded }));
      } catch (e) {
        console.error("Failed to decode mastered audio:", e);
      }
    };

    // 1. Initial Fetch
    const checkInitialStatus = async () => {
      const { data: job } = await supabase
        .from('mastering_jobs')
        .select('*')
        .eq('id', activeJobId)
        .single();

      if (job) {
        if (job.status === 'failed') {
          setState(prev => ({ ...prev, step: 'idle', error: job.error_message }));
          return;
        }
        const publicUrl = job.output_path ? job.output_path.replace('gs://', 'https://storage.googleapis.com/') : null;
        setState(prev => ({
          ...prev,
          step: job.status as any,
          analysis: job.metrics,
          consensus: job.consensus_opinions,
          finalParams: job.final_params,
          outputUrl: publicUrl,
          userEmail: job.user_email,
          progress: job.status === 'completed' ? 100 : 20
        }));
      }
    };
    checkInitialStatus();

    // 2. Real-time Subscription
    const channel = supabase
      .channel(`job-${activeJobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mastering_jobs', filter: `id=eq.${activeJobId}` },
        (payload) => {
          const job = payload.new;
          const publicUrl = job.output_path ? job.output_path.replace('gs://', 'https://storage.googleapis.com/') : null;

          if (job.status === 'failed') {
            setState((prev: MasteringState) => ({
              ...prev,
              step: 'idle',
              progress: 0,
              error: job.error_message || "Processing failed. Please try again."
            }));
            setActiveJobId(null);
            channel.unsubscribe();
            return;
          }

          setState((prev: MasteringState) => ({
            ...prev,
            step: job.status,
            analysis: job.metrics,
            consensus: job.consensus_opinions,
            finalParams: job.final_params,
            outputUrl: publicUrl,
            userEmail: job.user_email,
            error: null,
            progress: job.status === 'completed' ? 100 : 20
          }));

          if (job.status === 'completed' && publicUrl) {
            fetchAndDecodeMaster(publicUrl);
            channel.unsubscribe();
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [activeJobId, audioContext]);

  const handleUpload = async (file: File, email: string) => {
    setState((prev: MasteringState) => ({ ...prev, step: 'uploading', progress: 5, fileName: file.name, userEmail: email }));

    try {
      // Decode locally for original player
      const arrayBuffer = await file.arrayBuffer();
      const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
      setState(prev => ({ ...prev, originalBuffer }));
      // 1. Create Job in Supabase
      const { data: job, error: jobErr } = await supabase
        .from('mastering_jobs')
        .insert({
          file_name: file.name,
          status: 'uploading',
          input_path: '',
          user_email: email
        })
        .select()
        .single();

      if (jobErr) throw jobErr;
      setActiveJobId(job.id);

      // 2. Get Signed URL for GCS upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, jobId: job.id }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || `Server Error (${response.status}): The upload service is currently unavailable.`);
      }

      if (!data || !data.url) {
        throw new Error("Invalid server response: Missing signed upload URL.");
      }

      const { url, path: remotePath } = data;

      // 3. Upload directly to GCS
      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-goog-meta-jobId': job.id
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`GCS Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
      }

      // 4. Update job with the actual path in Supabase
      const { error: updateErr } = await supabase
        .from('mastering_jobs')
        .update({ input_path: remotePath })
        .eq('id', job.id);

      if (updateErr) throw updateErr;

      setState((prev: MasteringState) => ({ ...prev, progress: 20 }));

    } catch (error: any) {
      console.error("Mastering failed:", error);
      setState((prev: MasteringState) => ({
        ...prev,
        step: 'idle',
        progress: 0,
        error: error.message || "An unexpected error occurred. Please check your connection and environment variables."
      }));
    }
  };

  const reset = () => {
    setState({
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
    });
  };

  const isProcessing = state.step !== 'idle' && state.step !== 'completed';

  return (
    <div className="min-h-screen pb-32 pt-24">
      <Header />

      <main className="max-w-7xl mx-auto px-8">
        {state.step === 'idle' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-12">
            <div className="space-y-6 max-w-4xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border-blue-500/20 text-blue-400 text-[10px] font-mono uppercase tracking-[0.3em] mb-4">
                <Waves className="w-3 h-3" /> Next-Gen Audio Intelligence
              </div>
              <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-none text-white">
                MASTERING <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-purple-600 glow-text uppercase">Redefined.</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
                Experience the world's first multi-agent AI mastering service.
                Our neural network negotiates the perfect tonal balance for your music.
              </p>
            </div>

            {state.error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl animate-in fade-in zoom-in duration-300">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-400 text-sm font-medium">{state.error}</p>
                <button onClick={() => setState(p => ({ ...p, error: null }))} className="ml-4 text-red-500/50 hover:text-red-500">×</button>
              </div>
            )}

            <MasteringFlow onComplete={handleUpload} isProcessing={isProcessing} />
          </div>
        )}

        {state.step === 'uploading' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12">
            <div className="relative">
              <div className="absolute -inset-10 bg-blue-500/10 rounded-full blur-[100px] animate-pulse"></div>
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                  <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="4" fill="transparent"
                    strokeDasharray={552} strokeDashoffset={552 - (552 * state.progress) / 100}
                    className="text-blue-500 transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-2" />
                  <span className="text-2xl font-black text-white mono">{state.progress}%</span>
                </div>
              </div>
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-3xl font-bold text-white uppercase tracking-widest italic">GCS Ingestion</h3>
              <p className="text-blue-400 font-mono text-xs uppercase tracking-[0.5em] animate-pulse">
                Sending raw spectral data to matrix...
              </p>
            </div>
          </div>
        )}

        {(['analyzing', 'consensus', 'processing'].includes(state.step)) && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 max-w-4xl mx-auto">
            <div className="glass p-12 rounded-[3rem] border-blue-500/30 text-center space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 animate-shimmer"></div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-mono uppercase tracking-[0.3em]">
                <CheckCircle2 className="w-3 h-3" /> Source Ingested Successfully
              </div>

              <div className="space-y-4">
                <h2 className="text-5xl font-black text-white tracking-tighter">MISSION RECEIVED.</h2>
                <p className="text-gray-400 text-lg leading-relaxed max-w-xl mx-auto">
                  Our neural agents are now negotiating the optimal spectral balance for your track.
                  <span className="text-white block mt-4 font-bold">You can safely close this window.</span>
                </p>
              </div>

              <div className="p-8 bg-blue-500/5 border border-white/5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-left">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Target Address</p>
                  <p className="text-white font-mono">{state.userEmail || 'Your Inbox'}</p>
                </div>
                <div className="h-px md:h-8 w-full md:w-px bg-white/10"></div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">ETA Delivery</p>
                  <p className="text-blue-400 font-mono">≈ 120 Seconds</p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-8">
                <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-2xl text-center">
                  <p className="text-gray-400 text-sm">
                    <span className="text-red-400 font-bold">STUCK?</span> If you don't receive an email within 15 minutes, the system may have encountered a spectral anomaly.
                    Please <button onClick={reset} className="text-blue-400 underline hover:text-blue-300">try again</button> or report the Job ID to our AI Support.
                  </p>
                  <p className="text-[10px] font-mono text-gray-600 mt-2 uppercase tracking-widest">Job ID: {activeJobId}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Upgrade to Studio Grade</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-vibrant p-6 rounded-2xl border-white/10 hover:border-blue-500/30 transition-all cursor-pointer group">
                      <h4 className="text-white font-black text-xl mb-1 group-hover:text-blue-400">PRO SINGLE</h4>
                      <p className="text-gray-500 text-xs mb-4 uppercase">24-bit 96kHz + AI Insight</p>
                      <div className="text-2xl font-black text-white">$9.99</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-600 to-blue-900 p-6 rounded-2xl border border-blue-400/30 shadow-2xl hover:scale-105 transition-all cursor-pointer">
                      <h4 className="text-white font-black text-xl mb-1">PRO ALBUM</h4>
                      <p className="text-blue-200 text-xs mb-4 uppercase">10 Tracks + Sonic Match</p>
                      <div className="text-2xl font-black text-white">$79.99</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <button onClick={reset} className="flex items-center gap-2 px-6 py-3 glass hover:bg-white/5 rounded-xl transition-all text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <RefreshCw className="w-4 h-4" /> Start New Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {state.step === 'completed' && (
          <div className="space-y-16 py-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 glass p-10 rounded-[2.5rem] border-blue-500/20">
              <div className="flex items-center gap-8">
                <div className="relative">
                  <div className="absolute -inset-4 bg-green-500/20 rounded-full blur-xl"></div>
                  <div className="relative p-6 bg-green-500/10 rounded-full border border-green-500/30">
                    <CheckCircle2 className="w-12 h-12 text-green-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tight uppercase">Master Ready.</h2>
                  <p className="text-gray-400 font-mono text-xs uppercase tracking-widest mt-1">Beatport Top 10 Compliance: Verified</p>
                </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={reset} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-4 glass hover:bg-white/5 rounded-2xl transition-all font-bold">
                  <RefreshCw className="w-5 h-5" /> New Session
                </button>
                <a href={state.outputUrl!} download className="flex-1 md:flex-none flex items-center justify-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black transition-all neon-glow text-white">
                  <Download className="w-6 h-6" /> DOWNLOAD MASTER
                </a>
              </div>
            </div>

            {/* A/B Comparison Player */}
            {state.originalBuffer && state.masteredBuffer && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">A/B Comparison Engine</h3>
                </div>
                <AudioComparisonPlayer original={state.originalBuffer} mastered={state.masteredBuffer} />
              </div>
            )}

            <div className="grid grid-cols-1 gap-16">
              {state.analysis && <AnalysisView metrics={state.analysis} />}
              {state.consensus && state.finalParams && <AgentConsensus opinions={state.consensus} finalParams={state.finalParams} />}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">GCS: Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Gemini: v2.5-Flash</span>
          </div>
        </div>
        <div className="text-[9px] font-mono text-gray-600 uppercase tracking-[0.3em]">
          © 2025 NEURO-MASTER // HYBRID-ANALOG ENGINE
        </div>
      </footer>
    </div>
  );
}
