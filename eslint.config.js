// @ts-check

import payloadEsLintConfig from '@payloadcms/eslint-config'

export const defaultESLintIgnores = [
  '**/.temp',
  '**/.*', // ignore all dotfiles
  '**/.git',
  '**/.hg',
  '**/.pnp.*',
  '**/.svn',
  '**/playwright.config.ts',
  '**/vitest.config.js',
  '**/tsconfig.tsbuildinfo',
  '**/README.md',
  '**/eslint.config.js',
  '**/payload-types.ts',
  '**/dist/',
  '**/.yarn/',
  '**/build/',
  '**/node_modules/',
  '**/temp/',
]

export default [
  // Must come first and stand alone: an `ignores` key with no other key is a
  // global ignore, and without it ESLint's flat config only skips
  // `node_modules/` and `.git/` — it walks build output (`dist/`, `.next/`)
  // and generated sources otherwise, which is thousands of files that no rule
  // should be reading.
  { ignores: defaultESLintIgnores },
  ...payloadEsLintConfig,
  {
    rules: {
      'no-restricted-exports': 'off',
      // Off because ESLint and `tsc` do not see the same types here, so the
      // rule reports assertions that are load-bearing — and its fixer deletes
      // them, breaking `pnpm typecheck`.
      //
      // A package's own tsconfig includes `src` alone, so when ESLint resolves
      // a plugin's file it sees no generated Payload types and `CollectionSlug`
      // widens to `string`, making `slug as CollectionSlug` look redundant.
      // `tsc` runs from the root tsconfig, which also includes `dev/`, where
      // the generated `payload-types.ts` narrow `CollectionSlug` to a union of
      // real slugs — and there the assertion is required.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      // `warn`/`error` are the only channel available at the two places these
      // plugins report trouble: a plugin factory runs while the config is
      // being built, before there is a Payload logger, and a client component
      // runs in the browser, where there is no server logger at all.
      // `log`/`debug` stay banned.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
        projectService: {
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 40,
          allowDefaultProject: [
            'scripts/*.ts',
            '*.js',
            '*.mjs',
            '*.spec.ts',
            '*.d.ts',
            // Build configs sit outside every tsconfig: the root one includes
            // `packages/*/src` and `packages/*/test`, and each package's own
            // includes `src`. Without this they fail to parse rather than lint.
            // (`**` is rejected here, so the depth is spelled out.)
            'packages/*/tsup.config.ts',
          ],
        },
        // projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/test/**/*.ts', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      // A stub standing in for an async interface — `typeof fetch`,
      // `payload.count`, a transport factory — has to return a promise to
      // typecheck, and has nothing of its own to await. Dropping `async` to
      // satisfy the rule would change the return type and break the contract
      // the double exists to satisfy.
      '@typescript-eslint/require-await': 'off',
    },
  },
]
