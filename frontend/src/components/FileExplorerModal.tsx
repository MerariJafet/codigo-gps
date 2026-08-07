import { useState, useEffect, useCallback } from 'react';
import { Folder, File, CornerLeftUp, X, Check, HardDrive, Home, RefreshCw, Upload } from 'lucide-react';

interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
}

export interface ManifestEntry {
    path: string;
    content: string;
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
    onSelect: (path: string, manifest?: ManifestEntry[]) => void;
    initialPath?: string;
}

// Browser-upload guardrails: skip heavy/derived dirs and cap volume so huge
// repos don't freeze the tab (server-side path browsing has no such limits).
const UPLOAD_IGNORE_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'env', 'dist', 'build', '.next', '.turbo', 'coverage', 'target', '.pytest_cache', '.mypy_cache', '.idea', '.vscode']);
const UPLOAD_EXT_RE = /\.(js|jsx|ts|tsx|py|java|cpp|c|h|cs|php|rb|go|rs|swift|kt|scala|html|css|scss|json|xml|yaml|yml|md|txt|toml|sh)$/i;
const UPLOAD_MAX_FILES = 4000;
const UPLOAD_MAX_FILE_SIZE = 400_000; // bytes per file

/**
 * Project picker with two paths:
 *  1. Server-side browsing (/api/v1/system/ls): absolute paths, nothing
 *     uploaded, no size limit. Ideal when backend and browser share the disk.
 *  2. Browser upload (File System Access API): for web/Docker setups where
 *     the backend can NOT see your filesystem — files are read in the browser
 *     and sent as a manifest (filtered + capped).
 */
