'use client'

import type { DefaultCellComponentProps } from 'payload'
import React from 'react'

type Breadcrumb = {
  label?: string | null
}

/**
 * List-view cell for the categories `breadcrumbs` field: renders the full
 * path as `Parent > Child`. Falls back to the category name for documents
 * whose breadcrumbs have not been populated yet.
 */
export const CategoryBreadcrumbsCell: React.FC<DefaultCellComponentProps> = ({
  cellData,
  rowData,
}) => {
  const breadcrumbs = (Array.isArray(cellData) ? (cellData as Breadcrumb[]) : []).filter(
    (breadcrumb) => breadcrumb.label,
  )

  const path = breadcrumbs.length
    ? breadcrumbs.map((breadcrumb) => breadcrumb.label).join(' > ')
    : ((rowData as { name?: string })?.name ?? '')

  return <span>{path}</span>
}
