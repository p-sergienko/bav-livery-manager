import type { Livery, Resolution, Simulator } from '@/types/livery';

const asString = (value: unknown): string | null => {
    if (value === undefined || value === null) {
        return null;
    }
    return String(value);
};

export const normalizeRemoteLivery = (entry: Record<string, unknown>): Livery => {
    const tailNumber = asString(entry.tailNumber);
    const title = asString(entry.title) ?? asString(entry.name) ?? 'Unknown Livery';
    const name = tailNumber ?? title;
    const downloadEndpoint = asString(entry.downloadEndpoint) ?? '';

    return {
        id: asString(entry.id) ?? name,
        name,
        title,
        tailNumber,
        developer: asString(entry.developer) ?? 'Unknown developer',
        aircraftType: asString(entry.aircraftType) ?? asString(entry.aircraft) ?? 'Unknown type',
        aircraft: asString(entry.aircraft) ?? undefined,
        year: entry.year ?? null,
        engine: asString(entry.engine),
        resolution: asString(entry.resolution),
        simulator: asString(entry.simulator),
        size: entry.sizeBytes ?? entry.size ?? null,
        preview: asString(entry.previewUrl) ?? asString(entry.preview),
        previewUrl: asString(entry.previewUrl),
        downloadEndpoint,
        packageKey: asString(entry.packageKey),
        version: asString(entry.version),
        manufacturer: asString(entry.manufacturer),
        registration: tailNumber ?? undefined,
        tags: Array.isArray(entry.tags) ? (entry.tags as string[]) : [],
        status: asString(entry.status) ?? undefined
    };
};

export const ITEMS_PER_PAGE = 15;

const slugify = (input: string) => input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'livery';

export const buildDownloadRequestUrl = (livery: Livery, resolution: Resolution, simulator: Simulator): string => {
    if (!livery.downloadEndpoint) {
        throw new Error('Missing download endpoint for livery');
    }
    const url = new URL(livery.downloadEndpoint);
    url.searchParams.set('resolution', resolution);
    url.searchParams.set('simulator', simulator);
    url.searchParams.set('name', livery.name);
    if (livery.packageKey) {
        url.searchParams.set('packageKey', livery.packageKey);
    }
    return url.toString();
};

export const deriveInstallFolderName = (livery: Livery): string => {
    if (livery.packageKey) {
        const key = livery.packageKey.split('/').pop();
        if (key) {
            return key.replace(/\.zip$/i, '');
        }
    }
    const base = slugify(livery.name);
    const version = livery.version ? slugify(livery.version) : 'v1-0-0';
    return `${base}-${version}`;
};

export const joinPaths = (base: string, folder: string): string => {
    const sanitizedBase = base.replace(/[\\/]+$/, '');
    const separator = sanitizedBase.includes('\\') ? '\\' : '/';
    return `${sanitizedBase}${separator}${folder}`;
};

export const formatDate = (date: string | number | Date): string => {
    try {
        const parsed = new Date(date);
        return parsed.toLocaleDateString();
    } catch (error) {
        return '';
    }
};
