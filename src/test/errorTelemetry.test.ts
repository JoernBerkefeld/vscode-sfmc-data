import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeErrorCode, sanitizeErrorName, sanitizeFailureTelemetry } from '../errorTelemetry';

describe('errorTelemetry sanitizer', () => {
    it('accepts short Error names and rejects free-form text', () => {
        assert.equal(sanitizeErrorName('TypeError'), 'TypeError');
        assert.equal(sanitizeErrorName('Error: boom'), undefined);
        assert.equal(sanitizeErrorName(String.raw`C:\Users\x`), undefined);
    });

    it('accepts identifier codes and small integers, rejects paths', () => {
        assert.equal(sanitizeErrorCode('ENOENT'), 'ENOENT');
        assert.equal(sanitizeErrorCode(2), '2');
        assert.equal(sanitizeErrorCode(String.raw`C:\Users\x\mcdata.exe`), undefined);
    });

    it('never copies message or stack onto the payload', () => {
        const error = {
            name: 'Error',
            code: 'ENOENT',
            message: String.raw`spawn C:\Users\secret\mcdata.exe`,
            stack: 'Error: spawn C:\\Users\\secret\\mcdata.exe\n    at x',
        };
        assert.deepEqual(sanitizeFailureTelemetry(error, 'spawnError'), {
            errorCategory: 'spawnError',
            errorName: 'Error',
            errorCode: 'ENOENT',
        });
    });
});
