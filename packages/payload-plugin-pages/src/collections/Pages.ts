import type { Access, Block, BlockSlug, CollectionConfig, Field } from 'payload'
import { slugField } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import type {
  RevalidateOptions,
  SeoGenerators,
} from '@composius/payload-plugin-shared-components'
import {
  contentEditorFeatures,
  revalidateHooks,
  seoField,
  slugify,
} from '@composius/payload-plugin-shared-components'
import { label } from '../translations/index.js'

export type PagesAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type PagesSeoGenerators = SeoGenerators

export type PagesOptions = {
  access: Required<PagesAccess>
  /** Blocks of the `layout` field, referenced by slug from `config.blocks`. */
  blockReferences: (Block | BlockSlug)[]
  /** Blocks defined inline on the `layout` field. */
  blocks: Block[]
  /** Adds the fixed `content` richText field, alongside any layout blocks. */
  contentField: boolean
  pageUrl: (slug?: string | null) => string
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
const layoutFields = (blocks: Block[], blockReferences: (Block | BlockSlug)[]): Field[] => {
  if (blocks.length === 0 && blockReferences.length === 0) {
    return []
  }

  const fieldLabel = label((t) => t.fields.layout)

  if (blockReferences.length === 0) {
    return [{ name: 'layout', type: 'blocks', label: fieldLabel, blocks }]
  }

  return [
    {
      name: 'layout',
      type: 'blocks',
      label: fieldLabel,
      blockReferences: [...blockReferences, ...blocks],
      blocks: [],
    },
  ]
}

export const Pages = ({
  access,
  blockReferences,
  blocks,
  contentField,
  pageUrl,
  revalidate,
  seo,
}: PagesOptions): CollectionConfig => ({
  slug: 'pages',
  labels: {
    singular: label((t) => t.pages.singular),
    plural: label((t) => t.pages.plural),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'publishedAt', 'updatedAt'],
    livePreview: {
      url: ({ data }) => pageUrl(data?.slug as string | undefined),
    },
    preview: (data) => pageUrl(data?.slug as string | undefined),
  },
  defaultSort: '-publishedAt',
  access: {
    read: access.read,
    create: access.create,
    update: access.update,
    delete: access.delete,
  },
  versions: {
    drafts: {
      autosave: true,
    },
  },
  hooks: {
    ...revalidateHooks({ collection: 'pages', drafts: true, fields: ['slug'] }, revalidate),
  },
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
      label: label((t) => t.fields.coverImage),
      relationTo: 'media',
      admin: {
        position: 'sidebar',
      },
    },
    ...(contentField
      ? [
          {
            name: 'content',
            type: 'richText' as const,
            label: label((t) => t.fields.content),
            editor: lexicalEditor({
              features: contentEditorFeatures('@composius/payload-plugin-pages/client'),
            }),
          },
        ]
      : []),
    ...layoutFields(blocks, blockReferences),
    {
      name: 'publishedAt',
      type: 'date',
      label: label((t) => t.fields.publishedAt),
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
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
})
