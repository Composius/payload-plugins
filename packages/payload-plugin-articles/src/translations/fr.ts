import type { Translation } from './index.js'

export const fr: Translation = {
  articles: {
    fields: {
      author: 'Auteur',
      category: 'Catégorie',
      content: 'Contenu',
      coverImage: 'Image de couverture',
      editor: 'Rédacteur',
      publishedAt: 'Publié le',
      seo: 'SEO',
      seoTitle: 'Titre',
      title: 'Titre',
    },
    messages: {
      noCategories: "Aucune catégorie pour l'instant. Créez-en une dans la collection Catégories.",
    },
    plural: 'Articles',
    singular: 'Article',
  },
  authors: {
    fields: {
      name: 'Nom',
      avatarPreview: 'Avatar',
      biography: 'Biographie',
      contact: 'Contact',
      contactDescription: "E-mail, site web ou tout autre moyen de joindre l'auteur.",
      picture: 'Photo',
      pictureDescription: 'Un avatar généré est utilisé si ce champ est vide.',
    },
    plural: 'Auteurs',
    singular: 'Auteur',
  },
  categories: {
    fields: {
      name: 'Nom',
      articleCount: 'Articles',
      breadcrumbs: "Fil d'Ariane",
      description: 'Description',
      isDefault: 'Par défaut',
      isDefaultDescription:
        'Attribuée aux articles enregistrés sans catégorie. Une seule catégorie peut être celle par défaut : cocher cette case la retire de la précédente.',
      parent: 'Parent',
    },
    plural: 'Catégories',
    singular: 'Catégorie',
  },
}
