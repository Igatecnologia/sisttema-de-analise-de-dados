import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartShell } from '../../components/ChartShell'

type StatusData = { status: string; valor: number }

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatAxisShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(Math.round(n))
}

export function ContasStatusChart({
  data,
  color = 'rgba(26, 122, 181, 0.75)',
  label,
}: {
  data: StatusData[]
  color?: string
  label: string
}) {
  if (!data.length) return null

  return (
    <div role="region" aria-label={label}>
      <ChartShell height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="status" />
          <YAxis tickFormatter={formatAxisShort} />
          <Tooltip formatter={(v) => formatBRL(Number(v))} />
          <Bar dataKey="valor" name="Valor" fill={color} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartShell>
    </div>
  )
}
