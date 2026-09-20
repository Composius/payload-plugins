import type { Field } from 'payload'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

export type SeoGenerators = {
  hasGenerateDescription: boolean
  hasGenerateImage: boolean
  hasGenerateTitle: boolean
}

export type SeoFieldOptions = {
  generators: SeoGenerators
  labels: {
    /** Label of the `meta` group (e.g. "SEO"). */
    group: Record<string, string> | string
    /** Label of the meta title field (e.g. "Title"). */
    title: Record<string, string> | string
  }
}

/** Sidebar `meta` group with the SEO fields from `@payloadcms/plugin-seo`. */
export const seoField = ({ generators, labels }: SeoFieldOptions): Field => ({
  name: 'meta',
  type: 'group',
  admin: {
    position: 'sidebar',
  },
  fields: [
    OverviewField({
      descriptionPath: 'meta.description',
      imagePath: 'meta.image',
      titlePath: 'meta.title',
    }),
    MetaTitleField({
      hasGenerateFn: generators.hasGenerateTitle,
      overrides: {
        label: labels.title,
      },
    }),
    MetaImageField({
      hasGenerateFn: generators.hasGenerateImage,
      relationTo: 'media',
    }),
    MetaDescriptionField({
      hasGenerateFn: generators.hasGenerateDescription,
    }),
    PreviewField({
      descriptionPath: 'meta.description',
      hasGenerateFn: true,
      titlePath: 'meta.title',
    }),
  ],
  label: labels.group,
})
