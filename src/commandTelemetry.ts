import type { TelemetryValue } from './telemetry';

/**
 * Privacy-safe command outcome used by the dispatcher and refresh-cache handler.
 */
export type CommandTelemetryOutcome = 'success' | 'commandFailed' | 'spawnError' | 'cancelled';

/**
 * `McdataRunOutcome.status` values from runMcdata — mapped by {@link mapMcdataRunStatus}.
 */
export type McdataRunStatus = 'success' | 'failed' | 'cancelled' | 'spawn_error';

export interface TelemetrySink {
    track(event: string, properties?: Record<string, TelemetryValue>): void;
}

export interface CommandTelemetryExtras {
    durationMs?: number;
    buCount?: number;
}

/**
 * Maps a completed mcdata-run status onto the telemetry outcome allowlist.
 * @param status - Status from `McdataRunOutcome`.
 * @returns {CommandTelemetryOutcome} Telemetry-facing outcome.
 */
export function mapMcdataRunStatus(status: McdataRunStatus): CommandTelemetryOutcome {
    switch (status) {
        case 'success': {
            return 'success';
        }
        case 'failed': {
            return 'commandFailed';
        }
        case 'spawn_error': {
            return 'spawnError';
        }
        case 'cancelled': {
            return 'cancelled';
        }
    }
}

/**
 * Emits command.executed or command.failed. Cancelled outcomes send nothing.
 * @param reporter - Optional sink (no-op when undefined).
 * @param command - VS Code command id (e.g. `sfmc-data.exportDE`).
 * @param outcome - Allowlisted result. Never a raw error string.
 * @param extras - `durationMs` on success only; optional `buCount` for refresh-cache.
 */
export function trackCommandOutcome(
    reporter: TelemetrySink | undefined,
    command: string,
    outcome: CommandTelemetryOutcome,
    extras?: CommandTelemetryExtras
): void {
    if (outcome === 'cancelled') {
        return;
    }

    if (outcome === 'success') {
        const properties: Record<string, TelemetryValue> = { command };
        if (extras?.durationMs !== undefined) {
            properties.durationMs = extras.durationMs;
        }
        if (extras?.buCount !== undefined) {
            properties.buCount = extras.buCount;
        }
        reporter?.track('command.executed', properties);
        return;
    }

    const properties: Record<string, TelemetryValue> = {
        command,
        errorCategory: outcome,
    };
    if (extras?.buCount !== undefined) {
        properties.buCount = extras.buCount;
    }
    reporter?.track('command.failed', properties);
}
