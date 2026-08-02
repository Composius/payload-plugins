import type { Translation } from './index.js'

export const fr: Translation = {
  articles: {
    plural: 'Articles',
    singular: 'Article',
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
  },
  authors: {
    plural: 'Auteurs',
    singular: 'Auteur',
    fields: {
      avatarPreview: 'Avatar',
      biography: 'Biographie',
      contact: 'Contact',
      contactDescription: "E-mail, site web ou tout autre moyen de joindre l'auteur.",
      name: 'Nom',
      picture: 'Photo',
      pictureDescription: 'Un avatar généré est utilisé si ce champ est vide.',
    },
  },
  categories: {
    plural: 'Catégories',
    singular: 'Catégorie',
    fields: {
      articleCount: 'Articles',
      breadcrumbs: "Fil d'Ariane",
      description: 'Description',
      isDefault: 'Par défaut',
      isDefaultDescription:
        'Attribuée aux articles enregistrés sans catégorie. Une seule catégorie peut être celle par défaut : cocher cette case la retire de la précédente.',
      name: 'Nom',
      parent: 'Parent',
    },
  },
}
