import { defineConfig } from 'tsup'

/**
 * Two builds: the Payload entry (collection + rules endpoint) and the Next.js
 * entry (proxy helper + resolver). The Next entry has to load on the edge
 * runtime, so `payload` is marked external there — an accidental import fails
 * the build instead of shipping.
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
    entry: { 'exports/next': 'src/exports/next.ts' },
    external: ['next', 'next/server', 'payload'],
  },
])
