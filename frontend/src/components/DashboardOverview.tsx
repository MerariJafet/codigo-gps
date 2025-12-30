import StatCard from './StatCard';
import { Activity, FileCode, ShieldCheck, Zap } from 'lucide-react';

export default function DashboardOverview({ stats, onEnter }: any) {
    return (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05060A]/90 backdrop-blur-sm p-10 animate-in fade-in zoom-in duration-500">
            <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#43C6FF] to-[#9A4DFF] mb-2">
                PROJECT OVERVIEW
            </h2>
            <p className="text-gray-400 mb-10 tracking-widest text-sm">ANALYSIS COMPLETE // SYSTEM READY</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl mb-12">
                <StatCard
                    label="Total Files"
                    value={stats.fileCount}
                    color="blue"
                    icon={<FileCode size={40} />}
                />
                <StatCard
                    label="Dependencies"
                    value={stats.depCount}
                    color="purple"
                    icon={<Activity size={40} />}
                />
                <StatCard
                    label="Health Score"
                    value={`${stats.healthScore}%`}
                    color="green"
                    icon={<ShieldCheck size={40} />}
                />
                <StatCard
                    label="Complexity"
                    value={stats.complexity}
                    color="orange"
                    icon={<Zap size={40} />}
                />
            </div>

            <button
                onClick={onEnter}
                className="cyber-button group px-12 py-4 bg-[#43C6FF]/10 border border-[#43C6FF] hover:bg-[#43C6FF]/20 text-[#43C6FF] font-bold tracking-widest uppercase"
            >
                <span className="flex items-center gap-2">
                    Enter Hologram
                    <Activity className="w-4 h-4 animate-pulse" />
                </span>
            </button>
        </div>
    );
}
