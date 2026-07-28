/**
 * Cache tag entry point. Imports nothing from `payload` or `next`, so front-end
 * code can build a tag without loading the CMS.
 */

export {
  articleIdTag,
  articleTag,
  ARTICLES_TAG,
  authorIdTag,
  AUTHORS_TAG,
  categoryIdTag,
  categoryTag,
  CATEGORIES_TAG,
} from '../tags.js'
