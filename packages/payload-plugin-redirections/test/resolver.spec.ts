import { describe, expect, test } from 'vitest'

import type { RedirectionRule } from '../src/types.js'

import { resolveRedirection } from '../src/lib/resolver.js'

const rule = (overrides: Partial<RedirectionRule> & Pick<RedirectionRule, 'from' | 'to'>): RedirectionRule => ({
  matchType: 'exact',
  preserveQuery: true,
  status: 301,
  ...overrides,
})

describe('precedence', () => {
  const rules = [
    rule({ from: '^/thing$', matchType: 'regex', to: '/from-regex' }),
    rule({ from: '/thing', matchType: 'prefix', to: '/from-prefix' }),
    rule({ from: '/thing', matchType: 'exact', to: '/from-exact' }),
  ]

  test('exact wins over prefix and regex', () => {
    expect(resolveRedirection('/thing', rules)?.to).toBe('/from-exact')
  })

  test('prefix wins over regex when no exact rule matches', () => {
    expect(resolveRedirection('/thing', rules.slice(0, 2))?.to).toBe('/from-prefix')
  })

  test('regex is the last resort', () => {
    expect(resolveRedirection('/thing', rules.slice(0, 1))?.to).toBe('/from-regex')
  })

  test('an empty rule list resolves to nothing', () => {
    expect(resolveRedirection('/thing', [])).toBeUndefined()
  })

  test('a non-matching path resolves to nothing', () => {
    expect(resolveRedirection('/other', rules)).toBeUndefined()
  })
})

describe('exact matching', () => {
  const rules = [rule({ from: '/old', to: '/new' })]

  test('matches the same path', () => {
    expect(resolveRedirection('/old', rules)?.to).toBe('/new')
  })

  test('ignores a trailing slash on the request', () => {
    expect(resolveRedirection('/old/', rules)?.to).toBe('/new')
  })

  test('ignores a trailing slash on the rule', () => {
    expect(resolveRedirection('/old', [rule({ from: '/old/', to: '/new' })])?.to).toBe('/new')
  })

  test('normalizes a rule source without a leading slash', () => {
    expect(resolveRedirection('/old', [rule({ from: 'old', to: '/new' })])?.to).toBe('/new')
  })

  test('collapses repeated slashes in the request', () => {
    expect(resolveRedirection('//old', rules)?.to).toBe('/new')
  })

  test('the incoming query takes no part in matching', () => {
    expect(resolveRedirection('/old', rules, '?ref=x')?.to).toBe('/new?ref=x')
  })
})

describe('prefix matching', () => {
  const rules = [rule({ from: '/blog', matchType: 'prefix', to: '/articles' })]

  test('matches the prefix itself', () => {
    expect(resolveRedirection('/blog', rules)?.to).toBe('/articles')
  })

  test('appends the remainder', () => {
    expect(resolveRedirection('/blog/a/b', rules)?.to).toBe('/articles/a/b')
  })

  test('is segment-aware: /blog does not match /blogging', () => {
    expect(resolveRedirection('/blogging', rules)).toBeUndefined()
  })

  test('the longest prefix wins regardless of list order', () => {
    const ordered = [
      rule({ from: '/blog', matchType: 'prefix', to: '/short' }),
      rule({ from: '/blog/2024', matchType: 'prefix', to: '/long' }),
    ]
    expect(resolveRedirection('/blog/2024/hello', ordered)?.to).toBe('/long/hello')
    expect(resolveRedirection('/blog/2024/hello', [...ordered].reverse())?.to).toBe('/long/hello')
  })

  test('equal-length prefixes fall back to list order', () => {
    const ordered = [
      rule({ from: '/aaa', matchType: 'prefix', to: '/first' }),
      rule({ from: '/aaa', matchType: 'prefix', to: '/second' }),
    ]
    expect(resolveRedirection('/aaa/x', ordered)?.to).toBe('/first/x')
  })

  test('a root prefix maps everything', () => {
    const root = [rule({ from: '/', matchType: 'prefix', to: 'https://new.example.com' })]
    expect(resolveRedirection('/a/b', root)?.to).toBe('https://new.example.com/a/b')
  })

  test('the remainder lands on the path, keeping the destination query and hash', () => {
    const withExtras = [rule({ from: '/blog', matchType: 'prefix', to: '/articles?utm=1#top' })]
    expect(resolveRedirection('/blog/hello', withExtras)?.to).toBe('/articles/hello?utm=1#top')
  })

  test('a trailing slash on the destination is not doubled', () => {
    const trailing = [rule({ from: '/blog', matchType: 'prefix', to: '/articles/' })]
    expect(resolveRedirection('/blog/hello', trailing)?.to).toBe('/articles/hello')
  })
})

