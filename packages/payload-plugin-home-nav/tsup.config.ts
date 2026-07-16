import { defineConfig } from 'tsup'

/**
 * Two builds: the server entry (the plugin factory) and the rsc entry (the
 * icon-label and nav-link server components). Both components are server
 * components — the interactive bits (PayloadIcon, Link) come from
 * @payloadcms/ui, which stays external — so there is no client bundle at all.
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
