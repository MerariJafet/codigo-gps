import { FolderOpen, Play, XCircle } from 'lucide-react';
import { useState } from 'react';

interface TopBarProps {
    currentPath: string;
    onPathChange: (path: string) => void;
    onRun: () => void;
    status: string;
    onClear: () => void;
    onBrowse?: () => void;
}

export default function TopBar({ currentPath, onPathChange, onRun, status, onClear, onBrowse }: TopBarProps) {
    const [inputVal, setInputVal] = useState(currentPath);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputVal(e.target.value);
        onPathChange(e.target.value);
    };

    return (
        <header className="h-24 flex items-center justify-between px-8 border-b border-[#00F0FF]/10 bg-[#05060A]/80 backdrop-blur-md z-40 relative">

            {/* Logo - Minimal */}
            <div className="w-1/4">
                <h1 className="text-lg font-bold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#BD00FF] glow-text-cyan flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#00FF41] rounded-full animate-pulse"></span>
                    CÓDIGO GPS
                </h1>
            </div>

            {/* Center Control Module */}
            <div className="flex-1 flex flex-col items-center justify-center gap-2 max-w-xl mx-auto">

                {/* Connection Label */}
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Target System Interface</div>

                {/* Input Line */}
                <div className={`w-[60%] flex items-center gap-2 px-3 py-1 bg-black/40 border-b border-[#00F0FF]/30 transition-all ${status === 'scanning' ? 'opacity-50' : 'hover:border-[#00F0FF]'}`}>
                    <button
                        onClick={async () => {
                            if (onBrowse) {
                                onBrowse();
                            }
                        }}
                        className="hover:text-[#00F0FF] text-gray-500 transition-colors"
                        title="Browse Server Files"
                    >
                        <FolderOpen size={14} />
                    </button>
                    <input
                        type="text"
                        value={inputVal}
                        onChange={handleInputChange}
                        placeholder="LOAD TARGET SYSTEM..."
                        className="flex-1 bg-transparent outline-none text-xs font-mono text-[#00F0FF] placeholder-gray-700 text-center uppercase tracking-wider"
                        disabled={status === 'scanning'}
                    />
                    {inputVal && status !== 'scanning' && (
                        <button onClick={() => { setInputVal(''); onClear(); }} className="text-gray-700 hover:text-red-500">
                            <XCircle size={12} />
                        </button>
                    )}
                </div>

                {/* Glitch Button - Below Input */}
                <button
                    onClick={onRun}
                    disabled={!currentPath || status === 'scanning'}
                    className={`group relative overflow-hidden px-8 py-1 transition-all duration-300 transform scale-90
                    ${!currentPath ? 'opacity-30 cursor-not-allowed' : 'hover:scale-[0.95] active:scale-[0.85]'}
                `}
                >
                    <div className={`absolute inset-0 bg-[#00F0FF]/10 skew-x-12 group-hover:bg-[#00F0FF]/20 transition-all border-l border-r border-[#00F0FF]/50 ${status === 'scanning' ? 'animate-pulse' : ''}`}></div>
                    <div className="relative flex items-center gap-2 text-[#00F0FF] font-bold text-xs tracking-[0.3em] uppercase">
                        {status === 'scanning' ? 'SCANNING...' : 'INITIALIZE RUN'}
                        <Play size={10} fill="currentColor" />
                    </div>
                </button>

            </div>

            {/* Status - Minimal */}
            <div className="w-1/4 text-right">
                <div className={`text-[10px] font-mono ${status === 'error' ? 'text-red-500' : 'text-[#00FF41]'}`}>
                    STATUS: {status.toUpperCase()}
                </div>
            </div>

        </header>
    );
}

