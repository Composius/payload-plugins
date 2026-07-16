/**
 * A plain string, or a per-language record keyed by admin language code
 * (e.g. `{ en: 'Home', fr: 'Accueil' }`).
 */
export type LocalizedText = string | Record<string, string>

/**
 * Resolves a `LocalizedText` for the current admin language: exact language
 * match first, then `en`, then the first value in the record.
 */
export const resolveLocalizedText = (
  text: LocalizedText | undefined,
  language: string,
): string | undefined => {
  if (text === undefined || typeof text === 'string') {
    return text
  }

  return text[language] ?? text.en ?? Object.values(text)[0]
}
