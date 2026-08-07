import { useRef, useState } from 'react';
import { GripHorizontal, Minus, Plus } from 'lucide-react';

interface LegendPanelProps {
    folderStats?: { id?: string; path: string, count: number, color: string }[];
    onFolderHover?: (folder: string | null) => void;
}

export default function LegendPanel({ folderStats, onFolderHover }: LegendPanelProps) {
    // null = default position (bottom-left); set when the user drags it
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);

    const onPointerDown = (e: React.PointerEvent) => {
        const panel = panelRef.current;
        if (!panel || !panel.parentElement) return;
        const rect = panel.getBoundingClientRect();
        dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current || !panelRef.current?.parentElement) return;
        const parent = panelRef.current.parentElement.getBoundingClientRect();
        const rect = panelRef.current.getBoundingClientRect();
        let x = e.clientX - parent.left - dragRef.current.dx;
        let y = e.clientY - parent.top - dragRef.current.dy;
        x = Math.max(0, Math.min(x, parent.width - rect.width));
        y = Math.max(0, Math.min(y, parent.height - 40));
        setPos({ x, y });
    };

    const onPointerUp = () => { dragRef.current = null; };

    return (
        <div
            ref={panelRef}
            className={`absolute glass-panel rounded-lg border border-white/10 bg-[#05060A]/85 backdrop-blur z-10 w-[250px] ${pos ? '' : 'bottom-6 left-6'}`}
            style={pos ? { left: pos.x, top: pos.y } : undefined}
        >
            {/* Drag handle header */}
            <div
                className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing border-b border-white/10 select-none touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                title="Arrástrame para mover la leyenda"
            >
                <div className="flex items-center gap-2 text-gray-400">
                    <GripHorizontal size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Leyenda</span>
                </div>
                <button
                    onClick={() => setCollapsed(c => !c)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="p-1 rounded hover:bg-white/10 text-gray-400 transition-colors"
                    title={collapsed ? 'Expandir' : 'Minimizar'}
                >
                    {collapsed ? <Plus size={13} /> : <Minus size={13} />}
                </button>
            </div>

            {!collapsed && (
                <div className="p-4 max-h-[52vh] overflow-y-auto custom-scrollbar">
                    {folderStats && folderStats.length > 0 && (
                        <>
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Módulos / Regiones</h3>
                            <div className="space-y-1.5 mb-4">
                                {folderStats.slice(0, 10).map((stat) => (
                                    <div
                                        key={stat.id || stat.path}
                                        className="flex items-center gap-3 group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors"
                                        onMouseEnter={() => onFolderHover && onFolderHover(stat.id || stat.path)}
                                        onMouseLeave={() => onFolderHover && onFolderHover(null)}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                                            style={{ backgroundColor: stat.color, boxShadow: `0 0 8px ${stat.color}` }}
                                        />
                                        <span className="text-xs font-bold text-gray-200 truncate">{stat.path}</span>
                                        <span className="text-[10px] text-gray-500 ml-auto shrink-0">{stat.count}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Conexiones</h3>
                    <div className="space-y-2 mb-4">
                        <LineItem color="#FF2E63" label="Crítica / dañada" desc="Ciclo o hallazgo señalado" />
                        <LineItem color="#B388FF" label="Puente HTTP" desc="El frontend llama a esta ruta de la API" />
                        <LineItem color="#FFD54F" label="Puente entre módulos" desc="Referencia de un módulo a otro" />
                        <LineItem color="#37FFB0" label="Esencial" desc="Alimenta un archivo hub del sistema" />
                        <LineItem color="#7BD4FF" label="Interna" desc="Import normal, color de su módulo" />
                    </div>

                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Nodos</h3>
                    <div className="space-y-2">
                        <LegendItem color="#ffffff" label="Nodo = archivo" desc="El tamaño crece con sus conexiones" />
                        <RoleItem type="entrypoint" label="Punto de entrada" desc="Donde arranca el sistema" />
                        <RoleItem type="hub" label="Hub central" desc="Muy conectado: cuidado al tocarlo" />
                        <RoleItem type="orphan" label="Desconectado (huérfano)" desc="Atenuado: nadie lo importa" />
                    </div>
                    <p className="text-[9px] text-gray-600 mt-3 italic">
                        Pasa el cursor sobre una línea para ver qué archivo conecta con cuál.
                    </p>
                </div>
            )}
        </div>
    );
}

function LineItem({ color, label, desc }: any) {
    return (
        <div className="flex items-center gap-3 cursor-help" title={desc}>
            <div className="w-5 h-[3px] rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
            <div>
                <div className="text-xs font-bold text-gray-300">{label}</div>
                <div className="text-[10px] text-gray-500">{desc}</div>
            </div>
        </div>
    );
}

function LegendItem({ color, label, desc }: any) {
    return (
        <div className="flex items-center gap-3 group cursor-help" title={desc}>
            <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] shrink-0" style={{ backgroundColor: color, color: color }} />
            <div>
                <div className="text-xs font-bold text-gray-300">{label}</div>
                <div className="text-[10px] text-gray-500">{desc}</div>
            </div>
        </div>
    );
}

function RoleItem({ type, label, desc }: any) {
    return (
        <div className="flex items-center gap-3 group cursor-help" title={desc}>
            <div className={`w-3 h-3 rounded-full bg-gray-500 border-2 shrink-0
                ${type === 'entrypoint' ? 'border-white shadow-[0_0_10px_white]' : ''}
                ${type === 'hub' ? 'border-[#FFF176] shadow-[0_0_5px_#FFF176]' : ''}
                ${type === 'orphan' ? 'border-none opacity-40 bg-[#37474F]' : ''}
            `} />
            <div>
                <div className="text-xs font-bold text-gray-300">{label}</div>
                <div className="text-[10px] text-gray-500">{desc}</div>
            </div>
        </div>
    );
}
