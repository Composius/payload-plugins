import { injectStyles } from '../injectStyles.js'
import { EDITOR_FONT_SCALE_PROPERTY } from './sizes.js'

export const EDITOR_FONT_SIZE_STYLE_ID = 'composius-editor-font-size'

const scaled = (px: number): string => `calc(${px}px * var(${EDITOR_FONT_SCALE_PROPERTY}, 1))`

/**
 * Restates the font sizes Payload gives the lexical editor as a multiple of the
 * scale custom property. Every value below is the one Payload already uses, so
 * an unset property (or a scale of 1) leaves the editor exactly as it was.
 *
 * Only the prose is listed: the chrome of a block, a relationship or an upload
 * keeps its own size, being panel UI rather than the text being written. Sizes
 * expressed in `em` — inline code, sub/superscript, list markers — follow along
 * on their own.
 */
export const editorFontSizeStyles = `
.LexicalEditorTheme__paragraph,
.LexicalEditorTheme__quote,
.LexicalEditorTheme__listItem,
.LexicalEditorTheme__placeholder,
.LexicalEditorTheme__h6 {
  font-size: ${scaled(16)};
}
.LexicalEditorTheme__h1 {
  font-size: ${scaled(28)};
}
.LexicalEditorTheme__h2 {
  font-size: ${scaled(25)};
}
.LexicalEditorTheme__h3 {
  font-size: ${scaled(22)};
}
.LexicalEditorTheme__h4 {
  font-size: ${scaled(20)};
}
.LexicalEditorTheme__h5 {
  font-size: ${scaled(18)};
}
.composius-editor-font-size__icon {
  align-items: center;
  display: inline-flex;
  font-weight: 600;
  height: 20px;
  justify-content: center;
  line-height: 1;
  width: 20px;
}
/*
 * Sized to its own text rather than to the button it hangs off. The tooltip is
 * absolutely positioned inside a button barely wider than the "Aa", so the
 * moment wrapping is allowed it collapses to that width and folds a short
 * sentence into a column of single words. Payload's own tooltips get this from
 * white-space: nowrap; saying it here keeps it true whatever it inherits.
 */
.composius-editor-font-size__tooltip {
  white-space: nowrap;
  width: max-content;
}
`

export const injectEditorFontSizeStyles = (): void =>
  injectStyles(EDITOR_FONT_SIZE_STYLE_ID, editorFontSizeStyles)
