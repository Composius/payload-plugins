import type {
  EditorFontSize,
  RevalidateOptions,
  SeoGenerators,
} from '@composius/payload-plugin-shared-components'
import type { Access, Block, BlockSlug, CollectionConfig, Field } from 'payload'

import {
  contentEditorFeatures,
  revalidateHooks,
  seoField,
  slugify,
} from '@composius/payload-plugin-shared-components'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { slugField } from 'payload'

import { label } from '../translations/index.js'

export type PagesAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type PagesSeoGenerators = SeoGenerators

/**
 * A block, or the slug of one registered on the config.
 *
 * `BlockSlug` narrows to the slugs of the host's *generated* block types, which
 * a plugin cannot know, so the `{} & string` arm keeps any slug assignable
 * while still offering the generated ones as completions. This mirrors how
 * Payload types the `blockReferences` field itself (`BlockSlugOrString`).
 */
export type BlockReference = ({} & string) | Block | BlockSlug

export type PagesOptions = {
  access: Required<PagesAccess>
  /** Blocks of the `layout` field, referenced by slug from `config.blocks`. */
  blockReferences: BlockReference[]
  /** Blocks defined inline on the `layout` field. */
  blocks: Block[]
  /** Adds the fixed `content` richText field, alongside any layout blocks. */
  contentField: boolean
  /** Font size control on the content editor's toolbar. `false` leaves it out. */
  editorFontSize: EditorFontSize | false
  /** Draws the content editor's links blue and continuously underlined. */
  emphasizeEditorLinks: boolean
  pageUrl: (slug?: null | string) => string
  /** Next.js cache invalidation on save and delete. `false` turns it off. */
  revalidate: false | RevalidateOptions
  seo: false | PagesSeoGenerators
}

/**
 * The `layout` blocks field, present only once the host has blocks to put in it.
 *
 * Payload rejects a field that carries both `blocks` and `blockReferences`, so
 * only one list is ever set. The plugin decides which, and hands the blocks
 * over already sorted into it.
 */
const layoutFields = (blocks: Block[], blockReferences: BlockReference[]): Field[] => {
  if (blocks.length === 0 && blockReferences.length === 0) {
    return []
  }

  const fieldLabel = label((t) => t.fields.layout)

  if (blockReferences.length === 0) {
    return [{ name: 'layout', type: 'blocks', blocks, label: fieldLabel }]
  }

  return [
    {
      name: 'layout',
      type: 'blocks',
      label: fieldLabel,
      // Payload types the field as `(Block | BlockSlug)[]`, and `BlockSlug`
      // resolves to `never` until the host generates block types — so a slug
      // a plugin was handed has no assignable type here, though the runtime
      // takes any registered one. The cast is that gap, not a loosening.
      blockReferences: [...blockReferences, ...blocks] as (Block | BlockSlug)[],
      blocks: [],
    },
  ]
}

export const Pages = ({
  access,
  blockReferences,
  blocks,
  contentField,
  editorFontSize,
  emphasizeEditorLinks,
  pageUrl,
  revalidate,
  seo,
}: PagesOptions): CollectionConfig => ({
  slug: 'pages',
  access: {
    create: access.create,
    delete: access.delete,
    read: access.read,
    update: access.update,
  },
  admin: {
    defaultColumns: ['title', 'slug', '_status', 'publishedAt', 'updatedAt'],
    livePreview: {
      url: ({ data }) => pageUrl(data?.slug as string | undefined),
    },
    preview: (data) => pageUrl(data?.slug as string | undefined),
    useAsTitle: 'title',
  },
  defaultSort: '-publishedAt',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: label((t) => t.fields.title),
      required: true,
    },
    slugField({ slugify }),
    {
      name: 'coverImage',
      type: 'upload',
      admin: {
        position: 'sidebar',
      },
      label: label((t) => t.fields.coverImage),
      relationTo: 'media',
    },
    ...(contentField
      ? [
          {
            name: 'content',
            type: 'richText' as const,
            editor: lexicalEditor({
              features: contentEditorFeatures('@composius/payload-plugin-pages/client', {
                emphasizeLinks: emphasizeEditorLinks,
                fontSize: editorFontSize,
              }),
            }),
            label: label((t) => t.fields.content),
          },
        ]
      : []),
    ...layoutFields(blocks, blockReferences),
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
      label: label((t) => t.fields.publishedAt),
    },
    ...(seo
      ? [
          seoField({
            generators: seo,
            labels: {
              group: label((t) => t.fields.seo),
              title: label((t) => t.fields.seoTitle),
            },
          }),
        ]
      : []),
  ],
  hooks: {
    ...revalidateHooks({ collection: 'pages', drafts: true, fields: ['slug'] }, revalidate),
  },
  labels: {
    plural: label((t) => t.pages.plural),
    singular: label((t) => t.pages.singular),
  },
  versions: {
    drafts: {
      autosave: true,
    },
  },
})
