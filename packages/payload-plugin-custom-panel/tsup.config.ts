import { defineConfig } from 'tsup'

/**
 * Two builds: the server entry (the plugin factory) and the rsc entry (the
 * panel server component). The panel has no interactivity, so there is no
 * client bundle at all. Peer dependencies (payload, react) stay external.
 */
const common = {
  clean: false,
  dts: true,
  format: 'esm' as const,
  outDir: 'dist',
  sourcemap: true,
  splitting: false,
}

export default defineConfig([
  {
    ...common,
    entry: { index: 'src/index.ts' },
  },
  {
    ...common,
    entry: { 'exports/rsc': 'src/exports/rsc.ts' },
  },
])
