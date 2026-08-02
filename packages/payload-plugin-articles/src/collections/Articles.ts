import type {
  Access,
  CollectionConfig,
  CollectionSlug,
  FieldAccess,
  FieldHook,
  PayloadRequest,
} from 'payload'
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

export type ArticlesAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type ArticlesSeoGenerators = SeoGenerators

export type ArticlesOptions = {
  access: Required<ArticlesAccess>
  articleUrl: (slug?: string | null) => string
  /** Adds the `author` relationship to the `authors` collection. */
  authors: boolean
  /** Field-level access controlling who may change the `editor` field. */
  editorUpdateAccess: FieldAccess
  /** Next.js cache invalidation on save and delete. `false` turns it off. */
  revalidate: false | RevalidateOptions
  seo: false | ArticlesSeoGenerators
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
  editorUpdateAccess,
  revalidate,
  seo,
  useDefaultCategory,
  usersSlug,
}: ArticlesOptions): CollectionConfig => ({
  slug: 'articles',
  labels: {
    singular: label((t) => t.articles.singular),
    plural: label((t) => t.articles.plural),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'editor', 'publishedAt', 'updatedAt'],
    livePreview: {
      url: ({ data }) => articleUrl(data?.slug as string | undefined),
    },
    preview: (data) => articleUrl(data?.slug as string | undefined),
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
    ...revalidateHooks({ collection: 'articles', drafts: true, fields: ['slug'] }, revalidate),
  },
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
        position: 'sidebar',
        components: {
          Field: '@composius/payload-plugin-articles/client#CategoryFieldClient',
        },
      },
    },
    ...(authors
      ? ([
          {
            name: 'author',
            type: 'relationship',
            label: label((t) => t.articles.fields.author),
            relationTo: 'authors',
            admin: {
              position: 'sidebar',
            },
          },
        ] as const)
      : []),
    {
      name: 'coverImage',
      type: 'upload',
      label: label((t) => t.articles.fields.coverImage),
      relationTo: 'media',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'content',
      type: 'richText',
      label: label((t) => t.articles.fields.content),
      editor: lexicalEditor({
        features: contentEditorFeatures('@composius/payload-plugin-articles/client'),
      }),
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: label((t) => t.articles.fields.publishedAt),
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
    {
      name: 'editor',
      type: 'relationship',
      label: label((t) => t.articles.fields.editor),
      relationTo: usersSlug,
      access: {
        update: editorUpdateAccess,
      },
      admin: {
        position: 'sidebar',
        components: {
          Cell: '@composius/payload-plugin-articles/client#EditorCell',
        },
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
})
