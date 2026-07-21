/**
 * Hand-written — `payload generate:importmap` no longer writes here.
 *
 * Every suite used to generate into this one file, so generating for one suite
 * wiped the entries of whichever suite generated last, and the admin panel
 * would fail with "PayloadComponent not found in importMap". Each suite now
 * generates its own map into ./importMaps/<suite>.js (wired up by
 * `admin.importMap.importMapFile` in dev/configs/shared.ts) and this module
 * picks the right one using DEV_SUITE — the same env var that selects the
 * Payload config in dev/payload.config.ts.
 *
 * To add a plugin: add its import and map entry here, plus the matching
 * generate:importmap:<suite> script in the root package.json.
 */
import { importMap as articles } from './importMaps/articles.js'
import { importMap as auth } from './importMaps/auth.js'
import { importMap as axiom } from './importMaps/axiom.js'
import { importMap as customPanel } from './importMaps/custom-panel.js'
import { importMap as health } from './importMaps/health.js'
import { importMap as homeNav } from './importMaps/home-nav.js'
import { importMap as media } from './importMaps/media.js'
import { importMap as menus } from './importMaps/menus.js'
import { importMap as pages } from './importMaps/pages.js'
import { importMap as umami } from './importMaps/umami.js'

const importMaps = {
  articles,
  auth,
  axiom,
  'custom-panel': customPanel,
  health,
  'home-nav': homeNav,
  media,
  menus,
  pages,
  umami,
}

/**
 * An unknown suite falls back to an empty map rather than throwing: importing
 * the Payload config already fails first, with a message listing valid suites.
 */
export const importMap = importMaps[process.env.DEV_SUITE] ?? {}
