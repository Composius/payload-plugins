import type { Access, PayloadRequest, ServerProps } from 'payload'

import React from 'react'

import type { CustomPanelRow, LocalizedText } from '../types.js'
import type { Translation } from '../translations/index.js'

import { resolveLocalizedText } from '../localized.js'
import { en } from '../translations/en.js'
import { fr } from '../translations/fr.js'
import { panelStyles } from './panelStyles.js'

const translations: Record<string, Translation> = { en, fr }

/** Icons that look like a URL or path render as `<img>`, anything else as text (emoji). */
const isImageIcon = (icon: string) => /^(https?:\/\/|\/|\.\/|data:)/.test(icon)

export type CustomPanelProps = ServerProps & {
  /** `access.read` resolved by the plugin, evaluated per request. */
  access: Access
  rows: CustomPanelRow[]
  title?: LocalizedText
}

/**
 * Server component rendered before the dashboard: evaluates the plugin's
 * `read` access for the current user and renders nothing when denied. All
 * text options accept a per-language record, resolved against the admin
 * language.
 */
export const CustomPanel = async ({
  access,
  i18n,
  payload,
  rows,
  title,
  user,
}: CustomPanelProps) => {
  // beforeDashboard components receive `payload` and `user` (not a full
  // request); access functions in practice only read `req.user`/`req.payload`.
  const allowed = await access({ req: { payload, user } as unknown as PayloadRequest })

  if (!allowed) {
    return null
  }

  const language = i18n?.language ?? 'en'
  const t = (translations[language] ?? en).customPanel
  const heading = resolveLocalizedText(title, language)

  const resolvedRows = rows
    .map((row) => ({
      links: row.links ?? [],
      message: resolveLocalizedText(row.message, language),
    }))
    .filter((row) => row.message || row.links.length > 0)

  if (!heading && resolvedRows.length === 0) {
    return null
  }

  return (
    <div className="custom-panel">
      <style>{panelStyles}</style>
      {heading ? <h2 className="custom-panel__title">{heading}</h2> : null}
      {resolvedRows.map((row, rowIndex) => (
        <div className="custom-panel__row" key={rowIndex}>
          {row.message ? <p className="custom-panel__message">{row.message}</p> : null}
          {row.links.length > 0 ? (
            <nav aria-label={t.linksLabel} className="custom-panel__links">
              {row.links.map((link, index) => (
                <a
                  className="custom-panel__button"
                  href={link.url}
                  key={index}
                  {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                >
                  {link.icon ? (
                    <span aria-hidden="true" className="custom-panel__button-icon">
                      {isImageIcon(link.icon) ? <img alt="" src={link.icon} /> : link.icon}
                    </span>
                  ) : null}
                  <span className="custom-panel__button-label">
                    {resolveLocalizedText(link.label, language)}
                  </span>
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      ))}
    </div>
  )
}
