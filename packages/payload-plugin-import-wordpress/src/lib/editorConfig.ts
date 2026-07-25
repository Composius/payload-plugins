import type { SanitizedServerEditorConfig } from '@payloadcms/richtext-lexical'
import type { Field, Payload, RichTextField } from 'payload'

import { editorConfigFactory } from '@payloadcms/richtext-lexical'

/** Recursively finds a named richText field within a field tree. */
const findRichTextField = (fields: Field[], name: string): RichTextField | undefined => {
  for (const field of fields) {
    if (field.type === 'richText' && 'name' in field && field.name === name) {
      return field as RichTextField
    }
    if ('fields' in field && Array.isArray(field.fields)) {
      const nested = findRichTextField(field.fields, name)
      if (nested) {
        return nested
      }
    }
    if (field.type === 'tabs' && Array.isArray(field.tabs)) {
      for (const tab of field.tabs) {
        const nested = findRichTextField(tab.fields, name)
        if (nested) {
          return nested
        }
      }
    }
  }
  return undefined
}

/**
 * Resolves the sanitized Lexical editor config for the target article content
 * field, so HTML→Lexical conversion uses exactly the features that field
 * accepts. Falls back to the config's default editor when the field can't be
 * located.
 */
export const resolveEditorConfig = async (
  payload: Payload,
  articlesSlug: string,
  contentFieldName: string,
): Promise<SanitizedServerEditorConfig> => {
  const collections = payload.collections as unknown as Record<
    string,
    { config: { fields: Field[] } } | undefined
  >
  const collection = collections[articlesSlug]
  const field = collection
    ? findRichTextField(collection.config.fields, contentFieldName)
    : undefined

  if (field) {
    return editorConfigFactory.fromField({ field })
  }

  return editorConfigFactory.default({ config: payload.config })
}
