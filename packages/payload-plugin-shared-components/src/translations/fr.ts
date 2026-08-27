import type { Translation } from './index.js'

export const fr: Translation = {
  editorFontSize: {
    sizes: {
      huge: 'Très grand',
      large: 'Grand',
      normal: 'Normal',
      small: 'Petit',
    },
    tooltip: 'Taille du texte dans l’éditeur seulement',
  },
  videoEmbed: {
    errors: {
      titleUnavailable: 'La plateforme n’a renvoyé aucun titre pour ce lien',
      unsupportedLink: 'Aucun titre : ce lien n’est pas une vidéo YouTube, Vimeo ou Gan Jing World',
      unsupportedUrl: 'Saisissez le lien d’une vidéo YouTube, Vimeo ou Gan Jing World',
    },
    fields: {
      title: 'Titre',
      url: 'Lien de la vidéo',
      urlDescription: 'Collez le lien d’une vidéo YouTube, Vimeo ou Gan Jing World',
    },
    plural: 'Vidéos',
    singular: 'Vidéo',
  },
}
