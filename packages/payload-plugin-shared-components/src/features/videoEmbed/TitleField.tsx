'use client'

import type { TextFieldClientComponent } from 'payload'
import { TextField, useField, useFormFields, useTranslation } from '@payloadcms/ui'
import { useEffect, useRef } from 'react'
import { en } from '../../translations/en.js'
import { fr } from '../../translations/fr.js'
import { parseVideoEmbedUrl } from './providers.js'
import { fetchVideoTitle } from './titles.js'

/** Long enough that a pasted link is looked up once, not letter by letter. */
const DEBOUNCE_MS = 600

const sibling = (path: string, name: string): string => path.replace(/title$/, name)

const linkOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * The read-only `title` of a video embed, kept in step with the link as the
 * editor types it.
 *
 * The save fills this field too, and that pass is the authoritative one — a
 * title arriving from an API client is refetched rather than trusted. This is
 * only so the editor sees the title of the link they just pasted: autosave
 * stores what the hook resolves but never feeds it back into the open form, so
 * without this the field would stay blank until the next reload.
 *
 * All three providers allow cross-origin reads, so the lookup runs from the
 * admin panel with no endpoint of our own in between.
 */
export const VideoEmbedTitleField: TextFieldClientComponent = (props) => {
  const { path } = props
  const { i18n } = useTranslation()

  const url = useFormFields(([fields]) => fields[sibling(path, 'url')]?.value)
  const { setValue: setTitle } = useField<string>({ path })
  const { setValue: setUnavailable, value: unavailable } = useField<boolean>({
    path: sibling(path, 'titleUnavailable'),
  })

  const messages = (i18n.language === 'fr' ? fr : en).videoEmbed.errors

  const link = linkOf(url)
  const unsupported = link !== '' && parseVideoEmbedUrl(link) === null

  // A link of the wrong kind is the reason there is no title, and saying so
  // here is the earliest an editor hears about it: the `url` field's own
  // validation only speaks up once the document is submitted.
  const warning = unsupported
    ? messages.unsupportedLink
    : unavailable === true
      ? messages.titleUnavailable
      : undefined

  // Whatever title the form opened with was resolved from the link it opened
  // with; only a link that changes afterwards is worth asking about again.
  const resolvedFor = useRef(url)

  useEffect(() => {
    if (url === resolvedFor.current) {
      return
    }

    const video = parseVideoEmbedUrl(linkOf(url))

    // An empty or unsupported link has no title, and must not keep the old
    // one — the warning below the field says which of the two it is.
    if (!video) {
      resolvedFor.current = url
      setTitle('')
      setUnavailable(false)
      return
    }

    let current = true

    const timer = setTimeout(() => {
      void fetchVideoTitle(video).then((title) => {
        if (!current) {
          return
        }

        resolvedFor.current = url
        setTitle(title ?? '')
        setUnavailable(title === null)
      })
    }, DEBOUNCE_MS)

    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [setTitle, setUnavailable, url])

  return (
    <>
      {/* `admin.readOnly` reaches the default field renderer, not a component
          standing in for it: the field is ours to lock. */}
      <TextField {...props} readOnly />
      {warning ? <div className="field-description">{warning}</div> : null}
    </>
  )
}
