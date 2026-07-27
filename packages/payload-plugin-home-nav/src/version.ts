import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

/**
 * Cached across renders — the app's version cannot change while the server
 * runs. `undefined` means "not looked up yet", `null` means "looked up, not
 * found" (so a failed lookup is not retried on every request).
 */
let cached: null | string | undefined

const readVersion = (packageJsonPath: string): string | undefined => {
  try {
    const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: unknown
    }

    return typeof version === 'string' && version.length > 0 ? version : undefined
  } catch {
    // Unreadable or malformed package.json — keep walking up.
    return undefined
  }
}

/** The `payload.logger` shape this module needs. */
type Logger = {
  info: (message: string) => void
  warn: (message: string) => void
}

/**
 * The host app's version, read from the nearest `package.json` that declares
 * one, walking up from the working directory (the app root under `next dev`,
 * `next build` and `next start`). Returns `undefined` when no version can be
 * found — e.g. a standalone bundle that ships no package.json.
 *
 * The outcome is logged once — the version and the file it came from, or a
 * warning explaining why there is none. The result is cached, so the walk (and
 * the log with it) only ever runs on the first render.
 */
export const resolveAppVersion = (logger?: Logger): string | undefined => {
  if (cached !== undefined) {
    return cached ?? undefined
  }

  const cwd = process.cwd()
  const { root } = parse(cwd)
  let directory = cwd
  let seenPackageJson = false

  while (true) {
    const packageJsonPath = join(directory, 'package.json')

    if (existsSync(packageJsonPath)) {
      seenPackageJson = true
      const version = readVersion(packageJsonPath)

      if (version) {
        logger?.info(
          `[payload-plugin-home-nav] App version ${version}, from "${packageJsonPath}" — shown in the nav sidebar.`,
        )
        cached = version
        return version
      }
    }

    if (directory === root) break
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }

  logger?.warn(
    seenPackageJson
      ? `[payload-plugin-home-nav] No package.json above "${cwd}" declares a "version" — hiding the app version in the nav sidebar. Pass the \`versionNumber\` option to set it explicitly.`
      : `[payload-plugin-home-nav] No package.json found above "${cwd}" — hiding the app version in the nav sidebar. Pass the \`versionNumber\` option to set it explicitly.`,
  )

  cached = null
  return undefined
}
