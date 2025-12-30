"use client";

import { useState, useEffect } from 'react';
import { Gauge, Zap, Activity, Layers, Minimize2, Maximize2 } from 'lucide-react';

export type PerformanceMode = 'high-quality' | 'balanced' | 'high-performance';

interface PerformancePanelProps {
    currentMode: PerformanceMode;
    onModeChange: (mode: PerformanceMode) => void;
    stats: {
        fps: number;
        nodeCount: number;
        linkCount: number;
    };
}

export default function PerformancePanel({ currentMode, onModeChange, stats }: PerformancePanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Color helpers
    const getModeColor = (mode: PerformanceMode) => {
        switch (mode) {
            case 'high-quality': return 'text-cyan-400';
            case 'balanced': return 'text-yellow-400';
            case 'high-performance': return 'text-green-400';
        }
    };

    return (
        <div className={`fixed bottom-4 left-4 z-50 transition-all duration-300 ${isExpanded ? 'w-64' : 'w-12'} bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg overflow-hidden`}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full h-12 flex items-center justify-center hover:bg-cyan-500/10 transition-colors"
                title="Performance Settings"
            >
                {isExpanded ? <Minimize2 size={20} className="text-cyan-400" /> : <Activity size={20} className="text-cyan-400 animate-pulse" />}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 space-y-4">

                    {/* Mode Selector */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold tracking-wider text-gray-500 flex items-center gap-2">
                            <Zap size={14} /> Performance Mode
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => onModeChange('high-quality')}
                                className={`text-left px-3 py-2 rounded text-sm border transition-all ${currentMode === 'high-quality' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-gray-800 text-gray-400 hover:border-gray-600'}`}
                            >
                                <div className="font-bold">Ultra Quality</div>
                                <div className="text-[10px] opacity-70">Max effects, particles, glow</div>
                            </button>
                            <button
                                onClick={() => onModeChange('balanced')}
                                className={`text-left px-3 py-2 rounded text-sm border transition-all ${currentMode === 'balanced' ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300' : 'border-gray-800 text-gray-400 hover:border-gray-600'}`}
                            >
                                <div className="font-bold">Balanced</div>
                                <div className="text-[10px] opacity-70">Standard effects, optimized</div>
                            </button>
                            <button
                                onClick={() => onModeChange('high-performance')}
                                className={`text-left px-3 py-2 rounded text-sm border transition-all ${currentMode === 'high-performance' ? 'border-green-500 bg-green-500/20 text-green-300' : 'border-gray-800 text-gray-400 hover:border-gray-600'}`}
                            >
                                <div className="font-bold">Max Performance</div>
                                <div className="text-[10px] opacity-70">Basic geometry, high FPS</div>
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="pt-2 border-t border-gray-800 space-y-2">
                        <label className="text-xs uppercase font-bold tracking-wider text-gray-500 flex items-center gap-2">
                            <Gauge size={14} /> Live Stats
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-gray-900/50 p-2 rounded border border-gray-800">
                                <span className="block text-gray-500">FPS</span>
                                <span className={`font-mono font-bold text-lg ${stats.fps < 30 ? 'text-red-400' : 'text-green-400'}`}>
                                    {stats.fps}
                                </span>
                            </div>
                            <div className="bg-gray-900/50 p-2 rounded border border-gray-800">
                                <span className="block text-gray-500">Nodes</span>
                                <span className="font-mono font-bold text-lg text-blue-400">{stats.nodeCount}</span>
                            </div>
                            <div className="bg-gray-900/50 p-2 rounded border border-gray-800 col-span-2">
                                <span className="block text-gray-500">Elements</span>
                                <span className="font-mono text-gray-300">{stats.linkCount} links</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
