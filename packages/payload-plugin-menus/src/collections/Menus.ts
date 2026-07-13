import type {
  Access,
  Block,
  CollectionConfig,
  CollectionSlug,
  Field,
  PayloadRequest,
} from 'payload'

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
}

const newTab: Field = {
  name: 'newTab',
  type: 'checkbox',
  defaultValue: false,
  label: label((t) => t.fields.newTab),
}

const externalLink: Block = {
  slug: 'external',
  labels: {
    singular: label((t) => t.links.external),
    plural: label((t) => t.links.externalPlural),
  },
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
}

const internalLink = (collections: CollectionSlug[]): Block => ({
  slug: 'internal',
  labels: {
    singular: label((t) => t.links.internal),
    plural: label((t) => t.links.internalPlural),
  },
  fields: [
    {
      name: 'doc',
      type: 'relationship',
      relationTo: collections,
      label: label((t) => t.fields.document),
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      label: label((t) => t.fields.title),
      admin: {
        description: label((t) => t.links.titleDescription),
      },
    },
    newTab,
  ],
})

type InternalLinkBlock = {
  blockType: 'internal'
  doc?: { relationTo: CollectionSlug; value: unknown } | null
  title?: null | string
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
    return String((value as Record<string, unknown>)[useAsTitle] ?? '')
  }

  const relatedDoc = await req.payload.findByID({
    collection: relationTo,
    id: value as number | string,
    depth: 0,
    req,
  })
  return String((relatedDoc as unknown as Record<string, unknown>)?.[useAsTitle] ?? '')
}

export const Menus = ({ access, collections }: MenusOptions): CollectionConfig => ({
  slug: 'menus',
  labels: {
    singular: label((t) => t.menus.singular),
    plural: label((t) => t.menus.plural),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'linksCount', 'updatedAt'],
  },
  access: {
    read: access.read,
    create: access.create,
    update: access.update,
    delete: access.delete,
  },
  hooks: {
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
      label: label((t) => t.fields.links),
      blocks: [...(collections.length > 0 ? [internalLink(collections)] : []), externalLink],
    },
    {
      name: 'linksCount',
      type: 'number',
      virtual: true,
      label: label((t) => t.fields.linksCount),
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
    },
  ],
})
