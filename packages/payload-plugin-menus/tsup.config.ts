import { defineConfig } from 'tsup'

/**
 * The private @composius/payload-plugin-shared-components package is inlined
 * into dist/ (JS via the devDependency, types via the tsconfig `paths`
 * mapping), so the published package has no dependency on it.
 *
 * `next` is an optional peer, imported dynamically by the revalidation hooks:
 * listing it keeps esbuild from following that import and bundling the
 * framework into dist/.
 */
const common = {
  clean: false,
  dts: true,
  external: [/^next(\/|$)/],
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
    entry: { 'exports/tags': 'src/exports/tags.ts' },
  },
])
