import { en } from './en.js'
import { fr } from './fr.js'

export type Translation = typeof en

/** Builds a Payload label record ({ en, fr }) from a translation key selector. */
export const label = (pick: (t: Translation) => string): Record<string, string> => ({
  en: pick(en),
  fr: pick(fr),
})
