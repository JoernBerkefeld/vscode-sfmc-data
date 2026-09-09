/**
 * Minimal `vscode` surface for host-free `node --test` of telemetry modules.
 */

type TelemetryChangeListener = (isEnabled: boolean) => void;

export class Disposable {
    private readonly callOnDispose: () => void;

    constructor(callOnDispose: () => void) {
        this.callOnDispose = callOnDispose;
    }

    dispose(): void {
        this.callOnDispose();
    }
}

export const version = '1.101.0-mock';

/**
 * Must match the `vscode.env` export name used by the reporter.
 */
// eslint-disable-next-line unicorn/name-replacements -- vscode API surface
export const env = {
    machineId: 'mock-machine-id',
    isTelemetryEnabled: true,
    __listeners: [] as TelemetryChangeListener[],
    onDidChangeTelemetryEnabled(listener: TelemetryChangeListener): Disposable {
        env.__listeners.push(listener);
        return new Disposable(() => {
            const index = env.__listeners.indexOf(listener);
            if (index !== -1) env.__listeners.splice(index, 1);
        });
    },
};

export interface MockExtension {
    id: string;
    isActive?: boolean;
    packageJSON: { extensionDependencies?: string[]; extensionPack?: string[] };
}

export const extensions = {
    __installed: [] as MockExtension[],
    get all(): MockExtension[] {
        return extensions.__installed;
    },
    getExtension(id: string): MockExtension | undefined {
        return extensions.__installed.find((extension) => extension.id === id);
    },
};

export const workspace = {
    workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
};

/**
 * Sets the global telemetry flag and notifies subscribers, mirroring VS Code.
 * @param isEnabled - New consent value.
 */
export function fireTelemetryChange(isEnabled: boolean): void {
    env.isTelemetryEnabled = isEnabled;
    for (const listener of env.__listeners) listener(isEnabled);
}

/**
 * Restores stub defaults between tests.
 */
export function resetVscodeStub(): void {
    env.isTelemetryEnabled = true;
    env.__listeners = [];
    extensions.__installed = [];
    workspace.workspaceFolders = undefined;
}
