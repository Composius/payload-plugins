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
  /** Content types a download may declare. Anything else is rejected. */
  allowedMimeTypes: string[]
  alt?: string
  /** Preferred canonical key for dedupe (defaults to the derived original URL). */
  cache: Map<string, ImageImportResult>
  dryRun: boolean
  fetchImpl?: typeof fetch
  jobId: number | string
  /** Largest accepted download, in bytes. */
  maxBytes: number
  mediaSlug: string
  site: string
  /** WordPress media id, when known. */
  sourceId?: number
  timeoutMs: number
  url: string
}

type DownloadLimits = {
  allowedMimeTypes: string[]
  maxBytes: number
}

/**
 * Fetches one image.
 *
 * What comes back is attacker-controlled as soon as the source site is: the
 * declared content type is what the media collection's `mimeTypes` gate is
 * checked against, and the body is buffered in memory. So the type has to be
 * one the caller allows — an unknown one is rejected rather than guessed at —
 * and the body is abandoned once it passes the size limit.
 */
const download = async (
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  { allowedMimeTypes, maxBytes }: DownloadLimits,
): Promise<{ buffer: Buffer; mimeType: string }> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`image download failed: ${res.status}`)
    }

    const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(`image download rejected: unsupported content type "${mimeType || 'none'}"`)
    }

    // A declared length over the cap settles it without reading a byte; a
    // missing or lying one is caught while streaming.
    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`image download rejected: ${declared} bytes exceeds the ${maxBytes} limit`)
    }

    const buffer = await readCapped(res, maxBytes, controller)
    return { buffer, mimeType }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Reads the body, giving up as soon as it passes `maxBytes`. Falls back to
 * buffering whole when the response has no readable stream — a plain `Response`
 * built by a test double, say — where the length is already known anyway.
 */
const readCapped = async (
  res: Response,
  maxBytes: number,
  controller: AbortController,
): Promise<Buffer> => {
  const body = res.body

  if (!body?.getReader) {
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length > maxBytes) {
      throw new Error(`image download rejected: exceeds the ${maxBytes} byte limit`)
    }
    return buffer
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (!value) {
      continue
    }

    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      controller.abort()
      throw new Error(`image download rejected: exceeds the ${maxBytes} byte limit`)
    }

    chunks.push(value)
  }

  return Buffer.concat(chunks)
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
    const limits = { allowedMimeTypes: args.allowedMimeTypes, maxBytes: args.maxBytes }

    // Prefer the original; fall back to the (possibly resized) URL WordPress gave us.
    let downloaded
    try {
      downloaded = await download(canonical, args.timeoutMs, fetchImpl, limits)
    } catch {
      downloaded = await download(args.url, args.timeoutMs, fetchImpl, limits)
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
