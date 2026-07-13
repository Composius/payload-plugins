import type { SanitizedConfig } from 'payload'

/**
 * Selects the Payload config of one plugin suite. DEV_SUITE is required —
 * every dev/generate/test script sets it explicitly (e.g. `pnpm dev:articles`).
 * To add a plugin: add its loader here and the matching scripts in package.json.
 */
const suite = process.env.DEV_SUITE

const loaders: Record<string, () => Promise<{ default: Promise<SanitizedConfig> }>> = {
  articles: () => import('./configs/articles/config.js'),
  menus: () => import('./configs/menus/config.js'),
  pages: () => import('./configs/pages/config.js'),
}

if (!suite || !loaders[suite]) {
  throw new Error(
    `DEV_SUITE must be set to one of: ${Object.keys(loaders).join(', ')} (got "${suite ?? ''}")`,
  )
}

export default loaders[suite]().then((configModule) => configModule.default)
