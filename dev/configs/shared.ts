import type { Payload, Plugin } from 'payload'

import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { testEmailAdapter } from '../helpers/testEmailAdapter.js'

export type DevConfigOptions = {
  /** The suite directory (dev/configs/<suite>), used for per-suite db, media and types files. */
  dirname: string
  plugins: Plugin[]
  seed?: (payload: Payload) => Promise<void>
}

export const buildDevConfig = ({ dirname, plugins, seed }: DevConfigOptions) => {
  if (!process.env.ROOT_DIR) {
    process.env.ROOT_DIR = dirname
  }

  const databaseUrl =
    process.env.NODE_ENV === 'test'
      ? ':memory:'
      : process.env.DATABASE_URL || `file:${path.resolve(dirname, 'payload.db')}`

  return buildConfig({
    admin: {
      importMap: {
        // dev/ root, so every suite shares dev/app/(payload)/admin/importMap.js
        baseDir: path.resolve(dirname, '..', '..'),
      },
    },
    collections: [
      {
        slug: 'media',
        fields: [],
        upload: {
          staticDir: path.resolve(dirname, 'media'),
        },
      },
    ],
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
