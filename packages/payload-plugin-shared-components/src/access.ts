import type { Access, FieldAccess } from 'payload'

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** Field-level equivalent of `authenticated`: any authenticated user. */
export const authenticatedField: FieldAccess = ({ req: { user } }) => Boolean(user)

export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }

  return {
    _status: {
      equals: 'published',
    },
  }
}
