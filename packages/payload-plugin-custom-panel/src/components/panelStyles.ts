/**
 * Scoped styles for the panel, injected via a `<style>` tag. Everything uses
 * Payload's own admin theme variables so the panel matches the panel chrome
 * in both light and dark themes.
 */
export const panelStyles = `
.custom-panel {
  background: var(--theme-elevation-0);
  border: 1px solid var(--theme-elevation-100);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 1.25rem 1.5rem;
}
.custom-panel__title {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
}
.custom-panel__row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.custom-panel__message {
  color: var(--theme-elevation-600);
  font-size: 1.15rem;
  margin: 0;
  white-space: pre-line;
}
.custom-panel__links {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}
/* Sized like the dashboard's collection cards. */
.custom-panel__button {
  background: var(--theme-elevation-0);
  border: 1px solid var(--theme-elevation-150);
  border-radius: 6px;
  color: var(--theme-text);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  justify-content: flex-end;
  min-height: 100px;
  padding: 1.25rem;
  text-decoration: none;
}
.custom-panel__button:hover {
  background: var(--theme-elevation-100);
  border-color: var(--theme-elevation-250);
}
.custom-panel__button-icon {
  font-size: 2rem;
  line-height: 1;
}
.custom-panel__button-icon img {
  height: 2rem;
  width: auto;
}
.custom-panel__button-label {
  font-size: 1.15rem;
  font-weight: 600;
}
`
