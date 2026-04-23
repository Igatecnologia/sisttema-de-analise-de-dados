import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { getUserPreferences, saveUserPreferences } from '../services/userPreferencesService'

/**
 * Encapsula sensors + estado + persistência de layout reordenável via drag-and-drop.
 *
 * Uso:
 *   const { widgetLayout, WidgetWrapper, SortableWrap } = useSortableWidgets('dashboard', ['a','b','c'])
 *   <SortableWrap>
 *     {widgetLayout.map(id => (
 *       <WidgetWrapper key={id} id={id}>
 *         {widgets[id]}
 *       </WidgetWrapper>
 *     ))}
 *   </SortableWrap>
 *
 * A ordem é salva em preferences.pageLayouts[pageKey] por usuário.
 * Backward-compat: `dashboard` também lê/escreve `preferences.dashboardLayout` (legado).
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
          // Garante que todos os IDs salvos ainda existem no default atual
          // — se um widget foi removido, ignoramos ele. Widgets novos são
          // adicionados ao final para não sumirem da tela.
          const validSaved = saved.filter((id) => defaultLayout.includes(id))
          const missing = defaultLayout.filter((id) => !validSaved.includes(id))
          setWidgetLayout([...validSaved, ...missing])
        }
      } catch {
        /* noop — mantém default */
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

  return { widgetLayout, setWidgetLayout, SortableWrap, WidgetWrapper }
}

/**
 * Wrapper visual de um widget ordenável. Aplica transform e um handle de grip
 * discreto no canto superior esquerdo. O corpo inteiro também é arrastável
 * para não atrapalhar o clique em conteúdo interno (listeners no handle).
 */
function WidgetWrapper({
  id,
  children,
  style,
}: {
  id: string
  children: ReactNode
  style?: CSSProperties
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const combinedStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
    ...style,
  }
  return (
    <div ref={setNodeRef} style={combinedStyle} {...attributes}>
      <button
        type="button"
        {...listeners}
        aria-label="Reordenar"
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          zIndex: 2,
          width: 22,
          height: 22,
          border: 'none',
          background: 'transparent',
          color: '#999',
          cursor: 'grab',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseDown={(e) => e.currentTarget.style.setProperty('cursor', 'grabbing')}
        onMouseUp={(e) => e.currentTarget.style.setProperty('cursor', 'grab')}
      >
        <GripVertical size={14} />
      </button>
      {children}
    </div>
  )
}
