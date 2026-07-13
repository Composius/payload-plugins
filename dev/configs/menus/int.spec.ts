import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import config from './config.js'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('Plugin integration tests', () => {
  test('plugin adds the menus collection', () => {
    expect(payload.collections['menus']).toBeDefined()
  })

  test('can create a menu', async () => {
    const menu = await payload.create({
      collection: 'menus',
      data: {
        title: 'Footer menu',
      },
    })

    expect(menu.title).toBe('Footer menu')
  })
})
