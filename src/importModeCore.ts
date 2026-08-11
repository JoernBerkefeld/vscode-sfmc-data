import type * as vscode from 'vscode';

/**
 * Reads `sfmcData.importMode` from VS Code workspace configuration.
 * @param config - VS Code workspace configuration (`sfmcData` section)
 * @returns {'upsert' | 'insert'} effective import write mode
 */
export function getImportWriteModeFromSettings(
    config: vscode.WorkspaceConfiguration
): 'upsert' | 'insert' {
    const v = config.get<string>('importMode') ?? 'upsert';
    return v === 'insert' ? 'insert' : 'upsert';
}
