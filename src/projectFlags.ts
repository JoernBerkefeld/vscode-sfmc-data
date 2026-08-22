import * as fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';

const FILE_MCDEV_RC = '.mcdevrc.json';
const FILE_MCDATA_RC = '.mcdatarc.json';

export interface ProjectFlags {
    isMcdevProject: boolean;
    isMcdataProject: boolean;
}

export interface ProjectFlagFolder {
    uri: { fsPath: string };
}

/**
 * Scans every workspace folder root independently for `.mcdevrc.json` and
 * `.mcdatarc.json`. Both flags can be true. Does not return paths.
 *
 * Do not reuse `findProjectRoot` — that helper stops at the first folder that
 * has either file and would miss a sibling folder of the other type.
 * @param workspaceFolders - Folders to scan; defaults to `vscode.workspace.workspaceFolders`.
 * @returns {ProjectFlags} Booleans only.
 */
export function getProjectFlags(
    workspaceFolders?: readonly ProjectFlagFolder[] | undefined
): ProjectFlags {
    const folders = workspaceFolders ?? vscode.workspace.workspaceFolders ?? [];
    let isMcdevProject = false;
    let isMcdataProject = false;
    for (const folder of folders) {
        const root = folder.uri.fsPath;
        if (fs.existsSync(path.join(root, FILE_MCDEV_RC))) {
            isMcdevProject = true;
        }
        if (fs.existsSync(path.join(root, FILE_MCDATA_RC))) {
            isMcdataProject = true;
        }
    }
    return { isMcdevProject, isMcdataProject };
}
