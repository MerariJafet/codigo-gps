import { Folder } from 'lucide-react';
import HealthGauge from './HealthGauge';
import FileTree from './FileTree';

export default function SidebarLeft({ data, onNodeSelect, groupByModule, setGroupByModule }: any) {
    const healthScore = data?.summary?.health?.score ?? 0;
    const grade = data?.summary?.health?.grade;

    return (
        <div className="w-[20%] min-w-[250px] max-w-[300px] h-full bg-[#05060A]/95 backdrop-blur flex flex-col z-30 transition-all duration-500">

            {/* Status Panel */}
            <div className="p-6 bg-[#05060A]/95 shrink-0">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                    Salud del proyecto
                    {grade && <span className="text-sm font-black text-[#00F0FF]">{grade}</span>}
                </h3>
                <HealthGauge score={healthScore} />
            </div>

            {/* PROJECT SUMMARY */}
            {data && (
                <div className="p-6 bg-[#05060A]/95 shrink-0">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Resumen</h3>

                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div
                            className="bg-white/5 rounded p-2 border border-white/5 cursor-help"
                            title="Cada esfera representa un archivo del proyecto"
                        >
                            <div className="text-lg font-bold text-[#00F0FF]">{data.nodes.length}</div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-wider">Archivos</div>
                        </div>
                        <div
                            className="bg-white/5 rounded p-2 border border-white/5 cursor-help"
                            title="Cada línea es una dependencia (import) entre archivos"
                        >
                            <div className="text-lg font-bold text-[#BD00FF]">{data.links.length}</div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-wider">Conexiones</div>
                        </div>
                        <div
                            className="bg-white/5 rounded p-2 border border-white/5 cursor-help"
                            title="Bloques lógicos detectados: se dibujan como regiones de color en el holograma"
                        >
                            <div className="text-lg font-bold text-[#37FFB0]">{data.modules?.length || 0}</div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-wider">Módulos</div>
                        </div>
                    </div>
                </div>
            )}

            {/* EXPLORER / MATRIX */}
            <div className="flex-1 overflow-y-auto cyber-scrollbar bg-[#05060A]/95">
                <h3 className="px-6 py-4 text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] bg-[#05060A]/95 flex items-center justify-between">
                    Explorador
                    {data && (
                        <label className="flex items-center gap-2 cursor-pointer" title="Agrupar el holograma por módulos (regiones de color)">
                            <span className="text-[9px] text-gray-500 normal-case tracking-normal">Regiones</span>
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${groupByModule ? 'bg-[#00F0FF]' : 'bg-gray-700'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${groupByModule ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <input
                                type="checkbox"
                                checked={groupByModule}
                                onChange={(e) => setGroupByModule(e.target.checked)}
                                className="hidden"
                            />
                        </label>
                    )}
                </h3>

                <div className="p-2">
                    {data ? (
                        <FileTree
                            files={data.nodes.filter((n: any) => n.type === 'file')}
                            onSelect={onNodeSelect}
                        />
                    ) : (
                        <div className="text-center mt-20 opacity-30">
                            <Folder size={32} className="mx-auto mb-2" />
                            <span className="text-xs tracking-widest">SIN PROYECTO</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
