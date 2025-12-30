export default function RepoLoader() {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg">
            <div className="text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-[#43C6FF] rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-2 border-4 border-[#9A4DFF] rounded-full border-b-transparent animate-spin-reverse"></div>
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-[#43C6FF] animate-pulse">SYSTEM SCAN INITIATED</h2>
                    <p className="text-[#9A4DFF] font-mono text-sm">Parsing Abstract Syntax Trees...</p>
                </div>
                <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden mx-auto">
                    <div className="h-full bg-[#37FFB0] animate-progress-bar"></div>
                </div>
            </div>
        </div>
    );
}
