import { DEFAULT_FETCH_TIMEOUT_MS } from '../../shared/constants';

export function createRequestError(response: Response, url: string): Error {
    const error = new Error(`Request to ${url} failed with status ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    return error;
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = DEFAULT_FETCH_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();

    const externalSignal = options.signal;
    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort(externalSignal.reason);
        } else {
            externalSignal.addEventListener('abort', () => {
                controller.abort(externalSignal.reason);
            }, { once: true });
        }
    }

    const timer = setTimeout(() => controller.abort(new Error('Timeout')), timeout);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) {
            throw createRequestError(response, url);
        }
        return response;
    } finally {
        clearTimeout(timer);
    }
}

export async function fetchJson<T>(url: string, options: RequestInit = {}, timeout = DEFAULT_FETCH_TIMEOUT_MS): Promise<T> {
    const response = await fetchWithTimeout(url, options, timeout);
    return response.json() as Promise<T>;
}
