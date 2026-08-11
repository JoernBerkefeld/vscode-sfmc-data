import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appendMcdataDebugArgument } from '../mcdataDebugArguments';

describe('appendMcdataDebugArg', () => {
    it('returns a copy unchanged when disabled', () => {
        const arguments_ = ['export', 'a/b', '--de', 'K'];
        const out = appendMcdataDebugArgument(arguments_, false);
        assert.deepEqual(out, arguments_);
        assert.notStrictEqual(out, arguments_);
    });

    it('appends --debug when enabled', () => {
        const out = appendMcdataDebugArgument(['import', 'a/b', '--file', 'x.csv'], true);
        assert.deepEqual(out, ['import', 'a/b', '--file', 'x.csv', '--debug']);
    });

    it('does not duplicate --debug', () => {
        const out = appendMcdataDebugArgument(['export', 'a/b', '--debug', '--de', 'K'], true);
        assert.deepEqual(out, ['export', 'a/b', '--debug', '--de', 'K']);
    });
});
