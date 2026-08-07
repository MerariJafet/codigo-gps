import { Bot, AlertTriangle, Layers, ShieldCheck, Boxes } from 'lucide-react';
import { GraphData, Insight, SEVERITY_COLORS, SEVERITY_LABELS, Severity } from '../types';

interface SidebarRightProps {
    node: any;
    data?: GraphData | null;
    onShowInsight?: (insight: Insight) => void;
}

export default function SidebarRight({ node, data, onShowInsight }: SidebarRightProps) {
    if (!node) return (
        <div className="w-80 border-l border-[#ffffff]/10 bg-black/40 backdrop-blur-sm p-8 hidden lg:flex flex-col items-center justify-center text-center z-20">
            <Bot size={48} className="text-gray-700 mb-4" />
            <p className="text-gray-500 text-sm">Selecciona un nodo para<br />activar el Modo Mentor</p>
        </div>
    );

    const nodeInsights = (data?.insights || []).filter(i => i.nodes.includes(node.id));
    const nodeModule = (data?.modules || []).find(m => m.id === node.module);

    return (
        <div className="w-96 border-l border-[#9A4DFF]/20 bg-[#05060A]/90 backdrop-blur-md h-full z-20 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-[#9A4DFF]/20 bg-gradient-to-r from-[#9A4DFF]/10 to-transparent">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400">
                        {node.type}
                    </span>
                    {nodeModule && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"
                            style={{ background: nodeModule.color + '22', color: nodeModule.color }}>
                            <Boxes size={10} /> {nodeModule.name}
                        </span>
                    )}
                </div>
                <h2 className="text-xl font-bold text-white break-words leading-tight glow-text-purple">
                    {node.label}
                </h2>
            </div>

            {/* Mentor content */}
            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-6">

                {/* Educational Classification Card */}
                <div className="glass-panel p-4 rounded-lg border-l-2" style={{ borderColor: getColorForLayer(node.classification?.layer) }}>
                    <div className="flex items-center gap-2 mb-3" style={{ color: getColorForLayer(node.classification?.layer) }}>
                        <Bot size={18} />
                        <h3 className="text-sm font-bold uppercase">{getRoleName(node.classification?.role)}</h3>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        {getRoleDescription(node.classification?.role)}
                    </p>
                    <div className="mt-3 text-xs text-gray-400 italic border-t border-white/5 pt-2">
                        {getLayerDescription(node.classification?.layer)}
                    </div>
                </div>

                {/* Metrics Grid */}
                <div>
                    <h4 className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase mb-3">
                        <Layers size={14} /> Métricas
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <Metric label="Líneas" value={node.metrics?.loc ?? 0} color="#FFC98B" />
                        <Metric label="Complejidad" value={node.metrics?.complexity ?? 1} color="#FF4EC3" />
                        <Metric label="Lo importan" value={node.metrics?.in_degree ?? 0} color="#37FFB0"
                            hint="Archivos que dependen de este" />
                        <Metric label="Importa a" value={node.metrics?.out_degree ?? 0} color="#43C6FF"
                            hint="Archivos de los que depende" />
                    </div>
                </div>

                {/* Real findings for this file */}
                <div>
                    <h4 className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase mb-3">
                        <AlertTriangle size={14} /> Hallazgos en este archivo
                    </h4>
                    {nodeInsights.length === 0 ? (
                        <div className="p-3 bg-[#37FFB0]/5 border border-[#37FFB0]/20 rounded flex items-start gap-3">
                            <ShieldCheck size={18} className="text-[#37FFB0] shrink-0 mt-0.5" />
                            <p className="text-[11px] text-[#37FFB0]/90">
                                El análisis no encontró problemas en este archivo.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {nodeInsights.map(ins => {
                                const c = SEVERITY_COLORS[ins.severity as Severity] || '#888';
                                return (
                                    <button key={ins.id}
                                        onClick={() => onShowInsight && onShowInsight(ins)}
                                        className="w-full text-left p-3 rounded border transition-all hover:brightness-125"
                                        style={{ background: c + '10', borderColor: c + '33' }}>
                                        <div className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: c }}>
                                            {SEVERITY_LABELS[ins.severity as Severity]}
                                        </div>
                                        <div className="text-[11px] text-gray-200 leading-snug">{ins.title}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

function Metric({ label, value, color, hint }: any) {
    return (
        <div className="bg-white/5 p-2 rounded text-center" title={hint}>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-lg font-mono" style={{ color }}>{value}</div>
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

function getRoleName(role: string) {
    switch (role) {
        case 'entrypoint': return 'Punto de entrada';
        case 'core_hub': return 'Hub central';
        case 'orphan': return 'Huérfano';
        default: return 'Archivo hoja';
    }
}

function getRoleDescription(role: string) {
    switch (role) {
        case 'entrypoint': return 'Aquí arranca el sistema: es la puerta de entrada del programa.';
        case 'core_hub': return 'Está muy conectado: muchos archivos dependen de él. Tócalo con cuidado y cúbrelo con tests.';
        case 'orphan': return 'Nadie lo importa. Puede ser código muerto o un script que se ejecuta por su cuenta.';
        default: return 'Archivo con responsabilidades específicas, pocas dependencias apuntan hacia él.';
    }
}

function getLayerDescription(layer: string) {
    switch (layer) {
        case 'backend': return 'Lógica de servidor y manejo de API.';
        case 'frontend': return 'Interfaz de usuario y lógica del cliente.';
        case 'shared': return 'Código compartido entre capas.';
        case 'config': return 'Configuración e infraestructura del proyecto.';
        case 'test': return 'Pruebas automatizadas.';
        default: return 'Archivo general del proyecto.';
    }
}
