import type { EditorFontSize } from '@composius/payload-plugin-shared-components'
import type { Block } from 'payload'

import { contentEditorFeatures } from '@composius/payload-plugin-shared-components'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { label } from '../translations/index.js'

export const CONTENT_BLOCK_SLUG = 'content'

/**
 * A heading and three lines of prose, drawn at the 3:2 the block drawer wants.
 *
 * Inlined as a data URI rather than shipped as a file: a plugin has nowhere to
 * put an asset the host will serve, and the drawer renders the thumbnail in a
 * plain `<img>`. The grey reads on either admin theme, since an `<img>` inherits
 * none of the page's colours.
 */
const thumbnail = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" width="480" height="320">
  <g fill="#8c8c96">
    <rect width="48" height="32" opacity=".12"/>
    <rect x="9" y="8" width="19" height="3" rx="1.5"/>
    <rect x="9" y="15" width="30" height="2" rx="1" opacity=".68"/>
    <rect x="9" y="19" width="30" height="2" rx="1" opacity=".68"/>
    <rect x="9" y="23" width="21" height="2" rx="1" opacity=".68"/>
  </g>
</svg>`

const thumbnailUrl = `data:image/svg+xml,${encodeURIComponent(thumbnail.trim())}`

export type ContentBlockOptions = {
  /**
   * Draws the editor's links blue and continuously underlined, rather than the
   * green under a dotted border Payload gives them.
   * @default false
   */
  emphasizeLinks?: boolean
  /**
   * Font size control on the editor's toolbar, scaling the admin editor with
   * CSS alone. `false` leaves it out, at Payload's own size.
   * @default 'normal'
   */
  fontSize?: EditorFontSize | false
}

/**
 * The rich text of a page, as a block rather than a fixed field: pages compose
 * their content out of blocks, and prose is one of them.
 *
 * A factory rather than a shared object — Payload marks a block sanitized in
 * place, so two configs built in one process (the dev suites, a test file)
 * would otherwise pass the same mutated definition around.
 */
export const contentBlock = ({
  emphasizeLinks,
  fontSize,
}: ContentBlockOptions = {}): Block => ({
  slug: CONTENT_BLOCK_SLUG,
  admin: {
    images: {
      thumbnail: {
        alt: 'A heading above three lines of text',
        url: thumbnailUrl,
      },
    },
  },
  fields: [
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: contentEditorFeatures('@composius/payload-plugin-pages/client', {
          emphasizeLinks,
          fontSize,
        }),
      }),
      label: label((t) => t.fields.content),
    },
  ],
  labels: {
    plural: label((t) => t.blocks.content.plural),
    singular: label((t) => t.blocks.content.singular),
  },
})
