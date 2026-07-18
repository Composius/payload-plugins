import type { Translation } from './index.js'

export const fr: Translation = {
  errors: {
    lastAdminDelete: 'Le dernier utilisateur admin ne peut pas être supprimé.',
    lastAdminRole: "Le dernier utilisateur admin ne peut pas perdre le rôle d'admin.",
  },
  fields: {
    name: 'Nom',
    role: 'Rôle',
  },
  roles: {
    admin: 'Admin',
    editor: 'Éditeur',
    viewer: 'Lecteur',
  },
  users: {
    plural: 'Utilisateurs',
    singular: 'Utilisateur',
  },
}
