'use client'

import type { DefaultCellComponentProps } from 'payload'
import { useConfig } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

/**
 * List-view cell for the categories `articleCount` UI field: counts the
 * articles directly assigned to the category. Children of the category are
 * not included. The count comes from the `count` endpoint rather than a
 * field hook so reads of `categories` elsewhere stay a single query.
 */
export const CategoryArticleCountCell: React.FC<DefaultCellComponentProps> = ({ rowData }) => {
  const { config } = useConfig()
  const [count, setCount] = useState<number>()

  const id = (rowData as { id?: number | string } | undefined)?.id

  useEffect(() => {
    if (id === undefined) {
      return
    }

    const controller = new AbortController()

    const fetchCount = async () => {
      const query = `where[category][equals]=${encodeURIComponent(String(id))}`

      try {
        const response = await fetch(
          `${config.serverURL}${config.routes.api}/articles/count?${query}`,
          {
            credentials: 'include',
            signal: controller.signal,
          },
        )
        if (response.ok) {
          const data = (await response.json()) as { totalDocs: number }
          setCount(data.totalDocs)
        }
      } catch (error) {
        // The unmount cleanup aborts the request; only real failures matter.
        if (!controller.signal.aborted) {
          console.error('Failed to count articles', error)
        }
      }
    }

    void fetchCount()

    return () => controller.abort()
  }, [config.serverURL, config.routes.api, id])

  return <span>{count ?? ''}</span>
}
