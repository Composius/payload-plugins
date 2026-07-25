import type { RequestOptions } from '../types.js'
import type { WPCategory, WPMedia, WPPost, WPUser } from './wpTypes.js'

/** Normalizes a site URL into its `/wp-json/wp/v2` REST base (no trailing slash). */
export const restBase = (siteUrl: string): string => {
  const trimmed = siteUrl.trim().replace(/\/+$/, '')
  return `${trimmed}/wp-json/wp/v2`
}

/** WordPress user + application password (Users → Profile → Application Passwords). */
export type WPCredentials = {
  applicationPassword?: null | string
  username?: null | string
}

export type WPClient = {
  /** Whether requests carry Basic auth (credentials were provided). */
  authenticated: boolean
  fetchCategories: () => Promise<WPCategory[]>
  fetchMedia: (id: number) => Promise<null | WPMedia>
  fetchPostsPage: (args: {
    after?: string
    before?: string
    page: number
    perPage: number
  }) => Promise<{ posts: WPPost[]; totalPages: number }>
  fetchUser: (id: number) => Promise<null | WPUser>
}

export class WPRequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'WPRequestError'
    this.status = status
  }
}

export const createWPClient = (
  siteUrl: string,
  request: Pick<Required<RequestOptions>, 'timeoutMs'> &
    Pick<RequestOptions, 'userAgent'> & { credentials?: null | WPCredentials },
  fetchImpl: typeof fetch = fetch,
): WPClient => {
  const base = restBase(siteUrl)

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (request.userAgent) {
    headers['User-Agent'] = request.userAgent
  }

  // WordPress application passwords authenticate via HTTP Basic auth, which
  // unlocks non-public data (e.g. author emails via ?context=edit).
  const { applicationPassword, username } = request.credentials ?? {}
  const authenticated = Boolean(username && applicationPassword)
  if (authenticated) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString('base64')}`
  }

  const get = async (path: string): Promise<{ body: unknown; totalPages: number }> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), request.timeoutMs)
    try {
      const res = await fetchImpl(`${base}${path}`, { headers, signal: controller.signal })
      if (!res.ok) {
        throw new WPRequestError(`WordPress request failed: ${res.status} ${path}`, res.status)
      }
      const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? '1') || 1
      const body = await res.json()
      return { body, totalPages }
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    authenticated,
    fetchPostsPage: async ({ after, before, page, perPage }) => {
      const params = new URLSearchParams({
        _embed: '1',
        page: String(page),
        per_page: String(perPage),
        status: 'publish',
      })
      if (after) {
        params.set('after', after)
      }
      if (before) {
        params.set('before', before)
      }
      const { body, totalPages } = await get(`/posts?${params.toString()}`)
      return { posts: (body as WPPost[]) ?? [], totalPages }
    },
    fetchCategories: async () => {
      const all: WPCategory[] = []
      let page = 1
      let totalPages = 1
      do {
        const { body, totalPages: tp } = await get(`/categories?per_page=100&page=${page}`)
        all.push(...((body as WPCategory[]) ?? []))
        totalPages = tp
        page += 1
      } while (page <= totalPages)
      return all
    },
    fetchMedia: async (id) => {
      try {
        const { body } = await get(`/media/${id}`)
        return body as WPMedia
      } catch {
        return null
      }
    },
    fetchUser: async (id) => {
      // context=edit exposes non-public fields (email) but needs auth.
      if (authenticated) {
        try {
          const { body } = await get(`/users/${id}?context=edit`)
          return body as WPUser
        } catch {
          // Fall through to the public representation.
        }
      }
      try {
        const { body } = await get(`/users/${id}`)
        return body as WPUser
      } catch {
        return null
      }
    },
  }
}
