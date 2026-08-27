import { injectStyles } from '../injectStyles.js'

export const EDITOR_LINK_EMPHASIS_STYLE_ID = 'composius-editor-link-emphasis'

/**
 * Marks the one editor whose links are emphasised. Scoping to a class rather
 * than restyling `.LexicalEditorTheme__link` outright keeps the setting to the
 * plugin that asked for it: a host running both the articles and the pages
 * plugin can turn it on for one and leave the other as Payload draws it.
 */
export const EDITOR_LINK_EMPHASIS_CLASS = 'composius-editor-links--emphasized'

/**
 * Payload draws editor links in `--theme-success-750` (a green) under a dotted
 * border. Emphasised, they become blue and continuously underlined, which
 * separates them from the surrounding prose at a glance.
 *
 * The blue is ours: Payload's palette has elevation, success, error and warning
 * ramps, and no blue to borrow. Both values clear 4.5:1 against the admin
 * background of their theme. The theme is selected the way Payload selects it —
 * on `html[data-theme]`, which the admin panel always sets — rather than off
 * `prefers-color-scheme`, so a panel forced light on a dark system follows.
 */
export const editorLinkEmphasisStyles = `
:root {
  --composius-editor-link-color: #0b57d0;
}
html[data-theme='dark'] {
  --composius-editor-link-color: #8ab4f8;
}
.${EDITOR_LINK_EMPHASIS_CLASS} .LexicalEditorTheme__link {
  border-bottom-style: none;
  color: var(--composius-editor-link-color);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
`

export const injectEditorLinkEmphasisStyles = (): void =>
  injectStyles(EDITOR_LINK_EMPHASIS_STYLE_ID, editorLinkEmphasisStyles)
