import { useMemo, useState, useEffect } from 'react';
import { GraduationCap, X, ChevronLeft, ChevronRight, Flame, ShieldAlert, Boxes, Rocket } from 'lucide-react';
import { GraphData, Module } from '../types';

interface TourGuideProps {
    data: GraphData;
    onClose: () => void;
    onFocusModule: (id: string | null) => void;
    onGoToMentor: () => void;
    onSelectNode: (id: string) => void;
}

/** Heuristic, honest description of what a module probably is. */
function describeModule(m: Module): string {
    const n = m.id.toLowerCase();
    const by = (kw: string[]) => kw.some(k => n.includes(k));
    if (by(['backend', 'server', 'api'])) return 'El cerebro del servidor: aquí vive la lógica de negocio y los endpoints que responden a las peticiones. Si algo falla "en el servidor", casi siempre es aquí.';
    if (by(['frontend', 'mobile', 'app', 'web', 'ui', 'client'])) return 'La cara visible: pantallas, componentes y la lógica que corre en el dispositivo del usuario. Habla con el backend a través de llamadas HTTP (líneas violetas).';
    if (by(['test'])) return 'Las pruebas automatizadas: verifican que el resto del código haga lo que promete. Un módulo de tests grande y conectado es señal de un proyecto cuidado.';
    if (by(['doc'])) return 'La documentación: no se ejecuta, pero explica el proyecto. Sus archivos aparecen desconectados porque nadie los importa — eso es normal.';
    if (by(['script', 'tool', 'bin'])) return 'Utilidades sueltas: scripts que se ejecutan a mano o por cron. Se conectan hacia el código que usan, pero nadie los importa a ellos.';
    if (by(['model', 'data', 'schema', 'db'])) return 'La capa de datos: define qué forma tiene la información del sistema (modelos, esquemas, migraciones). Muchos archivos dependen de ella.';
    if (by(['config', 'infra', 'docker', 'deploy'])) return 'Infraestructura y configuración: cómo se construye, despliega y configura el sistema.';
    if (by(['core', 'lib', 'shared', 'common', 'util'])) return 'El núcleo compartido: código que todos los demás módulos reutilizan. Cambiarlo tiene consecuencias en cadena.';
    if (by(['research', 'experiment', 'notebook'])) return 'Exploración e investigación: experimentos y análisis que alimentan al producto pero no son parte del sistema en producción.';
    if (n === 'root') return 'Los archivos de la raíz del proyecto: READMEs, configuración global y puntos de entrada.';
    return `Un bloque de ${m.main_language} con ${m.file_count} archivos. Observa sus conexiones para deducir su papel: ¿a quién alimenta y de quién depende?`;
}

