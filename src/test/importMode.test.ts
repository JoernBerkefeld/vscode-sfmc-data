import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type * as vscode from 'vscode';
import { getImportWriteModeFromSettings } from '../importModeCore';

function mockWorkspaceConfig(options: { getImportMode?: string }): vscode.WorkspaceConfiguration {
    return {
        get: (section: string) => {
            if (section === 'importMode') {
                return options.getImportMode ?? 'upsert';
            }
            return;
        },
    } as vscode.WorkspaceConfiguration;
}

describe('getImportWriteModeFromSettings', () => {
    it('returns insert when importMode is set to insert', () => {
        const config = mockWorkspaceConfig({ getImportMode: 'insert' });
        assert.equal(getImportWriteModeFromSettings(config), 'insert');
    });

    it('returns upsert when importMode is set to upsert', () => {
        const config = mockWorkspaceConfig({ getImportMode: 'upsert' });
        assert.equal(getImportWriteModeFromSettings(config), 'upsert');
    });

    it('defaults to upsert when importMode is absent', () => {
        const config = mockWorkspaceConfig({});
        assert.equal(getImportWriteModeFromSettings(config), 'upsert');
    });

    it('defaults to upsert when importMode is an unrecognised value', () => {
        const config = mockWorkspaceConfig({ getImportMode: 'bulk' });
        assert.equal(getImportWriteModeFromSettings(config), 'upsert');
    });
});
