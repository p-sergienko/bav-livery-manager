import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

type SupportedSimulator = 'MSFS2020' | 'MSFS2024';

const PROCESS_NAMES: Record<SupportedSimulator, string[]> = {
    MSFS2020: ['FlightSimulator.exe', 'MicrosoftFlightSimulator.exe'],
    MSFS2024: ['FlightSimulator.exe', 'FlightSimulator2024.exe', 'MicrosoftFlightSimulator.exe']
};

const FALLBACK_NAMES = Array.from(new Set([...PROCESS_NAMES.MSFS2020, ...PROCESS_NAMES.MSFS2024])).map((name) =>
    name.toLowerCase()
);

async function captureWindowsProcessSnapshot(): Promise<string> {
    const { stdout } = await execAsync('tasklist /NH');
    return stdout.toLowerCase();
}

export async function isSimulatorRunning(simulator?: SupportedSimulator): Promise<boolean> {
    if (process.platform !== 'win32') {
        return false;
    }

    const candidates = simulator ? PROCESS_NAMES[simulator] : undefined;
    const processNames = (candidates ?? FALLBACK_NAMES).map((name) => name.toLowerCase());

    try {
        const snapshot = await captureWindowsProcessSnapshot();
        return processNames.some((name) => snapshot.includes(name));
    } catch (error) {
        console.warn('Failed to inspect simulator processes:', error);
        return false;
    }
}
