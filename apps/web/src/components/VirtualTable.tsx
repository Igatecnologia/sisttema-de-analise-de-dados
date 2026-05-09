import { useVirtualizer } from '@tanstack/react-virtual'
import { Empty, Spin } from 'antd'
import { useMemo, useRef } from 'react'

export type VirtualColumn<T> = {
  key: string
  title: React.ReactNode
  width?: number | string
  render: (row: T) => React.ReactNode
}

type Props<T> = {
  rows: T[]
  rowKey: (row: T) => string
  columns: VirtualColumn<T>[]
  height?: number
  loading?: boolean
  emptyText?: string
}

export function VirtualTable<T>({
  rows,
  rowKey,
  columns,
  height = 520,
  loading,
  emptyText = 'Sem dados.',
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 46,
    overscan: 8,
  })

  const header = useMemo(
    () => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: columns
            .map((c) => (typeof c.width === 'number' ? `${c.width}px` : c.width ?? '1fr'))
            .join(' '),
          gap: 0,
          padding: '10px 12px',
          borderBottom: '1px solid var(--qc-border)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: 'inherit',
          fontWeight: 600,
        }}
      >
        {columns.map((c) => (
          <div key={c.key} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.title}
          </div>
        ))}
      </div>
    ),
    [columns],
  )

  if (loading) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center' }}>
        <Spin />
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    )
  }

  const items = rowVirtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      style={{
        height,
        overflow: 'auto',
        borderRadius: 12,
      }}
    >
      {header}
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => {
          const row = rows[virtualRow.index]
          const key = rowKey(row)
          return (
            <div
              key={key}
              data-row={key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: columns
                  .map((c) =>
                    typeof c.width === 'number' ? `${c.width}px` : c.width ?? '1fr',
                  )
                  .join(' '),
                padding: '10px 12px',
                borderBottom: '1px solid color-mix(in srgb, var(--qc-border) 70%, transparent)',
                alignItems: 'center',
              }}
            >
              {columns.map((c) => (
                <div
                  key={c.key}
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.render(row)}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

