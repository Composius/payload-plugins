import type { CollectionAdminOptions, Config } from 'payload'

import type { RedirectionsAccess } from './collections/Redirections.js'
import type { RedirectionsEndpointOptions } from './endpoints/rules.js'

import { Redirections } from './collections/Redirections.js'
import { DEFAULT_SLUG } from './constants.js'
import { anyone, authenticated } from './defaults.js'
import { rulesEndpoint } from './endpoints/rules.js'

export type { RedirectionsAccess, RedirectionsEndpointOptions }

export type ComposiusPayloadPluginRedirectionsConfig = {
  /**
   * Access control for the redirections collection, per operation.
   * Defaults: `read` allows anyone, `create`/`update`/`delete` require an
   * authenticated user. This does not gate the rules endpoint — see
   * `endpoint.access`.
   */
  access?: RedirectionsAccess
  disabled?: boolean
  /**
   * The public rules endpoint consumed by the Next.js proxy helper, mounted at
   * `/api/<slug>/rules`. Pass `false` to skip it entirely, for instance when
   * the rules are read through the Local API instead.
   */
  endpoint?: false | RedirectionsEndpointOptions
  /**
   * Hides the redirections collection from the admin nav and routes (default:
   * `false`). Accepts a boolean or a `({ user }) => boolean` function, so it can
   * be hidden per user. The collection stays registered, leaving the database
   * schema and the REST/GraphQL API untouched.
   */
  hidden?: CollectionAdminOptions['hidden']
  /**
   * Slug of the generated collection. Deliberately distinct from
   * `@payloadcms/plugin-redirects`' `redirects`, so both can coexist.
   * @default 'redirections'
   */
  slug?: string
}

/**
 * Adds a `redirections` collection of URL-to-URL rules — matched exactly, by
 * prefix, or by regular expression — plus a cacheable endpoint publishing them
 * for the Next.js proxy helper exported from
 * `@composius/payload-plugin-redirections/next`.
 */
export const ComposiusPayloadPluginRedirections =
  (pluginOptions: ComposiusPayloadPluginRedirectionsConfig = {}) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    const access = {
      create: pluginOptions.access?.create ?? authenticated,
      delete: pluginOptions.access?.delete ?? authenticated,
      read: pluginOptions.access?.read ?? anyone,
      update: pluginOptions.access?.update ?? authenticated,
    }

    const slug = pluginOptions.slug ?? DEFAULT_SLUG

    // A disabled plugin keeps the collection but stops publishing the rules,
    // so nothing redirects while the schema stays intact.
    const endpoints =
      pluginOptions.endpoint === false || pluginOptions.disabled
        ? []
        : [rulesEndpoint(slug, pluginOptions.endpoint ?? {})]

    config.collections.push(
      Redirections({
        access,
        endpoints,
        hidden: pluginOptions.hidden ?? false,
        slug,
      }),
    )

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    return config
  }

export { Redirections } from './collections/Redirections.js'
export {
  DEFAULT_RULES_ENDPOINT,
  DEFAULT_SLUG,
  DEFAULT_STATUS,
  MATCH_TYPES,
  RULES_ENDPOINT_PATH,
  RULES_PATH,
  RULES_VERSION,
  STATUSES,
} from './constants.js'
export { anyone, authenticated } from './defaults.js'
export { rulesEndpoint } from './endpoints/rules.js'
export { resolveRedirection } from './lib/resolver.js'
export type { ResolveOptions } from './lib/resolver.js'
export { isSelfRedirect, validateDestination, validateSource } from './lib/validation.js'
export { en, fr, label, t } from './translations/index.js'
export type { Translation } from './translations/index.js'
export type {
  RedirectionMatchType,
  RedirectionRule,
  RedirectionRulesResponse,
  RedirectionStatus,
  ResolvedRedirection,
} from './types.js'
