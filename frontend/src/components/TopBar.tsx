import { FolderOpen, Play, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import StepIndicator from './StepIndicator';
import { RunState } from './RunOverlay';

interface TopBarProps {
    currentPath: string;
    onPathChange: (path: string) => void;
    onRun: () => void;
    status: string;
    onClear: () => void;
    onBrowse?: () => void;
    backendOnline?: boolean | null;
    runState?: string;
    runtimeMode?: 'web' | 'tauri';
}

export default function TopBar({ currentPath, onPathChange, onRun, status, onClear, onBrowse, backendOnline, runState, runtimeMode }: TopBarProps) {
    const [inputVal, setInputVal] = useState(currentPath);

    // Build ID for debugging - shows current build
    const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'DEV-2026-01-31';

    useEffect(() => {
        console.log(`🚀 CÓDIGO GPS Build ID: ${BUILD_ID}`);
    }, []);

    // Sync internal state with prop changes
    useEffect(() => {
        setInputVal(currentPath);
    }, [currentPath]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputVal(e.target.value);
        onPathChange(e.target.value);
    };

    // Determine step status based on current state
    const getStepStatus = (stepIndex: number): 'pending' | 'active' | 'completed' => {
        if (!currentPath) return 'pending';
        if (runState === 'idle' && stepIndex === 0) return 'completed';
        if (runState === 'idle' && stepIndex === 1) return 'active';
        if (['connecting', 'indexing', 'building', 'rendering'].includes(runState || '') && stepIndex === 2) return 'active';
        if (runState === 'ready' && stepIndex === 3) return 'completed';
        return stepIndex === 0 ? 'completed' : 'pending';
    };

    const steps = [
        { id: 'select', label: 'SELECT PROJECT', status: getStepStatus(0) },
        { id: 'run', label: 'INITIALIZE RUN', status: getStepStatus(1) },
        { id: 'analyze', label: 'ANALYSIS', status: getStepStatus(2) },
        { id: 'visualize', label: 'VISUALIZE', status: getStepStatus(3) },
    ];

    return (
        <header className="h-20 flex flex-col border-b border-[#00F0FF]/10 bg-[#05060A]/90 backdrop-blur-md z-40">

            {/* Step Indicator - Top */}
            <div className="flex-1 flex items-center justify-center px-8">
                <StepIndicator steps={steps} />
            </div>

            {/* Main Controls - Bottom */}
            <div className="flex items-center justify-between px-8 pb-4">

                {/* Left: Title */}
                <div className="flex-1">
                    <h1 className="text-sm font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#BD00FF]">
                        TARGET SYSTEM INTERFACE
                    </h1>
                </div>

                {/* Center: Input and RUN */}
                <div className="flex-1 flex flex-col items-center gap-2 max-w-lg mx-auto">

                    {/* Input Container */}
                    <div className={`w-full flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-[#00F0FF]/30 rounded transition-all ${status === 'scanning' ? 'opacity-50' : 'hover:border-[#00F0FF]'}`}>
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
                            placeholder="SELECT TARGET SYSTEM..."
                            className="flex-1 bg-transparent outline-none text-xs font-mono text-[#00F0FF] placeholder-gray-700 text-center uppercase tracking-wider"
                            disabled={status === 'scanning'}
                        />
                        {inputVal && status !== 'scanning' && (
                            <button onClick={() => { setInputVal(''); onClear(); }} className="text-gray-700 hover:text-red-500">
                                <XCircle size={12} />
                            </button>
                        )}
                    </div>

                    {/* RUN Button */}
                    <button
                        onClick={onRun}
                        disabled={status === 'scanning' || !currentPath}
                        className={`px-6 py-1.5 transition-all duration-300 transform
                        ${status === 'scanning' ? 'opacity-30 cursor-not-allowed' :
                          !currentPath ? 'opacity-50 cursor-not-allowed bg-gray-800' :
                          'hover:scale-[1.02] active:scale-[0.98] bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20'}
                        border border-[#00F0FF]/50 rounded text-[#00F0FF] font-bold text-xs tracking-[0.2em] uppercase`}
                    >
                        {status === 'scanning' ? 'ANALYZING...' : 'INITIALIZE RUN'}
                    </button>

                </div>

                {/* Right: Status */}
                <div className="flex-1 text-right">
                    <div className={`text-[10px] font-mono ${status === 'error' ? 'text-red-500' : 'text-[#00FF41]'}`}>
                        {backendOnline === null ? 'CHECKING...' :
                         backendOnline ? 'BACKEND: ONLINE' : 'BACKEND: OFFLINE'}
                    </div>
                    <div className="text-[10px] font-mono text-gray-500 mt-1">
                        {runtimeMode === 'tauri' ? 'DESKTOP MODE (Direct Path)' : 'WEB MODE (Upload)'}
                    </div>
                </div>

            </div>

        </header>
    );
}

