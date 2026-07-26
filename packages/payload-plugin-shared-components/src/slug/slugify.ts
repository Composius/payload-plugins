import type { Slugify } from 'payload/shared'
import slugifyString from 'slugify'

/**
 * Payload's built-in slugify strips anything outside `[\w-]`, which drops
 * accented letters entirely ("nouveautés" → "nouveauts"). Transliterating
 * first keeps the letter instead ("nouveautés" → "nouveautes").
 *
 * `remove` mirrors Payload's filter so underscores survive, as they do in the
 * built-in behaviour.
 */
export const slugifyValue = (val?: string): string | undefined =>
  val ? slugifyString(val, { lower: true, remove: /[^\w\s-]/g }) : val

/** Pass to `slugField({ slugify })` to slugify accented titles legibly. */
export const slugify: Slugify = ({ valueToSlugify }) =>
  slugifyValue(typeof valueToSlugify === 'string' ? valueToSlugify : undefined)
