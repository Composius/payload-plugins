'use client'

import type { DefaultCellComponentProps } from 'payload'
import { useConfig, useListRelationships, useTranslation } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

type UserDoc = {
  email?: null | string
  name?: null | string
  [key: string]: unknown
}

const asString = (value: unknown): string => (typeof value === 'string' && value ? value : '')

/**
 * Resolves the display label of an editor: their `name`, then the users
 * collection's configured title field (`useAsTitle`, the "key field"), then
 * their `email`.
 */
const editorLabel = (doc: UserDoc, useAsTitle?: string): string =>
  asString(doc.name) || (useAsTitle ? asString(doc[useAsTitle]) : '') || asString(doc.email)

/**
 * List-view cell for the articles `editor` relationship. The list query yields
 * only the related user id, so this resolves the user through the shared
 * RelationshipProvider (the same batched, access-aware fetch the default
 * relationship cell uses) and renders name → title field → email.
 */
export const EditorCell: React.FC<DefaultCellComponentProps> = ({ cellData, field }) => {
  const { config } = useConfig()
  const { t } = useTranslation()
  const { documents, getRelationships } = useListRelationships()

  const relationTo = (field as { relationTo?: string }).relationTo
  const useAsTitle = config.collections?.find((collection) => collection.slug === relationTo)?.admin
    ?.useAsTitle

  // Normally the bare related id; tolerate an already-populated object too.
  const id =
    cellData && typeof cellData === 'object'
      ? (cellData as { id?: number | string }).id
      : (cellData as number | string | null)

  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (id == null || !relationTo || requested) {
      return
    }
    // Batched with every other relationship cell on the page by the provider.
    getRelationships([{ relationTo, value: id }])
    setRequested(true)
  }, [id, relationTo, requested, getRelationships])

  if (id == null || !relationTo) {
    return <span />
  }

  const doc = documents[relationTo]?.[id]

  // `null`/`undefined` = still loading, `false` = not found or not readable.
  if (doc == null) {
    return <span>{`${t('general:loading')}…`}</span>
  }
  if (doc === false) {
    return <span>{`${t('general:untitled')} - ID: ${id}`}</span>
  }

  return <span>{editorLabel(doc as UserDoc, useAsTitle) || `${t('general:untitled')} - ID: ${id}`}</span>
}
