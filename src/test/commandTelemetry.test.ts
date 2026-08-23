import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    mapMcdataRunStatus,
    trackCommandOutcome,
    type CommandTelemetryOutcome,
} from '../commandTelemetry';
import type { TelemetryValue } from '../telemetry';

interface TelemetryEvent {
    event: string;
    properties: Record<string, TelemetryValue>;
}

function createSink(): {
    events: TelemetryEvent[];
    track: (event: string, properties?: Record<string, TelemetryValue>) => void;
} {
    const events: TelemetryEvent[] = [];
    return {
        events,
        track(event, properties = {}) {
            events.push({ event, properties });
        },
    };
}

describe('trackCommandOutcome', () => {
    it('maps success to command.executed with durationMs', () => {
        const sink = createSink();
        trackCommandOutcome(sink, 'sfmc-data.exportDE', 'success', { durationMs: 42 });
        assert.deepEqual(sink.events, [
            {
                event: 'command.executed',
                properties: { command: 'sfmc-data.exportDE', durationMs: 42 },
            },
        ]);
    });

    it('maps commandFailed to command.failed with errorCategory', () => {
        const sink = createSink();
        trackCommandOutcome(sink, 'sfmc-data.importDE', 'commandFailed', { durationMs: 99 });
        assert.deepEqual(sink.events, [
            {
                event: 'command.failed',
                properties: { command: 'sfmc-data.importDE', errorCategory: 'commandFailed' },
            },
        ]);
        assert.equal(Object.hasOwn(sink.events[0].properties, 'durationMs'), false);
        assert.equal(Object.hasOwn(sink.events[0].properties, 'message'), false);
    });

    it('maps spawnError to command.failed with errorCategory', () => {
        const sink = createSink();
        trackCommandOutcome(sink, 'sfmc-data.initProject', 'spawnError');
        assert.deepEqual(sink.events, [
            {
                event: 'command.failed',
                properties: { command: 'sfmc-data.initProject', errorCategory: 'spawnError' },
            },
        ]);
    });

    it('attaches sanitized errorName and errorCode on spawnError', () => {
        const sink = createSink();
        const error = {
            name: 'Error',
            code: 'ENOENT',
            message: String.raw`spawn C:\Users\secret\mcdata.exe`,
        };
        trackCommandOutcome(sink, 'sfmc-data.exportDE', 'spawnError', { error });
        assert.deepEqual(sink.events[0].properties, {
            command: 'sfmc-data.exportDE',
            errorCategory: 'spawnError',
            errorName: 'Error',
            errorCode: 'ENOENT',
        });
        assert.equal(Object.hasOwn(sink.events[0].properties, 'message'), false);
        assert.equal(Object.hasOwn(sink.events[0].properties, 'stack'), false);
    });

    it('maps mcdataPrefixMissing and attaches a string exit code on commandFailed', () => {
        const sink = createSink();
        trackCommandOutcome(sink, 'sfmc-data.exportDE', 'mcdataPrefixMissing');
        trackCommandOutcome(sink, 'sfmc-data.exportDE', 'commandFailed', { errorCode: 2 });
        assert.deepEqual(sink.events, [
            {
                event: 'command.failed',
                properties: {
                    command: 'sfmc-data.exportDE',
                    errorCategory: 'mcdataPrefixMissing',
                },
            },
            {
                event: 'command.failed',
                properties: {
                    command: 'sfmc-data.exportDE',
                    errorCategory: 'commandFailed',
                    errorCode: '2',
                },
            },
        ]);
    });

    it('emits nothing when cancelled', () => {
        const sink = createSink();
        trackCommandOutcome(sink, 'sfmc-data.exportDE', 'cancelled', { durationMs: 10 });
        assert.deepEqual(sink.events, []);
    });

    it('attaches optional buCount on refresh-cache success and failure', () => {
        const sink = createSink();
        trackCommandOutcome(sink, 'sfmc-data.refreshDeCache', 'success', {
            durationMs: 15,
            buCount: 3,
        });
        trackCommandOutcome(sink, 'sfmc-data.refreshDeCache', 'commandFailed', { buCount: 3 });
        assert.deepEqual(sink.events, [
            {
                event: 'command.executed',
                properties: { command: 'sfmc-data.refreshDeCache', durationMs: 15, buCount: 3 },
            },
            {
                event: 'command.failed',
                properties: {
                    command: 'sfmc-data.refreshDeCache',
                    errorCategory: 'commandFailed',
                    buCount: 3,
                },
            },
        ]);
    });

    it('is a no-op when the reporter is undefined', () => {
        const outcome: CommandTelemetryOutcome = 'success';
        assert.doesNotThrow(() => {
            trackCommandOutcome(undefined, 'sfmc-data.exportDE', outcome, { durationMs: 1 });
        });
    });
});

describe('mapMcdataRunStatus', () => {
    it('maps McdataRunOutcome statuses onto the telemetry allowlist', () => {
        assert.equal(mapMcdataRunStatus('success'), 'success');
        assert.equal(mapMcdataRunStatus('failed'), 'commandFailed');
        assert.equal(mapMcdataRunStatus('spawn_error'), 'spawnError');
        assert.equal(mapMcdataRunStatus('cancelled'), 'cancelled');
    });
});
