import type { Block } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { contentEditorFeatures } from '@composius/payload-plugin-shared-components'
import { label } from '../translations/index.js'

export const CONTENT_BLOCK_SLUG = 'content'

/**
 * The rich text of a page, as a block rather than a fixed field: pages compose
 * their content out of blocks, and prose is one of them.
 *
 * A factory rather than a shared object — Payload marks a block sanitized in
 * place, so two configs built in one process (the dev suites, a test file)
 * would otherwise pass the same mutated definition around.
 */
export const contentBlock = (): Block => ({
  slug: CONTENT_BLOCK_SLUG,
  labels: {
    singular: label((t) => t.blocks.content.singular),
    plural: label((t) => t.blocks.content.plural),
  },
  fields: [
    {
      name: 'content',
      type: 'richText',
      label: label((t) => t.fields.content),
      editor: lexicalEditor({
        features: contentEditorFeatures('@composius/payload-plugin-pages/client'),
      }),
    },
  ],
})
