import type { Payload } from 'payload'

import { RECORDS_SLUG } from '../defaults.js'
import { createDoc, findDocs } from './payloadOps.js'

export type SourceType = 'author' | 'category' | 'media' | 'post'

export type RecordLookup = {
  site: string
  sourceId?: null | number
  sourceKey?: null | string
  sourceType: SourceType
}

export type SaveRecordArgs = {
  error?: string
  jobId: number | string
  status?: 'done' | 'failed'
  targetCollection?: string
  targetId?: null | number | string
} & RecordLookup

/**
 * Finds a completed import record for a source entity. Media are matched by
 * `sourceKey` (the original image URL) so an image reused across posts is only
 * uploaded once; everything else is matched by `sourceId`. Returns the mapped
 * target id (as a string) or `null`.
 *
 * Reads/writes deliberately omit `req` so each commits independently — a crash
 * mid-import leaves earlier work durable and the run resumes from these records.
 */
export const findDoneRecord = async (
  payload: Payload,
  lookup: RecordLookup,
): Promise<null | string> => {
  const where =
    lookup.sourceType === 'media' && lookup.sourceKey
      ? {
          and: [
            { site: { equals: lookup.site } },
            { sourceType: { equals: 'media' } },
            { sourceKey: { equals: lookup.sourceKey } },
            { status: { equals: 'done' } },
          ],
        }
      : {
          and: [
            { site: { equals: lookup.site } },
            { sourceType: { equals: lookup.sourceType } },
            { sourceId: { equals: lookup.sourceId } },
            { status: { equals: 'done' } },
          ],
        }

  const { docs } = await findDocs(payload, {
    collection: RECORDS_SLUG,
    depth: 0,
    limit: 1,
    where,
  })

  const doc = docs[0] as { targetId?: null | string } | undefined
  return doc?.targetId != null ? String(doc.targetId) : null
}

/** Upserts an import record (used to mark an entity done or failed). */
export const saveRecord = async (payload: Payload, args: SaveRecordArgs): Promise<void> => {
  await createDoc(payload, {
    collection: RECORDS_SLUG,
    data: {
      error: args.error,
      job: args.jobId,
      site: args.site,
      sourceId: args.sourceId ?? undefined,
      sourceKey: args.sourceKey ?? undefined,
      sourceType: args.sourceType,
      status: args.status ?? 'done',
      targetCollection: args.targetCollection,
      targetId: args.targetId != null ? String(args.targetId) : undefined,
    },
  })
}
