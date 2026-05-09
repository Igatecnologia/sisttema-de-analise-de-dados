import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartShell } from '../../components/ChartShell'

type StatusData = { status: string; count: number }

const STATUS_COLORS: Record<string, string> = {
  Normal: '#1A7AB5',
  Baixo: '#E8930C',
  'Crítico': '#D94A38',
}

export function EstoqueStatusChart({ data, label }: { data: StatusData[]; label: string }) {
  if (!data.length) return null

  return (
    <div role="region" aria-label={label}>
      <ChartShell height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="status" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="Itens" radius={[8, 8, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={STATUS_COLORS[d.status] ?? '#5DB896'} />
            ))}
          </Bar>
        </BarChart>
      </ChartShell>
    </div>
  )
}
