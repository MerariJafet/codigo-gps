interface Bar {
    label: string;
    value: number;
    color?: string;
    sublabel?: string;
}

interface BarChartProps {
    bars: Bar[];
    unit?: string;
    onBarClick?: (label: string) => void;
}

/** Horizontal neon bar chart (pure CSS/SVG, no deps). */
export default function BarChart({ bars, unit = '', onBarClick }: BarChartProps) {
    const max = Math.max(...bars.map((b) => b.value), 1);
    return (
        <div className="space-y-2.5">
            {bars.map((b) => (
                <div
                    key={b.label}
                    className={`group ${onBarClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onBarClick && onBarClick(b.label)}
                >
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-300 font-medium truncate max-w-[60%]">{b.label}</span>
                        <span className="text-[11px] text-gray-500 font-mono">
                            {b.value.toLocaleString()}{unit}{b.sublabel ? ` · ${b.sublabel}` : ''}
                        </span>
                    </div>
                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
                            style={{
                                width: `${Math.max(2, (b.value / max) * 100)}%`,
                                background: `linear-gradient(90deg, ${b.color || '#00E5FF'}88, ${b.color || '#00E5FF'})`,
                                boxShadow: `0 0 8px ${b.color || '#00E5FF'}66`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
