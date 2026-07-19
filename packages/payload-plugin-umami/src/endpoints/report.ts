import type { Access, Endpoint, PayloadRequest } from 'payload'

import { APIError } from 'payload'

import type { UmamiReport } from '../types.js'
import type { UmamiCredentials } from '../umami/client.js'

import { isUmamiRange, rangeToWindow } from '../range.js'
import { createUmamiClient, UmamiError } from '../umami/client.js'

export const REPORT_PATH = '/plugin-umami/report'

/**
 * Builds the GET `/api/plugin-umami/report` endpoint. It authenticates the
 * admin user, resolves the requested range into a Umami time window, fetches
 * stats + top pages + top countries + the time series server-side, and returns
 * them as one combined report. Umami credentials stay on the server.
 */
export const reportEndpoint = (
  credentials: UmamiCredentials,
  defaultRange: UmamiReport['range'],
  readAccess: Access,
): Endpoint => {
  // Created once so the self-hosted Bearer token is cached across requests.
  const client = createUmamiClient(credentials)

  return {
    path: REPORT_PATH,
    method: 'get',
    handler: async (req: PayloadRequest): Promise<Response> => {
      if (!req.user) {
        throw new APIError('Unauthorized', 401)
      }

      // Same access rule that gates the dashboard widget.
      if (!(await readAccess({ req }))) {
        throw new APIError('Forbidden', 403)
      }

      const requested = req.query?.range
      const range = isUmamiRange(requested) ? requested : defaultRange
      const { endAt, startAt, unit } = rangeToWindow(range)
      // The period immediately before the selected range, same length.
      const prevStartAt = startAt - (endAt - startAt)

      try {
        const [stats, prevStats, topPages, topCountries, series] = await Promise.all([
          client.getStats(startAt, endAt),
          client.getStats(prevStartAt, startAt),
          client.getTopPages(startAt, endAt),
          client.getTopCountries(startAt, endAt),
          client.getSeries(startAt, endAt, unit),
        ])

        const report: UmamiReport = { range, stats, prevStats, topPages, topCountries, series }
        return Response.json(report)
      } catch (error) {
        const status = error instanceof UmamiError ? error.status : 502
        req.payload.logger.error(
          { err: error, plugin: '@composius/payload-plugin-umami' },
          'Failed to fetch Umami report',
        )
        return Response.json({ error: 'Failed to fetch Umami analytics' }, { status })
      }
    },
  }
}
