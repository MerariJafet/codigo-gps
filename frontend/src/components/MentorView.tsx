import { useState } from 'react';
import { toast } from 'react-toastify';
import { GraduationCap, ShieldAlert, Puzzle, Sparkles, ChevronDown, Crosshair, BookOpen, Wrench, Bot } from 'lucide-react';
import { GraphData, Insight, SEVERITY_COLORS, SEVERITY_LABELS, CATEGORY_LABELS, Severity } from '../types';

interface MentorViewProps {
    data: GraphData;
    onShowInGraph: (insight: Insight) => void;
    projectPath?: string;
}

/** Builds a ready-to-paste prompt so an AI agent (Claude Code, etc.) can
 *  analyze, fix and verify the finding autonomously. */
export function buildAgentPrompt(insight: Insight, data: GraphData, projectPath?: string): string {
    const labelOf = (id: string) => data.nodes.find(n => n.id === id)?.label || id.replace('file:', '');
    const files = insight.nodes.map(labelOf);
    const evidence = (insight.evidence || [])
        .map(e => `- ${e.file}:${e.line} → ${e.snippet}`)
        .join('\n');
    const links = (insight.links || [])
        .slice(0, 15)
        .map(l => `- ${labelOf(l.source)} → ${labelOf(l.target)}`)
        .join('\n');

    return `Actúa como ingeniero de software senior. Trabaja en el proyecto${projectPath ? ` ubicado en: ${projectPath}` : ' actual'}.

El analizador estático CÓDIGO GPS detectó este hallazgo:

## Hallazgo
- **Título:** ${insight.title}
- **Categoría:** ${CATEGORY_LABELS[insight.category] || insight.category} · **Severidad:** ${SEVERITY_LABELS[insight.severity as Severity] || insight.severity}
- **Qué se encontró:** ${insight.explanation}
- **Por qué importa:** ${insight.why_matters}
- **Recomendación del analizador:** ${insight.recommendation}
${files.length ? `\n## Archivos afectados\n${files.map(f => `- ${f}`).join('\n')}` : ''}${evidence ? `\n\n## Evidencia (archivo:línea → fragmento)\n${evidence}` : ''}${links ? `\n\n## Conexiones implicadas\n${links}` : ''}

## Tu tarea
1. Lee los archivos afectados y CONFIRMA si el hallazgo es real o un falso positivo (por ejemplo, un secreto de prueba en un fixture). Sé honesto: si es falso positivo, dilo y detente.
2. Si es real, explica la causa raíz en 2-3 frases claras.
3. Corrige el problema siguiendo la recomendación (o justifica una alternativa mejor). Haz el cambio mínimo y limpio.
4. Verifica: corre los tests del proyecto (o el linter/compilador si no hay tests) y confirma que nada se rompió.
5. Reporta al final: qué estaba pasando, qué cambiaste, en qué archivos, y el resultado de la verificación. Sin exagerar ni inventar.`;
}

const CATEGORY_ICONS: Record<string, any> = {
    security: ShieldAlert,
    architecture: Puzzle,
    quality: Sparkles,
};

export default function MentorView({ data, onShowInGraph, projectPath }: MentorViewProps) {
    const copyAgentPrompt = async (insight: Insight) => {
        const prompt = buildAgentPrompt(insight, data, projectPath);
        try {
            await navigator.clipboard.writeText(prompt);
            toast.success('Prompt copiado — pégalo en Claude Code o tu agente favorito');
        } catch {
            toast.error('No se pudo copiar al portapapeles');
        }
    };
    const insights = data.insights || [];
    const [filter, setFilter] = useState<string>('all');
    const [expanded, setExpanded] = useState<string | null>(insights[0]?.id ?? null);

    const filtered = filter === 'all' ? insights : insights.filter(i => i.category === filter);
    const counts: Record<string, number> = { all: insights.length };
    insights.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });

    return (
        <div className="absolute inset-0 z-20 overflow-y-auto custom-scrollbar bg-[#05060A]/95 backdrop-blur px-8 pb-8 pt-20">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-1">
                    <GraduationCap size={30} className="text-[#FFB74D]" />
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFB74D] to-[#FF4EC3]">
                        MODO MAESTRO
                    </h2>
                </div>
                <p className="text-gray-500 text-sm mb-6 tracking-wide">
                    No solo te muestro el código: te explico qué encontré, por qué importa y cómo arreglarlo.
                    Pulsa <span className="text-[#FF2E63] font-bold">«Ver en el holograma»</span> para iluminar el problema con líneas rojas.
                </p>

                {/* Filters */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {['all', 'security', 'architecture', 'quality'].map(cat => (
                        <button key={cat} onClick={() => setFilter(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide border transition-all
                                ${filter === cat
                                    ? 'bg-[#00F0FF]/15 border-[#00F0FF]/60 text-[#00F0FF]'
                                    : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/25'}`}>
                            {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat]} ({counts[cat] || 0})
                        </button>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="glass-panel rounded-xl p-10 border border-[#37FFB0]/20 text-center">
                        <Sparkles size={40} className="text-[#37FFB0] mx-auto mb-3" />
                        <p className="text-[#37FFB0] font-bold">Sin hallazgos en esta categoría</p>
                        <p className="text-gray-500 text-sm mt-1">Tu código está limpio aquí. 🎉</p>
                    </div>
                )}

                <div className="space-y-3">
                    {filtered.map((ins) => {
                        const sevColor = SEVERITY_COLORS[ins.severity as Severity] || '#888';
                        const Icon = CATEGORY_ICONS[ins.category] || Sparkles;
                        const isOpen = expanded === ins.id;
                        return (
                            <div key={ins.id}
                                className="glass-panel rounded-xl border overflow-hidden transition-all"
                                style={{ borderColor: isOpen ? sevColor + '66' : '#ffffff10' }}>
                                {/* Header row */}
                                <button className="w-full flex items-center gap-3 p-4 text-left"
                                    onClick={() => setExpanded(isOpen ? null : ins.id)}>
                                    <span className="p-2 rounded-lg shrink-0" style={{ background: sevColor + '18', color: sevColor }}>
                                        <Icon size={18} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider"
                                                style={{ background: sevColor + '22', color: sevColor }}>
                                                {SEVERITY_LABELS[ins.severity as Severity]}
                                            </span>
                                            <span className="text-[9px] text-gray-500 uppercase tracking-wider">{CATEGORY_LABELS[ins.category]}</span>
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-100 mt-0.5 truncate">{ins.title}</h3>
                                    </div>
                                    <ChevronDown size={16} className={`text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Expanded teaching content */}
                                {isOpen && (
                                    <div className="px-4 pb-4 space-y-3">
                                        <TeachBlock icon={<Crosshair size={13} />} title="Qué encontré" color="#43C6FF" text={ins.explanation} />
                                        <TeachBlock icon={<BookOpen size={13} />} title="Por qué importa" color="#FFB74D" text={ins.why_matters} />
                                        <TeachBlock icon={<Wrench size={13} />} title="Cómo arreglarlo" color="#37FFB0" text={ins.recommendation} />

                                        {ins.evidence?.length > 0 && (
                                            <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                                                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Evidencia</div>
                                                <div className="space-y-1 font-mono text-[11px]">
                                                    {ins.evidence.slice(0, 5).map((ev, i) => (
                                                        <div key={i} className="flex gap-2 items-baseline">
                                                            <span className="text-[#FF2E63] shrink-0">{ev.file}:{ev.line}</span>
                                                            <span className="text-gray-400 truncate">{ev.snippet}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            {(ins.nodes.length > 0 || ins.links.length > 0) && (
                                                <button
                                                    onClick={() => onShowInGraph(ins)}
                                                    className="flex-1 py-2.5 rounded-lg text-xs font-black tracking-widest uppercase transition-all hover:brightness-125 flex items-center justify-center gap-2"
                                                    style={{ background: '#FF2E6320', border: '1px solid #FF2E6366', color: '#FF6B8A' }}>
                                                    <Crosshair size={14} />
                                                    Ver en el holograma
                                                </button>
                                            )}
                                            <button
                                                onClick={() => copyAgentPrompt(ins)}
                                                title="Copia un prompt completo para que un agente IA (Claude Code, etc.) analice, corrija y verifique este hallazgo"
                                                className="flex-1 py-2.5 rounded-lg text-xs font-black tracking-widest uppercase transition-all hover:brightness-125 flex items-center justify-center gap-2"
                                                style={{ background: '#B388FF20', border: '1px solid #B388FF66', color: '#C9A8FF' }}>
                                                <Bot size={14} />
                                                Prompt para agente IA
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function TeachBlock({ icon, title, color, text }: any) {
    return (
        <div className="rounded-lg p-3 border-l-2 bg-white/[0.02]" style={{ borderColor: color }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
                {icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
        </div>
    );
}
