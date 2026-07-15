import { defineConfig } from 'tsup'

/**
 * Two builds: the server entry (the plugin factory) and the rsc entry (the
 * panel server component). The panel has no interactivity, so there is no
 * client bundle at all. Peer dependencies (payload, react) stay external.
 */
const common = {
  format: 'esm' as const,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  splitting: false,
  clean: false,
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
