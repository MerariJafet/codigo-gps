import { UploadCloud, Zap, Play } from 'lucide-react';

interface NoProjectStateProps {
    hasSelectedFolder?: boolean;
    runState?: string;
}

export default function NoProjectState({ hasSelectedFolder = false, runState = 'idle' }: NoProjectStateProps) {
    // Show different states based on progress
    if (hasSelectedFolder && runState === 'idle') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <div className="text-center space-y-6 opacity-80 bg-black/40 p-10 rounded-2xl border border-[#00F0FF]/20 backdrop-blur-sm">
                    <div className="w-40 h-40 rounded-full border-2 border-[#00F0FF]/50 flex items-center justify-center mx-auto animate-pulse bg-[#00F0FF]/10">
                        <Play size={64} className="text-[#00F0FF]" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#00F0FF] tracking-widest">READY TO ANALYZE</h2>
                    <p className="text-gray-400 font-mono text-sm max-w-xs mx-auto">
                        Target system loaded. Click INITIALIZE RUN to begin analysis.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div className="text-center space-y-6 opacity-60 bg-black/40 p-10 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="w-40 h-40 rounded-full border-2 border-dashed border-[#00F0FF]/30 flex items-center justify-center mx-auto animate-pulse bg-[#00F0FF]/5">
                    <UploadCloud size={64} className="text-[#00F0FF]" />
                </div>
                <h2 className="text-2xl font-bold text-gray-600 tracking-widest">SELECT TARGET SYSTEM</h2>
                <p className="text-gray-700 font-mono text-sm max-w-xs mx-auto">
                    Choose a project folder above to begin the analysis sequence.
                </p>
            </div>
        </div>
    );
}
