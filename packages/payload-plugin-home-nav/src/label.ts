import type { LocalizedText } from './localized.js'
import type { Translation } from './translations/index.js'

import { resolveLocalizedText } from './localized.js'
import { en } from './translations/en.js'
import { fr } from './translations/fr.js'

const translations: Record<string, Translation> = { en, fr }

/**
 * Resolves the "Home" label for the current admin language: the `label`
 * plugin option when set, otherwise the plugin's bundled translations.
 */
export const resolveHomeLabel = (
  label: LocalizedText | undefined,
  language: string,
): string => resolveLocalizedText(label, language) ?? (translations[language] ?? en).homeNav.home
