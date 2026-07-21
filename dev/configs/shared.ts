import type { Payload, Plugin } from 'payload'

import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { testEmailAdapter } from '../helpers/testEmailAdapter.js'

export type DevConfigOptions = {
  /** Set to false when a plugin provides its own `media` collection. */
  defaultMediaCollection?: boolean
  /** The suite directory (dev/configs/<suite>), used for per-suite db, media and types files. */
  dirname: string
  plugins: Plugin[]
  seed?: (payload: Payload) => Promise<void>
}

export const buildDevConfig = ({
  defaultMediaCollection = true,
  dirname,
  plugins,
  seed,
}: DevConfigOptions) => {
  const devRoot = path.resolve(dirname, '..', '..')

  // Payload resolves the import map file from ROOT_DIR/app/(payload)/admin,
  // so it must point at the dev app root (not the suite dir) for
  // generate:importmap to work.
  if (!process.env.ROOT_DIR) {
    process.env.ROOT_DIR = devRoot
  }

  // Each suite generates its own map file, named after its directory. They used
  // to share one importMap.js, so generating for one suite wiped the entries of
  // whichever suite generated last — leaving the admin panel to fail with
  // "PayloadComponent not found in importMap". The hand-written aggregator at
  // app/(payload)/admin/importMap.js picks the right one per DEV_SUITE.
  const suite = path.basename(dirname)

  const databaseUrl =
    process.env.NODE_ENV === 'test'
      ? ':memory:'
      : process.env.DATABASE_URL || `file:${path.resolve(dirname, 'payload.db')}`

  return buildConfig({
    admin: {
      importMap: {
        baseDir: devRoot,
        importMapFile: path.resolve(devRoot, `app/(payload)/admin/importMaps/${suite}.js`),
      },
    },
    collections: defaultMediaCollection
      ? [
          {
            slug: 'media',
            fields: [],
            upload: {
              staticDir: path.resolve(dirname, 'media'),
            },
          },
        ]
      : [],
    db: sqliteAdapter({
      client: {
        url: databaseUrl,
      },
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: seed,
    plugins,
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}
