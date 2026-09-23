'use client';

// SALVAGED 2026-09-23 from legacy clone; not wired
// Local stubs: v2 lacked FilterState + EDGE_TYPE_COLORS at salvage time (unwired).

export interface FilterState {
    edgeTypes: Record<string, boolean>;
    roles: Record<string, boolean>;
    layers: Record<string, boolean>;
}

const CONFIG_EDGE_COLORS: Record<string, string> = {
    import: 'rgba(255, 255, 255, 0.25)',
    call: 'rgba(0, 229, 255, 0.8)',
    extends: 'rgba(180, 0, 255, 0.8)',
    re_export: 'rgba(255, 200, 0, 0.8)',
    mounts: 'rgba(0, 255, 128, 0.8)',
    circular: 'rgba(255, 50, 50, 0.95)',
};

interface FilterPanelProps {
    filters: FilterState;
    onChange: (filters: FilterState) => void;
    onClose: () => void;
}

const ALL_EDGE_TYPES = ['import', 'call', 'extends', 're_export', 'mounts', 'circular'];
const ALL_ROLES = ['entrypoint', 'core_hub', 'orphan', 'leaf', 'middleware', 'service', 'router', 'component', 'hook', 'context'];
const ALL_LAYERS = ['backend', 'frontend', 'shared', 'config', 'test', 'unknown'];

const EDGE_LABELS: Record<string, string> = {
    import: 'Import',
    call: 'Function Call',
    extends: 'Extends / Inherit',
    re_export: 'Re-export',
    mounts: 'Mounts',
    circular: 'Circular Dep',
};

const ROLE_LABELS: Record<string, string> = {
    entrypoint: 'Entrypoint',
    core_hub: 'Core Hub',
    orphan: 'Orphan',
    leaf: 'Leaf',
    middleware: 'Middleware',
    service: 'Service',
    router: 'Router',
    component: 'Component',
    hook: 'Hook',
    context: 'Context',
};

const LAYER_COLORS: Record<string, string> = {
    backend: '#00E5FF',
    frontend: '#FF4EC3',
    shared: '#B388FF',
    config: '#FFB74D',
    test: '#8BC34A',
    unknown: '#B0BEC5',
};

export default function FilterPanel({ filters, onChange, onClose }: FilterPanelProps) {
    const toggle = (category: 'edgeTypes' | 'roles' | 'layers', key: string) => {
        const current = filters[category][key] !== false;
        onChange({
            ...filters,
            [category]: {
                ...filters[category],
                [key]: !current
            }
        });
    };

    const toggleAll = (category: 'edgeTypes' | 'roles' | 'layers', keys: string[], value: boolean) => {
        const updated: Record<string, boolean> = {};
        keys.forEach(k => updated[k] = value);
        onChange({
            ...filters,
            [category]: updated
        });
    };

    return (
        <div className="absolute top-16 right-4 z-50 w-72 bg-[#05060A]/95 border border-[#9A4DFF]/30 rounded-lg backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#9A4DFF]/20">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Filters</h3>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                >
                    Close
                </button>
            </div>

            <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto cyber-scrollbar">

                {/* Edge Types */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Edge Types</h4>
                        <div className="flex gap-2">
                            <button onClick={() => toggleAll('edgeTypes', ALL_EDGE_TYPES, true)} className="text-[9px] text-[#00E5FF] hover:underline">All</button>
                            <button onClick={() => toggleAll('edgeTypes', ALL_EDGE_TYPES, false)} className="text-[9px] text-gray-500 hover:underline">None</button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        {ALL_EDGE_TYPES.map(type => {
                            const isOn = filters.edgeTypes[type] !== false;
                            const color = CONFIG_EDGE_COLORS[type] || 'rgba(255,255,255,0.3)';
                            return (
                                <label key={type} className="flex items-center gap-2 cursor-pointer group">
                                    <div
                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isOn ? 'opacity-100' : 'opacity-30'}`}
                                        style={{ borderColor: color, backgroundColor: isOn ? color : 'transparent' }}
                                        onClick={() => toggle('edgeTypes', type)}
                                    >
                                        {isOn && <span className="text-black text-[8px] font-bold">✓</span>}
                                    </div>
                                    <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                                        {EDGE_LABELS[type] || type}
                                    </span>
                                    {/* Color swatch */}
                                    <div className="ml-auto w-8 h-1 rounded" style={{ backgroundColor: color }} />
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Roles */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Node Roles</h4>
                        <div className="flex gap-2">
                            <button onClick={() => toggleAll('roles', ALL_ROLES, true)} className="text-[9px] text-[#00E5FF] hover:underline">All</button>
                            <button onClick={() => toggleAll('roles', ALL_ROLES, false)} className="text-[9px] text-gray-500 hover:underline">None</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {ALL_ROLES.map(role => {
                            const isOn = filters.roles[role] !== false;
                            return (
                                <label key={role} className="flex items-center gap-1.5 cursor-pointer group" onClick={() => toggle('roles', role)}>
                                    <div className={`w-3 h-3 rounded-sm border transition-all ${isOn ? 'bg-[#9A4DFF] border-[#9A4DFF]' : 'bg-transparent border-gray-600'}`}>
                                        {isOn && <span className="text-white text-[8px] leading-3 flex items-center justify-center">✓</span>}
                                    </div>
                                    <span className="text-[11px] text-gray-400 group-hover:text-white capitalize transition-colors truncate">
                                        {ROLE_LABELS[role] || role}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Layers */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Layers</h4>
                        <div className="flex gap-2">
                            <button onClick={() => toggleAll('layers', ALL_LAYERS, true)} className="text-[9px] text-[#00E5FF] hover:underline">All</button>
                            <button onClick={() => toggleAll('layers', ALL_LAYERS, false)} className="text-[9px] text-gray-500 hover:underline">None</button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        {ALL_LAYERS.map(layer => {
                            const isOn = filters.layers[layer] !== false;
                            const color = LAYER_COLORS[layer] || '#B0BEC5';
                            return (
                                <label key={layer} className="flex items-center gap-2 cursor-pointer group" onClick={() => toggle('layers', layer)}>
                                    <div
                                        className="w-3 h-3 rounded-full border-2 shrink-0 transition-all"
                                        style={{
                                            borderColor: color,
                                            backgroundColor: isOn ? color : 'transparent',
                                            opacity: isOn ? 1 : 0.3
                                        }}
                                    />
                                    <span className="text-[11px] text-gray-400 group-hover:text-white capitalize transition-colors">
                                        {layer}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
