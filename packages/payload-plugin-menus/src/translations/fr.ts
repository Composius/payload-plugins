import type { Translation } from './index.js'

export const fr: Translation = {
  fields: {
    anchor: 'Ancre',
    document: 'Document',
    links: 'Liens',
    linksCount: 'Nombre de liens',
    name: 'Nom',
    newTab: 'Ouvrir dans un nouvel onglet',
    title: 'Titre',
    url: 'URL',
  },
  links: {
    anchorDescription:
      'Facultatif. L’identifiant d’une section du document lié, sans le « # », pour y accéder directement.',
    external: 'Lien externe',
    externalPlural: 'Liens externes',
    internal: 'Lien interne',
    internalPlural: 'Liens internes',
    titleDescription:
      'Laissez-le vide pour utiliser le titre du document lié. Modifiez-le pour le remplacer.',
  },
  menus: {
    plural: 'Menus',
    singular: 'Menu',
  },
}
