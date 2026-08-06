interface Slice {
    label: string;
    value: number;
    color: string;
}

interface DonutProps {
    slices: Slice[];
    centerLabel?: string;
    centerValue?: string;
}

/** SVG donut chart with side legend (no deps). */
export default function Donut({ slices, centerLabel, centerValue }: DonutProps) {
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    const R = 42;
    const C = 2 * Math.PI * R;
    let offset = 0;

    return (
        <div className="flex items-center gap-5">
            <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0 -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" stroke="#ffffff10" strokeWidth="14" />
                {slices.map((s) => {
                    const frac = s.value / total;
                    const dash = frac * C;
                    const el = (
                        <circle
                            key={s.label}
                            cx="60" cy="60" r={R}
                            fill="none"
                            stroke={s.color}
                            strokeWidth="14"
                            strokeDasharray={`${dash} ${C - dash}`}
                            strokeDashoffset={-offset}
                            style={{ filter: `drop-shadow(0 0 3px ${s.color})`, transition: 'stroke-dasharray 0.7s' }}
                        />
                    );
                    offset += dash;
                    return el;
                })}
                {centerValue && (
                    <g className="rotate-90" style={{ transformOrigin: '60px 60px' }}>
                        <text x="60" y="58" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold">{centerValue}</text>
                        {centerLabel && <text x="60" y="74" textAnchor="middle" fill="#8899aa" fontSize="8">{centerLabel}</text>}
                    </g>
                )}
            </svg>
            <div className="space-y-1.5 min-w-0">
                {slices.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}` }} />
                        <span className="text-gray-300 truncate">{s.label}</span>
                        <span className="text-gray-500 font-mono ml-auto">{Math.round((s.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
