import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export function SortableWidgetWrapper({
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
