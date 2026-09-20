export const en = {
  articles: {
    fields: {
      author: 'Author',
      category: 'Category',
      content: 'Content',
      coverImage: 'Cover Image',
      editor: 'Editor',
      publishedAt: 'Published At',
      seo: 'SEO',
      seoTitle: 'Title',
      title: 'Title',
    },
    messages: {
      noCategories: 'No categories yet. Create one in the Categories collection first.',
    },
    plural: 'Articles',
    singular: 'Article',
  },
  authors: {
    fields: {
      name: 'Name',
      avatarPreview: 'Avatar',
      biography: 'Biography',
      contact: 'Contact',
      contactDescription: 'Email, website, or any way to reach the author.',
      picture: 'Picture',
      pictureDescription: 'Falls back to a generated avatar when left empty.',
    },
    plural: 'Authors',
    singular: 'Author',
  },
  categories: {
    fields: {
      name: 'Name',
      articleCount: 'Articles',
      breadcrumbs: 'Breadcrumbs',
      description: 'Description',
      isDefault: 'Default',
      isDefaultDescription:
        'Given to articles saved without a category. Only one category can be the default: checking this box clears it on the previous one.',
      parent: 'Parent',
    },
    plural: 'Categories',
    singular: 'Category',
  },
}
