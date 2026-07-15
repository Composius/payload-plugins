import type { LocalizedText } from './types.js'

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
