import type { Access, CollectionConfig, Config, Field, SelectField } from 'payload'

import { describe, expect, test } from 'vitest'

import type { ComposiusPayloadPluginRedirectionsConfig } from '../src/index.js'

import { anyone, authenticated } from '../src/defaults.js'
import { ComposiusPayloadPluginRedirections } from '../src/index.js'
import { isSelfRedirect, validateDestination, validateSource } from '../src/lib/validation.js'

const accessArgs = (user: unknown) => ({ req: { user } }) as Parameters<Access>[0]

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const findRedirections = (config: Config, slug = 'redirections'): CollectionConfig => {
  const collection = config.collections?.find((each) => each.slug === slug)
  expect(collection).toBeDefined()
  return collection!
}

const fieldNames = (collection: CollectionConfig): (string | undefined)[] =>
  collection.fields.map((field) => (field as { name?: string }).name)

const findField = (collection: CollectionConfig, name: string): Field => {
  const field = collection.fields.find((each) => (each as { name?: string }).name === name)
  expect(field).toBeDefined()
  return field!
}

const optionValues = (field: Field): string[] =>
  (field as SelectField).options.map((option) =>
    typeof option === 'string' ? option : String(option.value),
  )

describe('access defaults', () => {
  test('anyone always allows', () => {
    expect(anyone(accessArgs(null))).toBe(true)
    expect(anyone(accessArgs({ id: 1 }))).toBe(true)
  })

  test('authenticated allows only requests with a user', () => {
    expect(authenticated(accessArgs({ id: 1 }))).toBe(true)
    expect(authenticated(accessArgs(null))).toBe(false)
  })
})

describe('ComposiusPayloadPluginRedirections', () => {
  test('adds the redirections collection', () => {
    const collection = findRedirections(ComposiusPayloadPluginRedirections()(baseConfig()))

    expect(fieldNames(collection)).toEqual([
      'from',
      'matchType',
      'to',
      'status',
      'preserveQuery',
      'enabled',
      'priority',
    ])
    expect(collection.admin?.useAsTitle).toBe('from')
    expect(collection.admin?.defaultColumns).toEqual([
      'from',
      'matchType',
      'to',
      'status',
      'enabled',
      'updatedAt',
    ])
  })

  test('from and matchType are unique as a pair, not individually', () => {
    const collection = findRedirections(ComposiusPayloadPluginRedirections()(baseConfig()))

    expect(collection.indexes).toEqual([{ fields: ['from', 'matchType'], unique: true }])
    expect((findField(collection, 'from') as { unique?: boolean }).unique).toBeUndefined()
    expect((findField(collection, 'from') as { index?: boolean }).index).toBe(true)
  })

  test('match types are exact, prefix and regex, defaulting to exact', () => {
    const matchType = findField(
      findRedirections(ComposiusPayloadPluginRedirections()(baseConfig())),
      'matchType',
    )

    expect(optionValues(matchType)).toEqual(['exact', 'prefix', 'regex'])
    expect((matchType as SelectField).defaultValue).toBe('exact')
  })

  test('status offers 301/302/307/308 and defaults to 307', () => {
    const status = findField(
      findRedirections(ComposiusPayloadPluginRedirections()(baseConfig())),
      'status',
    )

    expect(optionValues(status)).toEqual(['301', '302', '307', '308'])
    expect((status as SelectField).defaultValue).toBe('307')
  })

  test('preserveQuery and enabled default to true', () => {
    const collection = findRedirections(ComposiusPayloadPluginRedirections()(baseConfig()))

    expect((findField(collection, 'preserveQuery') as { defaultValue?: unknown }).defaultValue).toBe(
      true,
    )
    expect((findField(collection, 'enabled') as { defaultValue?: unknown }).defaultValue).toBe(true)
    expect((findField(collection, 'priority') as { defaultValue?: unknown }).defaultValue).toBe(0)
  })

  test('default access: read is public, writes require a user', () => {
    const collection = findRedirections(ComposiusPayloadPluginRedirections()(baseConfig()))

    expect(collection.access?.read).toBe(anyone)
    expect(collection.access?.create).toBe(authenticated)
    expect(collection.access?.update).toBe(authenticated)
    expect(collection.access?.delete).toBe(authenticated)
  })

  test('custom access overrides replace only the provided operations', () => {
    const create: Access = () => false
    const collection = findRedirections(
      ComposiusPayloadPluginRedirections({ access: { create } })(baseConfig()),
    )

    expect(collection.access?.create).toBe(create)
    expect(collection.access?.read).toBe(anyone)
  })

  test('collection is visible in the admin UI by default', () => {
    expect(
      findRedirections(ComposiusPayloadPluginRedirections()(baseConfig())).admin?.hidden,
    ).toBe(false)
  })

  test('hidden accepts a boolean', () => {
    expect(
      findRedirections(ComposiusPayloadPluginRedirections({ hidden: true })(baseConfig())).admin
        ?.hidden,
    ).toBe(true)
  })

  test('hidden accepts a per-user function', () => {
    const hidden = ({ user }: { user: unknown }) =>
      (user as { role?: string } | null)?.role !== 'admin'
    const config = ComposiusPayloadPluginRedirections({
      hidden: hidden as ComposiusPayloadPluginRedirectionsConfig['hidden'],
    })(baseConfig())

    const configured = findRedirections(config).admin?.hidden as (args: {
      user: unknown
    }) => boolean
    expect(configured({ user: { role: 'admin' } })).toBe(false)
    expect(configured({ user: { role: 'viewer' } })).toBe(true)
  })

  test('slug renames the collection', () => {
    const config = ComposiusPayloadPluginRedirections({ slug: 'url-rules' })(baseConfig())

    findRedirections(config, 'url-rules')
    expect(config.collections?.find((each) => each.slug === 'redirections')).toBeUndefined()
  })

  test('preserves collections added by other plugins', () => {
    const config = {
      collections: [{ fields: [], slug: 'pages' } as CollectionConfig],
    } as unknown as Config

    expect(
      ComposiusPayloadPluginRedirections()(config).collections?.map((each) => each.slug),
    ).toEqual(['pages', 'redirections'])
  })

  test('disabled still registers the collection for schema consistency', () => {
    const collection = findRedirections(
      ComposiusPayloadPluginRedirections({ disabled: true })(baseConfig()),
    )

    // …but stops publishing the rules, so nothing redirects.
    expect(collection.endpoints).toEqual([])
  })
})

