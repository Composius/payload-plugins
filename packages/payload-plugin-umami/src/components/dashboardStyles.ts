/**
 * Scoped styles for the Umami dashboard, injected via a `<style>` tag. Series
 * colors are categorical slots 1 (blue) & 2 (aqua) from the validated data-viz
 * palette, stepped per surface; chrome uses Payload's own admin theme variables
 * so the widgets match the panel in both light and dark themes.
 */
export const dashboardStyles = `
.umami-dashboard {
  --umami-series-views: #2a78d6;
  --umami-series-visitors: #1baf7a;
  --umami-grid: #e1e0d9;
  --umami-axis: #c3c2b7;
  --umami-muted: #898781;
  container-type: inline-size;
  margin-bottom: 2rem;
}
@media (prefers-color-scheme: dark) {
  .umami-dashboard {
    --umami-series-views: #3987e5;
    --umami-series-visitors: #199e70;
    --umami-grid: #2c2c2a;
    --umami-axis: #383835;
  }
}
html[data-theme='dark'] .umami-dashboard {
  --umami-series-views: #3987e5;
  --umami-series-visitors: #199e70;
  --umami-grid: #2c2c2a;
  --umami-axis: #383835;
}
html[data-theme='light'] .umami-dashboard {
  --umami-series-views: #2a78d6;
  --umami-series-visitors: #1baf7a;
  --umami-grid: #e1e0d9;
  --umami-axis: #c3c2b7;
}
.umami-dashboard__header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
// .umami-dashboard__title { font-size: 1.15rem; font-weight: 600; margin: 0; }
.umami-dashboard__select {
  background: var(--theme-elevation-50);
  border: 1px solid var(--theme-elevation-150);
  border-radius: 4px;
  color: var(--theme-text);
  padding: 0.4rem 0.6rem;
}
.umami-grid { display: grid; gap: 1rem; grid-template-columns: repeat(4, 1fr); }
.umami-card {
  background: var(--theme-elevation-50);
  border: 1px solid var(--theme-elevation-100);
  border-radius: 6px;
  padding: 1rem;
}
.umami-card__title { color: var(--theme-elevation-800); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
.umami-stat { display: flex; flex-direction: column; gap: 0.35rem; grid-column: span 1; }
.umami-stat__label { color: var(--theme-elevation-600); font-size: 0.85rem; }
.umami-stat__value { font-size: 2rem; font-weight: 700; line-height: 1; }
.umami-chart { grid-column: span 4; }
.umami-top { grid-column: span 2; }
.umami-top__list { list-style: none; margin: 0.75rem 0 0; padding: 0; }
.umami-top__row { align-items: baseline; display: flex; gap: 0.75rem; justify-content: space-between; padding: 0.3rem 0; }
.umami-top__name { color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.umami-top__value { color: var(--theme-elevation-800); font-variant-numeric: tabular-nums; font-weight: 600; }
.umami-empty { color: var(--theme-elevation-500); margin: 0.75rem 0 0; }
.umami-message { color: var(--theme-elevation-600); padding: 1rem 0; }
/* Responds to the widget's own width (it can be resized in the dashboard). */
@container (max-width: 900px) {
  .umami-grid { grid-template-columns: repeat(2, 1fr); }
  .umami-stat, .umami-top { grid-column: span 1; }
  .umami-chart { grid-column: span 2; }
}
`
