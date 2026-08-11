/**
 * When enabled, appends `--debug` to mcdata argv (matches `sfmc-dataloader` CLI).
 * Does not duplicate if `--debug` is already present.
 * @param arguments_ - mcdata arguments after the executable (subcommand and flags)
 * @param isEnabled - from workspace setting `sfmcData.createDebugLog`
 * @returns {string[]} a new array (does not mutate `arguments_`)
 */
export function appendMcdataDebugArgument(
    arguments_: readonly string[],
    isEnabled: boolean
): string[] {
    if (!isEnabled) {
        return [...arguments_];
    }
    if (arguments_.includes('--debug')) {
        return [...arguments_];
    }
    return [...arguments_, '--debug'];
}
