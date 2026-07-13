import type { Translation } from './index.js'

export const fr: Translation = {
  articles: {
    plural: 'Articles',
    singular: 'Article',
    fields: {
      category: 'Catégorie',
      content: 'Contenu',
      coverImage: 'Image de couverture',
      publishedAt: 'Publié le',
      seo: 'SEO',
      seoTitle: 'Titre',
      title: 'Titre',
    },
    messages: {
      noCategories: "Aucune catégorie pour l'instant. Créez-en une dans la collection Catégories.",
    },
  },
  categories: {
    plural: 'Catégories',
    singular: 'Catégorie',
    fields: {
      breadcrumbs: "Fil d'Ariane",
      description: 'Description',
      name: 'Nom',
      parent: 'Parent',
    },
  },
}
