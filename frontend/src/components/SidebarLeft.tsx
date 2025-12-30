import { FileCode, Folder, AlertCircle } from 'lucide-react';
import HealthGauge from './HealthGauge';
import FileTree from './FileTree';

export default function SidebarLeft({ data, onNodeSelect, groupByFolder, setGroupByFolder }: any) {
    const healthScore = data ? 85 : 0;

    return (
        <div className="w-[20%] min-w-[250px] max-w-[300px] h-full border-r border-white/5 bg-[#05060A]/95 backdrop-blur flex flex-col z-30 transition-all duration-500">

            {/* Status Panel */}
            <div className="p-6 border-b border-white/5 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 p-2 opacity-10 text-[#00F0FF]">
                    <AlertCircle size={64} />
                </div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">System Status</h3>

                <HealthGauge score={data ? healthScore : 0} />

                {data && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                        <div
                            className="bg-white/5 rounded p-2 border border-white/5 cursor-help"
                            title="Cada bolita representa un archivo del proyecto"
                        >
                            <div className="text-lg font-bold text-[#00F0FF]">{data.nodes.length}</div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-wider">Files in Project</div>
                        </div>
                        <div
                            className="bg-white/5 rounded p-2 border border-white/5 cursor-help"
                            title="Cada línea representa una conexión o dependencia entre archivos (imports, llamadas, etc.)"
                        >
                            <div className="text-lg font-bold text-[#BD00FF]">{data.links.length}</div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-wider">Connections</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Explorer */}
            <div className="flex-1 overflow-y-auto cyber-scrollbar p-2">
                <h3 className="px-4 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-2 sticky top-0 bg-[#05060A] z-10 flex items-center justify-between">
                    Project Matrix
                    {data && (
                        <label className="flex items-center gap-2 cursor-pointer" title="Group nodes by their folder (Hive Mode)">
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${groupByFolder ? 'bg-[#00F0FF]' : 'bg-gray-700'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${groupByFolder ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <input
                                type="checkbox"
                                checked={groupByFolder}
                                onChange={(e) => setGroupByFolder(e.target.checked)}
                                className="hidden"
                            />
                        </label>
                    )}
                </h3>

                {data ? (
                    <FileTree
                        files={data.nodes.filter((n: any) => n.type === 'file')}
                        onSelect={onNodeSelect}
                    />
                ) : (
                    <div className="text-center mt-20 opacity-30">
                        <Folder size={32} className="mx-auto mb-2" />
                        <span className="text-xs tracking-widest">OFFLINE</span>
                    </div>
                )}
            </div>
        </div>
    );
}
