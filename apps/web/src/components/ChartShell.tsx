import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

type ChartShellProps = {
  height?: number
  children: ReactElement
}

/** Dimensões fixas evitam width/height -1 do Recharts dentro de Card/flex. */
export function ChartShell({ height = 260, children }: ChartShellProps) {
  return (
    <div style={{ width: '100%', minWidth: 0, height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}
