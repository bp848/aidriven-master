import React, { useState } from 'react';
import { Mail, Upload, Play, ChevronRight, Music, AlertCircle, Loader2, Check } from 'lucide-react';

interface Props {
    onComplete: (file: File, email: string) => void;
    isProcessing: boolean;
}

type FlowStep = 'email' | 'upload' | 'confirm';

const STEPS: { id: FlowStep; label: string }[] = [
    { id: 'email', label: 'Delivery' },
    { id: 'upload', label: 'Source' },
    { id: 'confirm', label: 'Execute' },
];

export const MasteringFlow: React.FC<Props> = ({ onComplete, isProcessing }) => {
    const [step, setStep] = useState<FlowStep>('email');
    const [email, setEmail] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const stepIndex = STEPS.findIndex(s => s.id === step);

    const handleNext = () => {
        if (step === 'email' && email) setStep('upload');
        else if (step === 'upload' && file) setStep('confirm');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) setFile(selectedFile);
    };

    const initiateMastering = () => {
        if (file && email) onComplete(file, email);
    };

    return (
        <div className="w-full max-w-lg mx-auto">
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-10 px-4">
                {STEPS.map((s, i) => (
                    <React.Fragment key={s.id}>
                        <div className="flex flex-col items-center gap-2">
                            <div className={`
                                w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300
                                ${i < stepIndex
                                    ? 'bg-success/15 text-success border border-success/20'
                                    : i === stepIndex
                                        ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                                        : 'bg-muted text-muted-foreground border border-border'
                                }
                            `}>
                                {i < stepIndex ? <Check className="w-4 h-4" /> : i + 1}
                            </div>
                            <span className={`text-[10px] uppercase tracking-[0.15em] font-semibold ${
                                i === stepIndex ? 'text-primary' : 'text-muted-foreground'
                            }`}>
                                {s.label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={`h-px flex-1 mx-3 mt-[-20px] transition-colors duration-300 ${
                                i < stepIndex ? 'bg-success/25' : 'bg-border'
                            }`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Content */}
            <div className="surface-1 rounded-xl p-8 min-h-[360px] flex flex-col justify-between relative overflow-hidden">
                {/* Step 1: Email */}
                {step === 'email' && (
                    <div className="flex flex-col gap-6 animate-in">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-xl font-bold text-foreground tracking-tight">Delivery Address</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Your mastered file and preview link will be sent to this email. Processing typically takes 1-2 minutes.
                            </p>
                        </div>

                        <div className="relative group">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="email"
                                placeholder="producer@studio.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={!email || !email.includes('@')}
                            className={`w-full flex items-center justify-center gap-2 py-3.5 font-semibold rounded-lg transition-all text-sm ${
                                email && email.includes('@')
                                    ? 'bg-primary text-primary-foreground btn-glow hover:bg-primary/90'
                                    : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                            }`}
                        >
                            Continue <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Step 2: Upload */}
                {step === 'upload' && (
                    <div className="flex flex-col gap-6 animate-in">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-xl font-bold text-foreground tracking-tight">Upload Source</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Upload your pre-master. Recommended: 24-bit WAV or AIFF at -6dB headroom.
                            </p>
                        </div>

                        <label className={`
                            flex flex-col items-center justify-center w-full h-40 rounded-lg border-2 border-dashed transition-all cursor-pointer
                            ${file
                                ? 'bg-primary/5 border-primary/30'
                                : 'bg-muted/50 border-border hover:border-primary/30 hover:bg-muted'
                            }
                        `}>
                            <input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
                            {file ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                                        <Music className="w-6 h-6 text-primary" />
                                    </div>
                                    <span className="text-foreground font-mono text-xs">{file.name}</span>
                                    <span className="tag tag-green text-[10px]">Ready</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <Upload className="w-8 h-8" />
                                    <span className="text-xs">Click to select or drop audio file</span>
                                </div>
                            )}
                        </label>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setStep('email')}
                                className="flex-1 py-3.5 btn-secondary rounded-lg text-sm font-medium"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={!file}
                                className={`flex-[2] py-3.5 font-semibold rounded-lg transition-all text-sm ${
                                    file
                                        ? 'bg-primary text-primary-foreground btn-glow hover:bg-primary/90'
                                        : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                                }`}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirm */}
                {step === 'confirm' && (
                    <div className="flex flex-col gap-6 animate-in">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-xl font-bold text-foreground tracking-tight">Confirm & Master</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                AI agents will analyze your track and determine optimal mastering parameters.
                            </p>
                        </div>

                        <div className="bg-muted rounded-lg p-5 flex flex-col gap-3 border border-border">
                            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-primary">
                                <span>Session Ready</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                                    <span className="text-success">Active</span>
                                </span>
                            </div>
                            <div className="divider" />
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Track</span>
                                <span className="text-foreground font-medium truncate max-w-[200px]">{file?.name}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Deliver to</span>
                                <span className="text-foreground font-medium truncate max-w-[200px]">{email}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Target</span>
                                <span className="font-mono text-xs text-primary">-8.0 LUFS / -1.0 dBTP</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setStep('upload')}
                                disabled={isProcessing}
                                className="flex-1 py-3.5 btn-secondary rounded-lg text-sm font-medium"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    initiateMastering();
                                }}
                                disabled={isProcessing}
                                className={`flex-[2] relative overflow-hidden py-3.5 font-semibold rounded-lg transition-all text-sm ${
                                    isProcessing
                                        ? 'bg-primary/50 text-primary-foreground/60 cursor-not-allowed'
                                        : 'bg-primary text-primary-foreground btn-glow hover:bg-primary/90'
                                }`}
                            >
                                {isProcessing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                                    </span>
                                ) : (
                                    'Start Mastering'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 flex items-center justify-center">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full border border-border">
                    <AlertCircle className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Beatport Top 10 Standard</span>
                </div>
            </div>
        </div>
    );
};