describe('regex matching', () => {
  test('substitutes numbered captures', () => {
    const rules = [rule({ from: '^/p/(\\d+)/(.*)$', matchType: 'regex', to: '/posts/$2-$1' })]
    expect(resolveRedirection('/p/12/hello', rules)?.to).toBe('/posts/hello-12')
  })

  test('$& is the whole match', () => {
    const rules = [rule({ from: '^/p/.*$', matchType: 'regex', to: '/archive$&' })]
    expect(resolveRedirection('/p/12', rules)?.to).toBe('/archive/p/12')
  })

  test('$$ is a literal dollar sign', () => {
    const rules = [rule({ from: '^/price$', matchType: 'regex', to: '/cost-$$' })]
    expect(resolveRedirection('/price', rules)?.to).toBe('/cost-$')
  })

  test('a group that did not participate resolves to an empty string', () => {
    const rules = [rule({ from: '^/p/(\\d+)$', matchType: 'regex', to: '/posts/$1$9' })]
    expect(resolveRedirection('/p/12', rules)?.to).toBe('/posts/12')
  })

  test('an invalid pattern is skipped, never thrown', () => {
    const rules = [
      rule({ from: '^/p/([', matchType: 'regex', to: '/broken' }),
      rule({ from: '^/p/(\\d+)$', matchType: 'regex', to: '/posts/$1' }),
    ]
    expect(() => resolveRedirection('/p/12', rules)).not.toThrow()
    expect(resolveRedirection('/p/12', rules)?.to).toBe('/posts/12')
  })

  test('the first matching regex in list order wins', () => {
    const rules = [
      rule({ from: '^/p/.*$', matchType: 'regex', to: '/first' }),
      rule({ from: '^/p/(\\d+)$', matchType: 'regex', to: '/second' }),
    ]
    expect(resolveRedirection('/p/12', rules)?.to).toBe('/first')
  })

  test('patterns are tested against the normalized pathname', () => {
    const rules = [rule({ from: '^/p/(\\d+)$', matchType: 'regex', to: '/posts/$1' })]
    expect(resolveRedirection('/p/12/', rules)?.to).toBe('/posts/12')
  })
})

describe('query handling', () => {
  test('preserveQuery forwards the incoming search', () => {
    const rules = [rule({ from: '/old', to: '/new' })]
    expect(resolveRedirection('/old', rules, '?a=1&b=2')?.to).toBe('/new?a=1&b=2')
  })

  test('a search without its leading ? is normalized', () => {
    const rules = [rule({ from: '/old', to: '/new' })]
    expect(resolveRedirection('/old', rules, 'a=1')?.to).toBe('/new?a=1')
  })

  test('preserveQuery false drops the incoming search', () => {
    const rules = [rule({ from: '/old', preserveQuery: false, to: '/new' })]
    expect(resolveRedirection('/old', rules, '?a=1')?.to).toBe('/new')
  })

  test('a destination with its own query is left alone', () => {
    const rules = [rule({ from: '/old', to: '/new?keep=1' })]
    expect(resolveRedirection('/old', rules, '?a=1')?.to).toBe('/new?keep=1')
  })

  test('the destination hash stays after the appended query', () => {
    const rules = [rule({ from: '/old', to: '/new#top' })]
    expect(resolveRedirection('/old', rules, '?a=1')?.to).toBe('/new?a=1#top')
  })

  test('an undefined preserveQuery behaves as true', () => {
    const partial = { from: '/old', matchType: 'exact', status: 301, to: '/new' } as RedirectionRule
    expect(resolveRedirection('/old', [partial], '?a=1')?.to).toBe('/new?a=1')
  })
})

