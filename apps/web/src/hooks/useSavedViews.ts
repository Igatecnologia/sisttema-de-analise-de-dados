import { useCallback, useEffect, useState } from 'react'
import {
  deleteView,
  listSavedViews,
  saveView,
  type SavedView,
} from '../services/savedViewsService'

export function useSavedViews(pageKey: string) {
  const [views, setViews] = useState<SavedView[]>([])

  const refresh = useCallback(() => {
    setViews(listSavedViews(pageKey))
  }, [pageKey])

  useEffect(() => {
    queueMicrotask(() => {
      refresh()
    })
  }, [refresh])

  const create = useCallback(
    (name: string, params: URLSearchParams) => {
      const created = saveView(pageKey, name, params)
      refresh()
      return created
    },
    [pageKey, refresh],
  )

  const remove = useCallback(
    (id: string) => {
      deleteView(pageKey, id)
      refresh()
    },
    [pageKey, refresh],
  )

  return { views, refresh, create, remove }
}

