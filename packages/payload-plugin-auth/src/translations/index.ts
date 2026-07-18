import { en } from './en.js'
import { fr } from './fr.js'

export type Translation = typeof en

const translations: Record<string, Translation> = { en, fr }

/** Builds a Payload label record ({ en, fr }) from a translation key selector. */
export const label = (pick: (t: Translation) => string): Record<string, string> => ({
  en: pick(en),
  fr: pick(fr),
})

/** Resolves a translation for a runtime language (e.g. `req.i18n.language`), falling back to English. */
export const translate = (
  language: string | undefined,
  pick: (t: Translation) => string,
): string => pick(translations[language ?? 'en'] ?? en)