describe('destinations', () => {
  test('absolute URLs are passed through', () => {
    const rules = [rule({ from: '/old', to: 'https://other.example.com/new' })]
    expect(resolveRedirection('/old', rules)?.to).toBe('https://other.example.com/new')
  })

  test('protocol-relative URLs are treated as absolute', () => {
    const rules = [rule({ from: '/old', to: '//cdn.example.com/new' })]
    expect(resolveRedirection('/old', rules)?.to).toBe('//cdn.example.com/new')
  })

  test('the status comes from the matched rule', () => {
    for (const status of [301, 302, 307, 308] as const) {
      const rules = [rule({ from: '/old', status, to: '/new' })]
      expect(resolveRedirection('/old', rules)?.status).toBe(status)
    }
  })

  test('the matched rule is returned alongside the destination', () => {
    const matched = rule({ from: '/old', to: '/new' })
    expect(resolveRedirection('/old', [matched])?.rule).toBe(matched)
  })
})

describe('self-redirect and loop protection', () => {
  test('a rule pointing at its own source resolves to nothing', () => {
    expect(resolveRedirection('/a', [rule({ from: '/a', to: '/a' })])).toBeUndefined()
  })

  test('a self-redirect is skipped so a later rule can still answer', () => {
    const rules = [
      rule({ from: '/a', to: '/a' }),
      rule({ from: '/a', matchType: 'prefix', to: '/b' }),
    ]
    expect(resolveRedirection('/a', rules)?.to).toBe('/b')
  })

  test('a same-origin absolute destination counts as self when origin is given', () => {
    const rules = [rule({ from: '/a', to: 'https://example.com/a' })]
    expect(resolveRedirection('/a', rules, '', { origin: 'https://example.com' })).toBeUndefined()
    expect(resolveRedirection('/a', rules)?.to).toBe('https://example.com/a')
  })

  test('a destination differing only by query is not a self-redirect', () => {
    const rules = [rule({ from: '/a', preserveQuery: false, to: '/a?x=1' })]
    expect(resolveRedirection('/a', rules)?.to).toBe('/a?x=1')
  })
})

describe('chained rules', () => {
  const chain = [
    rule({ from: '/a', to: '/b' }),
    rule({ from: '/b', to: '/c' }),
  ]

  test('maxHops defaults to a single hop', () => {
    expect(resolveRedirection('/a', chain)?.to).toBe('/b')
  })

  test('maxHops collapses a chain, keeping the first rule status', () => {
    const statuses = [
      rule({ from: '/a', status: 302, to: '/b' }),
      rule({ from: '/b', status: 308, to: '/c' }),
    ]
    const result = resolveRedirection('/a', statuses, '', { maxHops: 3 })
    expect(result?.to).toBe('/c')
    expect(result?.status).toBe(302)
  })

  test('a cycle terminates and keeps the last good result', () => {
    const cycle = [rule({ from: '/a', to: '/b' }), rule({ from: '/b', to: '/a' })]
    const result = resolveRedirection('/a', cycle, '', { maxHops: 5 })
    expect(result?.to).toBe('/a')
  })

  test('a cross-origin destination ends the walk', () => {
    const external = [
      rule({ from: '/a', to: 'https://other.example.com/b' }),
      rule({ from: '/b', to: '/c' }),
    ]
    expect(resolveRedirection('/a', external, '', { maxHops: 3 })?.to).toBe(
      'https://other.example.com/b',
    )
  })

  test('a same-origin absolute destination is followed when origin is given', () => {
    const sameOrigin = [
      rule({ from: '/a', to: 'https://example.com/b' }),
      rule({ from: '/b', to: '/c' }),
    ]
    expect(
      resolveRedirection('/a', sameOrigin, '', { maxHops: 3, origin: 'https://example.com' })?.to,
    ).toBe('/c')
  })
})
