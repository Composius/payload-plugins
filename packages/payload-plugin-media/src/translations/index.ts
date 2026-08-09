import { en } from './en.js'
import { fr } from './fr.js'

export type Translation = typeof en

/** Builds a Payload label record ({ en, fr }) from a translation key selector. */
export const label = (pick: (t: Translation) => string): Record<string, string> => ({
  en: pick(en),
  fr: pick(fr),
})

/**
 * Translations for a runtime message, picked from the request language. Labels
 * go through `label` instead — Payload resolves those itself.
 */
export const translation = (language?: string): Translation =>
  language?.startsWith('fr') ? fr : en
