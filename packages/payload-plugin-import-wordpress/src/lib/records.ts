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

export type SaveRecordArgs = RecordLookup & {
  error?: string
  jobId: number | string
  status?: 'done' | 'failed'
  targetCollection?: string
  targetId?: null | number | string
}

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
    where,
    limit: 1,
    depth: 0,
  })

  const doc = docs[0] as undefined | { targetId?: null | string }
  return doc?.targetId != null ? String(doc.targetId) : null
}

/** Upserts an import record (used to mark an entity done or failed). */
export const saveRecord = async (payload: Payload, args: SaveRecordArgs): Promise<void> => {
  await createDoc(payload, {
    collection: RECORDS_SLUG,
    data: {
      job: args.jobId,
      site: args.site,
      sourceType: args.sourceType,
      sourceId: args.sourceId ?? undefined,
      sourceKey: args.sourceKey ?? undefined,
      targetCollection: args.targetCollection,
      targetId: args.targetId != null ? String(args.targetId) : undefined,
      status: args.status ?? 'done',
      error: args.error,
    },
  })
}
