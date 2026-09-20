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
  access: {
    create: access.create,
    delete: access.delete,
    read: access.read,
    update: access.update,
  },
  admin: {
    defaultColumns: ['site', 'sourceType', 'sourceId', 'targetCollection', 'targetId', 'status'],
    group: 'WordPress import',
    hidden: true,
    useAsTitle: 'sourceKey',
  },
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
      index: true,
      label: label((t) => t.records.fields.site),
      required: true,
    },
    {
      name: 'sourceType',
      type: 'select',
      index: true,
      label: label((t) => t.records.fields.sourceType),
      options: ['post', 'category', 'author', 'media'],
      required: true,
    },
    {
      name: 'sourceId',
      type: 'number',
      index: true,
      label: label((t) => t.records.fields.sourceId),
    },
    {
      name: 'sourceKey',
      type: 'text',
      index: true,
      label: label((t) => t.records.fields.sourceKey),
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
      defaultValue: 'done',
      label: label((t) => t.records.fields.status),
      options: ['done', 'failed'],
    },
    {
      name: 'error',
      type: 'text',
      label: label((t) => t.records.fields.error),
    },
  ],
  indexes: [
    { fields: ['site', 'sourceType', 'sourceId'] },
    { fields: ['site', 'sourceType', 'sourceKey'] },
  ],
  labels: {
    plural: label((t) => t.records.plural),
    singular: label((t) => t.records.singular),
  },
})
