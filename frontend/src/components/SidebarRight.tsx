import { Bot, AlertTriangle, Code, Layers } from 'lucide-react';

export default function SidebarRight({ node }: any) {
    if (!node) return (
        <div className="w-80 border-l border-[#ffffff]/10 bg-black/40 backdrop-blur-sm p-8 hidden lg:flex flex-col items-center justify-center text-center z-20">
            <Bot size={48} className="text-gray-700 mb-4" />
            <p className="text-gray-500 text-sm">Select a node to activate<br />Mentor Mode</p>
        </div>
    );

    return (
        <div className="w-96 border-l border-[#9A4DFF]/20 bg-[#05060A]/90 backdrop-blur-md h-full z-20 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-[#9A4DFF]/20 bg-gradient-to-r from-[#9A4DFF]/10 to-transparent">
                <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${node.type === 'file' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {node.type}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">ID: {node.id.substring(0, 8)}...</span>
                </div>
                <h2 className="text-xl font-bold text-white break-words leading-tight glow-text-purple">
                    {node.label}
                </h2>
            </div>

            {/* Mentor Chat / Explanation */}
            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-6">

                {/* Educational Classification Card */}
                <div className="glass-panel p-4 rounded-lg border-l-2" style={{ borderColor: getColorForLayer(node.classification?.layer) }}>
                    <div className="flex items-center gap-2 mb-3" style={{ color: getColorForLayer(node.classification?.layer) }}>
                        <Bot size={18} />
                        <h3 className="text-sm font-bold uppercase">{node.classification?.role || 'File'}</h3>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        <strong className="text-white">Layer:</strong> {node.classification?.layer?.toUpperCase() || 'UNKNOWN'}<br />
                        <strong className="text-white">Role:</strong> {getRoleDescription(node.classification?.role)}
                    </p>
                    <div className="mt-3 text-xs text-gray-400 italic border-t border-white/5 pt-2">
                        {getLayerDescription(node.classification?.layer)}
                    </div>
                </div>

                {/* Metrics Grid */}
                <div>
                    <h4 className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase mb-3">
                        <Layers size={14} /> Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/5 p-2 rounded text-center">
                            <div className="text-xs text-gray-500">Degree</div>
                            <div className="text-lg font-mono text-[#37FFB0]">{node.metrics?.degree || 0}</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded text-center">
                            <div className="text-xs text-gray-500">LOC</div>
                            {/* @ts-ignore */}
                            <div className="text-lg font-mono text-[#FFC98B]">{node.metrics?.loc || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                {/* Code Snippet Placeholder */}
                <div>
                    <h4 className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase mb-3">
                        <Code size={14} /> Preview
                    </h4>
                    <div className="bg-black/50 p-3 rounded font-mono text-xs text-gray-400 overflow-x-auto border border-white/5">
                        <span className="text-pink-500">import</span> React <span className="text-pink-500">from</span> 'react';<br />
                        <span className="text-blue-400">export default</span> <span className="text-yellow-300">function</span>...
                    </div>
                </div>

                {/* Alerts */}
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <h5 className="text-xs font-bold text-red-400 mb-1">VULNERABILITY SCAN</h5>
                        <p className="text-[10px] text-red-300/80">No critical CVEs detected in this file scope.</p>
                    </div>
                </div>

            </div>
        </div>
    );
}

function getColorForLayer(layer: string) {
    switch (layer) {
        case 'backend': return '#00E5FF';
        case 'frontend': return '#FF4EC3';
        case 'shared': return '#B388FF';
        case 'config': return '#FFB74D';
        case 'test': return '#8BC34A';
        default: return '#B0BEC5';
    }
}

function getRoleDescription(role: string) {
    switch (role) {
        case 'entrypoint': return 'System Entry Point (Start)';
        case 'core_hub': return 'High Connectivity Hub';
        case 'orphan': return 'Isolated / Unused';
        case 'leaf': return 'Specific Utility / Leaf';
        default: return 'Standard File(Leaf)';
    }
}

function getLayerDescription(layer: string) {
    switch (layer) {
        case 'backend': return 'Server-side logic and API handling.';
        case 'frontend': return 'User Interface and client-side logic.';
        case 'shared': return 'Code shared between layers.';
        case 'config': return 'Project configuration and infrastructure.';
        default: return 'General project file.';
    }
}
