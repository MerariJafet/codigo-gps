import { UploadCloud } from 'lucide-react';

export default function NoProjectState() {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div className="text-center space-y-6 opacity-60 bg-black/40 p-10 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="w-40 h-40 rounded-full border-2 border-dashed border-[#00F0FF]/30 flex items-center justify-center mx-auto animate-pulse bg-[#00F0FF]/5">
                    <UploadCloud size={64} className="text-[#00F0FF]" />
                </div>
                <h2 className="text-2xl font-bold text-gray-600 tracking-widest">NO SIGNAL DETECTED</h2>
                <p className="text-gray-700 font-mono text-sm max-w-xs mx-auto">
                    Select a valid project path above and initialize the run sequence.
                </p>
            </div>
        </div>
    );
}
