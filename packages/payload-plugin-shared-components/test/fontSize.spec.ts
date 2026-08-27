import { describe, expect, test } from 'vitest'

import { EditorFontSizeFeature } from '../src/features/fontSize/server.js'
import { editorFontSizeStyles } from '../src/features/fontSize/styles.js'
import { contentEditorFeatures, EDITOR_FONT_SCALES, EDITOR_FONT_SIZES } from '../src/index.js'

type ProvidedFeature = {
  feature: unknown
  key: string
}

const provided = (...args: Parameters<typeof contentEditorFeatures>): ProvidedFeature[] => {
  const features = contentEditorFeatures(...args) as (args: never) => ProvidedFeature[]

  return features({ defaultFeatures: [] } as never)
}

/** Resolves a server feature the way Payload's editor sanitization does. */
const resolve = (feature: unknown) =>
  ((feature as ProvidedFeature).feature as (args: never) => Promise<{
    ClientFeature: string
    clientFeatureProps: unknown
  }>)({} as never)

describe('EditorFontSizeFeature', () => {
  test('points at the client feature of the plugin it was built for', async () => {
    const { ClientFeature } = await resolve(
      EditorFontSizeFeature({ clientModulePath: '@example/my-plugin/client' }),
    )

    expect(ClientFeature).toBe('@example/my-plugin/client#EditorFontSizeFeatureClient')
  })

  test('opens at the given size', async () => {
    const { clientFeatureProps } = await resolve(
      EditorFontSizeFeature({ clientModulePath: '@example/my-plugin/client', defaultSize: 'huge' }),
    )

    expect(clientFeatureProps).toEqual({ defaultSize: 'huge' })
  })

  test('falls back to the size Payload already draws at', async () => {
    const { clientFeatureProps } = await resolve(
      EditorFontSizeFeature({ clientModulePath: '@example/my-plugin/client' }),
    )

    expect(clientFeatureProps).toEqual({ defaultSize: 'normal' })
  })
})

describe('contentEditorFeatures', () => {
  test('carries the font size control by default, at the normal size', async () => {
    const feature = provided('@example/my-plugin/client').find(({ key }) => key === 'editorFontSize')

    expect(feature).toBeDefined()
    expect((await resolve(feature)).clientFeatureProps).toEqual({ defaultSize: 'normal' })
  })

  test('passes the configured size on to the control', async () => {
    const feature = provided('@example/my-plugin/client', { fontSize: 'large' }).find(
      ({ key }) => key === 'editorFontSize',
    )

    expect((await resolve(feature)).clientFeatureProps).toEqual({ defaultSize: 'large' })
  })

  test('leaves the control out when it is turned off', () => {
    const keys = provided('@example/my-plugin/client', { fontSize: false }).map(({ key }) => key)

    expect(keys).not.toContain('editorFontSize')
  })
})

describe('editorFontSizeStyles', () => {
  test('scales every size off the custom property, so an unset one changes nothing', () => {
    const declarations = editorFontSizeStyles.match(/font-size: [^;]+;/g) ?? []

    expect(declarations.length).toBeGreaterThan(0)
    for (const declaration of declarations) {
      expect(declaration).toMatch(
        /^font-size: calc\(\d+px \* var\(--composius-editor-font-scale, 1\)\);$/,
      )
    }
  })
})

describe('EDITOR_FONT_SCALES', () => {
  test('leaves `normal` at what Payload already renders, and orders the rest around it', () => {
    expect(EDITOR_FONT_SCALES.normal).toBe(1)

    const scales = EDITOR_FONT_SIZES.map((size) => EDITOR_FONT_SCALES[size])

    expect(scales).toEqual([...scales].sort((a, b) => a - b))
  })
})
