export default function StatCard({ label, value, color, icon }: any) {
    const colorClasses = {
        blue: 'text-[#43C6FF] border-[#43C6FF]',
        purple: 'text-[#9A4DFF] border-[#9A4DFF]',
        green: 'text-[#37FFB0] border-[#37FFB0]',
        orange: 'text-[#FFC98B] border-[#FFC98B]',
    };

    // Default to blue if color not found
    const activeColor = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue;

    return (
        <div className={`p-6 glass-panel rounded-xl border border-opacity-30 ${activeColor} relative overflow-hidden group hover:bg-white/5 transition-all`}>
            <div className={`absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity`}>
                {icon}
            </div>
            <h3 className="text-gray-400 text-sm uppercase tracking-widest mb-2">{label}</h3>
            <div className={`text-4xl font-bold ${activeColor.split(' ')[0]} glow-text-blue`}>
                {value}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50" />
        </div>
    )
}
