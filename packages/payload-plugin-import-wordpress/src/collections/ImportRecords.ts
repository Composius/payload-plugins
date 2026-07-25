import type { CollectionConfig } from 'payload'

import type { ImportAccess } from '../types.js'

import { label } from '../translations/index.js'

export type ImportRecordsOptions = {
  access: Required<ImportAccess>
}

/**
 * Source→target mapping rows that make the import idempotent, resumable and
 * image-deduplicating. Before importing anything the task looks up a `done`
 * record for the same `site` + `sourceType` + `sourceId` (or `sourceKey` for
 * media, keyed by the image URL) and skips/reuses it.
 */
export const ImportRecords = ({ access }: ImportRecordsOptions): CollectionConfig => ({
  slug: 'wp-import-records',
  labels: {
    singular: label((t) => t.records.singular),
    plural: label((t) => t.records.plural),
  },
  admin: {
    useAsTitle: 'sourceKey',
    defaultColumns: ['site', 'sourceType', 'sourceId', 'targetCollection', 'targetId', 'status'],
    group: 'WordPress import',
    hidden: true,
  },
  access: {
    read: access.read,
    create: access.create,
    update: access.update,
    delete: access.delete,
  },
  indexes: [
    { fields: ['site', 'sourceType', 'sourceId'] },
    { fields: ['site', 'sourceType', 'sourceKey'] },
  ],
  fields: [
    {
      name: 'job',
      type: 'relationship',
      label: label((t) => t.records.fields.job),
      relationTo: 'wp-import-jobs',
    },
    {
      name: 'site',
      type: 'text',
      label: label((t) => t.records.fields.site),
      index: true,
      required: true,
    },
    {
      name: 'sourceType',
      type: 'select',
      label: label((t) => t.records.fields.sourceType),
      options: ['post', 'category', 'author', 'media'],
      index: true,
      required: true,
    },
    {
      name: 'sourceId',
      type: 'number',
      label: label((t) => t.records.fields.sourceId),
      index: true,
    },
    {
      name: 'sourceKey',
      type: 'text',
      label: label((t) => t.records.fields.sourceKey),
      index: true,
    },
    {
      name: 'targetCollection',
      type: 'text',
      label: label((t) => t.records.fields.targetCollection),
    },
    {
      name: 'targetId',
      type: 'text',
      label: label((t) => t.records.fields.targetId),
    },
    {
      name: 'status',
      type: 'select',
      label: label((t) => t.records.fields.status),
      defaultValue: 'done',
      options: ['done', 'failed'],
    },
    {
      name: 'error',
      type: 'text',
      label: label((t) => t.records.fields.error),
    },
  ],
})
