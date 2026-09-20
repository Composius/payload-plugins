/**
 * Cache tag entry point. Imports nothing from `payload` or `next`, so front-end
 * code can build a tag without loading the CMS.
 */

export {
  articleIdTag,
  ARTICLES_TAG,
  articleTag,
  authorIdTag,
  AUTHORS_TAG,
  CATEGORIES_TAG,
  categoryIdTag,
  categoryTag,
} from '../tags.js'
