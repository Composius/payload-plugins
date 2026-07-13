import type { Access, CollectionConfig } from 'payload'

import { label } from '../translations/index.js'

export type MenusAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type MenusOptions = {
  access: Required<MenusAccess>
}

export const Menus = ({ access }: MenusOptions): CollectionConfig => ({
  slug: 'menus',
  labels: {
    singular: label((t) => t.menus.singular),
    plural: label((t) => t.menus.plural),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
  },
  access: {
    read: access.read,
    create: access.create,
    update: access.update,
    delete: access.delete,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: label((t) => t.fields.title),
      required: true,
    },
  ],
})
