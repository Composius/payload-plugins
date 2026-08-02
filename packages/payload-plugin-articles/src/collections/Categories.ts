import type { Access, CollectionAfterChangeHook, CollectionConfig } from 'payload'
import { slugField } from 'payload'
import { createBreadcrumbsField, createParentField } from '@payloadcms/plugin-nested-docs'
import type { RevalidateOptions } from '@composius/payload-plugin-shared-components'
import { revalidateHooks, slugify } from '@composius/payload-plugin-shared-components'
import { label } from '../translations/index.js'

export type CategoriesAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type CategoriesOptions = {
  access: Required<CategoriesAccess>
  /** Next.js cache invalidation on save and delete. `false` turns it off. */
  revalidate: false | RevalidateOptions
}

/**
 * Only one category is the default: ticking the box on one clears it on every
 * other. Runs after the change so a category created with the box already
 * ticked has an id to exclude itself by. It cannot recurse — the cascading
 * update sets the flag to `false`, and this hook only acts on a `true` one.
 */
export const clearOtherDefaults: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (doc.isDefault !== true) {
    return doc
  }

  await req.payload.update({
    collection: 'categories',
    data: { isDefault: false },
    depth: 0,
    // Bookkeeping the collection owes itself: whoever may set the flag here
    // is not necessarily allowed to update the category that held it before.
    overrideAccess: true,
    req,
    where: {
      and: [{ id: { not_equals: doc.id } }, { isDefault: { equals: true } }],
    },
  })

  return doc
}

/**
 * The `parent` and `breadcrumbs` fields are declared here (rather than left to
 * `nestedDocsPlugin`) so the schema stays consistent when the plugin is disabled.
 * `nestedDocsPlugin` detects them and only adds its hooks and parent filterOptions.
 */
export const Categories = ({ access, revalidate }: CategoriesOptions): CollectionConfig => {
  // Articles carry their category's name, so renaming one changes every
  // article page and listing that shows it.
  const revalidation = revalidateHooks(
    { collection: 'categories', fields: ['slug'], related: ['articles'] },
    revalidate,
  )

  return {
    slug: 'categories',
    labels: {
      singular: label((t) => t.categories.singular),
      plural: label((t) => t.categories.plural),
    },
    admin: {
      useAsTitle: 'name',
      defaultColumns: ['name', 'breadcrumbs', 'parent', 'isDefault', 'articleCount', 'updatedAt'],
    },
    access: {
      read: access.read,
      create: access.create,
      update: access.update,
      delete: access.delete,
    },
    hooks: {
      ...revalidation,
      afterChange: [clearOtherDefaults, ...(revalidation.afterChange ?? [])],
    },
    fields: [
      {
        name: 'name',
        type: 'text',
        label: label((t) => t.categories.fields.name),
        required: true,
      },
      slugField({ slugify, useAsSlug: 'name' }),
      createParentField('categories', {
        label: label((t) => t.categories.fields.parent),
      }),
      {
        name: 'description',
        type: 'textarea',
        label: label((t) => t.categories.fields.description),
      },
      {
        name: 'isDefault',
        type: 'checkbox',
        label: label((t) => t.categories.fields.isDefault),
        defaultValue: false,
        // Articles look the default up on every save, by this flag alone.
        index: true,
        admin: {
          description: label((t) => t.categories.fields.isDefaultDescription),
        },
      },
      {
        name: 'articleCount',
        type: 'ui',
        label: label((t) => t.categories.fields.articleCount),
        admin: {
          components: {
            Cell: '@composius/payload-plugin-articles/client#CategoryArticleCountCell',
          },
        },
      },
      createBreadcrumbsField('categories', {
        label: label((t) => t.categories.fields.breadcrumbs),
        admin: {
          components: {
            Cell: '@composius/payload-plugin-articles/client#CategoryBreadcrumbsCell',
          },
          readOnly: true,
        },
      }),
    ],
  }
}
