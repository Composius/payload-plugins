import type { Access, CollectionConfig } from 'payload'
import { slugField } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import type { SeoGenerators } from '@vitrailweb/payload-plugin-shared-components'
import { contentEditorFeatures, seoField } from '@vitrailweb/payload-plugin-shared-components'
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
  pageUrl: (slug?: string | null) => string
  seo: false | PagesSeoGenerators
}

export const Pages = ({ access, pageUrl, seo }: PagesOptions): CollectionConfig => ({
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
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'content',
      type: 'richText',
      label: label((t) => t.fields.content),
      editor: lexicalEditor({
        features: contentEditorFeatures('@vitrailweb/payload-plugin-pages/client'),
      }),
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
