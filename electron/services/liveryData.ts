import { REMOTE_LIVERY_LIST_URL } from '../../shared/constants';
import type { RemoteLiveryPayload } from '../types';
import { fetchJson } from '../utils/network';

export async function fetchRemoteLiveryList(authToken?: string | null): Promise<RemoteLiveryPayload> {
    const headers: HeadersInit = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    return fetchJson<RemoteLiveryPayload>(REMOTE_LIVERY_LIST_URL, { headers });
}
