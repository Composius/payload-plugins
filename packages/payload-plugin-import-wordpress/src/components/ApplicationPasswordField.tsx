'use client'
import type { TextFieldClientComponent } from 'payload'

import { PasswordField } from '@payloadcms/ui'

/**
 * Renders the WordPress application-password input masked (•••) instead of as
 * plain text, reusing Payload's own password field UI. The value is still a
 * regular text field in the database — this only changes the input widget.
 */
export const ApplicationPasswordFieldClient: TextFieldClientComponent = ({ field, path }) => (
  <PasswordField autoComplete="new-password" field={field} path={path} />
)
