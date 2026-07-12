import type { Access, CollectionConfig, Field } from 'payload'
import { slugField } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { label } from '../translations/index.js'

export type ArticlesAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type ArticlesSeoGenerators = {
  hasGenerateDescription: boolean
  hasGenerateImage: boolean
  hasGenerateTitle: boolean
}

export type ArticlesOptions = {
  access: Required<ArticlesAccess>
  articleUrl: (slug?: string | null) => string
  seo: false | ArticlesSeoGenerators
}

const seoField = (generators: ArticlesSeoGenerators): Field => ({
  name: 'meta',
  label: label((t) => t.fields.seo),
  type: 'group',
  admin: {
    position: 'sidebar',
  },
  fields: [
    OverviewField({
      titlePath: 'meta.title',
      descriptionPath: 'meta.description',
      imagePath: 'meta.image',
    }),
    MetaTitleField({
      hasGenerateFn: generators.hasGenerateTitle,
      overrides: {
        label: label((t) => t.fields.seoTitle),
      },
    }),
    MetaImageField({
      relationTo: 'media',
      hasGenerateFn: generators.hasGenerateImage,
    }),
    MetaDescriptionField({
      hasGenerateFn: generators.hasGenerateDescription,
    }),
    PreviewField({
      hasGenerateFn: true,
      titlePath: 'meta.title',
      descriptionPath: 'meta.description',
    }),
  ],
})

export const Articles = ({ access, articleUrl, seo }: ArticlesOptions): CollectionConfig => ({
  slug: 'articles',
  labels: {
    singular: label((t) => t.articles.singular),
    plural: label((t) => t.articles.plural),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'publishedAt', 'updatedAt'],
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
      label: label((t) => t.fields.title),
      required: true,
    },
    slugField(),
    {
      name: 'coverImage',
      type: 'upload',
      label: label((t) => t.fields.coverImage),
      relationTo: 'media',
    },
    {
      name: 'content',
      type: 'richText',
      label: label((t) => t.fields.content),
    },
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
    ...(seo ? [seoField(seo)] : []),
  ],
})