export default function FileExplorerModal({ isOpen, onClose, onSelect, initialPath }: FileExplorerModalProps) {
    const [listing, setListing] = useState<DirectoryListing | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);

    const uploadFromBrowser = async () => {
        if (!('showDirectoryPicker' in window)) {
            setError('Tu navegador no soporta la subida de carpetas (usa Chrome/Edge, o navega por el servidor).');
            return;
        }
        try {
            // @ts-expect-error File System Access API (Chromium)
            const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
            setUploadStatus('Leyendo archivos…');
            const files: ManifestEntry[] = [];
            let truncated = false;

            const walk = async (handle: FileSystemDirectoryHandle, base: string) => {
                if (files.length >= UPLOAD_MAX_FILES) { truncated = true; return; }
                // @ts-expect-error entries() exists on directory handles in Chromium
                for await (const [name, child] of handle.entries()) {
                    if (files.length >= UPLOAD_MAX_FILES) { truncated = true; return; }
                    const rel = base ? `${base}/${name}` : name;
                    if (child.kind === 'directory') {
                        if (!UPLOAD_IGNORE_DIRS.has(name) && !name.startsWith('.')) await walk(child, rel);
                    } else if (UPLOAD_EXT_RE.test(name)) {
                        const file = await (child as FileSystemFileHandle).getFile();
                        if (file.size > UPLOAD_MAX_FILE_SIZE) continue;
                        files.push({ path: rel, content: await file.text(), size: file.size });
                        if (files.length % 200 === 0) setUploadStatus(`Leyendo archivos… ${files.length}`);
                    }
                }
            };
            await walk(dirHandle, '');
            setUploadStatus(null);
            if (files.length === 0) {
                setError('La carpeta no contiene archivos de código legibles.');
                return;
            }
            onSelect(dirHandle.name + (truncated ? ' (parcial)' : ''), files);
            onClose();
        } catch (e: unknown) {
            setUploadStatus(null);
            if ((e as Error)?.name !== 'AbortError') {
                setError('No se pudo leer la carpeta desde el navegador.');
            }
        }
    };

    const loadPath = useCallback(async (path?: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = path ? `/api/v1/system/ls?path=${encodeURIComponent(path)}` : '/api/v1/system/ls';
            const res = await fetch(url);
            if (!res.ok) throw new Error('El backend no respondió');
            const data: DirectoryListing = await res.json();
            if (data.error) {
                setError(data.error === 'Permission denied' ? 'Sin permisos para leer esta carpeta' : data.error);
            } else {
                setListing(data);
            }
        } catch (e: any) {
            setError(e.message || 'No se pudo listar la carpeta');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadPath(initialPath && initialPath.startsWith('/') ? initialPath : undefined);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const dirs = listing?.entries.filter(e => e.is_dir && !e.name.startsWith('.')) || [];
    const files = listing?.entries.filter(e => !e.is_dir && !e.name.startsWith('.')) || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[820px] max-w-[95vw] h-[600px] max-h-[90vh] bg-[#0A0B10] border border-[#00F0FF]/30 rounded-xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <HardDrive size={18} className="text-[#00F0FF] shrink-0" />
                        <span className="font-mono text-sm text-gray-300 truncate" title={listing?.path}>
                            {listing?.path || 'Cargando…'}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-2 border-b border-white/10 bg-white/5 flex items-center gap-1">
                    <button
                        onClick={() => loadPath()}
                        className="p-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10 rounded transition-colors"
                        title="Ir a tu carpeta personal"
                    >
                        <Home size={14} /> Inicio
                    </button>
                    <button
                        onClick={() => listing?.parent && loadPath(listing.parent)}
                        disabled={!listing?.parent || listing.parent === listing.path}
                        className="p-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                        title="Subir un nivel"
                    >
                        <CornerLeftUp size={14} /> Subir
                    </button>
                    <button
                        onClick={() => listing && loadPath(listing.path)}
                        className="p-2 text-gray-400 hover:bg-white/10 rounded transition-colors"
                        title="Recargar"
                    >
                        <RefreshCw size={13} />
                    </button>
                    <button
                        onClick={uploadFromBrowser}
                        className="p-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#B388FF] hover:bg-[#B388FF]/10 rounded transition-colors"
                        title="Para cuando el backend corre en Docker/remoto y no ve tu disco: lee la carpeta desde el navegador y la envía como manifiesto (filtrado, máx. 4000 archivos)"
                    >
                        <Upload size={13} /> Subir del navegador
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={() => { if (listing) { onSelect(listing.path); onClose(); } }}
                        disabled={!listing}
                        className="px-4 py-2 bg-[#00F0FF]/20 border border-[#00F0FF]/50 text-[#00F0FF] hover:bg-[#00F0FF]/30 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
                    >
                        <Check size={14} />
                        Analizar esta carpeta
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-black/40">
                    {uploadStatus ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#B388FF] gap-4">
                            <div className="w-8 h-8 border-2 border-[#B388FF] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs uppercase tracking-widest animate-pulse">{uploadStatus}</span>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#00F0FF] gap-4">
                            <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs uppercase tracking-widest animate-pulse">Escaneando…</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-400 gap-2">
                            <p className="font-bold">ERROR DE ACCESO</p>
                            <p className="text-sm">{error}</p>
                            <button onClick={() => loadPath()} className="mt-4 px-4 py-1 bg-red-500/10 border border-red-500/30 rounded hover:bg-red-500/20">
                                Volver al inicio
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {dirs.map((entry) => (
                                <div
                                    key={entry.path}
                                    onClick={() => loadPath(entry.path)}
                                    onDoubleClick={() => { onSelect(entry.path); onClose(); }}
                                    className="flex items-center gap-3 p-2 rounded cursor-pointer transition-colors border border-transparent group hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/20 text-gray-200"
                                    title="Clic para entrar · doble clic para analizarla"
                                >
                                    <Folder size={18} className="text-[#FFC107] group-hover:text-[#00F0FF] transition-colors shrink-0" />
                                    <span className="text-sm font-mono truncate">{entry.name}</span>
                                </div>
                            ))}
                            {files.slice(0, 50).map((entry) => (
                                <div key={entry.path} className="flex items-center gap-3 p-2 rounded opacity-40 text-gray-400">
                                    <File size={16} className="text-gray-600 shrink-0" />
                                    <span className="text-xs font-mono truncate">{entry.name}</span>
                                </div>
                            ))}
                            {dirs.length === 0 && files.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-600 italic gap-2 opacity-50">
                                    <Folder size={32} />
                                    <span>Carpeta vacía</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-white/10 bg-black/40 text-[10px] text-gray-500 text-center">
                    NAVEGANDO TU DISCO LOCAL VÍA BACKEND · sin subir archivos, sin límite de tamaño
                </div>

            </div>
        </div>
    );
}
