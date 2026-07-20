import type { Access, CollectionConfig } from 'payload'
import { label } from '../translations/index.js'

export type AuthorsAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type AuthorsOptions = {
  access: Required<AuthorsAccess>
}

export const Authors = ({ access }: AuthorsOptions): CollectionConfig => ({
  slug: 'authors',
  labels: {
    singular: label((t) => t.authors.singular),
    plural: label((t) => t.authors.plural),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'contact', 'updatedAt'],
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
      label: label((t) => t.authors.fields.name),
      required: true,
    },
    {
      name: 'picture',
      type: 'upload',
      label: label((t) => t.authors.fields.picture),
      relationTo: 'media',
      admin: {
        position: 'sidebar',
        description: label((t) => t.authors.fields.pictureDescription),
      },
    },
    {
      name: 'avatarPreview',
      type: 'ui',
      label: label((t) => t.authors.fields.avatarPreview),
      admin: {
        position: 'sidebar',
        components: {
          Field: '@composius/payload-plugin-articles/client#AuthorAvatar',
        },
      },
    },
    {
      name: 'contact',
      type: 'text',
      label: label((t) => t.authors.fields.contact),
      admin: {
        description: label((t) => t.authors.fields.contactDescription),
      },
    },
    {
      name: 'biography',
      type: 'textarea',
      label: label((t) => t.authors.fields.biography),
    },
  ],
})
