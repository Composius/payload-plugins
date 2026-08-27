/**
 * Puts a stylesheet in the document head, once per page.
 *
 * A plugin has no CSS file the host app would know to import, and these rules
 * are static, so the editor features carry their own — the `id` keeps the
 * second editor on the page from adding a duplicate.
 *
 * Everything injected this way is deliberately unlayered: Payload ships its
 * admin CSS inside `@layer payload-default`, and unlayered rules beat layered
 * ones whatever their specificity, so a single class selector is enough to win.
 */
export const injectStyles = (id: string, css: string): void => {
  if (document.getElementById(id)) {
    return
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.append(style)
}
