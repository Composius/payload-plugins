import type { Payload } from 'payload'

import type { ImportError, ImportedItem } from '../types.js'
import type { WPCategory } from './wpTypes.js'

import { coerceId } from './id.js'
import { createDoc } from './payloadOps.js'
import { decodeEntities } from './url.js'
import { findDoneRecord, saveRecord } from './records.js'

/**
 * Orders categories so every parent precedes its children (WordPress `parent`
 * is `0` for roots). Cycles/ophans are appended at the end. Pure — unit-tested.
 */
export const sortCategoriesParentsFirst = (categories: WPCategory[]): WPCategory[] => {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const sorted: WPCategory[] = []
  const placed = new Set<number>()

  const place = (cat: WPCategory, stack: Set<number>): void => {
    if (placed.has(cat.id) || stack.has(cat.id)) {
      return
    }
    stack.add(cat.id)
    const parent = cat.parent && cat.parent !== 0 ? byId.get(cat.parent) : undefined
    if (parent) {
      place(parent, stack)
    }
    stack.delete(cat.id)
    if (!placed.has(cat.id)) {
      placed.add(cat.id)
      sorted.push(cat)
    }
  }

  for (const cat of categories) {
    place(cat, new Set())
  }
  return sorted
}

export type ImportCategoriesArgs = {
  categories: WPCategory[]
  categoriesSlug: string
  dryRun: boolean
  jobId: number | string
  site: string
}

export type ImportCategoriesResult = {
  errors: ImportError[]
  imported: ImportedItem[]
  /** WordPress category id → Payload category id. */
  idMap: Map<number, number | string>
}

/** Imports categories preserving hierarchy; idempotent via import records. */
export const importCategories = async (
  payload: Payload,
  args: ImportCategoriesArgs,
): Promise<ImportCategoriesResult> => {
  const idMap = new Map<number, number | string>()
  const imported: ImportedItem[] = []
  const errors: ImportError[] = []
  const ordered = sortCategoriesParentsFirst(args.categories)

  for (const cat of ordered) {
    try {
      const existing = await findDoneRecord(payload, {
        site: args.site,
        sourceId: cat.id,
        sourceType: 'category',
      })
      if (existing) {
        idMap.set(cat.id, coerceId(existing))
        continue
      }

      const name = decodeEntities(cat.name ?? cat.slug ?? `category-${cat.id}`)

      if (args.dryRun) {
        imported.push({ sourceId: cat.id, targetId: 'dry-run', title: name })
        continue
      }

      const parentId = cat.parent && cat.parent !== 0 ? idMap.get(cat.parent) : undefined

      const created = await createDoc(payload, {
        collection: args.categoriesSlug,
        data: {
          name,
          ...(cat.slug ? { slug: cat.slug } : {}),
          ...(parentId != null ? { parent: coerceId(parentId) } : {}),
          ...(cat.description ? { description: decodeEntities(cat.description) } : {}),
        },
      })

      const rawId = created.id
      idMap.set(cat.id, rawId)
      imported.push({ sourceId: cat.id, targetId: rawId, title: name })
      await saveRecord(payload, {
        jobId: args.jobId,
        site: args.site,
        sourceId: cat.id,
        sourceType: 'category',
        targetCollection: args.categoriesSlug,
        targetId: rawId,
      })
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : String(error),
        scope: 'category',
        sourceId: cat.id,
      })
    }
  }

  return { errors, idMap, imported }
}
