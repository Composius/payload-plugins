import type { EditorFontSize } from './sizes.js'

import {
  EDITOR_FONT_SCALE_PROPERTY,
  EDITOR_FONT_SCALES,
  EDITOR_FONT_SIZE_STORAGE_KEY,
  isEditorFontSize,
} from './sizes.js'

/**
 * The size in force, shared by every editor on the page: it is a property of
 * the person reading, not of the field they happen to be writing in. Set once
 * from storage (or from the plugin's default), then only by the toolbar.
 */
let current: EditorFontSize | undefined

const listeners = new Set<() => void>()

const stored = (): EditorFontSize | undefined => {
  try {
    const value = window.localStorage.getItem(EDITOR_FONT_SIZE_STORAGE_KEY)

    return isEditorFontSize(value) ? value : undefined
  } catch {
    // Storage refused (private window, blocked site data): the default stands.
    return undefined
  }
}

const remember = (size: EditorFontSize): void => {
  try {
    window.localStorage.setItem(EDITOR_FONT_SIZE_STORAGE_KEY, size)
  } catch {
    // The size still applies for this page; it just will not outlive it.
  }
}

/** The scale is set on the root, so nested editors are carried along with it. */
const paint = (size: EditorFontSize): void => {
  document.documentElement.style.setProperty(
    EDITOR_FONT_SCALE_PROPERTY,
    String(EDITOR_FONT_SCALES[size]),
  )
}

/**
 * The current size, falling back to what the plugin was configured with the
 * first time it is asked. Two editors configured with different defaults settle
 * on whichever was read first — the setting is one preference, not one per field.
 */
export const editorFontSize = (fallback: EditorFontSize): EditorFontSize => {
  current ??= stored() ?? fallback

  return current
}

export const applyEditorFontSize = (fallback: EditorFontSize): void =>
  paint(editorFontSize(fallback))

export const setEditorFontSize = (size: EditorFontSize): void => {
  current = size
  remember(size)
  paint(size)

  for (const listener of listeners) {
    listener()
  }
}

/**
 * Lets the toolbar icon follow the size without going through the editor state:
 * Payload only recomputes toolbar item states while the editor holds a
 * selection, so an untouched editor would otherwise show the wrong one.
 */
export const subscribeToEditorFontSize = (listener: () => void): (() => void) => {
  listeners.add(listener)

  return () => listeners.delete(listener)
}
