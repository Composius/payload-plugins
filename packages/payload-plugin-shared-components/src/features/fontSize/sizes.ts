/**
 * The four steps of the editor font size control, smallest first — the order
 * they appear in the toolbar dropdown.
 */
export const EDITOR_FONT_SIZES = ['small', 'normal', 'large', 'huge'] as const

export type EditorFontSize = (typeof EDITOR_FONT_SIZES)[number]

/** `normal` is the size Payload's lexical editor already draws at. */
export const DEFAULT_EDITOR_FONT_SIZE: EditorFontSize = 'normal'

/**
 * Multipliers over Payload's own editor font sizes, so `normal` (1) lands
 * exactly where the admin panel was before the control existed.
 */
export const EDITOR_FONT_SCALES: Record<EditorFontSize, number> = {
  huge: 1.5,
  large: 1.25,
  normal: 1,
  small: 0.875,
}

/** Custom property the stylesheet multiplies each font size by. */
export const EDITOR_FONT_SCALE_PROPERTY = '--composius-editor-font-scale'

/** Where the chosen size is remembered, per browser. */
export const EDITOR_FONT_SIZE_STORAGE_KEY = 'composius:editor-font-size'

export const isEditorFontSize = (value: unknown): value is EditorFontSize =>
  EDITOR_FONT_SIZES.includes(value as EditorFontSize)
