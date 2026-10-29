const SUFFIX_ARGUMENT = "--multica-dev-app-suffix=";

export function devAppSuffix(envSuffix: string | undefined, argv: string[]): string | undefined {
  return envSuffix || argv.find((arg) => arg.startsWith(SUFFIX_ARGUMENT))?.slice(SUFFIX_ARGUMENT.length) || undefined;
}

export function devProtocolArguments(appPath: string, suffix: string | undefined): string[] {
  return suffix ? [appPath, `${SUFFIX_ARGUMENT}${suffix}`] : [appPath];
}
