import type { CollectionConfig, Config } from 'payload'

export type PayloadVwArticlesConfig = {
  disabled?: boolean
}

export const payloadVwArticles =
  (pluginOptions: PayloadVwArticlesConfig = {}) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    const articles: CollectionConfig = {
      slug: 'articles',
      admin: {
        defaultColumns: ['title', 'slug', 'publishedAt'],
        useAsTitle: 'title',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'slug',
          type: 'text',
          index: true,
          unique: true,
        },
        {
          name: 'coverImage',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'content',
          type: 'richText',
        },
        {
          name: 'publishedAt',
          type: 'date',
        },
      ],
    }

    config.collections.push(articles)

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    return config
  }
