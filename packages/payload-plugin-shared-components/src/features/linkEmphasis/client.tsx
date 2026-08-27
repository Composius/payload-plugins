'use client'

import type { PluginComponent } from '@payloadcms/richtext-lexical'

import { createClientFeature, useEditorConfigContext } from '@payloadcms/richtext-lexical/client'
import { useEffect } from 'react'

import { EDITOR_LINK_EMPHASIS_CLASS, injectEditorLinkEmphasisStyles } from './styles.js'

/**
 * Marks this editor's root element, which is what the stylesheet keys off.
 *
 * `registerRootListener` rather than a one-off read: it fires with the root as
 * it stands and again whenever Lexical swaps it, and hands back the element it
 * is leaving so the class does not outlive the editor that asked for it.
 */
const EditorLinkEmphasisPlugin: PluginComponent = () => {
  const { editor } = useEditorConfigContext()

  useEffect(() => {
    injectEditorLinkEmphasisStyles()

    return editor.registerRootListener((root, previousRoot) => {
      previousRoot?.classList.remove(EDITOR_LINK_EMPHASIS_CLASS)
      root?.classList.add(EDITOR_LINK_EMPHASIS_CLASS)
    })
  }, [editor])

  return null
}

/**
 * Draws the links of this editor in blue and underlines them continuously,
 * where Payload draws them green under a dotted border. CSS over the admin
 * panel and nothing else: no node carries the emphasis, so a front end styles
 * its links however it already did.
 */
export const EditorLinkEmphasisFeatureClient = createClientFeature({
  plugins: [{ Component: EditorLinkEmphasisPlugin, position: 'normal' }],
})
