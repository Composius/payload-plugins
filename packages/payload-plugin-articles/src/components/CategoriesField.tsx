'use client'

import type { RelationshipFieldClientComponent } from 'payload'
import { CheckboxInput, FieldLabel, useConfig, useField, useTranslation } from '@payloadcms/ui'
import React, { useEffect, useMemo, useState } from 'react'
import { en } from '../translations/en.js'
import { fr } from '../translations/fr.js'

type CategoryId = number | string

type CategoryDoc = {
  id: CategoryId
  name: string
  parent?: CategoryId | { id: CategoryId } | null
}

const parentId = (category: CategoryDoc): CategoryId | null => {
  if (category.parent && typeof category.parent === 'object') {
    return category.parent.id
  }
  return category.parent ?? null
}

type CategoryBranchProps = {
  childrenByParent: Map<CategoryId | null, CategoryDoc[]>
  depth: number
  onToggle: (id: CategoryId) => void
  parent: CategoryId | null
  path: string
  readOnly?: boolean
  value: CategoryId[]
}

const CategoryBranch = ({
  childrenByParent,
  depth,
  onToggle,
  parent,
  path,
  readOnly,
  value,
}: CategoryBranchProps) => {
  const categories = childrenByParent.get(parent)

  if (!categories?.length) {
    return null
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {categories.map((category) => (
        <li key={category.id} style={{ paddingLeft: depth ? 20 : 0, marginTop: 8 }}>
          <CheckboxInput
            checked={value.includes(category.id)}
            id={`${path}-category-${category.id}`}
            Label={<span>{category.name}</span>}
            onToggle={() => onToggle(category.id)}
            readOnly={readOnly}
          />
          <CategoryBranch
            childrenByParent={childrenByParent}
            depth={depth + 1}
            onToggle={onToggle}
            parent={category.id}
            path={path}
            readOnly={readOnly}
            value={value}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * Renders the articles `categories` relationship as a checkbox tree, with
 * child categories indented under their parent.
 */
export const CategoriesFieldClient: RelationshipFieldClientComponent = ({ field, path, readOnly }) => {
  const { config } = useConfig()
  const { i18n } = useTranslation()
  const { setValue, value } = useField<CategoryId[]>({ path })
  const [categories, setCategories] = useState<CategoryDoc[]>()

  const noCategoriesMessage = (i18n.language === 'fr' ? fr : en).articles.messages.noCategories

  useEffect(() => {
    const controller = new AbortController()

    const fetchCategories = async () => {
      try {
        const response = await fetch(
          `${config.serverURL}${config.routes.api}/categories?limit=0&depth=0&sort=name`,
          { credentials: 'include', signal: controller.signal },
        )
        if (response.ok) {
          const data = (await response.json()) as { docs: CategoryDoc[] }
          setCategories(data.docs)
        }
      } catch (error) {
        // The unmount cleanup aborts the request; only real failures matter.
        if (!controller.signal.aborted) {
          console.error('Failed to load categories', error)
        }
      }
    }

    void fetchCategories()

    return () => controller.abort()
  }, [config.serverURL, config.routes.api])

  const childrenByParent = useMemo(() => {
    const byParent = new Map<CategoryId | null, CategoryDoc[]>()
    const ids = new Set(categories?.map((category) => category.id))

    for (const category of categories ?? []) {
      const parent = parentId(category)
      // Guards against orphans, e.g. a parent the user is not allowed to read.
      const key = parent !== null && ids.has(parent) ? parent : null
      byParent.set(key, [...(byParent.get(key) ?? []), category])
    }

    return byParent
  }, [categories])

  const selected = useMemo(() => (Array.isArray(value) ? value : []), [value])

  const onToggle = (id: CategoryId) => {
    setValue(
      selected.includes(id) ? selected.filter((selectedId) => selectedId !== id) : [...selected, id],
    )
  }

  return (
    <div className="field-type">
      <FieldLabel label={field.label} path={path} required={field.required} />
      {categories === undefined ? null : categories.length === 0 ? (
        <p className="field-description" style={{ margin: 0 }}>
          {noCategoriesMessage}
        </p>
      ) : (
        <CategoryBranch
          childrenByParent={childrenByParent}
          depth={0}
          onToggle={onToggle}
          parent={null}
          path={path}
          readOnly={readOnly}
          value={selected}
        />
      )}
    </div>
  )
}
