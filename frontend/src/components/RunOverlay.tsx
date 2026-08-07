import { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, Loader2, Terminal } from 'lucide-react';

export type RunState = 'idle' | 'connecting' | 'indexing' | 'building' | 'rendering' | 'ready' | 'failed';

interface RunStep {
    id: RunState;
    label: string;
    description: string;
    duration?: number;
}

interface RunOverlayProps {
    isVisible: boolean;
    currentState: RunState;
    onCancel?: () => void;
    logs: string[];
    error?: string;
}

const RUN_STEPS: RunStep[] = [
    { id: 'connecting', label: 'CONNECTING BACKEND', description: 'Establishing connection to analysis service', duration: 2000 },
    { id: 'indexing', label: 'INDEXING FILES', description: 'Scanning and cataloging project files', duration: 3000 },
    { id: 'building', label: 'BUILDING GRAPH', description: 'Analyzing dependencies and relationships', duration: 4000 },
    { id: 'rendering', label: 'RENDERING HOLOGRAM', description: 'Generating 3D visualization', duration: 2000 },
];

export default function RunOverlay({ isVisible, currentState, onCancel, logs, error }: RunOverlayProps) {
    const [showLogs, setShowLogs] = useState(false);

    // Derived, not state: avoids setState-in-effect cascading renders
    const currentStepIndex = RUN_STEPS.findIndex(step => step.id === currentState);
    const progress = !isVisible || currentStepIndex < 0
        ? 0
        : (currentStepIndex / RUN_STEPS.length) * 100;

    if (!isVisible) return null;

    const getStepStatus = (stepId: RunState) => {
        const stepIndex = RUN_STEPS.findIndex(s => s.id === stepId);
        const currentIndex = RUN_STEPS.findIndex(s => s.id === currentState);

        if (stepIndex < currentIndex) return 'completed';
        if (stepIndex === currentIndex) return 'active';
        return 'pending';
    };

    const getStepIcon = (stepId: RunState) => {
        const status = getStepStatus(stepId);
        switch (status) {
            case 'completed':
                return <CheckCircle size={16} className="text-green-400" />;
            case 'active':
                return <Loader2 size={16} className="text-[#00F0FF] animate-spin" />;
            case 'pending':
                return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />;
        }
    };

    return (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-[#05060A] border border-[#00F0FF]/30 rounded-lg p-8 max-w-2xl w-full mx-4 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold text-[#00F0FF] tracking-widest mb-2">
                        ANALYSIS SEQUENCE
                    </h2>
                    <div className="text-sm text-gray-400">
                        Initializing target system analysis...
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                        <div
                            className="bg-gradient-to-r from-[#00F0FF] to-[#BD00FF] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="text-right text-xs text-gray-500">
                        {Math.round(progress)}% Complete
                    </div>
                </div>

                {/* Steps */}
                <div className="space-y-4 mb-8">
                    {RUN_STEPS.map((step) => (
                        <div key={step.id} className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                                {getStepIcon(step.id)}
                            </div>
                            <div className="flex-1">
                                <div className={`text-sm font-mono tracking-wider ${
                                    getStepStatus(step.id) === 'active' ? 'text-[#00F0FF]' :
                                    getStepStatus(step.id) === 'completed' ? 'text-green-400' :
                                    'text-gray-600'
                                }`}>
                                    {step.label}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {step.description}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded p-4 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <XCircle size={16} className="text-red-400" />
                            <span className="text-red-400 font-mono text-sm">ANALYSIS FAILED</span>
                        </div>
                        <p className="text-red-300 text-sm">{error}</p>
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="flex items-center gap-2 text-gray-400 hover:text-[#00F0FF] transition-colors text-sm"
                    >
                        <Terminal size={14} />
                        {showLogs ? 'Hide Logs' : 'Show Logs'}
                    </button>

                    {onCancel && currentState !== 'ready' && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 hover:bg-red-900/40 transition-colors text-sm"
                        >
                            Cancel Analysis
                        </button>
                    )}
                </div>

                {/* Logs Panel */}
                {showLogs && (
                    <div className="mt-6 bg-black/50 border border-gray-700 rounded p-4 max-h-48 overflow-y-auto">
                        <h3 className="text-sm font-mono text-gray-400 mb-2">RUN LOG</h3>
                        <div className="space-y-1 font-mono text-xs">
                            {logs.map((log, index) => (
                                <div key={index} className="text-gray-300">
                                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                                </div>
                            ))}
                            {logs.length === 0 && (
                                <div className="text-gray-600 italic">No logs yet...</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}