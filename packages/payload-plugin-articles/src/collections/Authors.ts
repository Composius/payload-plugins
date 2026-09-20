import type { RevalidateOptions } from '@composius/payload-plugin-shared-components'
import type { Access, CollectionConfig } from 'payload'

import { revalidateHooks } from '@composius/payload-plugin-shared-components'

import { label } from '../translations/index.js'

export type AuthorsAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type AuthorsOptions = {
  access: Required<AuthorsAccess>
  /** Next.js cache invalidation on save and delete. `false` turns it off. */
  revalidate: false | RevalidateOptions
}

export const Authors = ({ access, revalidate }: AuthorsOptions): CollectionConfig => ({
  slug: 'authors',
  access: {
    create: access.create,
    delete: access.delete,
    read: access.read,
    update: access.update,
  },
  admin: {
    defaultColumns: ['name', 'contact', 'updatedAt'],
    useAsTitle: 'name',
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
      admin: {
        description: label((t) => t.authors.fields.pictureDescription),
        position: 'sidebar',
      },
      label: label((t) => t.authors.fields.picture),
      relationTo: 'media',
    },
    {
      name: 'avatarPreview',
      type: 'ui',
      admin: {
        components: {
          Field: '@composius/payload-plugin-articles/client#AuthorAvatar',
        },
        position: 'sidebar',
      },
      label: label((t) => t.authors.fields.avatarPreview),
    },
    {
      name: 'contact',
      type: 'text',
      admin: {
        description: label((t) => t.authors.fields.contactDescription),
      },
      label: label((t) => t.authors.fields.contact),
    },
    {
      name: 'biography',
      type: 'textarea',
      label: label((t) => t.authors.fields.biography),
    },
  ],
  hooks: {
    // Articles carry their author's name and picture, so a change here changes
    // every article page and byline that shows them.
    ...revalidateHooks({ collection: 'authors', related: ['articles'] }, revalidate),
  },
  labels: {
    plural: label((t) => t.authors.plural),
    singular: label((t) => t.authors.singular),
  },
})
