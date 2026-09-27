import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'
import type { CollectionConfig, Config } from 'payload'

import { seoPlugin } from '@payloadcms/plugin-seo'

export type SeoGenerateFunctions = {
  generateDescription: GenerateDescription
  generateImage: GenerateImage
  generateTitle: GenerateTitle
  generateURL: GenerateURL
}

/**
 * The collections sharing the generate endpoints, on `config.custom` (which
 * Payload keeps server-side). A string key and not a module-level map or a
 * symbol: every plugin inlines its own copy of this module at build time, and
 * all of those copies must find the same registry.
 */
export const SEO_REGISTRY_KEY = 'composiusSeoCollections'

/** Tags the generate endpoints put on the config here, so the next call replaces those and only those. */
const ENDPOINT_MARKER = 'composiusSeo'

/**
 * Registers a collection with the `/plugin-seo/generate-*` endpoints the SEO
 * field buttons call, keeping the `meta` group the collection built itself.
 *
 * `seoPlugin` is not safe to call once per plugin: every call appends its own
 * set of endpoints under the same paths, Payload routes each request to the
 * first one, and since @payloadcms/plugin-seo 3.90.0 that one rejects any
 * collection it was not given — so the second plugin's editors get a 403, and
 * would get the first plugin's generate functions even without it.
 *
 * Instead every call records its collection and generate functions on the
 * config, drops the endpoints an earlier call registered, and runs `seoPlugin`
 * afresh over every collection recorded so far, with generate functions that
 * route by collection. Whichever plugin runs last leaves one set of endpoints
 * that knows them all. Endpoints the host registered itself are left alone.
 */
export const registerSeoCollection = (
  config: Config,
  slug: string,
  generate: SeoGenerateFunctions,
): Config => {
  const registry: Record<string, SeoGenerateFunctions> = {
    ...(config.custom?.[SEO_REGISTRY_KEY] as Record<string, SeoGenerateFunctions> | undefined),
    [slug]: generate,
  }
  const slugs = Object.keys(registry)

  // `seoPlugin` also appends its own `meta` group to every collection it is
  // listed for, on top of the one each collection builds itself. Listing them
  // is what authorizes the endpoints, so the fields are put back afterwards.
  const fieldsBefore = new Map(
    (config.collections ?? [])
      .filter((collection) => slugs.includes(collection.slug))
      .map((collection) => [collection.slug, collection.fields]),
  )

  const endpoints = (config.endpoints ?? []).filter(
    (endpoint) => !endpoint.custom?.[ENDPOINT_MARKER],
  )

  // The endpoints hand the generate function the collection they authorized
  // the request against, so its slug is always one of the registry's.
  const route =
    <K extends keyof SeoGenerateFunctions>(name: K) =>
    (args: Parameters<SeoGenerateFunctions[K]>[0]) => {
      const collection = (args.collectionConfig as CollectionConfig | undefined)?.slug
      const fn = collection ? registry[collection]?.[name] : undefined
      return fn ? fn(args) : ''
    }

  const result = seoPlugin({
    collections: slugs,
    generateDescription: route('generateDescription') as GenerateDescription,
    generateImage: route('generateImage') as GenerateImage,
    generateTitle: route('generateTitle') as GenerateTitle,
    generateURL: route('generateURL') as GenerateURL,
  })({ ...config, endpoints })

  for (const collection of result.collections ?? []) {
    const fields = fieldsBefore.get(collection.slug)
    if (fields) {
      collection.fields = fields
    }
  }

  result.endpoints = (result.endpoints ?? []).map((endpoint, index) =>
    index < endpoints.length
      ? endpoint
      : { ...endpoint, custom: { ...endpoint.custom, [ENDPOINT_MARKER]: true } },
  )
  result.custom = { ...result.custom, [SEO_REGISTRY_KEY]: registry }

  return result
}