describe('the rules endpoint', () => {
  test('is mounted on the collection at /rules', () => {
    const collection = findRedirections(ComposiusPayloadPluginRedirections()(baseConfig()))

    expect(collection.endpoints).toHaveLength(1)
    expect(collection.endpoints).toMatchObject([{ method: 'get', path: '/rules' }])
  })

  test('honors a custom path', () => {
    const collection = findRedirections(
      ComposiusPayloadPluginRedirections({ endpoint: { path: '/all' } })(baseConfig()),
    )

    expect(collection.endpoints).toMatchObject([{ path: '/all' }])
  })

  test('endpoint false keeps the collection but registers no endpoint', () => {
    const collection = findRedirections(
      ComposiusPayloadPluginRedirections({ endpoint: false })(baseConfig()),
    )

    expect(collection.endpoints).toEqual([])
  })
})

describe('validateSource', () => {
  test('accepts a rooted path for exact and prefix rules', () => {
    expect(validateSource('/old', 'exact')).toBeUndefined()
    expect(validateSource('/blog', 'prefix')).toBeUndefined()
  })

  test('rejects a path without a leading slash', () => {
    expect(validateSource('old', 'exact')).toEqual({ code: 'mustStartWithSlash' })
  })

  test('rejects an absolute URL', () => {
    expect(validateSource('https://example.com/old', 'exact')).toEqual({ code: 'mustBeRelative' })
  })

  test('rejects a query string or fragment', () => {
    expect(validateSource('/old?a=1', 'exact')).toEqual({ code: 'noQueryOrHash' })
    expect(validateSource('/old#top', 'exact')).toEqual({ code: 'noQueryOrHash' })
  })

  test('accepts a valid regex and reports the engine error for an invalid one', () => {
    expect(validateSource('^/p/(\\d+)$', 'regex')).toBeUndefined()

    const issue = validateSource('^/p/([', 'regex')
    expect(issue?.code).toBe('invalidRegex')
    expect(issue?.detail).toBeTruthy()
  })

  test('a regex source need not start with a slash', () => {
    expect(validateSource('^/p/\\d+$', 'regex')).toBeUndefined()
  })
})

describe('validateDestination', () => {
  test('accepts http(s) and protocol-relative URLs', () => {
    expect(validateDestination('https://example.com/new')).toBeUndefined()
    expect(validateDestination('http://example.com/new')).toBeUndefined()
    expect(validateDestination('//cdn.example.com/new')).toBeUndefined()
  })

  test('accepts a rooted path', () => {
    expect(validateDestination('/new')).toBeUndefined()
  })

  test('rejects a bare path', () => {
    expect(validateDestination('new')).toEqual({ code: 'mustBeAbsoluteOrRooted' })
  })

  test('rejects a non-http protocol', () => {
    expect(validateDestination('ftp://example.com/new')).toEqual({ code: 'unsupportedProtocol' })
  })
})

describe('isSelfRedirect', () => {
  test('flags an exact rule pointing at its own source', () => {
    expect(isSelfRedirect('/a', '/a', 'exact')).toBe(true)
    expect(isSelfRedirect('/a/', '/a', 'exact')).toBe(true)
  })

  test('leaves prefix and regex rules alone', () => {
    expect(isSelfRedirect('/a', '/a', 'prefix')).toBe(false)
    expect(isSelfRedirect('/a', '/a', 'regex')).toBe(false)
  })

  test('a different destination is not a self-redirect', () => {
    expect(isSelfRedirect('/a', '/b', 'exact')).toBe(false)
  })
})
