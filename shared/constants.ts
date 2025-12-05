const PANEL_BASE_URL = (typeof process !== 'undefined' && process.env.BAV_PANEL_BASE_URL ? process.env.BAV_PANEL_BASE_URL : 'http://localhost:3000').replace(/\/$/, '');

export const REMOTE_LIVERY_LIST_URL = `${PANEL_BASE_URL}/api/simulator/liveries`;
export const PANEL_BASE_ENDPOINT = PANEL_BASE_URL;
export const DEFAULT_FETCH_TIMEOUT_MS = 15000;
export const REMOTE_CATALOG_URL = `${PANEL_BASE_URL}/api/catalog`;
export const LIVERY_UPDATES_URL = `${PANEL_BASE_URL}/api/liveries/updates`;
