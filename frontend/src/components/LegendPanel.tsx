interface LegendPanelProps {
    folderStats?: { id?: string; path: string, count: number, color: string }[];
    onFolderHover?: (folder: string | null) => void;
}

export default function LegendPanel({ folderStats, onFolderHover }: LegendPanelProps) {
    return (
        <div className="absolute bottom-6 left-6 p-4 glass-panel rounded-lg border border-white/10 bg-[#05060A]/80 backdrop-blur z-10 max-w-[250px] max-h-[55vh] overflow-y-auto custom-scrollbar">
            {folderStats && folderStats.length > 0 && (
                <>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Módulos / Regiones</h3>
                    <div className="space-y-2 mb-4">
                        {folderStats.slice(0, 10).map((stat) => (
                            <div
                                key={stat.id || stat.path}
                                className="flex items-center gap-3 group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors"
                                onMouseEnter={() => onFolderHover && onFolderHover(stat.id || stat.path)}
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
                                    <span className="text-xs font-bold text-gray-200 truncate max-w-[150px]">{stat.path}</span>
                                    <span className="text-[10px] text-gray-500">{stat.count} archivos</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Cómo leerlo</h3>
            <div className="space-y-2">
                <LegendItem color="#ffffff" label="Nodo = archivo" desc="El tamaño crece con sus conexiones" />
                <LegendItem color="#37FFB0" label="Línea = import" desc="Las partículas viajan hacia la dependencia" />
                <LegendItem color="#FF2E63" label="Línea roja = problema" desc="Ciclo, vulnerabilidad o hallazgo señalado" />
                <RoleItem type="entrypoint" label="Punto de entrada" desc="Donde arranca el sistema" />
                <RoleItem type="hub" label="Hub central" desc="Muy conectado: cuidado al tocarlo" />
                <RoleItem type="orphan" label="Huérfano" desc="Nadie lo importa" />
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
