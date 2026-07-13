import type { Access, CollectionConfig } from 'payload'
import { slugField } from 'payload'
import { createBreadcrumbsField, createParentField } from '@payloadcms/plugin-nested-docs'
import { label } from '../translations/index.js'

export type CategoriesAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type CategoriesOptions = {
  access: Required<CategoriesAccess>
}

/**
 * The `parent` and `breadcrumbs` fields are declared here (rather than left to
 * `nestedDocsPlugin`) so the schema stays consistent when the plugin is disabled.
 * `nestedDocsPlugin` detects them and only adds its hooks and parent filterOptions.
 */
export const Categories = ({ access }: CategoriesOptions): CollectionConfig => ({
  slug: 'categories',
  labels: {
    singular: label((t) => t.categories.singular),
    plural: label((t) => t.categories.plural),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'breadcrumbs', 'parent', 'updatedAt'],
  },
  access: {
    read: access.read,
    create: access.create,
    update: access.update,
    delete: access.delete,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: label((t) => t.categories.fields.name),
      required: true,
    },
    slugField({ useAsSlug: 'name' }),
    createParentField('categories', {
      label: label((t) => t.categories.fields.parent),
    }),
    {
      name: 'description',
      type: 'textarea',
      label: label((t) => t.categories.fields.description),
    },
    createBreadcrumbsField('categories', {
      label: label((t) => t.categories.fields.breadcrumbs),
      admin: {
        components: {
          Cell: '@vitrailweb/payload-plugin-articles/client#CategoryBreadcrumbsCell',
        },
        readOnly: true,
      },
    }),
  ],
})
