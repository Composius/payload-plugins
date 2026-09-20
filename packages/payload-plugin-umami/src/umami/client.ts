import type { UmamiPoint, UmamiSeries, UmamiStats } from '../types.js'

export type UmamiCredentials = {
  /** Umami Cloud API key (`x-umami-api-key`). Takes precedence over username/password. */
  apiKey?: string
  /** API base URL. Defaults to Umami Cloud (`https://api.umami.is`). */
  baseUrl?: string
  /** Self-hosted password. */
  password?: string
  /** IANA timezone for time-series buckets. Defaults to the server timezone. */
  timezone?: string
  /** Self-hosted username (used with `password`). */
  username?: string
  websiteId: string
}

const CLOUD_BASE = 'https://api.umami.is'

/**
 * Top-pages metric type. Umami v3 removed `url` in favor of `path`
 * (breaking change from v2). Targets v3.x.
 */
const TOP_PAGES_METRIC = 'path'

export class UmamiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'UmamiError'
    this.status = status
  }
}

export type UmamiClient = {
  getSeries: (
    startAt: number,
    endAt: number,
    unit: 'day' | 'hour',
  ) => Promise<UmamiSeries>
  getStats: (startAt: number, endAt: number) => Promise<UmamiStats>
  getTopCountries: (startAt: number, endAt: number, limit?: number) => Promise<UmamiPoint[]>
  getTopPages: (startAt: number, endAt: number, limit?: number) => Promise<UmamiPoint[]>
}

/**
 * Server-side Umami API client. Supports both Umami Cloud (`x-umami-api-key`)
 * and self-hosted (login → cached Bearer token, re-auth once on 401).
 * Credentials never leave this module — the browser talks to the Payload
 * proxy endpoint, not to Umami.
 */
export const createUmamiClient = (credentials: UmamiCredentials): UmamiClient => {
  const { apiKey, baseUrl, password, timezone, username, websiteId } = credentials
  const isCloud = Boolean(apiKey)
  // Cloud data endpoints live under /v1; self-hosted under /api.
  const root = `${(baseUrl ?? CLOUD_BASE).replace(/\/$/, '')}${isCloud ? '/v1' : '/api'}`
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  let token: null | string = null

  const login = async (): Promise<string> => {
    const response = await fetch(`${(baseUrl ?? CLOUD_BASE).replace(/\/$/, '')}/api/auth/login`, {
      body: JSON.stringify({ password, username }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    if (!response.ok) {
      throw new UmamiError(`Umami login failed (${response.status})`, response.status)
    }
    const data = (await response.json()) as { token: string }
    token = data.token
    return token
  }

  const authHeader = async (): Promise<Record<string, string>> => {
    if (isCloud) {
      return { 'x-umami-api-key': apiKey as string }
    }
    if (!token) {
      await login()
    }
    return { Authorization: `Bearer ${token}` }
  }

  const request = async <T>(path: string, params: Record<string, number | string>): Promise<T> => {
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString()
    const url = `${root}/websites/${websiteId}${path}?${query}`

    const send = async () =>
      fetch(url, { headers: { Accept: 'application/json', ...(await authHeader()) } })

    let response = await send()

    // Self-hosted Bearer tokens expire; re-authenticate once on 401.
    if (response.status === 401 && !isCloud) {
      token = null
      response = await send()
    }

    if (!response.ok) {
      throw new UmamiError(`Umami request failed (${response.status})`, response.status)
    }

    return (await response.json()) as T
  }

  return {
    getSeries: (startAt, endAt, unit) =>
      request<UmamiSeries>('/pageviews', { endAt, startAt, timezone: tz, unit }),
    getStats: (startAt, endAt) => request<UmamiStats>('/stats', { endAt, startAt }),
    getTopCountries: (startAt, endAt, limit = 5) =>
      request<UmamiPoint[]>('/metrics', { type: 'country', endAt, limit, startAt }),
    getTopPages: (startAt, endAt, limit = 5) =>
      request<UmamiPoint[]>('/metrics', { type: TOP_PAGES_METRIC, endAt, limit, startAt }),
  }
}
