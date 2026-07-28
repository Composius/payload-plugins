import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { RevalidateEvent } from '../src/index.js'

import {
  collectionTag,
  fieldTag,
  idTag,
  resetRevalidateTagsCache,
  revalidateAfterChange,
  revalidateAfterDelete,
  revalidateHooks,
  revalidateTags,
  TAG_MAX_LENGTH,
} from '../src/index.js'

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))

vi.mock('next/cache.js', () => ({ revalidateTag }))

const debug = vi.fn()

const makeReq = () => ({ payload: { logger: { debug } } }) as unknown as PayloadRequest

const changeArgs = (args: {
  context?: Record<string, unknown>
  doc: Record<string, unknown>
  operation?: 'create' | 'update'
  previousDoc?: Record<string, unknown>
}) =>
  ({
    context: args.context ?? {},
    doc: args.doc,
    operation: args.operation ?? 'update',
    previousDoc: args.previousDoc,
    req: makeReq(),
  }) as unknown as Parameters<CollectionAfterChangeHook>[0]

const deleteArgs = (args: { context?: Record<string, unknown>; doc: Record<string, unknown> }) =>
  ({
    context: args.context ?? {},
    doc: args.doc,
    id: args.doc.id,
    req: makeReq(),
  }) as unknown as Parameters<CollectionAfterDeleteHook>[0]

/** The tags handed to `revalidateTag`, in call order. */
const invalidated = (): string[] => revalidateTag.mock.calls.map(([tag]) => tag as string)

beforeEach(() => {
  revalidateTag.mockReset()
  debug.mockReset()
  resetRevalidateTagsCache()
})

describe('tags', () => {
  test('a collection tag is the collection slug', () => {
    expect(collectionTag('articles')).toBe('articles')
  })

  test('a document tag names the field addressing it', () => {
    expect(idTag('articles', 42)).toBe('articles:id:42')
    expect(fieldTag('articles', 'slug', 'hello-world')).toBe('articles:slug:hello-world')
  })
})

describe('revalidateTags', () => {
  test('invalidates every tag with the given profile', async () => {
    const result = await revalidateTags(['articles', 'articles:id:1'], 'max')

    expect(result).toEqual({ tags: ['articles', 'articles:id:1'] })
    expect(revalidateTag.mock.calls).toEqual([
      ['articles', 'max'],
      ['articles:id:1', 'max'],
    ])
  })

  test('deduplicates tags', async () => {
    const result = await revalidateTags(['articles', 'articles'], { expire: 0 })

    expect(result.tags).toEqual(['articles'])
    expect(revalidateTag).toHaveBeenCalledTimes(1)
  })

  test('drops empty tags and tags Next.js would refuse', async () => {
    const result = await revalidateTags(['', 'a'.repeat(TAG_MAX_LENGTH + 1), 'articles'], 'max')

    expect(result.tags).toEqual(['articles'])
  })

  test('returns the failure instead of throwing', async () => {
    const failure = new Error('no request scope')
    revalidateTag.mockImplementation(() => {
      throw failure
    })

    const result = await revalidateTags(['articles'], 'max')

    expect(result).toEqual({ error: failure, tags: [] })
  })

  test('reports one failure per call, not one per tag', async () => {
    revalidateTag.mockImplementation(() => {
      throw new Error('no request scope')
    })

    await revalidateTags(['articles', 'pages'], 'max')

    expect(revalidateTag).toHaveBeenCalledTimes(1)
  })
})

