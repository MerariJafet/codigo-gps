import { ArrowRight, Boxes, Link2, FileCode } from 'lucide-react';
import { GraphData } from '../types';

interface ModulesViewProps {
    data: GraphData;
    onExploreModule: (id: string) => void;
    onSelectNode: (id: string) => void;
}

export default function ModulesView({ data, onExploreModule, onSelectNode }: ModulesViewProps) {
    const modules = data.modules || [];
    const moduleLinks = data.module_links || [];

    return (
        <div className="absolute inset-0 z-20 overflow-y-auto custom-scrollbar bg-[#05060A]/95 backdrop-blur px-8 pb-8 pt-20">
            <div className="max-w-6xl mx-auto">
                <div className="mb-2">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#37FFB0] to-[#43C6FF]">
                        MÓDULOS DEL SISTEMA
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 tracking-wide">
                        Cada tarjeta es una región del holograma. La <span className="text-gray-300">cohesión</span> mide qué tan autocontenido es el módulo:
                        alta = bloque sano, baja = depende demasiado de otros.
                    </p>
                </div>

                {/* Module relations strip */}
                {moduleLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 my-6">
                        {moduleLinks.slice(0, 10).map((ml) => {
                            const src = modules.find(m => m.id === ml.source);
                            const tgt = modules.find(m => m.id === ml.target);
                            return (
                                <div key={`${ml.source}->${ml.target}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs">
                                    <span style={{ color: src?.color }} className="font-bold">{ml.source}</span>
                                    <ArrowRight size={12} className="text-gray-500" />
                                    <span style={{ color: tgt?.color }} className="font-bold">{ml.target}</span>
                                    <span className="text-gray-500 font-mono ml-1">×{ml.count}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {modules.map((m) => {
                        const cohesionColor = m.cohesion >= 0.7 ? '#37FFB0' : m.cohesion >= 0.4 ? '#FFB74D' : '#FF2E63';
                        return (
                            <div key={m.id} className="glass-panel rounded-xl border border-white/5 overflow-hidden group hover:border-white/15 transition-colors">
                                {/* Header */}
                                <div className="p-4 border-b border-white/5" style={{ background: `linear-gradient(135deg, ${m.color}18, transparent 60%)` }}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: m.color, boxShadow: `0 0 10px ${m.color}` }} />
                                            <h3 className="font-black text-white truncate">{m.name}</h3>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full border shrink-0"
                                            style={{ color: m.color, borderColor: m.color + '44', background: m.color + '12' }}>
                                            {m.main_language}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4">
                                    {/* Stats row */}
                                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                        <MiniStat icon={<FileCode size={12} />} value={m.file_count} label="archivos" />
                                        <MiniStat icon={<Boxes size={12} />} value={m.total_loc.toLocaleString()} label="líneas" />
                                        <MiniStat icon={<Link2 size={12} />} value={m.internal_links + m.external_out} label="conexiones" />
                                    </div>

                                    {/* Cohesion bar */}
                                    <div className="mb-4">
                                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                            <span>COHESIÓN</span>
                                            <span style={{ color: cohesionColor }} className="font-bold">{Math.round(m.cohesion * 100)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{
                                                width: `${m.cohesion * 100}%`,
                                                backgroundColor: cohesionColor,
                                                boxShadow: `0 0 6px ${cohesionColor}`,
                                            }} />
                                        </div>
                                    </div>

                                    {/* Top files */}
                                    <div className="space-y-1 mb-4">
                                        <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5">Archivos clave</div>
                                        {m.top_files.slice(0, 3).map((f) => (
                                            <button key={f.id} onClick={() => onSelectNode(f.id)}
                                                className="w-full flex justify-between items-center text-left px-2 py-1 rounded hover:bg-white/5 transition-colors">
                                                <span className="text-[11px] text-gray-300 truncate">{f.label.split('/').pop()}</span>
                                                <span className="text-[10px] text-gray-500 font-mono shrink-0 ml-2">cx {f.complexity}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => onExploreModule(m.id)}
                                        className="w-full py-2 rounded-lg text-xs font-bold tracking-widest uppercase border transition-all hover:brightness-125"
                                        style={{ color: m.color, borderColor: m.color + '55', background: m.color + '10' }}
                                    >
                                        Ver región en el holograma
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function MiniStat({ icon, value, label }: any) {
    return (
        <div className="bg-white/[0.03] rounded-lg py-2">
            <div className="flex items-center justify-center gap-1 text-gray-300 text-sm font-bold">{icon}{value}</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wider">{label}</div>
        </div>
    );
}
