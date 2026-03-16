import { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, CornerLeftUp, X, Check, HardDrive } from 'lucide-react';
import { toast } from 'react-toastify';

interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    handle?: FileSystemHandle;
    content?: string;
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
    onSelect: (path: string, fileManifest?: FileEntry[]) => void;
    initialPath?: string;
    collectFiles?: boolean;
}

export default function FileExplorerModal({ isOpen, onClose, onSelect, initialPath, collectFiles = false }: FileExplorerModalProps) {
    const [currentPath, setCurrentPath] = useState(initialPath || '');
    const [listing, setListing] = useState<DirectoryListing | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentDirHandle, setCurrentDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

    useEffect(() => {
        if (isOpen && !listing && !loading && !error) {
            // Reset state when modal opens
            setCurrentPath(initialPath || '');
            setCurrentDirHandle(null);
            setListing(null);
            setError(null);
        }
    }, [isOpen, initialPath]);

    const openDirectoryPicker = async () => {
        console.log('📁 FolderPicker: open - attempting showDirectoryPicker');

        // Check if File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            console.log('📁 FolderPicker: File System Access API not supported');
            setError("File System Access API not supported in this browser. Please use a modern browser like Chrome or Edge.");
            return;
        }

        try {
            console.log('📁 FolderPicker: using showDirectoryPicker');
            // @ts-ignore - File System Access API
            const dirHandle = await window.showDirectoryPicker();
            setCurrentDirHandle(dirHandle);
            await loadDirectoryContents(dirHandle);
            console.log('📁 FolderPicker: directory selected successfully');
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log('📁 FolderPicker: user cancelled');
                // User cancelled
                onClose();
                return;
            }
            console.error('📁 FolderPicker: error', e);
            setError("Failed to access directory. Please check permissions and browser support.");
        }
    };

    const loadDirectoryContents = async (dirHandle: FileSystemDirectoryHandle) => {
        setLoading(true);
        setError(null);
        try {
            const entries: FileEntry[] = [];
            for await (const [name, handle] of (dirHandle as any).entries()) {
                const isDir = handle.kind === 'directory';
                entries.push({
                    name,
                    path: `${currentPath}/${name}`,
                    is_dir: isDir,
                    size: 0, // Size not available in File System API
                    handle
                });
            }

            // Sort: directories first, then files
            entries.sort((a, b) => {
                if (a.is_dir && !b.is_dir) return -1;
                if (!a.is_dir && b.is_dir) return 1;
                return a.name.localeCompare(b.name);
            });

            setListing({
                path: currentPath,
                parent: null, // File System API doesn't provide parent easily
                entries,
                error: null
            });
        } catch (e) {
            setError("Failed to read directory contents. Please check permissions.");
            console.error("Directory read error:", e);
        } finally {
            setLoading(false);
        }
    };

    const collectAllFiles = async (dirHandle: FileSystemDirectoryHandle, basePath = ''): Promise<FileEntry[]> => {
        const files: FileEntry[] = [];
        for await (const [name, handle] of (dirHandle as any).entries()) {
            const fullPath = basePath ? `${basePath}/${name}` : name;
            if (handle.kind === 'directory') {
                const subFiles = await collectAllFiles(handle, fullPath);
                files.push(...subFiles);
            } else {
                // Only collect text files
                const file = await handle.getFile();
                if (file.type.startsWith('text/') || file.name.match(/\.(js|ts|py|java|cpp|c\+\+|cs|php|rb|go|rs|swift|kt|scala|html|css|json|xml|yaml|yml|md|txt)$/i)) {
                    const content = await file.text();
                    files.push({
                        name: file.name,
                        path: fullPath,
                        is_dir: false,
                        size: file.size,
                        handle,
                        content
                    });
                }
            }
        }
        return files;
    };

    const handleSelect = async () => {
        if (collectFiles && currentDirHandle) {
            setLoading(true);
            try {
                const files = await collectAllFiles(currentDirHandle);
                onSelect(currentPath, files);
            } catch (e) {
                setError("Failed to collect files. Please check permissions.");
                console.error("File collection error:", e);
                return;
            } finally {
                setLoading(false);
            }
        } else {
            onSelect(currentPath);
        }
        onClose();
    };

    const handleEntryClick = async (entry: FileEntry) => {
        if (!entry.is_dir || !entry.handle) return;

        try {
            const dirHandle = entry.handle as FileSystemDirectoryHandle;
            setCurrentDirHandle(dirHandle);
            setCurrentPath(entry.path);
            await loadDirectoryContents(dirHandle);
        } catch (e) {
            setError("Cannot access this directory. Please check permissions.");
            console.error("Entry click error:", e);
        }
    };

    if (!isOpen) return null;

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
                        onClick={() => openDirectoryPicker()}
                        className="p-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#00F0FF] hover:bg-[#00F0FF]/10 rounded transition-colors"
                    >
                        <CornerLeftUp size={14} />
                        Browse Different Folder
                    </button>
                    <div className="flex-1" />
                    {currentPath && (
                        <div className="text-xs text-gray-400 mr-2">
                            Selected: <span className="text-[#00F0FF] font-mono">{currentPath.split('/').pop()}</span>
                        </div>
                    )}
                    <button
                        onClick={handleSelect}
                        disabled={!currentPath}
                        className="px-4 py-2 bg-[#00F0FF]/20 border border-[#00F0FF]/50 text-[#00F0FF] hover:bg-[#00F0FF]/30 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
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
                            <p className="font-bold">ACCESS ERROR</p>
                            <p className="text-sm">{error}</p>
                            <button onClick={() => openDirectoryPicker()} className="mt-4 px-4 py-1 bg-red-500/10 border border-red-500/30 rounded hover:bg-red-500/20">
                                Try Again
                            </button>
                        </div>
                    ) : !listing ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                            <HardDrive size={48} className="text-[#00F0FF]/50" />
                            <div className="text-center">
                                <p className="font-bold text-sm mb-2">Select a Project Folder</p>
                                <p className="text-xs text-gray-500 max-w-xs">
                                    Choose the root folder of your codebase to analyze its structure and dependencies.
                                </p>
                            </div>
                            <button onClick={() => openDirectoryPicker()} className="px-4 py-2 bg-[#00F0FF]/20 border border-[#00F0FF]/50 text-[#00F0FF] hover:bg-[#00F0FF]/30 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all">
                                <CornerLeftUp size={14} />
                                Browse Folders
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {listing?.entries.map((entry) => (
                                <div
                                    key={entry.name}
                                    onClick={() => handleEntryClick(entry)}
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
                    FILE SYSTEM ACCESS // LOCAL BROWSER API
                </div>

            </div>
        </div>
    );
}
