import type { Access, CollectionConfig } from 'payload'
import { slugField } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import type { SeoGenerators } from '@composius/payload-plugin-shared-components'
import { contentEditorFeatures, seoField } from '@composius/payload-plugin-shared-components'
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
  seo: false | ArticlesSeoGenerators
  /** Slug of the users collection the `editor` field relates to. */
  usersSlug: string
}

export const Articles = ({
  access,
  articleUrl,
  seo,
  usersSlug,
}: ArticlesOptions): CollectionConfig => ({
  slug: 'articles',
  labels: {
    singular: label((t) => t.articles.singular),
    plural: label((t) => t.articles.plural),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'editor', 'updatedAt'],
    livePreview: {
      url: ({ data }) => articleUrl(data?.slug as string | undefined),
    },
    preview: (data) => articleUrl(data?.slug as string | undefined),
  },
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
  fields: [
    {
      name: 'title',
      type: 'text',
      label: label((t) => t.articles.fields.title),
      required: true,
    },
    slugField(),
    {
      name: 'category',
      type: 'relationship',
      label: label((t) => t.articles.fields.category),
      relationTo: 'categories',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@composius/payload-plugin-articles/client#CategoryFieldClient',
        },
      },
    },
    {
      name: 'author',
      type: 'relationship',
      label: label((t) => t.articles.fields.author),
      relationTo: 'authors',
      admin: {
        position: 'sidebar',
      },
    },
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
