import type { Payload } from 'payload'

/**
 * Loosely-typed wrappers around the Payload Local API. This plugin operates on
 * collection slugs the host configures at runtime, so the generated
 * `CollectionSlug` unions don't apply — these helpers centralize the casts
 * instead of scattering them across every call site.
 */

export type AnyDoc = { id: number | string; [key: string]: unknown }

type CreateArgs = {
  collection: string
  data: Record<string, unknown>
  file?: { data: Buffer; mimetype: string; name: string; size: number }
  overrideAccess?: boolean
}

type FindArgs = {
  collection: string
  depth?: number
  limit?: number
  overrideAccess?: boolean
  select?: Record<string, unknown>
  where?: unknown
}

export const createDoc = (payload: Payload, args: CreateArgs): Promise<AnyDoc> =>
  (payload.create as (a: unknown) => Promise<AnyDoc>)({ overrideAccess: true, ...args })

export const findDocs = (
  payload: Payload,
  args: FindArgs,
): Promise<{ docs: AnyDoc[]; totalDocs: number }> =>
  (payload.find as (a: unknown) => Promise<{ docs: AnyDoc[]; totalDocs: number }>)({
    overrideAccess: true,
    ...args,
  })

export const countDocs = (
  payload: Payload,
  args: { collection: string; overrideAccess?: boolean; where?: unknown },
): Promise<{ totalDocs: number }> =>
  (payload.count as (a: unknown) => Promise<{ totalDocs: number }>)({
    overrideAccess: true,
    ...args,
  })

export const findDoc = (
  payload: Payload,
  args: { collection: string; depth?: number; id: number | string; overrideAccess?: boolean },
): Promise<AnyDoc> =>
  (payload.findByID as (a: unknown) => Promise<AnyDoc>)({ overrideAccess: true, ...args })

export const updateDoc = (
  payload: Payload,
  args: {
    collection: string
    context?: Record<string, unknown>
    data: Record<string, unknown>
    id: number | string
    overrideAccess?: boolean
  },
): Promise<AnyDoc> =>
  (payload.update as (a: unknown) => Promise<AnyDoc>)({ overrideAccess: true, ...args })
