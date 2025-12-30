import { GRAPH_COLORS } from './GraphConfig';

interface LegendPanelProps {
    folderStats?: { path: string, count: number, color: string }[];
    onFolderHover?: (folder: string | null) => void;
}

export default function LegendPanel({ folderStats, onFolderHover }: LegendPanelProps) {
    return (
        <div className="absolute bottom-6 left-6 p-4 glass-panel rounded-lg border border-white/10 bg-[#05060A]/80 backdrop-blur z-30 max-w-[240px] max-h-[60vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Architecture Layers</h3>
            <div className="space-y-2 mb-4">
                <LegendItem color={GRAPH_COLORS.backend} label="Backend" desc="Server Logic & API" />
                <LegendItem color={GRAPH_COLORS.frontend} label="Frontend" desc="UI Components" />
                <LegendItem color={GRAPH_COLORS.shared} label="Shared / Core" desc="Common Utilities" />
                <LegendItem color={GRAPH_COLORS.config} label="Config" desc="Infrastructure" />
                <LegendItem color={GRAPH_COLORS.test} label="Tests" desc="Unit/Integration Tests" />
            </div>

            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Educational Roles</h3>
            <div className="space-y-2 mb-4">
                <RoleItem type="entrypoint" label="Entry Point" desc="System Start" />
                <RoleItem type="hub" label="Core Hub" desc="Highly Connected" />
                <RoleItem type="orphan" label="Orphan" desc="No Connections" />
            </div>

            {folderStats && folderStats.length > 0 && (
                <>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Folder Nebulas</h3>
                    <div className="space-y-2">
                        {folderStats.slice(0, 8).map((stat) => (
                            <div
                                key={stat.path}
                                className="flex items-center gap-3 group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors"
                                onMouseEnter={() => onFolderHover && onFolderHover(stat.path)}
                                onMouseLeave={() => onFolderHover && onFolderHover(null)}
                            >
                                <div
                                    className="w-3 h-3 rounded-full border border-white/20"
                                    style={{
                                        backgroundColor: stat.color,
                                        boxShadow: `0 0 8px ${stat.color}`
                                    }}
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-200 truncate max-w-[140px]">{stat.path}</span>
                                    <span className="text-[10px] text-gray-500">{stat.count} files</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function LegendItem({ color, label, desc }: any) {
    return (
        <div className="flex items-center gap-3 group cursor-help" title={desc}>
            <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color, color: color }} />
            <div>
                <div className="text-xs font-bold text-gray-300">{label}</div>
            </div>
        </div>
    );
}

function RoleItem({ type, label, desc }: any) {
    return (
        <div className="flex items-center gap-3 group cursor-help" title={desc}>
            <div className={`w-3 h-3 rounded-full bg-gray-500 border-2
                ${type === 'entrypoint' ? 'border-white shadow-[0_0_10px_white]' : ''}
                ${type === 'hub' ? 'border-[#FFF176] shadow-[0_0_5px_#FFF176]' : ''}
                ${type === 'orphan' ? 'border-none opacity-40 bg-[#37474F]' : ''}
            `} />
            <div className="text-xs font-bold text-gray-300">{label}</div>
        </div>
    );
}
