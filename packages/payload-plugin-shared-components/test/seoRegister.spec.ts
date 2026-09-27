import type { CollectionConfig, Config, Endpoint, PayloadHandler } from 'payload'

import { describe, expect, test } from 'vitest'

import type { SeoGenerateFunctions } from '../src/index.js'

import { registerSeoCollection, SEO_REGISTRY_KEY } from '../src/index.js'

const collection = (slug: string): CollectionConfig => ({
  slug,
  fields: [{ name: 'meta', type: 'group', fields: [] }],
})

const baseConfig = (): Config =>
  ({ collections: [collection('pages'), collection('articles')] }) as unknown as Config

const generators = (name: string): SeoGenerateFunctions => ({
  generateDescription: () => `${name} description`,
  generateImage: () => `${name}-image`,
  generateTitle: () => `${name} title`,
  generateURL: () => `https://example.com/${name}`,
})

/** Both plugins, in the given order, the way a host lists them. */
const registerBoth = (order: string[]): Config =>
  order.reduce(
    (config, slug) => registerSeoCollection(config, slug, generators(slug)),
    baseConfig(),
  )

const generateEndpoints = (config: Config) =>
  (config.endpoints ?? []).filter((endpoint) => endpoint.path.startsWith('/plugin-seo/'))

/**
 * Calls a generate endpoint the way Payload does: the first one registered at
 * that path wins. Payload is stubbed just enough for an admin user to pass.
 */
const generate = async (config: Config, path: string, collectionSlug: string) => {
  const endpoint = config.endpoints?.find((route) => route.path === `/plugin-seo/${path}`)
  expect(endpoint).toBeDefined()

  const response = await endpoint!.handler({
    json: () => Promise.resolve({ collectionSlug, doc: {} }),
    payload: {
      collections: { users: { config: {} } },
      config: { admin: { user: 'users' } },
    },
    user: { id: 1, collection: 'users' },
  } as unknown as Parameters<PayloadHandler>[0])

  return ((await response.json()) as { result: string }).result
}

describe('registerSeoCollection', () => {
  test.each([[['pages', 'articles']], [['articles', 'pages']]])(
    'two collections share one set of endpoints, in either order (%j)',
    async (order) => {
      const config = registerBoth(order)

      expect(generateEndpoints(config).map((endpoint) => endpoint.path).sort()).toEqual([
        '/plugin-seo/generate-description',
        '/plugin-seo/generate-image',
        '/plugin-seo/generate-title',
        '/plugin-seo/generate-url',
      ])
      expect(await generate(config, 'generate-url', 'pages')).toBe('https://example.com/pages')
      expect(await generate(config, 'generate-url', 'articles')).toBe(
        'https://example.com/articles',
      )
    },
  )

  test('every generate function routes to the collection of the request', async () => {
    const config = registerBoth(['pages', 'articles'])

    expect(await generate(config, 'generate-title', 'pages')).toBe('pages title')
    expect(await generate(config, 'generate-description', 'articles')).toBe(
      'articles description',
    )
    expect(await generate(config, 'generate-image', 'pages')).toBe('pages-image')
  })

  test('a collection nobody registered is still rejected', async () => {
    const config = registerSeoCollection(baseConfig(), 'pages', generators('pages'))

    await expect(generate(config, 'generate-url', 'articles')).rejects.toThrow()
  })

  test('each collection keeps its own fields, without a second meta group', () => {
    const config = registerBoth(['pages', 'articles'])

    for (const slug of ['pages', 'articles']) {
      const fields = config.collections?.find((c) => c.slug === slug)?.fields ?? []
      expect(fields.filter((field) => (field as { name?: string }).name === 'meta')).toHaveLength(1)
    }
  })

  test('endpoints of the host are left in place', () => {
    const own: Endpoint = { handler: () => new Response(), method: 'get', path: '/own' }
    const config = registerSeoCollection(
      registerSeoCollection({ ...baseConfig(), endpoints: [own] }, 'pages', generators('pages')),
      'articles',
      generators('articles'),
    )

    expect(config.endpoints?.[0]).toBe(own)
    expect(config.endpoints).toHaveLength(5)
  })

  test('the registry lives on config.custom, next to whatever the host put there', () => {
    const config = registerSeoCollection(
      { ...baseConfig(), custom: { theirs: true } },
      'pages',
      generators('pages'),
    )

    expect(config.custom?.theirs).toBe(true)
    expect(Object.keys(config.custom?.[SEO_REGISTRY_KEY] as object)).toEqual(['pages'])
  })
})
