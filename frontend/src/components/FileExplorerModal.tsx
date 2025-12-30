import { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, CornerLeftUp, X, Check, HardDrive } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../lib/apiClient';

interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
}

interface DirectoryListing {
    path: string;
    parent: string | null;
    entries: FileEntry[];
    error: string | null;
}

interface FileExplorerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (path: string) => void;
    initialPath?: string;
}

export default function FileExplorerModal({ isOpen, onClose, onSelect, initialPath }: FileExplorerModalProps) {
    const [currentPath, setCurrentPath] = useState(initialPath || '');
    const [listing, setListing] = useState<DirectoryListing | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            // If no path, fetch root (backend handles it)
            fetchDir(currentPath);
        }
    }, [isOpen]);

    const fetchDir = async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const query = path ? `?path=${encodeURIComponent(path)}` : '';
            const res = await apiClient.get(`/api/v1/system/ls${query}`);

            if (!res.ok) throw new Error("Failed to fetch directory");

            const data: DirectoryListing = await res.json();
            if (data.error) {
                setError(data.error);
                // Keep previous listing if possible or clear
            } else {
                setListing(data);
                setCurrentPath(data.path);
            }
        } catch (e) {
            console.error(e);
            setError("Cannot connect to backend system service.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[800px] h-[600px] bg-[#0A0B10] border border-[#00F0FF]/30 rounded-xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <HardDrive size={18} className="text-[#00F0FF]" />
                        <span className="font-mono text-sm text-gray-300 truncate direction-rtl" title={currentPath}>
                            {currentPath || "Root"}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-2 border-b border-white/10 bg-white/5 flex items-center gap-2">
                    <button
                        onClick={() => listing?.parent && fetchDir(listing.parent)}
                        disabled={!listing?.parent}
                        className="p-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#00F0FF] hover:bg-[#00F0FF]/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <CornerLeftUp size={14} />
                        Up Level
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={() => onSelect(currentPath)}
                        className="px-4 py-2 bg-[#00F0FF]/20 border border-[#00F0FF]/50 text-[#00F0FF] hover:bg-[#00F0FF]/30 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
                    >
                        <Check size={14} />
                        Select This Folder
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-black/40">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#00F0FF] gap-4">
                            <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs uppercase tracking-widest animate-pulse">Scanning Sector...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-400 gap-2">
                            <p className="font-bold">SYSTEM ERROR</p>
                            <p className="text-sm">{error}</p>
                            <button onClick={() => fetchDir(currentPath)} className="mt-4 px-4 py-1 bg-red-500/10 border border-red-500/30 rounded hover:bg-red-500/20">
                                Retry Connection
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {listing?.entries.map((entry) => (
                                <div
                                    key={entry.name}
                                    onClick={() => entry.is_dir && fetchDir(entry.path)}
                                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors border border-transparent group
                                        ${entry.is_dir
                                            ? 'hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/20 text-gray-200'
                                            : 'opacity-50 cursor-default grayscale'
                                        }
                                    `}
                                >
                                    {entry.is_dir ? (
                                        <Folder size={18} className="text-[#FFC107] group-hover:text-[#00F0FF] transition-colors" />
                                    ) : (
                                        <File size={18} className="text-gray-600" />
                                    )}
                                    <span className="text-sm font-mono truncate">{entry.name}</span>
                                </div>
                            ))}
                            {listing?.entries.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-600 italic gap-2 opacity-50">
                                    <Folder size={32} />
                                    <span>Empty Directory</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-white/10 bg-black/40 text-[10px] text-gray-500 text-center">
                    BACKEND SYSTEM ACCESS // SECURE CONNECTION
                </div>

            </div>
        </div>
    );
}
