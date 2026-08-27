'use client'

import type { PluginComponent, ToolbarGroup } from '@payloadcms/richtext-lexical'
import type { FC, JSX, Ref, RefObject } from 'react'

import { createClientFeature } from '@payloadcms/richtext-lexical/client'
import { Tooltip, useTranslation } from '@payloadcms/ui'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { EditorFontSize } from './sizes.js'

import { t } from '../../translations/index.js'
import { EDITOR_FONT_SIZES } from './sizes.js'
import {
  applyEditorFontSize,
  editorFontSize,
  setEditorFontSize,
  subscribeToEditorFontSize,
} from './store.js'
import { injectEditorFontSizeStyles } from './styles.js'

export type EditorFontSizeClientProps = {
  defaultSize: EditorFontSize
}

/** How big the "Aa" of each item is drawn — a preview, not the size itself. */
const ICON_FONT_SIZES: Record<EditorFontSize, string> = {
  huge: '17px',
  large: '15px',
  normal: '13px',
  small: '11px',
}

/** An "Aa" drawn at one of the four sizes, for the button and the dropdown items. */
const SizeIcon = ({ ref, size }: { ref?: Ref<HTMLSpanElement>; size: EditorFontSize }) => (
  <span
    aria-hidden="true"
    className="composius-editor-font-size__icon"
    ref={ref}
    style={{ fontSize: ICON_FONT_SIZES[size] }}
  >
    Aa
  </span>
)

const icon = (size: EditorFontSize) => {
  const Icon = () => <SizeIcon size={size} />

  Icon.displayName = `EditorFontSizeIcon(${size})`

  return Icon
}

const ICONS: Record<EditorFontSize, () => JSX.Element> = {
  huge: icon('huge'),
  large: icon('large'),
  normal: icon('normal'),
  small: icon('small'),
}

/**
 * Whether the pointer is over the dropdown button this icon sits in.
 *
 * The button is Payload's own and takes no tooltip of its own — the icon is the
 * only thing a toolbar group gets to render inside it — so the hover is read
 * off the button rather than off the icon alone, and the whole control answers
 * rather than just the two letters.
 */
const useButtonHover = (ref: RefObject<HTMLElement | null>): boolean => {
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const button = ref.current?.closest('button')

    if (!button) {
      return
    }

    const enter = () => setHovered(true)
    const leave = () => setHovered(false)

    button.addEventListener('pointerenter', enter)
    button.addEventListener('pointerleave', leave)

    return () => {
      button.removeEventListener('pointerenter', enter)
      button.removeEventListener('pointerleave', leave)
    }
  }, [ref])

  return hovered
}

/**
 * The icon the closed dropdown wears: the "Aa" of the size in force, and the
 * tooltip saying what it does — that the size is the editor's own, and not
 * something the site will show.
 *
 * Payload swaps in the active item's icon, but only once it has recomputed the
 * toolbar states — which it does from the editor state, and so not at all until
 * the editor holds a selection. Subscribing to the store instead means an
 * untouched editor still shows the size it is actually rendering at.
 *
 * Cached per default size so the button is the same component across renders.
 */
const currentIcons = new Map<EditorFontSize, FC>()

const currentIcon = (defaultSize: EditorFontSize): FC => {
  const cached = currentIcons.get(defaultSize)

  if (cached) {
    return cached
  }

  const Icon: FC = () => {
    const { i18n } = useTranslation()
    const ref = useRef<HTMLSpanElement>(null)
    const hovered = useButtonHover(ref)
    const size = useSyncExternalStore(
      subscribeToEditorFontSize,
      () => editorFontSize(defaultSize),
      () => defaultSize,
    )

    return (
      <>
        {/* Anchors itself to the dropdown button, which Payload positions. */}
        <Tooltip className="composius-editor-font-size__tooltip" show={hovered}>
          {t(i18n.language, (translation) => translation.editorFontSize.tooltip)}
        </Tooltip>
        <SizeIcon ref={ref} size={size} />
      </>
    )
  }

  Icon.displayName = `EditorFontSizeCurrentIcon(${defaultSize})`
  currentIcons.set(defaultSize, Icon)

  return Icon
}

/**
 * Sits after the feature buttons (50), at the end of the toolbar: it changes
 * how the editor looks to the person using it, not what the document holds.
 */
const toolbarGroup = (defaultSize: EditorFontSize): ToolbarGroup => ({
  type: 'dropdown',
  ChildComponent: currentIcon(defaultSize),
  items: EDITOR_FONT_SIZES.map((size) => ({
    ChildComponent: ICONS[size],
    // Read straight from the store rather than from the editor state: nothing
    // about the size is stored in the document. Payload recomputes the active
    // item after every mouseup, which is what a click on the item is.
    isActive: () => editorFontSize(defaultSize) === size,
    key: `editorFontSize-${size}`,
    label: ({ i18n }) => t(i18n.language, (translation) => translation.editorFontSize.sizes[size]),
    onSelect: () => setEditorFontSize(size),
  })),
  key: 'editorFontSize',
  order: 60,
})

/**
 * Carries the stylesheet and the size chosen last time. It renders nothing: the
 * whole effect is the scale custom property it writes on the document root.
 */
const EditorFontSizePlugin: PluginComponent<EditorFontSizeClientProps> = ({ clientProps }) => {
  const { defaultSize } = clientProps

  useEffect(() => {
    injectEditorFontSizeStyles()
    applyEditorFontSize(defaultSize)
  }, [defaultSize])

  return null
}

/**
 * Scales the text of the admin editor, and nothing else: the size is CSS over
 * Payload's own, never a mark on a node, so what a front end renders is
 * untouched by it. The choice is remembered in the browser, and applies to
 * every editor the feature is on.
 */
export const EditorFontSizeFeatureClient = createClientFeature<EditorFontSizeClientProps>(
  ({ props }) => ({
    plugins: [{ Component: EditorFontSizePlugin, position: 'normal' }],
    // `createClientFeature` only fills this in when the feature is a plain
    // object, and the plugin component above is handed nothing without it.
    sanitizedClientFeatureProps: props,
    toolbarFixed: { groups: [toolbarGroup(props.defaultSize)] },
  }),
)
