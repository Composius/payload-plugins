import type {
  EditorFontSize,
  RevalidateOptions,
  SeoGenerators,
} from '@composius/payload-plugin-shared-components'
import type {
  Access,
  CollectionConfig,
  CollectionSlug,
  FieldAccess,
  FieldHook,
  PayloadRequest,
} from 'payload'

import {
  contentEditorFeatures,
  revalidateHooks,
  seoField,
  slugify,
} from '@composius/payload-plugin-shared-components'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { slugField } from 'payload'

import { label } from '../translations/index.js'

export type ArticlesAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type ArticlesSeoGenerators = SeoGenerators

export type ArticlesOptions = {
  access: Required<ArticlesAccess>
  articleUrl: (slug?: null | string) => string
  /** Adds the `author` relationship to the `authors` collection. */
  authors: boolean
  /** Font size control on the content editor's toolbar. `false` leaves it out. */
  editorFontSize: EditorFontSize | false
  /** Field-level access controlling who may change the `editor` field. */
  editorUpdateAccess: FieldAccess
  /** Draws the content editor's links blue and continuously underlined. */
  emphasizeEditorLinks: boolean
  /** Next.js cache invalidation on save and delete. `false` turns it off. */
  revalidate: false | RevalidateOptions
  seo: ArticlesSeoGenerators | false
  /**
   * Falls back to the category flagged as default whenever an article is saved
   * without one.
   */
  useDefaultCategory: boolean
  /**
   * Slug of the users collection the `editor` field relates to. Typed as
   * `CollectionSlug` rather than `string`: once a host app generates its types,
   * that widens to a union of its actual slugs, and a plain `string` is no
   * longer assignable to the `relationTo` of a relationship field.
   */
  usersSlug: CollectionSlug
}

/** Id of the category flagged as the default, if there is one. */
const defaultCategoryId = async (req: PayloadRequest): Promise<number | string | undefined> => {
  const { docs } = await req.payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1,
    pagination: false,
    req,
    select: {},
    where: { isDefault: { equals: true } },
  })

  return docs[0]?.id
}

/** Ticks the default category in the form of a new article. */
const defaultCategoryValue = ({ req }: { req: PayloadRequest }) => defaultCategoryId(req)

/**
 * Re-applies the default to an article saved with no category — the editor
 * cleared the one that was ticked, or the write never went through the admin
 * panel at all, where `defaultValue` is what fills the field in.
 */
const applyDefaultCategory: FieldHook = async ({ req, value }) => {
  if (value != null) {
    return value
  }

  return (await defaultCategoryId(req)) ?? value
}

export const Articles = ({
  access,
  articleUrl,
  authors,
  editorFontSize,
  editorUpdateAccess,
  emphasizeEditorLinks,
  revalidate,
  seo,
  useDefaultCategory,
  usersSlug,
}: ArticlesOptions): CollectionConfig => ({
  slug: 'articles',
  access: {
    create: access.create,
    delete: access.delete,
    read: access.read,
    update: access.update,
  },
  admin: {
    defaultColumns: ['title', 'category', '_status', 'editor', 'publishedAt', 'updatedAt'],
    livePreview: {
      url: ({ data }) => articleUrl(data?.slug as string | undefined),
    },
    preview: (data) => articleUrl(data?.slug as string | undefined),
    useAsTitle: 'title',
  },
  defaultSort: '-publishedAt',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: label((t) => t.articles.fields.title),
      required: true,
    },
    slugField({ slugify }),
    {
      name: 'category',
      type: 'relationship',
      label: label((t) => t.articles.fields.category),
      relationTo: 'categories',
      // Two paths to the same default: `defaultValue` ticks it in the form of a
      // new article, the hook catches a save that reaches the server without one.
      ...(useDefaultCategory
        ? {
            defaultValue: defaultCategoryValue,
            hooks: { beforeChange: [applyDefaultCategory] },
          }
        : {}),
      admin: {
        components: {
          Field: '@composius/payload-plugin-articles/client#CategoryFieldClient',
        },
        position: 'sidebar',
      },
    },
    ...(authors
      ? ([
          {
            name: 'author',
            type: 'relationship',
            admin: {
              position: 'sidebar',
            },
            label: label((t) => t.articles.fields.author),
            relationTo: 'authors',
          },
        ] as const)
      : []),
    {
      name: 'coverImage',
      type: 'upload',
      admin: {
        position: 'sidebar',
      },
      label: label((t) => t.articles.fields.coverImage),
      relationTo: 'media',
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: contentEditorFeatures('@composius/payload-plugin-articles/client', {
          emphasizeLinks: emphasizeEditorLinks,
          fontSize: editorFontSize,
        }),
      }),
      label: label((t) => t.articles.fields.content),
    },
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
      label: label((t) => t.articles.fields.publishedAt),
    },
    {
      name: 'editor',
      type: 'relationship',
      access: {
        update: editorUpdateAccess,
      },
      admin: {
        components: {
          Cell: '@composius/payload-plugin-articles/client#EditorCell',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ operation, req, value }) => {
            // Default to the creating user; still editable afterwards.
            if (operation === 'create' && value == null && req.user) {
              return req.user.id
            }
            return value
          },
        ],
      },
      label: label((t) => t.articles.fields.editor),
      relationTo: usersSlug,
    },
    ...(seo
      ? [
          seoField({
            generators: seo,
            labels: {
              group: label((t) => t.articles.fields.seo),
              title: label((t) => t.articles.fields.seoTitle),
            },
          }),
        ]
      : []),
  ],
  hooks: {
    ...revalidateHooks({ collection: 'articles', drafts: true, fields: ['slug'] }, revalidate),
  },
  labels: {
    plural: label((t) => t.articles.plural),
    singular: label((t) => t.articles.singular),
  },
  versions: {
    drafts: {
      autosave: true,
    },
  },
})
