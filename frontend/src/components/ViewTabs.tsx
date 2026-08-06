import { Orbit, LayoutDashboard, Boxes, GraduationCap } from 'lucide-react';

export type ViewMode = 'graph' | 'dashboard' | 'modules' | 'mentor';

interface ViewTabsProps {
    active: ViewMode;
    onChange: (v: ViewMode) => void;
    insightCount?: number;
}

const TABS: { id: ViewMode; label: string; icon: any }[] = [
    { id: 'graph', label: 'Holograma', icon: Orbit },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'modules', label: 'Módulos', icon: Boxes },
    { id: 'mentor', label: 'Maestro', icon: GraduationCap },
];

export default function ViewTabs({ active, onChange, insightCount = 0 }: ViewTabsProps) {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
            <div className="flex gap-1 p-1 rounded-full bg-[#05060A]/85 border border-white/10 backdrop-blur-md shadow-[0_0_25px_rgba(0,240,255,0.12)]">
                {TABS.map(({ id, label, icon: Icon }) => {
                    const isActive = active === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onChange(id)}
                            className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all
                                ${isActive
                                    ? 'bg-[#00F0FF]/15 text-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                        >
                            <Icon size={14} />
                            {label}
                            {id === 'mentor' && insightCount > 0 && (
                                <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF2E63] text-white text-[9px] font-black flex items-center justify-center">
                                    {insightCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
