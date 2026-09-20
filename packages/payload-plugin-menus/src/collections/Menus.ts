import type { RevalidateOptions } from '@composius/payload-plugin-shared-components'
import type {
  Access,
  Block,
  CollectionAdminOptions,
  CollectionConfig,
  CollectionSlug,
  Field,
  PayloadRequest,
} from 'payload'

import { revalidateHooks } from '@composius/payload-plugin-shared-components'

import { label } from '../translations/index.js'

export type MenusAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type MenusOptions = {
  access: Required<MenusAccess>
  collections: CollectionSlug[]
  /**
   * Excludes the collection from the admin nav and routes. The collection stays
   * registered, so the database schema and the API are unchanged.
   */
  hidden: CollectionAdminOptions['hidden']
  /** Next.js cache invalidation on save and delete. `false` turns it off. */
  revalidate: false | RevalidateOptions
}

const newTab: Field = {
  name: 'newTab',
  type: 'checkbox',
  defaultValue: false,
  label: label((t) => t.fields.newTab),
}

const anchor: Field = {
  name: 'anchor',
  type: 'text',
  admin: {
    description: label((t) => t.links.anchorDescription),
  },
  hooks: {
    // Stored without its leading '#', whether or not the editor typed one, so a
    // front end can always build the href as `${path}#${anchor}`.
    beforeValidate: [
      ({ value }) => {
        if (typeof value !== 'string') {
          return value
        }

        const normalized = value.trim().replace(/^#+/, '')
        return normalized === '' ? null : normalized
      },
    ],
  },
  label: label((t) => t.fields.anchor),
}

const externalLink: Block = {
  slug: 'external',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: label((t) => t.fields.title),
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      label: label((t) => t.fields.url),
      required: true,
    },
    newTab,
  ],
  labels: {
    plural: label((t) => t.links.externalPlural),
    singular: label((t) => t.links.external),
  },
}

const internalLink = (collections: CollectionSlug[]): Block => ({
  slug: 'internal',
  fields: [
    {
      name: 'doc',
      type: 'relationship',
      label: label((t) => t.fields.document),
      relationTo: collections,
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description: label((t) => t.links.titleDescription),
      },
      label: label((t) => t.fields.title),
    },
    anchor,
    newTab,
  ],
  labels: {
    plural: label((t) => t.links.internalPlural),
    singular: label((t) => t.links.internal),
  },
})

type InternalLinkBlock = {
  blockType: 'internal'
  doc?: { relationTo: CollectionSlug; value: unknown } | null
  title?: null | string
}

/**
 * Reads `useAsTitle` off a document as a title.
 *
 * `useAsTitle` is only supposed to name a text field, but nothing enforces
 * that — point it at a group, an upload or a relationship and a plain
 * `String()` would put the literal text `[object Object]` in the menu. Only a
 * primitive is a usable title; anything else is treated as absent.
 */
const titleOf = (doc: null | Record<string, unknown> | undefined, useAsTitle: string): string => {
  const raw = doc?.[useAsTitle]

  if (typeof raw === 'string') {
    return raw
  }
  return typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : ''
}

const resolveDocTitle = async (
  req: PayloadRequest,
  { relationTo, value }: NonNullable<InternalLinkBlock['doc']>,
): Promise<null | string> => {
  const relatedCollection = req.payload.collections[relationTo]
  if (!relatedCollection || !value) {
    return null
  }

  const useAsTitle = relatedCollection.config.admin?.useAsTitle ?? 'id'

  if (typeof value === 'object') {
    return titleOf(value as Record<string, unknown>, useAsTitle)
  }

  const relatedDoc = await req.payload.findByID({
    id: value as number | string,
    collection: relationTo,
    depth: 0,
    req,
  })
  return titleOf(relatedDoc as unknown as Record<string, unknown>, useAsTitle)
}

export const Menus = ({
  access,
  collections,
  hidden,
  revalidate,
}: MenusOptions): CollectionConfig => ({
  slug: 'menus',
  access: {
    create: access.create,
    delete: access.delete,
    read: access.read,
    update: access.update,
  },
  admin: {
    defaultColumns: ['name', 'linksCount', 'updatedAt'],
    hidden,
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: label((t) => t.fields.name),
      required: true,
    },
    {
      name: 'links',
      type: 'blocks',
      blocks: [...(collections.length > 0 ? [internalLink(collections)] : []), externalLink],
      label: label((t) => t.fields.links),
    },
    {
      name: 'linksCount',
      type: 'number',
      admin: {
        // List-view column only: never rendered in the edit form.
        condition: () => false,
        disableListFilter: true,
      },
      hooks: {
        afterRead: [
          ({ siblingData }) =>
            Array.isArray(siblingData?.links) ? siblingData.links.length : 0,
        ],
      },
      label: label((t) => t.fields.linksCount),
      virtual: true,
    },
  ],
  hooks: {
    ...revalidateHooks({ collection: 'menus', fields: ['name'] }, revalidate),
    afterRead: [
      async ({ doc, req }) => {
        if (!Array.isArray(doc?.links)) {
          return doc
        }

        for (const link of doc.links as InternalLinkBlock[]) {
          if (link.blockType !== 'internal' || link.title || !link.doc) {
            continue
          }

          link.title = await resolveDocTitle(req, link.doc)
        }

        return doc
      },
    ],
    beforeChange: [
      // The admin form echoes the title resolved by afterRead back on save.
      // Only store a title that differs from the linked doc's current one, so
      // an untouched value stays live instead of becoming a frozen override.
      async ({ data, req }) => {
        if (!Array.isArray(data?.links)) {
          return data
        }

        for (const link of data.links as InternalLinkBlock[]) {
          if (link.blockType !== 'internal' || !link.title || !link.doc) {
            continue
          }

          if (link.title === (await resolveDocTitle(req, link.doc))) {
            link.title = null
          }
        }

        return data
      },
    ],
  },
  labels: {
    plural: label((t) => t.menus.plural),
    singular: label((t) => t.menus.singular),
  },
})
