import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { useEffect, useState, type ReactNode } from 'react'
import { SortableWidgetWrapper } from '../components/SortableWidgetWrapper'
import { getUserPreferences, saveUserPreferences } from '../services/userPreferencesService'

/**
 * Encapsula sensors + estado + persistencia de layout reordenavel via drag-and-drop.
 * A ordem e salva em preferences.pageLayouts[pageKey] por usuario.
 */
export function useSortableWidgets(pageKey: string, defaultLayout: string[]) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [widgetLayout, setWidgetLayout] = useState<string[]>(defaultLayout)

  useEffect(() => {
    void (async () => {
      try {
        const prefs = await getUserPreferences()
        const fromNew = prefs.pageLayouts?.[pageKey]
        const fromLegacy = pageKey === 'dashboard' ? prefs.dashboardLayout : undefined
        const saved = fromNew ?? fromLegacy
        if (saved?.length) {
          const validSaved = saved.filter((id) => defaultLayout.includes(id))
          const missing = defaultLayout.filter((id) => !validSaved.includes(id))
          setWidgetLayout([...validSaved, ...missing])
        }
      } catch {
        /* noop: mantem default */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey])

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setWidgetLayout((current) => {
      const oldIdx = current.indexOf(String(active.id))
      const newIdx = current.indexOf(String(over.id))
      if (oldIdx < 0 || newIdx < 0) return current
      const next = arrayMove(current, oldIdx, newIdx)
      void saveUserPreferences({ pageLayouts: { [pageKey]: next } }).catch(() => undefined)
      return next
    })
  }

  const SortableWrap = ({ children }: { children: ReactNode }) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={widgetLayout} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )

  return { widgetLayout, setWidgetLayout, SortableWrap, WidgetWrapper: SortableWidgetWrapper }
}
