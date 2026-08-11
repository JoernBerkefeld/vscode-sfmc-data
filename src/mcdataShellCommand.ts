/**
 * Builds a single shell command line for `mcdata`, matching the quoting used when
 * the CLI was invoked via the integrated terminal (`sendText`).
 * @param shellPrefix - Resolved prefix (e.g. `node "…/mcdata.bundled.cjs"` or `mcdata`)
 * @param arguments_ - Arguments after the prefix
 * @returns {string} full command line string for `spawn(..., { shell: true })`
 */
export function buildMcdataShellCommandLine(shellPrefix: string, arguments_: string[]): string {
    const quotedArguments = arguments_.map((a) => (a.includes(' ') ? `"${a}"` : a));
    return `${shellPrefix} ${quotedArguments.join(' ')}`.trim();
}
