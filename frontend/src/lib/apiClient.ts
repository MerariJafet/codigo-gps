// Thin API client. All calls go through Next.js API proxy routes (/api/*)
// which forward to the FastAPI backend, avoiding CORS/auth friction in dev.

interface RequestOpts {
    headers?: Record<string, string>;
}

async function get(path: string, opts: RequestOpts = {}): Promise<Response> {
    return fetch(path, { method: 'GET', headers: opts.headers });
}

async function post(path: string, body: unknown, opts: RequestOpts = {}): Promise<Response> {
    return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        body: JSON.stringify(body),
    });
}

async function health(): Promise<void> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Backend offline');
}

export const apiClient = { get, post, health };
