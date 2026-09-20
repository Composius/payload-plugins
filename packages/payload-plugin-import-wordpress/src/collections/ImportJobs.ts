import type { CollectionConfig, PayloadRequest } from 'payload'

import type { ImportAccess } from '../types.js'

import { TASK_SLUG } from '../defaults.js'
import { label } from '../translations/index.js'

export type ImportJobsOptions = {
  access: Required<ImportAccess>
  /**
   * When the plugin is disabled the collection stays registered (so the
   * database schema is unchanged) but is hidden from the admin UI and no
   * longer queues imports.
   */
  disabled: boolean
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
export const ImportJobs = ({ access, disabled }: ImportJobsOptions): CollectionConfig => ({
  slug: 'wp-import-jobs',
  access: {
    create: access.create,
    delete: access.delete,
    read: access.read,
    update: access.update,
  },
  admin: {
    defaultColumns: ['sourceUrl', 'status', 'dryRun', 'updatedAt'],
    group: 'WordPress import',
    useAsTitle: 'sourceUrl',
    // Hidden (with its nav group) once the plugin is disabled, while the
    // collection itself stays registered so the schema is unchanged.
    hidden: disabled,
  },
  labels: {
    plural: label((t) => t.jobs.plural),
    singular: label((t) => t.jobs.singular),
  },
  // A disabled plugin must not start imports, so the queueing hook is omitted.
  fields: [
    // Unnamed tabs keep their fields at the top level of the document data —
    // one tab per import step, so each step's outcome reads in its own tab.
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'sourceUrl',
              type: 'text',
              admin: {
                description: label((t) => t.jobs.fields.sourceUrlDescription),
              },
              label: label((t) => t.jobs.fields.sourceUrl),
              required: true,
            },
            {
              name: 'credentials',
              type: 'group',
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
                      admin: { width: '50%' },
                      label: label((t) => t.jobs.fields.username),
                    },
                    {
                      name: 'applicationPassword',
                      type: 'text',
                      admin: {
                        components: {
                          // Masked (•••) input instead of plain text.
                          Field:
                            '@composius/payload-plugin-import-wordpress/client#ApplicationPasswordFieldClient',
                        },
                        description: label((t) => t.jobs.fields.applicationPasswordDescription),
                        width: '50%',
                      },
                      label: label((t) => t.jobs.fields.applicationPassword),
                    },
                  ],
                },
              ],
              label: label((t) => t.jobs.fields.credentials),
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'dateFrom',
                  type: 'date',
                  admin: { date: { pickerAppearance: 'dayOnly' }, width: '50%' },
                  label: label((t) => t.jobs.fields.dateFrom),
                },
                {
                  name: 'dateTo',
                  type: 'date',
                  admin: { date: { pickerAppearance: 'dayOnly' }, width: '50%' },
                  label: label((t) => t.jobs.fields.dateTo),
                },
              ],
            },
            {
              name: 'limit',
              type: 'number',
              admin: {
                description: label((t) => t.jobs.fields.limitDescription),
              },
              label: label((t) => t.jobs.fields.limit),
              min: 1,
            },
            {
              name: 'dryRun',
              type: 'checkbox',
              admin: {
                description: label((t) => t.jobs.fields.dryRunDescription),
              },
              defaultValue: false,
              label: label((t) => t.jobs.fields.dryRun),
            },
            {
              name: 'resume',
              type: 'checkbox',
              admin: {
                description: label((t) => t.jobs.fields.resumeDescription),
              },
              defaultValue: false,
              label: label((t) => t.jobs.fields.resume),
            },
          ],
          label: label((t) => t.jobs.tabs.configuration),
        },
        {
          fields: [
            {
              name: 'authorsReport',
              type: 'json',
              admin: { readOnly: true },
              label: label((t) => t.jobs.fields.authorsReport),
            },
          ],
          label: label((t) => t.jobs.tabs.authors),
        },
        {
          fields: [
            {
              name: 'categoriesReport',
              type: 'json',
              admin: { readOnly: true },
              label: label((t) => t.jobs.fields.categoriesReport),
            },
          ],
          label: label((t) => t.jobs.tabs.categories),
        },
        {
          fields: [
            {
              name: 'mediaReport',
              type: 'json',
              admin: { readOnly: true },
              label: label((t) => t.jobs.fields.mediaReport),
            },
          ],
          label: label((t) => t.jobs.tabs.media),
        },
        {
          fields: [
            {
              name: 'postsReport',
              type: 'json',
              admin: { readOnly: true },
              label: label((t) => t.jobs.fields.postsReport),
            },
          ],
          label: label((t) => t.jobs.tabs.posts),
        },
        {
          fields: [
            {
              name: 'linksReport',
              type: 'json',
              admin: { readOnly: true },
              label: label((t) => t.jobs.fields.linksReport),
            },
          ],
          label: label((t) => t.jobs.tabs.links),
        },
        {
          fields: [
            {
              name: 'runs',
              type: 'json',
              admin: { readOnly: true },
              label: label((t) => t.jobs.fields.runs),
            },
            {
              name: 'progress',
              type: 'json',
              admin: { readOnly: true },
              label: label((t) => t.jobs.fields.progress),
            },
            {
              name: 'errorsReport',
              type: 'json',
              admin: { readOnly: true },
              label: label((t) => t.jobs.fields.errorsReport),
            },
          ],
          label: label((t) => t.jobs.tabs.report),
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      defaultValue: 'queued',
      label: label((t) => t.jobs.fields.status),
      options: [
        { label: label((t) => t.jobs.status.queued), value: 'queued' },
        { label: label((t) => t.jobs.status.running), value: 'running' },
        { label: label((t) => t.jobs.status.paused), value: 'paused' },
        { label: label((t) => t.jobs.status.completed), value: 'completed' },
        { label: label((t) => t.jobs.status.failed), value: 'failed' },
      ],
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar', readOnly: true },
      label: label((t) => t.jobs.fields.startedAt),
    },
    {
      name: 'finishedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar', readOnly: true },
      label: label((t) => t.jobs.fields.finishedAt),
    },
  ],
  hooks: disabled
    ? {}
    : {
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
                id: doc.id as number | string,
                collection: 'wp-import-jobs',
                context: { wpImport: true },
                data: { resume: false, status: 'queued' },
                req,
              })
              await queueImport(req, doc.id as number | string)
            }

            return doc
          },
        ],
      },
})
