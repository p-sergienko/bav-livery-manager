import type { Livery, Resolution, Simulator } from '@/types/livery';

export const ITEMS_PER_PAGE = 15;

export const getDownloadUrlForSelection = (
    livery: Livery,
    resolution: Resolution,
    simulator: Simulator
): string => {
    if (resolution === '4K' && simulator === 'FS20') {
        return livery.downloadUrl4K ?? livery.downloadUrl;
    }

    if (resolution === '8K' && simulator === 'FS24') {
        return livery.downloadUrlFS24 ?? livery.downloadUrl;
    }

    if (resolution === '4K' && simulator === 'FS24') {
        return livery.downloadUrl4KFS24 ?? livery.downloadUrlFS24 ?? livery.downloadUrl;
    }

    return livery.downloadUrl;
};

export const getFolderNameFromUrl = (url: string): string => {
    const fileName = url.substring(url.lastIndexOf('/') + 1);
    return fileName.replace('.zip', '');
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
