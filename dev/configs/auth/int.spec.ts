import type { Payload, RequiredDataFromCollectionSlug } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { devUser } from '../../helpers/credentials.js'
import config from './config.js'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

const findByEmail = async (email: string) => {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
  })
  expect(docs).toHaveLength(1)
  return docs[0]
}

const createUser = (email: string, role?: 'admin' | 'editor' | 'viewer') =>
  payload.create({
    collection: 'users',
    data: {
      email,
      name: email,
      password: 'test',
      ...(role ? { role } : {}),
    } as RequiredDataFromCollectionSlug<'users'>,
  })

describe('Plugin integration tests', () => {
  test('plugin adds the users auth collection', () => {
    expect(payload.collections['users']).toBeDefined()
    expect(payload.collections['users'].config.auth.maxLoginAttempts).toBe(5)
  })

  test('the first user is forced to the admin role', async () => {
    // seed.ts creates the dev user without a role
    const dev = await findByEmail(devUser.email)
    expect(dev.role).toBe('admin')
  })

  test('subsequent users default to the viewer role', async () => {
    const user = await createUser('defaulted@example.com')
    expect(user.role).toBe('viewer')
  })

  test('non-admins cannot create users', async () => {
    const editor = await findByEmail('editor@payloadcms.com')

    await expect(
      payload.create({
        collection: 'users',
        data: { email: 'sneaky@example.com', name: 'Sneaky', password: 'test', role: 'viewer' },
        overrideAccess: false,
        user: editor,
      }),
    ).rejects.toThrow()
  })

  test('non-admins read every user, not just themselves', async () => {
    const editor = await findByEmail('editor@payloadcms.com')

    const { docs } = await payload.find({
      collection: 'users',
      overrideAccess: false,
      user: editor,
    })

    // Default read access is isAuthenticated, so an editor sees other users
    // too — unlike update, which stays admin-or-self.
    const emails = docs.map((doc) => doc.email)
    expect(emails).toContain('editor@payloadcms.com')
    expect(emails).toContain(devUser.email)
  })

  test('logged-out visitors cannot read users', async () => {
    await expect(
      payload.find({ collection: 'users', overrideAccess: false, user: null }),
    ).rejects.toThrow()
  })

  test('non-admins can update their profile but not their role', async () => {
    const editor = await findByEmail('editor@payloadcms.com')

    const updated = await payload.update({
      collection: 'users',
      id: editor.id,
      data: { name: 'Renamed Editor', role: 'admin' },
      overrideAccess: false,
      user: editor,
    })

    expect(updated.name).toBe('Renamed Editor')
    // role change silently dropped by field-level access
    expect(updated.role).toBe('editor')
  })

  test('admins can change roles', async () => {
    const dev = await findByEmail(devUser.email)
    const user = await createUser('promoted@example.com')

    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: { role: 'editor' },
      overrideAccess: false,
      user: dev,
    })

    expect(updated.role).toBe('editor')
  })

  test('the last admin cannot be demoted', async () => {
    const dev = await findByEmail(devUser.email)

    await expect(
      payload.update({
        collection: 'users',
        id: dev.id,
        data: { role: 'viewer' },
      }),
    ).rejects.toThrow(/last admin/)
  })

  test('the last admin cannot be deleted', async () => {
    const dev = await findByEmail(devUser.email)

    await expect(payload.delete({ collection: 'users', id: dev.id })).rejects.toThrow(
      /last admin/,
    )
  })

  test('with a second admin, demotion and deletion are allowed', async () => {
    const second = await createUser('admin2@example.com', 'admin')

    const demoted = await payload.update({
      collection: 'users',
      id: second.id,
      data: { role: 'viewer' },
    })
    expect(demoted.role).toBe('viewer')

    await payload.update({ collection: 'users', id: second.id, data: { role: 'admin' } })
    await payload.delete({ collection: 'users', id: second.id })

    const { totalDocs } = await payload.count({
      collection: 'users',
      where: { role: { equals: 'admin' } },
    })
    expect(totalDocs).toBe(1)
  })
})
