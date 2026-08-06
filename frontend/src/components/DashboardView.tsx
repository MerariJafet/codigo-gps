import { FileCode, GitBranch, Boxes, ShieldAlert, Activity, Flame } from 'lucide-react';
import { GraphData, SEVERITY_COLORS, SEVERITY_LABELS, Severity } from '../types';
import BarChart from './charts/BarChart';
import Donut from './charts/Donut';

const LANG_COLORS: Record<string, string> = {
    Python: '#4FC3F7', TypeScript: '#B388FF', JavaScript: '#FFD54F',
    CSS: '#FF4EC3', HTML: '#FF8A65', Markdown: '#8BC34A', JSON: '#AED581',
    YAML: '#9575CD', Otro: '#78909C',
};

interface DashboardViewProps {
    data: GraphData;
    onSelectModule: (id: string) => void;
    onGoToMentor: () => void;
    onSelectNode: (id: string) => void;
}

export default function DashboardView({ data, onSelectModule, onGoToMentor, onSelectNode }: DashboardViewProps) {
    const s = data.summary;
    if (!s) return null;
    const health = s.health;
    const insights = data.insights || [];
    const modules = data.modules || [];

    const healthColor = health.score >= 75 ? '#37FFB0' : health.score >= 50 ? '#FFB74D' : '#FF2E63';
    const problemCount = insights.filter(i => i.severity !== 'info').length;

    return (
        <div className="absolute inset-0 z-20 overflow-y-auto custom-scrollbar bg-[#05060A]/95 backdrop-blur px-8 pb-8 pt-20">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#43C6FF] to-[#9A4DFF]">
                        DASHBOARD DEL PROYECTO
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 tracking-wide">Radiografía completa de tu código, en un vistazo</p>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <Card icon={<FileCode size={22} />} label="Archivos" value={s.total_files} color="#43C6FF" />
                    <Card icon={<GitBranch size={22} />} label="Dependencias" value={s.total_links} color="#9A4DFF" />
                    <Card icon={<Boxes size={22} />} label="Módulos" value={s.total_modules} color="#37FFB0" />
                    <Card icon={<Activity size={22} />} label="Líneas de código" value={s.total_loc.toLocaleString()} color="#FFB74D" />
                    <Card
                        icon={<ShieldAlert size={22} />} label="Hallazgos" value={problemCount}
                        color={problemCount > 0 ? '#FF2E63' : '#37FFB0'}
                        onClick={onGoToMentor}
                        hint="Ver en el Maestro →"
                    />
                </div>

                <div className="grid lg:grid-cols-3 gap-6 mb-6">
                    {/* Health */}
                    <Panel title="Salud del proyecto">
                        <div className="flex items-center gap-5">
                            <div className="relative w-28 h-28 shrink-0">
                                <svg viewBox="0 0 100 100" className="-rotate-90">
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="#ffffff10" strokeWidth="10" />
                                    <circle cx="50" cy="50" r="42" fill="none" stroke={healthColor} strokeWidth="10"
                                        strokeDasharray={`${(health.score / 100) * 264} 264`}
                                        strokeLinecap="round"
                                        style={{ filter: `drop-shadow(0 0 6px ${healthColor})`, transition: 'stroke-dasharray 1s' }} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-black" style={{ color: healthColor }}>{health.score}</span>
                                    <span className="text-[10px] text-gray-500">/ 100</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-4xl font-black mb-1" style={{ color: healthColor }}>{health.grade}</div>
                                <p className="text-xs text-gray-400 leading-relaxed">{health.verdict}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4 flex-wrap">
                            {(Object.keys(SEVERITY_LABELS) as Severity[]).map(sev => {
                                const count = health.severity_counts?.[sev] || 0;
                                if (!count) return null;
                                return (
                                    <span key={sev} className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                        style={{ color: SEVERITY_COLORS[sev], borderColor: SEVERITY_COLORS[sev] + '55', background: SEVERITY_COLORS[sev] + '15' }}>
                                        {count} {SEVERITY_LABELS[sev]}
                                    </span>
                                );
                            })}
                        </div>
                    </Panel>

                    {/* Languages */}
                    <Panel title="Lenguajes (por líneas de código)">
                        <Donut
                            slices={s.languages.slice(0, 6).map(l => ({
                                label: l.name, value: l.loc, color: LANG_COLORS[l.name] || '#78909C',
                            }))}
                            centerValue={String(s.languages.length)}
                            centerLabel="lenguajes"
                        />
                    </Panel>

                    {/* Complexity distribution */}
                    <Panel title="Distribución de complejidad" hint="¿Cuántos archivos son simples vs. monstruos?">
                        <BarChart
                            bars={s.complexity_buckets.map((b, i) => ({
                                label: b.label, value: b.count,
                                color: ['#37FFB0', '#43C6FF', '#FFB74D', '#FF2E63'][i],
                            }))}
                            unit=" arch."
                        />
                    </Panel>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* LOC per module */}
                    <Panel title="Tamaño por módulo" hint="Haz clic en una barra para explorar el módulo">
                        <BarChart
                            bars={modules.slice(0, 8).map(m => ({
                                label: m.name, value: m.total_loc, color: m.color,
                                sublabel: `${m.file_count} archivos`,
                            }))}
                            unit=" loc"
                            onBarClick={(label) => {
                                const mod = modules.find(m => m.name === label);
                                if (mod) onSelectModule(mod.id);
                            }}
                        />
                    </Panel>

                    {/* Top hubs */}
                    <Panel title="Archivos más conectados (hubs)" hint="Si tocas estos archivos, medio proyecto se entera">
                        <div className="space-y-2">
                            {s.top_hubs.slice(0, 6).map((h, i) => (
                                <button key={h.id} onClick={() => onSelectNode(h.id)}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] transition-colors text-left group">
                                    <span className="text-lg font-black text-gray-600 w-6">{i + 1}</span>
                                    <Flame size={16} className={i === 0 ? 'text-[#FF2E63]' : 'text-[#FFB74D]'} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs text-gray-200 truncate group-hover:text-[#00F0FF]">{h.label}</div>
                                        <div className="text-[10px] text-gray-500">{h.module}</div>
                                    </div>
                                    <span className="text-xs font-mono text-[#FFB74D]">{h.degree} con.</span>
                                </button>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}

function Card({ icon, label, value, color, onClick, hint }: any) {
    return (
        <div
            className={`glass-panel rounded-xl p-4 border border-white/5 relative overflow-hidden ${onClick ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-center gap-2 mb-2" style={{ color }}>{icon}
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</span>
            </div>
            <div className="text-2xl font-black" style={{ color, textShadow: `0 0 18px ${color}55` }}>{value}</div>
            {hint && <div className="text-[10px] text-gray-500 mt-1">{hint}</div>}
            <div className="absolute bottom-0 left-0 w-full h-0.5 opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        </div>
    );
}

function Panel({ title, hint, children }: any) {
    return (
        <div className="glass-panel rounded-xl p-5 border border-white/5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</h3>
            {hint && <p className="text-[10px] text-gray-600 mb-3">{hint}</p>}
            {!hint && <div className="mb-3" />}
            {children}
        </div>
    );
}
