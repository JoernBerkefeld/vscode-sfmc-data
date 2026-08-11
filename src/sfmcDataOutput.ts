import * as vscode from 'vscode';

const CHANNEL_NAME = 'SFMC Data Loader';

const state: { channel: vscode.OutputChannel | undefined } = { channel: undefined };

/**
 * Creates the extension output channel and registers disposal on deactivate.
 * @param context - VS Code extension context for subscription lifetime
 * @returns {vscode.OutputChannel} the **SFMC Data Loader** output channel
 */
export function registerSfmcDataOutput(context: vscode.ExtensionContext): vscode.OutputChannel {
    state.channel = vscode.window.createOutputChannel(CHANNEL_NAME);
    context.subscriptions.push(state.channel);
    return state.channel;
}

export function getSfmcDataOutputChannel(): vscode.OutputChannel {
    if (!state.channel) {
        throw new Error('SFMC Data output channel was not registered');
    }
    return state.channel;
}
