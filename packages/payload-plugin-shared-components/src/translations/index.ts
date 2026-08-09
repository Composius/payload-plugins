import { en } from './en.js'
import { fr } from './fr.js'

export type Translation = typeof en

const translations: Record<string, Translation> = { en, fr }

/** Builds a Payload label record ({ en, fr }) from a translation key selector. */
export const label = (pick: (t: Translation) => string): Record<string, string> => ({
  en: pick(en),
  fr: pick(fr),
})

/**
 * Resolves a single string for a runtime language, falling back to English.
 * Used by field validators, which return one message rather than a label record.
 */
export const t = (language: string | undefined, pick: (t: Translation) => string): string =>
  pick(translations[language ?? 'en'] ?? en)

export { en, fr }
