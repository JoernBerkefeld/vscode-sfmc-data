import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    detectEcosystem,
    getReporter,
    setReporter,
    TelemetryReporter,
    type TelemetryValue,
} from '../telemetry';
import { fireTelemetryChange, resetVscodeStub, extensions } from './vscodeStub';

interface FetchCall {
    url: string;
    body: string;
    signal?: AbortSignal;
}

interface TelemetryEvent {
    event: string;
    properties: Record<string, TelemetryValue>;
}

/**
 * ES2022-safe name sort (`Array#toSorted` needs lib ES2023).
 * @param names - Keys to order.
 * @returns {string[]} New array ordered by localeCompare.
 */
function sortedNames(names: string[]): string[] {
    // eslint-disable-next-line unicorn/no-array-sort -- tsconfig lib is ES2022
    return [...names].sort((left, right) => left.localeCompare(right));
}

function stubFetch(isHeldOpen = false): {
    calls: FetchCall[];
    resolveAll: () => void;
    restore: () => void;
} {
    const calls: FetchCall[] = [];
    const resolvers: Array<() => void> = [];
    const originalFetch = fetch;
    // eslint-disable-next-line unicorn/no-global-object-property-assignment -- node --test fetch stub
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
        calls.push({
            url: String(url),
            body: String(init?.body ?? ''),
            signal: init?.signal ?? undefined,
        });
        if (!isHeldOpen) return Promise.resolve(new Response(null, { status: 200 }));
        return new Promise<Response>((resolve, reject) => {
            const abort = (): void => reject(new DOMException('Aborted', 'AbortError'));
            init?.signal?.addEventListener('abort', abort, { once: true });
            resolvers.push(() => resolve(new Response(null, { status: 200 })));
        });
    }) as typeof fetch;
    return {
        calls,
        resolveAll() {
            const pending = [...resolvers];
            resolvers.length = 0;
            for (const resolve of pending) resolve();
        },
        restore() {
            // eslint-disable-next-line unicorn/no-global-object-property-assignment -- restore fetch stub
            globalThis.fetch = originalFetch;
        },
    };
}

describe('TelemetryReporter', () => {
    afterEach(() => {
        resetVscodeStub();
        setReporter(undefined);
    });

    it('is a no-op when telemetry is disabled at construction', async () => {
        const fetchStub = stubFetch();
        try {
            fireTelemetryChange(false);
            const reporter = new TelemetryReporter({
                extensionName: 'sfmc-data',
                extensionVersion: '9.9.9',
            });
            reporter.track('extension.activated', { isMcdevProject: true });
            await reporter.flush();
            assert.equal(fetchStub.calls.length, 0);
            reporter.dispose();
        } finally {
            fetchStub.restore();
        }
    });

    it('aborts an in-flight request when telemetry is disabled', async () => {
        const fetchStub = stubFetch(true);
        try {
            const reporter = new TelemetryReporter({
                extensionName: 'sfmc-data',
                extensionVersion: '9.9.9',
            });
            reporter.track('command.executed', { command: 'sfmc-data.exportDE', durationMs: 5 });
            void reporter.flush();
            assert.equal(fetchStub.calls.length, 1);
            const signal = fetchStub.calls[0].signal;
            assert.ok(signal);
            fireTelemetryChange(false);
            assert.equal(signal.aborted, true);
            reporter.dispose();
        } finally {
            fetchStub.restore();
        }
    });

    it('getReporter and setReporter store the module-scoped instance', () => {
        assert.equal(getReporter(), undefined);
        const reporter = new TelemetryReporter({
            extensionName: 'sfmc-data',
            extensionVersion: '9.9.9',
        });
        setReporter(reporter);
        assert.equal(getReporter(), reporter);
        setReporter(undefined);
        assert.equal(getReporter(), undefined);
        reporter.dispose();
    });

    it('detectEcosystem reports neighbors and omits self neighbor.sfmc-data', () => {
        const selfId = 'joernberkefeld.sfmc-data';
        extensions.__installed = [
            { id: selfId, packageJSON: {} },
            { id: 'joernberkefeld.sfmc-language', packageJSON: {} },
            { id: 'some.other-extension', packageJSON: { extensionDependencies: [selfId] } },
        ];
        const result = detectEcosystem(selfId);
        assert.equal(result.coInstalledAsDependency, true);
        assert.equal(result['neighbor.sfmc-language'], true);
        assert.equal(Object.hasOwn(result, 'neighbor.sfmc-data'), false);
    });

    it('telemetry catalog matches runtime event properties and measures', async () => {
        const fetchStub = stubFetch();
        try {
            const reporter = new TelemetryReporter({
                extensionName: 'sfmc-data',
                extensionVersion: '9.9.9',
            });
            reporter.track('extension.activated', {
                isMcdevProject: true,
                isMcdataProject: false,
                mcdataSource: 'bundled',
                ...detectEcosystem('joernberkefeld.sfmc-data'),
            });
            reporter.track('mcdata.version', { mcdataVersion: '2.7.0', mcdataSource: 'bundled' });
            reporter.track('command.executed', {
                command: 'sfmc-data.refreshDeCache',
                durationMs: 42,
                buCount: 2,
            });
            reporter.track('command.failed', {
                command: 'sfmc-data.exportDE',
                errorCategory: 'commandFailed',
                errorName: 'Error',
                errorCode: 'ENOENT',
                buCount: 1,
            });
            await reporter.flush();

            const catalogPath = path.join(__dirname, '..', '..', '..', 'telemetry.json');
            const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
                commonProperties: Record<string, unknown>;
                events: Record<
                    string,
                    { properties?: Record<string, unknown>; measures?: Record<string, unknown> }
                >;
            };
            const body = JSON.parse(fetchStub.calls[0].body) as { batch: TelemetryEvent[] };
            const commonNames = sortedNames(Object.keys(catalog.commonProperties));
            const runtimeCommon = sortedNames([
                '$process_person_profile',
                'distinct_id',
                'extension',
                'extensionVersion',
                'os',
                'vscodeVersion',
            ]);
            assert.deepEqual(commonNames, runtimeCommon);
            assert.deepEqual(
                sortedNames(Object.keys(catalog.events)),
                sortedNames(body.batch.map((event) => event.event))
            );
            assert.equal(body.batch[0].properties.extension, 'sfmc-data');
            assert.equal(body.batch[0].properties.distinct_id, 'mock-machine-id');
            assert.equal(body.batch[0].properties.$process_person_profile, false);
            assert.equal(Object.hasOwn(body.batch[0].properties, 'neighbor.sfmc-data'), false);

            for (const event of body.batch) {
                const definition = catalog.events[event.event];
                const catalogProperties = sortedNames(Object.keys(definition.properties ?? {}));
                const catalogMeasures = sortedNames(Object.keys(definition.measures ?? {}));
                const runtimeCustom = Object.keys(event.properties).filter(
                    (name) => !runtimeCommon.includes(name)
                );
                const runtimeMeasures = sortedNames(
                    runtimeCustom.filter((name) => typeof event.properties[name] === 'number')
                );
                const runtimeProperties = sortedNames(
                    runtimeCustom.filter((name) => typeof event.properties[name] !== 'number')
                );
                assert.deepEqual(runtimeProperties, catalogProperties, `${event.event} properties`);
                assert.deepEqual(runtimeMeasures, catalogMeasures, `${event.event} measures`);
            }
            await reporter.disposeAsync();
        } finally {
            fetchStub.restore();
        }
    });
});
