import * as vscode from 'vscode';
import { findProjectRoot } from '../config';
import { runMcdataWithProgress } from '../runMcdata';
import { buildExportArguments } from '../argbuilder';
import { resolveContextFiles } from './contextUtilities';

export function registerContextExportCommand(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'sfmc-data.contextExportDE',
            (uri: vscode.Uri, uris: vscode.Uri[]) => contextExportDE(context, uri, uris)
        )
    );
}

async function contextExportDE(
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    uris: vscode.Uri[]
): Promise<void> {
    const projectRoot = findProjectRoot(vscode.workspace.workspaceFolders);
    if (!projectRoot) {
        void vscode.window.showErrorMessage(
            "No SFMC project config found. Use 'SFMC Data: Initialize Project' or open a folder containing .mcdevrc.json or .mcdatarc.json."
        );
        return;
    }

    const files = resolveContextFiles(uri, uris, projectRoot);
    if (!files) return;
    const { parsed, credBu } = files;

    const config = vscode.workspace.getConfiguration('sfmcData');
    const format = config.get<string>('defaultFormat') ?? 'csv';
    const isUseGit = config.get<boolean>('useGitFilenames') === true;
    const deKeys = parsed.map((f) => f.deKey);

    const arguments_ = buildExportArguments(credBu, deKeys, format, isUseGit);
    await runMcdataWithProgress(context, projectRoot, arguments_, {
        progressTitle: 'SFMC Data — Export',
        telemetryCommand: 'sfmc-data.contextExportDE',
    });
}