export default function TourGuide({ data, onClose, onFocusModule, onGoToMentor, onSelectNode }: TourGuideProps) {
    const [step, setStep] = useState(0);

    const steps = useMemo(() => {
        const s = data.summary;
        const modules = (data.modules || []).slice(0, 8);
        const list: { kind: string; module?: Module }[] = [{ kind: 'intro' }];
        modules.forEach(m => list.push({ kind: 'module', module: m }));
        list.push({ kind: 'hubs' });
        if ((data.insights || []).length > 0) list.push({ kind: 'issues' });
        list.push({ kind: 'end' });
        return list;
    }, [data]);

    const current = steps[step];

    // Fly the camera to the module being explained
    useEffect(() => {
        onFocusModule(current.kind === 'module' && current.module ? current.module.id : null);
    }, [step]);

    const s = data.summary;
    const modules = data.modules || [];
    const bridges = data.module_links || [];
    const insights = data.insights || [];

    const next = () => setStep(i => Math.min(i + 1, steps.length - 1));
    const prev = () => setStep(i => Math.max(i - 1, 0));

    return (
        <div className="absolute right-6 top-16 bottom-6 w-[380px] max-w-[90vw] z-40 flex flex-col">
            <div className="glass-panel rounded-xl border border-[#FFB74D]/30 bg-[#05060A]/95 backdrop-blur-md flex flex-col overflow-hidden shadow-[0_0_40px_rgba(255,183,77,0.15)] max-h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#FFB74D]/20 bg-gradient-to-r from-[#FFB74D]/10 to-transparent">
                    <div className="flex items-center gap-2 text-[#FFB74D]">
                        <GraduationCap size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">Modo Aprendizaje</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-mono">{step + 1}/{steps.length}</span>
                        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-400"><X size={14} /></button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 text-sm text-gray-300 leading-relaxed space-y-3">
                    {current.kind === 'intro' && s && (
                        <>
                            <h3 className="text-lg font-black text-white flex items-center gap-2"><Rocket size={18} className="text-[#00F0FF]" /> ¿Qué estás viendo?</h3>
                            <p>Este proyecto tiene <b className="text-[#00F0FF]">{s.total_files} archivos</b> con <b className="text-[#FFB74D]">{s.total_loc.toLocaleString()} líneas de código</b>, organizados en <b className="text-[#37FFB0]">{s.total_modules} módulos</b> (las burbujas de color).</p>
                            <p>Lenguaje principal: <b>{s.languages[0]?.name}</b> ({Math.round((s.languages[0]?.loc || 0) / (s.total_loc || 1) * 100)}% del código).</p>
                            <p>Cada esfera es un archivo; cada línea, una dependencia. Las <b className="text-white">esferas grandes</b> son archivos con muchas conexiones — los pilares del sistema.</p>
                            <p className="text-xs text-gray-500 italic">En los siguientes pasos te llevo módulo por módulo. La cámara volará sola a cada región.</p>
                        </>
                    )}

                    {current.kind === 'module' && current.module && (() => {
                        const m = current.module;
                        const out = bridges.filter(b => b.source === m.id);
                        const inn = bridges.filter(b => b.target === m.id);
                        return (
                            <>
                                <h3 className="text-lg font-black flex items-center gap-2" style={{ color: m.color }}>
                                    <Boxes size={18} /> {m.name}
                                </h3>
                                <p>{describeModule(m)}</p>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div className="bg-white/5 rounded p-2"><b className="text-white">{m.file_count}</b><br /><span className="text-gray-500">archivos</span></div>
                                    <div className="bg-white/5 rounded p-2"><b className="text-white">{m.total_loc.toLocaleString()}</b><br /><span className="text-gray-500">líneas</span></div>
                                    <div className="bg-white/5 rounded p-2"><b style={{ color: m.cohesion >= 0.7 ? '#37FFB0' : '#FFB74D' }}>{Math.round(m.cohesion * 100)}%</b><br /><span className="text-gray-500">cohesión</span></div>
                                </div>
                                {m.top_files.length > 0 && (
                                    <div>
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Sus archivos más importantes</div>
                                        {m.top_files.slice(0, 3).map(f => (
                                            <button key={f.id} onClick={() => onSelectNode(f.id)}
                                                className="w-full text-left text-xs font-mono text-gray-200 hover:text-[#00F0FF] py-0.5 truncate transition-colors">
                                                → {f.label.split('/').pop()} <span className="text-gray-600">(complejidad {f.complexity})</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {(out.length > 0 || inn.length > 0) ? (
                                    <p className="text-xs">
                                        {out.length > 0 && <>Depende de: {out.map(b => <b key={b.target} className="text-[#FFD54F]">{b.target} </b>)}</>}
                                        {inn.length > 0 && <>· Lo usan: {inn.map(b => <b key={b.source} className="text-[#37FFB0]">{b.source} </b>)}</>}
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-500">No importa ni es importado por otros módulos: es autocontenido (o se comunica por HTTP/archivos, no por imports).</p>
                                )}
                            </>
                        );
                    })()}

                    {current.kind === 'hubs' && s && (
                        <>
                            <h3 className="text-lg font-black text-white flex items-center gap-2"><Flame size={18} className="text-[#FF2E63]" /> Los pilares del sistema</h3>
                            <p>Estos son los archivos de los que más depende el resto del proyecto. <b className="text-white">Si tocas uno, medio sistema se entera</b> — cámbialos con tests y con calma:</p>
                            {s.top_hubs.slice(0, 5).map((h, i) => (
                                <button key={h.id} onClick={() => onSelectNode(h.id)}
                                    className="w-full flex items-center gap-2 text-left text-xs font-mono py-1 px-2 rounded bg-white/[0.03] hover:bg-white/[0.08] transition-colors">
                                    <span className="text-gray-600 font-black">{i + 1}</span>
                                    <span className="text-gray-200 truncate flex-1">{h.label}</span>
                                    <span className="text-[#FFB74D] shrink-0">{h.degree} con.</span>
                                </button>
                            ))}
                            <p className="text-xs text-gray-500 italic">Regla del maestro: el archivo más conectado es el mejor lugar para empezar a leer un proyecto ajeno.</p>
                        </>
                    )}

                    {current.kind === 'issues' && s && (
                        <>
                            <h3 className="text-lg font-black text-white flex items-center gap-2"><ShieldAlert size={18} className="text-[#FF2E63]" /> Lo que hay que arreglar</h3>
                            <p>El análisis encontró <b className="text-[#FF2E63]">{insights.length} hallazgos</b>. Salud del proyecto: <b>{s.health.score}/100 ({s.health.grade})</b> — {s.health.verdict}</p>
                            <div className="space-y-1">
                                {insights.slice(0, 4).map(i => (
                                    <div key={i.id} className="text-xs bg-white/[0.03] rounded px-2 py-1.5 truncate">• {i.title}</div>
                                ))}
                            </div>
                            <button onClick={() => { onClose(); onGoToMentor(); }}
                                className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-[#FF2E63]/15 border border-[#FF2E63]/50 text-[#FF6B8A] hover:brightness-125 transition-all">
                                Ver todos en el Maestro
                            </button>
                        </>
                    )}

                    {current.kind === 'end' && (
                        <>
                            <h3 className="text-lg font-black text-white">🎓 Fin del tour</h3>
                            <p>Ahora ya sabes leer este proyecto. Recuerda:</p>
                            <ul className="text-xs space-y-1 list-disc pl-4">
                                <li><b>Burbujas</b> = módulos · <b>esferas</b> = archivos · <b>líneas</b> = dependencias</li>
                                <li><b className="text-[#B388FF]">Violeta</b> = llamada HTTP · <b className="text-[#FFD54F]">ámbar</b> = puente · <b className="text-[#FF2E63]">rojo</b> = problema</li>
                                <li>Usa el <b>Modo Zoom</b> para aislar un archivo y su cadena de conexiones</li>
                                <li>El <b>Maestro</b> te explica cada problema y cómo arreglarlo</li>
                            </ul>
                        </>
                    )}
                </div>

                {/* Footer nav */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                    <button onClick={prev} disabled={step === 0}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300 hover:bg-white/10 disabled:opacity-30 transition-colors">
                        <ChevronLeft size={14} /> Anterior
                    </button>
                    <div className="flex gap-1">
                        {steps.map((_, i) => (
                            <button key={i} onClick={() => setStep(i)}
                                className={`w-1.5 h-1.5 rounded-full transition-all ${i === step ? 'bg-[#FFB74D] w-4' : 'bg-white/20 hover:bg-white/40'}`} />
                        ))}
                    </div>
                    {step < steps.length - 1 ? (
                        <button onClick={next}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FFB74D]/15 border border-[#FFB74D]/50 text-[#FFB74D] hover:brightness-125 transition-all">
                            Siguiente <ChevronRight size={14} />
                        </button>
                    ) : (
                        <button onClick={onClose}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#37FFB0]/15 border border-[#37FFB0]/50 text-[#37FFB0] hover:brightness-125 transition-all">
                            Terminar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
