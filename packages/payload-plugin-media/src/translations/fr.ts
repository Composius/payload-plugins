import type { Translation } from './index.js'

export const fr: Translation = {
  errors: {
    fileTooLarge: (max: string) =>
      `Le fichier est trop volumineux. La taille maximale est de ${max}.`,
  },
  fields: {
    alt: 'Texte alternatif',
  },
  media: {
    plural: 'Médias',
    singular: 'Média',
  },
}
