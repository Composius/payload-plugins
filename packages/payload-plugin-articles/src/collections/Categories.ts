import type { RevalidateOptions } from '@composius/payload-plugin-shared-components'
import type { Access, CollectionAfterChangeHook, CollectionConfig } from 'payload'

import { revalidateHooks, slugify } from '@composius/payload-plugin-shared-components'
import { createBreadcrumbsField, createParentField } from '@payloadcms/plugin-nested-docs'
import { slugField } from 'payload'

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
    access: {
      create: access.create,
      delete: access.delete,
      read: access.read,
      update: access.update,
    },
    admin: {
      defaultColumns: ['name', 'breadcrumbs', 'parent', 'isDefault', 'articleCount', 'updatedAt'],
      useAsTitle: 'name',
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
        defaultValue: false,
        label: label((t) => t.categories.fields.isDefault),
        // Articles look the default up on every save, by this flag alone.
        admin: {
          description: label((t) => t.categories.fields.isDefaultDescription),
        },
        index: true,
      },
      {
        name: 'articleCount',
        type: 'ui',
        admin: {
          components: {
            Cell: '@composius/payload-plugin-articles/client#CategoryArticleCountCell',
          },
        },
        label: label((t) => t.categories.fields.articleCount),
      },
      createBreadcrumbsField('categories', {
        admin: {
          components: {
            Cell: '@composius/payload-plugin-articles/client#CategoryBreadcrumbsCell',
          },
          readOnly: true,
        },
        label: label((t) => t.categories.fields.breadcrumbs),
      }),
    ],
    hooks: {
      ...revalidation,
      afterChange: [clearOtherDefaults, ...(revalidation.afterChange ?? [])],
    },
    labels: {
      plural: label((t) => t.categories.plural),
      singular: label((t) => t.categories.singular),
    },
  }
}