describe('revalidateAfterChange', () => {
  const articles = { collection: 'articles', drafts: true, fields: ['slug'] }

  test('invalidates the collection and the document', async () => {
    const hook = revalidateAfterChange(articles)

    await hook(changeArgs({ doc: { _status: 'published', id: 7, slug: 'hello' } }))

    expect(invalidated()).toEqual(['articles', 'articles:id:7', 'articles:slug:hello'])
  })

  test('expires at once by default, so the next request is served fresh', async () => {
    const hook = revalidateAfterChange(articles)

    await hook(changeArgs({ doc: { _status: 'published', id: 7 } }))

    expect(revalidateTag).toHaveBeenCalledWith('articles', { expire: 0 })
  })

  test('honours a cache profile', async () => {
    const hook = revalidateAfterChange(articles, { profile: 'max' })

    await hook(changeArgs({ doc: { _status: 'published', id: 7 } }))

    expect(revalidateTag).toHaveBeenCalledWith('articles', 'max')
  })

  test('invalidates the former slug of a renamed document', async () => {
    const hook = revalidateAfterChange(articles)

    await hook(
      changeArgs({
        doc: { _status: 'published', id: 7, slug: 'new' },
        previousDoc: { _status: 'published', id: 7, slug: 'old' },
      }),
    )

    expect(invalidated()).toContain('articles:slug:old')
    expect(invalidated()).toContain('articles:slug:new')
  })

  test('invalidates the collections that embed this one', async () => {
    const hook = revalidateAfterChange({
      collection: 'categories',
      fields: ['slug'],
      related: ['articles'],
    })

    await hook(changeArgs({ doc: { id: 3, slug: 'news' } }))

    expect(invalidated()).toEqual([
      'categories',
      'articles',
      'categories:id:3',
      'categories:slug:news',
    ])
  })

  test('adds the tags returned by the tags option', async () => {
    const seen: RevalidateEvent[] = []
    const hook = revalidateAfterChange(articles, {
      tags: (event) => {
        seen.push(event)
        return ['sitemap']
      },
    })

    await hook(changeArgs({ doc: { _status: 'published', id: 7 }, operation: 'create' }))

    expect(invalidated()).toContain('sitemap')
    expect(seen[0]).toMatchObject({ collection: 'articles', operation: 'create' })
  })

  test('skips a draft-only save, which autosave repeats every few seconds', async () => {
    const hook = revalidateAfterChange(articles)

    await hook(
      changeArgs({
        doc: { _status: 'draft', id: 7, slug: 'hello' },
        previousDoc: { _status: 'draft', id: 7, slug: 'hello' },
      }),
    )

    expect(revalidateTag).not.toHaveBeenCalled()
  })

  test('runs when a published document is unpublished', async () => {
    const hook = revalidateAfterChange(articles)

    await hook(
      changeArgs({
        doc: { _status: 'draft', id: 7, slug: 'hello' },
        previousDoc: { _status: 'published', id: 7, slug: 'hello' },
      }),
    )

    expect(invalidated()).toContain('articles:slug:hello')
  })

  test('runs on every save of a collection without drafts', async () => {
    const hook = revalidateAfterChange({ collection: 'menus', fields: ['name'] })

    await hook(changeArgs({ doc: { id: 2, name: 'Main' } }))

    expect(invalidated()).toEqual(['menus', 'menus:id:2', 'menus:name:Main'])
  })

  test('does nothing when the request disables revalidation', async () => {
    const hook = revalidateAfterChange(articles)

    await hook(
      changeArgs({ context: { disableRevalidate: true }, doc: { _status: 'published', id: 7 } }),
    )

    expect(revalidateTag).not.toHaveBeenCalled()
  })

  test('returns the document untouched', async () => {
    const doc = { _status: 'published', id: 7 }

    expect(await revalidateAfterChange(articles)(changeArgs({ doc }))).toBe(doc)
  })

  test('logs a failure rather than letting it roll the write back', async () => {
    revalidateTag.mockImplementation(() => {
      throw new Error('no request scope')
    })

    await revalidateAfterChange(articles)(changeArgs({ doc: { _status: 'published', id: 7 } }))

    expect(debug).toHaveBeenCalledOnce()
  })

  test('hands a failure to onError instead of logging it', async () => {
    const failure = new Error('no request scope')
    revalidateTag.mockImplementation(() => {
      throw failure
    })
    const onError = vi.fn()

    await revalidateAfterChange(articles, { onError })(
      changeArgs({ doc: { _status: 'published', id: 7 } }),
    )

    expect(onError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ collection: 'articles' }),
    )
    expect(debug).not.toHaveBeenCalled()
  })
})

describe('revalidateAfterDelete', () => {
  test('invalidates the collection and the deleted document', async () => {
    const hook = revalidateAfterDelete({ collection: 'pages', drafts: true, fields: ['slug'] })

    await hook(deleteArgs({ doc: { _status: 'draft', id: 4, slug: 'about' } }))

    expect(invalidated()).toEqual(['pages', 'pages:id:4', 'pages:slug:about'])
  })

  test('does nothing when the request disables revalidation', async () => {
    const hook = revalidateAfterDelete({ collection: 'pages' })

    await hook(deleteArgs({ context: { disableRevalidate: true }, doc: { id: 4 } }))

    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('revalidateHooks', () => {
  test('builds one hook per operation', () => {
    const hooks = revalidateHooks({ collection: 'pages' }, {})

    expect(hooks.afterChange).toHaveLength(1)
    expect(hooks.afterDelete).toHaveLength(1)
  })

  test('builds nothing when revalidation is off', () => {
    expect(revalidateHooks({ collection: 'pages' }, false)).toEqual({})
  })
})
