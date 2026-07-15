import type { Access } from 'payload'

/**
 * A plain string, or a per-language record keyed by admin language code
 * (e.g. `{ en: 'Welcome', fr: 'Bienvenue' }`).
 */
export type LocalizedText = string | Record<string, string>

export type CustomPanelLink = {
  /**
   * Icon shown above the label: an emoji or short text (e.g. `'📄'`), or an
   * image URL / path (`https://…`, `/…` or `data:` — rendered as `<img>`).
   */
  icon?: string
  /** Button label, plain or per-language. */
  label: LocalizedText
  /**
   * Open the link in a new tab.
   * @default false
   */
  newTab?: boolean
  /** Destination URL — absolute (`https://…`) or app-relative (`/admin/…`). */
  url: string
}

export type CustomPanelRow = {
  /** Link buttons for this row, rendered as tiles next to the message. */
  links?: CustomPanelLink[]
  /** Message shown at the start of the row, plain or per-language. */
  message?: LocalizedText
}

export type CustomPanelAccess = {
  /** Who can see the panel. Default: any authenticated user. */
  read?: Access
}
