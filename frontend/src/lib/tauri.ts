// Tauri runtime helpers. In web mode these degrade gracefully.

export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}

export async function getTauriToken(): Promise<string | null> {
    if (!isTauri()) return null;
    try {
        // @ts-ignore - tauri invoke available only in desktop runtime
        const { invoke } = (window as any).__TAURI__.core || (window as any).__TAURI__.tauri;
        return await invoke('get_auth_token');
    } catch {
        return null;
    }
}

export async function selectFolder(): Promise<string | null> {
    if (!isTauri()) return null;
    try {
        // @ts-ignore - tauri dialog plugin
        const { open } = (window as any).__TAURI__.dialog;
        const selected = await open({ directory: true, multiple: false });
        return typeof selected === 'string' ? selected : null;
    } catch {
        return null;
    }
}
