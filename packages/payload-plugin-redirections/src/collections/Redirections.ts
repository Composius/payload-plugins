import type {
  Access,
  CollectionAdminOptions,
  CollectionBeforeValidateHook,
  CollectionConfig,
  CollectionSlug,
  Endpoint,
  Field,
  TextFieldSingleValidation,
} from 'payload'

import { ValidationError } from 'payload'

import type { RedirectionMatchType } from '../types.js'

import { DEFAULT_STATUS, MATCH_TYPES, STATUSES } from '../constants.js'
import { isSelfRedirect, validateDestination, validateSource } from '../lib/validation.js'
import { label, t } from '../translations/index.js'

export type RedirectionsAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type RedirectionsOptions = {
  access: Required<RedirectionsAccess>
  /** Endpoints mounted under the collection route (`/api/<slug>/…`). */
  endpoints: Endpoint[]
  /**
   * Excludes the collection from the admin nav and routes. The collection stays
   * registered, so the database schema and the API are unchanged.
   */
  hidden: CollectionAdminOptions['hidden']
  slug: string
}

const trim = ({ value }: { value?: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value

const matchTypeOf = (siblingData: unknown): RedirectionMatchType =>
  (siblingData as { matchType?: RedirectionMatchType } | undefined)?.matchType ?? 'exact'

const validateFrom: TextFieldSingleValidation = (value, { req, siblingData }) => {
  if (typeof value !== 'string' || value.length === 0) {
    // `required` already reports an empty value.
    return true
  }

  const issue = validateSource(value, matchTypeOf(siblingData))
  if (!issue) {
    return true
  }

  const message = t(req?.i18n?.language, (m) => m.errors[issue.code])

  return issue.detail ? `${message}: ${issue.detail}` : message
}

const validateTo: TextFieldSingleValidation = (value, { req, siblingData }) => {
  if (typeof value !== 'string' || value.length === 0) {
    return true
  }

  const issue = validateDestination(value)
  if (issue) {
    return t(req?.i18n?.language, (m) => m.errors[issue.code])
  }

  const from = (siblingData as { from?: string } | undefined)?.from
  if (from && isSelfRedirect(from, value, matchTypeOf(siblingData))) {
    return t(req?.i18n?.language, (m) => m.errors.selfRedirect)
  }

  return true
}

/**
 * Rejects a duplicate `(from, matchType)` pair with a readable message. The
 * compound unique index below is the real guard — this only keeps the editor
 * from meeting a raw database error.
 */
const rejectDuplicates =
  (slug: string): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req }) => {
    const from = (data?.from ?? originalDoc?.from) as string | undefined
    const matchType = (data?.matchType ?? originalDoc?.matchType) as
      | RedirectionMatchType
      | undefined

    if (!from || !matchType || !req?.payload) {
      return data
    }

    const id = (originalDoc as { id?: number | string } | undefined)?.id

    const { totalDocs } = await req.payload.count({
      collection: slug as CollectionSlug,
      req,
      where: {
        and: [
          { from: { equals: from } },
          { matchType: { equals: matchType } },
          ...(id === undefined ? [] : [{ id: { not_equals: id } }]),
        ],
      },
    })

    if (totalDocs > 0) {
      throw new ValidationError({
        collection: slug,
        errors: [{ message: t(req.i18n?.language, (m) => m.errors.duplicate), path: 'from' }],
        req,
      })
    }

    return data
  }

const fields: Field[] = [
  {
    name: 'from',
    type: 'text',
    admin: { description: label((m) => m.descriptions.from) },
    hooks: { beforeValidate: [trim] },
    index: true,
    label: label((m) => m.fields.from),
    required: true,
    validate: validateFrom,
  },
  {
    name: 'matchType',
    type: 'select',
    defaultValue: 'exact',
    label: label((m) => m.fields.matchType),
    options: MATCH_TYPES.map((value) => ({
      label: label((m) => m.matchTypes[value]),
      value,
    })),
    required: true,
  },
  {
    name: 'to',
    type: 'text',
    admin: { description: label((m) => m.descriptions.to) },
    hooks: { beforeValidate: [trim] },
    label: label((m) => m.fields.to),
    required: true,
    validate: validateTo,
  },
  {
    name: 'status',
    type: 'select',
    defaultValue: String(DEFAULT_STATUS),
    label: label((m) => m.fields.status),
    options: STATUSES.map((value) => ({
      label: label((m) => m.statuses[value]),
      value: String(value),
    })),
    required: true,
  },
  {
    name: 'preserveQuery',
    type: 'checkbox',
    admin: { description: label((m) => m.descriptions.preserveQuery) },
    defaultValue: true,
    label: label((m) => m.fields.preserveQuery),
  },
  {
    name: 'enabled',
    type: 'checkbox',
    defaultValue: true,
    index: true,
    label: label((m) => m.fields.enabled),
  },
  {
    name: 'priority',
    type: 'number',
    admin: { description: label((m) => m.descriptions.priority), step: 1 },
    defaultValue: 0,
    label: label((m) => m.fields.priority),
  },
]

export const Redirections = ({
  access,
  endpoints,
  hidden,
  slug,
}: RedirectionsOptions): CollectionConfig => ({
  slug,
  labels: {
    singular: label((m) => m.redirections.singular),
    plural: label((m) => m.redirections.plural),
  },
  access: {
    read: access.read,
    create: access.create,
    update: access.update,
    delete: access.delete,
  },
  admin: {
    useAsTitle: 'from',
    defaultColumns: ['from', 'matchType', 'to', 'status', 'enabled', 'updatedAt'],
    listSearchableFields: ['from', 'to'],
    hidden,
  },
  endpoints,
  fields,
  hooks: {
    beforeValidate: [rejectDuplicates(slug)],
  },
  // The same path is a legitimate exact rule *and* prefix rule, so `from`
  // alone cannot be unique — the pair is what must not repeat.
  indexes: [{ fields: ['from', 'matchType'], unique: true }],
})
