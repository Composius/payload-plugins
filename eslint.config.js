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
]
