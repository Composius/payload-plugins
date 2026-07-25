import type { CollectionConfig, PayloadRequest } from 'payload'

import type { ImportAccess } from '../types.js'

import { TASK_SLUG } from '../defaults.js'
import { label } from '../translations/index.js'

export type ImportJobsOptions = {
  access: Required<ImportAccess>
}

/** Queues the import task for a job document (task-slug not in generated types → loose cast). */
const queueImport = async (req: PayloadRequest, jobId: number | string): Promise<void> => {
  const queue = req.payload.jobs.queue as unknown as (args: {
    input: { jobId: number | string }
    req?: PayloadRequest
    task: string
  }) => Promise<unknown>
  await queue({ input: { jobId }, req, task: TASK_SLUG })
}

/**
 * The import "form" and report surface. Creating a document queues an import
 * run (via the jobs queue); the task writes `status`, `progress` and `report`
 * back onto the same document. Toggling `resume` re-queues a stopped run.
 */
export const ImportJobs = ({ access }: ImportJobsOptions): CollectionConfig => ({
  slug: 'wp-import-jobs',
  labels: {
    singular: label((t) => t.jobs.singular),
    plural: label((t) => t.jobs.plural),
  },
  admin: {
    useAsTitle: 'sourceUrl',
    defaultColumns: ['sourceUrl', 'status', 'dryRun', 'updatedAt'],
    group: 'WordPress import',
  },
  access: {
    read: access.read,
    create: access.create,
    update: access.update,
    delete: access.delete,
  },
  hooks: {
    afterChange: [
      async ({ context, doc, operation, req }) => {
        // Updates coming from the importer itself must not re-queue the job.
        if (context?.wpImport) {
          return doc
        }

        if (operation === 'create') {
          await queueImport(req, doc.id as number | string)
          return doc
        }

        // A user toggled "resume" on an existing job → re-queue and clear the flag.
        if (operation === 'update' && doc.resume) {
          await req.payload.update({
            collection: 'wp-import-jobs',
            id: doc.id as number | string,
            data: { resume: false, status: 'queued' },
            context: { wpImport: true },
            req,
          })
          await queueImport(req, doc.id as number | string)
        }

        return doc
      },
    ],
  },
  fields: [
    // Unnamed tabs keep their fields at the top level of the document data —
    // one tab per import step, so each step's outcome reads in its own tab.
    {
      type: 'tabs',
      tabs: [
        {
          label: label((t) => t.jobs.tabs.configuration),
          fields: [
            {
              name: 'sourceUrl',
              type: 'text',
              label: label((t) => t.jobs.fields.sourceUrl),
              required: true,
              admin: {
                description: label((t) => t.jobs.fields.sourceUrlDescription),
              },
            },
            {
              name: 'credentials',
              type: 'group',
              label: label((t) => t.jobs.fields.credentials),
              admin: {
                description: label((t) => t.jobs.fields.credentialsDescription),
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'username',
                      type: 'text',
                      label: label((t) => t.jobs.fields.username),
                      admin: { width: '50%' },
                    },
                    {
                      name: 'applicationPassword',
                      type: 'text',
                      label: label((t) => t.jobs.fields.applicationPassword),
                      admin: {
                        width: '50%',
                        description: label((t) => t.jobs.fields.applicationPasswordDescription),
                        components: {
                          // Masked (•••) input instead of plain text.
                          Field:
                            '@composius/payload-plugin-import-wordpress/client#ApplicationPasswordFieldClient',
                        },
                      },
                    },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'dateFrom',
                  type: 'date',
                  label: label((t) => t.jobs.fields.dateFrom),
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
                },
                {
                  name: 'dateTo',
                  type: 'date',
                  label: label((t) => t.jobs.fields.dateTo),
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
                },
              ],
            },
            {
              name: 'limit',
              type: 'number',
              label: label((t) => t.jobs.fields.limit),
              min: 1,
              admin: {
                description: label((t) => t.jobs.fields.limitDescription),
              },
            },
            {
              name: 'dryRun',
              type: 'checkbox',
              label: label((t) => t.jobs.fields.dryRun),
              defaultValue: false,
              admin: {
                description: label((t) => t.jobs.fields.dryRunDescription),
              },
            },
            {
              name: 'resume',
              type: 'checkbox',
              label: label((t) => t.jobs.fields.resume),
              defaultValue: false,
              admin: {
                description: label((t) => t.jobs.fields.resumeDescription),
              },
            },
          ],
        },
        {
          label: label((t) => t.jobs.tabs.authors),
          fields: [
            {
              name: 'authorsReport',
              type: 'json',
              label: label((t) => t.jobs.fields.authorsReport),
              admin: { readOnly: true },
            },
          ],
        },
        {
          label: label((t) => t.jobs.tabs.categories),
          fields: [
            {
              name: 'categoriesReport',
              type: 'json',
              label: label((t) => t.jobs.fields.categoriesReport),
              admin: { readOnly: true },
            },
          ],
        },
        {
          label: label((t) => t.jobs.tabs.media),
          fields: [
            {
              name: 'mediaReport',
              type: 'json',
              label: label((t) => t.jobs.fields.mediaReport),
              admin: { readOnly: true },
            },
          ],
        },
        {
          label: label((t) => t.jobs.tabs.posts),
          fields: [
            {
              name: 'postsReport',
              type: 'json',
              label: label((t) => t.jobs.fields.postsReport),
              admin: { readOnly: true },
            },
          ],
        },
        {
          label: label((t) => t.jobs.tabs.links),
          fields: [
            {
              name: 'linksReport',
              type: 'json',
              label: label((t) => t.jobs.fields.linksReport),
              admin: { readOnly: true },
            },
          ],
        },
        {
          label: label((t) => t.jobs.tabs.report),
          fields: [
            {
              name: 'runs',
              type: 'json',
              label: label((t) => t.jobs.fields.runs),
              admin: { readOnly: true },
            },
            {
              name: 'progress',
              type: 'json',
              label: label((t) => t.jobs.fields.progress),
              admin: { readOnly: true },
            },
            {
              name: 'errorsReport',
              type: 'json',
              label: label((t) => t.jobs.fields.errorsReport),
              admin: { readOnly: true },
            },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: label((t) => t.jobs.fields.status),
      defaultValue: 'queued',
      options: [
        { label: label((t) => t.jobs.status.queued), value: 'queued' },
        { label: label((t) => t.jobs.status.running), value: 'running' },
        { label: label((t) => t.jobs.status.paused), value: 'paused' },
        { label: label((t) => t.jobs.status.completed), value: 'completed' },
        { label: label((t) => t.jobs.status.failed), value: 'failed' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      label: label((t) => t.jobs.fields.startedAt),
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'finishedAt',
      type: 'date',
      label: label((t) => t.jobs.fields.finishedAt),
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
})
