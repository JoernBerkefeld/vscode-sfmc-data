import * as vscode from 'vscode';

const PROJECT_API_KEY = 'phc_AY9WHA5c6M9QqkaapgPqSTZ2NNZK3L3FxwkbdASsS7Ex';
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const FLUSH_DEBOUNCE_MS = 2000;
const SHUTDOWN_TIMEOUT_MS = 2000;

export type TelemetryValue = string | number | boolean;

interface TelemetryReporterOptions {
    extensionName: string;
    extensionVersion: string;
}

interface QueuedEvent {
    event: string;
    properties: Record<string, TelemetryValue>;
    timestamp: string;
}

const reporterState: { current: TelemetryReporter | undefined } = { current: undefined };

/**
 * Batches anonymous extension telemetry and respects VS Code's global telemetry setting.
 */
export class TelemetryReporter implements vscode.Disposable {
    private readonly commonProperties: Record<string, TelemetryValue>;
    private readonly distinctId: string;
    private readonly inFlight = new Map<AbortController, Promise<void>>();
    private queue: QueuedEvent[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | undefined;
    private enabled: boolean;
    private disposed = false;
    private disposePromise: Promise<void> | undefined;
    private readonly changeSubscription: vscode.Disposable;

    /**
     * @param options - The emitting extension's short name and own version.
     */
    constructor(options: TelemetryReporterOptions) {
        this.distinctId = vscode.env.machineId;
        this.enabled = vscode.env.isTelemetryEnabled;
        this.commonProperties = {
            extension: options.extensionName,
            extensionVersion: options.extensionVersion,
            os: process.platform,
            vscodeVersion: vscode.version,
        };
        this.changeSubscription = vscode.env.onDidChangeTelemetryEnabled((isEnabled) => {
            this.enabled = isEnabled;
            if (!isEnabled) {
                this.clearPending();
                this.abortInFlight();
            }
        });
    }

    private async drainForShutdown(): Promise<void> {
        const existingRequests: Promise<void>[] = [];
        for (const request of this.inFlight.values()) {
            existingRequests.push(request);
        }
        const finalRequest = this.flushQueued(true);
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<void>((resolve) => {
            timeout = setTimeout(resolve, SHUTDOWN_TIMEOUT_MS);
        });

        await Promise.race([
            Promise.allSettled([...existingRequests, finalRequest]),
            timeoutPromise,
        ]);
        if (timeout) clearTimeout(timeout);
        if (this.inFlight.size > 0) this.abortInFlight();
        await Promise.allSettled(this.inFlight.values());
    }

    private flushQueued(canRunWhenDisposed: boolean): Promise<void> {
        this.clearFlushTimer();
        if (
            (!canRunWhenDisposed && this.disposed) ||
            !this.enabled ||
            !vscode.env.isTelemetryEnabled ||
            this.queue.length === 0
        ) {
            if (!this.enabled || !vscode.env.isTelemetryEnabled) this.queue = [];
            return Promise.resolve();
        }
        if (typeof fetch !== 'function') {
            this.queue = [];
            return Promise.resolve();
        }

        const batch = this.queue;
        this.queue = [];
        const controller = new AbortController();
        const request = this.sendBatch(controller, batch);
        this.inFlight.set(controller, request);
        return request;
    }

    private async sendBatch(controller: AbortController, batch: QueuedEvent[]): Promise<void> {
        try {
            await fetch(`${POSTHOG_HOST}/batch/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: PROJECT_API_KEY, batch }),
                signal: controller.signal,
            });
        } catch {
            // Telemetry transport failures never surface to users.
        } finally {
            this.inFlight.delete(controller);
        }
    }

    private clearPending(): void {
        this.queue = [];
        this.clearFlushTimer();
    }

    private clearFlushTimer(): void {
        if (!this.flushTimer) return;
        clearTimeout(this.flushTimer);
        this.flushTimer = undefined;
    }

    private abortInFlight(): void {
        for (const controller of this.inFlight.keys()) controller.abort();
    }

    /**
     * Enqueues an event for the next debounced flush.
     * @param event - Event name catalogued in telemetry.json.
     * @param properties - Optional flat custom properties.
     */
    track(event: string, properties?: Record<string, TelemetryValue>): void {
        if (this.disposed || !this.enabled) return;

        this.queue.push({
            event,
            properties: {
                distinct_id: this.distinctId,
                $process_person_profile: false,
                ...this.commonProperties,
                ...properties,
            },
            timestamp: new Date().toISOString(),
        });
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => void this.flush(), FLUSH_DEBOUNCE_MS);
        }
    }

    /**
     * Sends queued events now. Callers on normal paths intentionally do not await this promise.
     * @returns {Promise<void>} Settled when this flush's request settles.
     */
    flush(): Promise<void> {
        return this.flushQueued(false);
    }

    /**
     * Performs a bounded final drain for explicit extension deactivation.
     * @returns {Promise<void>} Settles after requests complete or the shutdown bound expires.
     */
    disposeAsync(): Promise<void> {
        if (this.disposePromise) return this.disposePromise;
        if (this.disposed) return Promise.resolve();

        this.disposed = true;
        this.changeSubscription.dispose();
        this.disposePromise = this.drainForShutdown();
        return this.disposePromise;
    }

    /**
     * Immediately stops telemetry when disposed through VS Code's synchronous Disposable path.
     */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.changeSubscription.dispose();
        this.clearPending();
        this.abortInFlight();
    }
}

const NEIGHBOR_ALLOWLIST: Record<string, string> = {
    'neighbor.sergey-agadzhanov.ampscript': 'sergey-agadzhanov.ampscript',
    'neighbor.FiB.ssjs-vsc': 'FiB.ssjs-vsc',
    'neighbor.FiB.beautyAmp': 'FiB.beautyAmp',
    'neighbor.sfmc-language': 'joernberkefeld.sfmc-language',
    'neighbor.sfmc-devtools': 'Accenture-oss.sfmc-devtools-vscode',
    'neighbor.sfmc-data': 'joernberkefeld.sfmc-data',
    'neighbor.mso-conditionals': 'joernberkefeld.mso-conditionals',
    'neighbor.sfmc-extension-pack': 'joernberkefeld.sfmc-extension-pack',
    'neighbor.sfmc-extension-pack-plus': 'joernberkefeld.sfmc-extension-pack-expanded',
    'neighbor.markdown-preview-bitbucket-innersource':
        'joernberkefeld.markdown-preview-bitbucket-innersource',
};

/**
 * Computes flat ecosystem and co-installation booleans.
 * @param selfId - Full publisher.name id of the calling extension.
 * @returns {Record<string, boolean>} Flat telemetry properties. The caller's own neighbor.* key is omitted.
 */
export function detectEcosystem(selfId: string): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    let isCoInstalledAsDependency = false;
    let isCoInstalledInPack = false;
    for (const extension of vscode.extensions.all) {
        if (extension.id === selfId) continue;
        const package_ = extension.packageJSON as {
            extensionDependencies?: string[];
            extensionPack?: string[];
        };
        if (
            Array.isArray(package_.extensionDependencies) &&
            package_.extensionDependencies.includes(selfId)
        ) {
            isCoInstalledAsDependency = true;
        }
        if (Array.isArray(package_.extensionPack) && package_.extensionPack.includes(selfId)) {
            isCoInstalledInPack = true;
        }
    }
    result.coInstalledAsDependency = isCoInstalledAsDependency;
    result.coInstalledInPack = isCoInstalledInPack;

    for (const [label, fullId] of Object.entries(NEIGHBOR_ALLOWLIST)) {
        if (fullId === selfId) continue;
        result[label] = vscode.extensions.getExtension(fullId) !== undefined;
    }
    return result;
}

/**
 * @returns {TelemetryReporter | undefined} The module-scoped reporter set during activate, or undefined before/after.
 */
export function getReporter(): TelemetryReporter | undefined {
    return reporterState.current;
}

/**
 * Stores the activate-time reporter for command chunks. Pass undefined on deactivate.
 * @param next - Live reporter, or undefined to clear.
 */
export function setReporter(next: TelemetryReporter | undefined): void {
    reporterState.current = next;
}
