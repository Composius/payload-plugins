import type { Payload } from 'payload'

import { createDoc } from './payloadOps.js'
import { deriveOriginalImageUrl, filenameOf } from './url.js'
import { findDoneRecord, saveRecord } from './records.js'

export type ImageImportResult = {
  error?: string
  mediaId: null | string
  reused: boolean
  uploaded: boolean
}

export type ImportImageArgs = {
  alt?: string
  /** Preferred canonical key for dedupe (defaults to the derived original URL). */
  cache: Map<string, ImageImportResult>
  dryRun: boolean
  fetchImpl?: typeof fetch
  jobId: number | string
  mediaSlug: string
  site: string
  /** WordPress media id, when known. */
  sourceId?: number
  timeoutMs: number
  url: string
}

const download = async (
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ buffer: Buffer; mimeType: string }> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`image download failed: ${res.status}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
    return { buffer: Buffer.from(arrayBuffer), mimeType }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Imports one image, uploading the original (full-size) version and reusing an
 * already-imported copy. Dedupe is by the derived original URL: within a run via
 * `cache`, across runs via `wp-import-records`. In dry-run mode it resolves
 * reuse but performs no download or write.
 */
export const importImage = async (
  payload: Payload,
  args: ImportImageArgs,
): Promise<ImageImportResult> => {
  const fetchImpl = args.fetchImpl ?? fetch
  const canonical = deriveOriginalImageUrl(args.url)

  const cached = args.cache.get(canonical)
  if (cached) {
    return { ...cached, reused: true, uploaded: false }
  }

  // Already imported by a previous run?
  const existing = await findDoneRecord(payload, {
    site: args.site,
    sourceKey: canonical,
    sourceType: 'media',
  })
  if (existing) {
    const result: ImageImportResult = { mediaId: existing, reused: true, uploaded: false }
    args.cache.set(canonical, result)
    return result
  }

  if (args.dryRun) {
    // Report intent without writing; mark cached so the same image is planned once.
    const result: ImageImportResult = { mediaId: null, reused: false, uploaded: true }
    args.cache.set(canonical, result)
    return result
  }

  try {
    // Prefer the original; fall back to the (possibly resized) URL WordPress gave us.
    let downloaded
    try {
      downloaded = await download(canonical, args.timeoutMs, fetchImpl)
    } catch {
      downloaded = await download(args.url, args.timeoutMs, fetchImpl)
    }

    const created = await createDoc(payload, {
      collection: args.mediaSlug,
      data: { alt: args.alt || filenameOf(canonical) },
      file: {
        data: downloaded.buffer,
        mimetype: downloaded.mimeType,
        name: filenameOf(canonical),
        size: downloaded.buffer.length,
      },
    })

    const mediaId = String(created.id)
    await saveRecord(payload, {
      jobId: args.jobId,
      site: args.site,
      sourceId: args.sourceId ?? null,
      sourceKey: canonical,
      sourceType: 'media',
      targetCollection: args.mediaSlug,
      targetId: mediaId,
    })

    const result: ImageImportResult = { mediaId, reused: false, uploaded: true }
    args.cache.set(canonical, result)
    return result
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      mediaId: null,
      reused: false,
      uploaded: false,
    }
  }
}
