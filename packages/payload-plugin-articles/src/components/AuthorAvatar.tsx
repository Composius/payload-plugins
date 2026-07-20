'use client'

import type { UIFieldClientComponent } from 'payload'
import Avatar from 'boring-avatars'
import { useFormFields } from '@payloadcms/ui'
import React from 'react'

/**
 * Sidebar preview of the author avatar. When no `picture` is uploaded, the
 * avatar falls back to a deterministic `boring-avatars` "beam" generated from
 * the author name — the same avatar a front-end can reproduce from the name.
 * Hidden once a picture is set (the upload field shows it instead).
 */
export const AuthorAvatar: UIFieldClientComponent = () => {
  const name = useFormFields(([fields]) => fields?.name?.value as string | undefined)
  const picture = useFormFields(([fields]) => fields?.picture?.value)

  if (picture) {
    return null
  }

  return (
    <div className="field-type">
      <Avatar name={name || 'Author'} variant="beam" size={80} square={false} />
    </div>
  )
}
