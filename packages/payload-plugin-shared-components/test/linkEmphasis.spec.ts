import { describe, expect, test } from 'vitest'

import { EditorLinkEmphasisFeature } from '../src/features/linkEmphasis/server.js'
import {
  EDITOR_LINK_EMPHASIS_CLASS,
  editorLinkEmphasisStyles,
} from '../src/features/linkEmphasis/styles.js'
import { contentEditorFeatures } from '../src/index.js'

const keys = (...args: Parameters<typeof contentEditorFeatures>): string[] => {
  const features = contentEditorFeatures(...args) as (args: never) => { key: string }[]

  return features({ defaultFeatures: [] } as never).map(({ key }) => key)
}

describe('EditorLinkEmphasisFeature', () => {
  test('points at the client feature of the plugin it was built for', async () => {
    const provider = EditorLinkEmphasisFeature({ clientModulePath: '@example/my-plugin/client' })
    const { ClientFeature } = await (
      provider.feature as (args: never) => Promise<{ ClientFeature: string }>
    )({} as never)

    expect(ClientFeature).toBe('@example/my-plugin/client#EditorLinkEmphasisFeatureClient')
  })
})

describe('contentEditorFeatures', () => {
  test('leaves the links as Payload draws them unless asked', () => {
    expect(keys('@example/my-plugin/client')).not.toContain('editorLinkEmphasis')
    expect(keys('@example/my-plugin/client', { emphasizeLinks: false })).not.toContain(
      'editorLinkEmphasis',
    )
  })

  test('emphasises them when asked', () => {
    expect(keys('@example/my-plugin/client', { emphasizeLinks: true })).toContain(
      'editorLinkEmphasis',
    )
  })
})

describe('editorLinkEmphasisStyles', () => {
  test('restyles links only under the class, so another editor is left alone', () => {
    const selectors = editorLinkEmphasisStyles.match(/^.*\.LexicalEditorTheme__link.*$/gm) ?? []

    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain(`.${EDITOR_LINK_EMPHASIS_CLASS} `)
    }
  })

  test('carries a colour for each admin theme', () => {
    expect(editorLinkEmphasisStyles).toMatch(/:root \{[^}]*--composius-editor-link-color:/)
    expect(editorLinkEmphasisStyles).toMatch(
      /html\[data-theme='dark'\] \{[^}]*--composius-editor-link-color:/,
    )
  })

  test('replaces the dotted border with a continuous underline', () => {
    expect(editorLinkEmphasisStyles).toContain('border-bottom-style: none')
    expect(editorLinkEmphasisStyles).toContain('text-decoration: underline')
  })
})
