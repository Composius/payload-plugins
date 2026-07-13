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
  label: labels.group,
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
        label: labels.title,
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
