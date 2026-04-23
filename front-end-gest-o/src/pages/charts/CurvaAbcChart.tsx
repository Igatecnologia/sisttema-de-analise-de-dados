import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartShell } from '../../components/ChartShell'
import { formatBRL } from '../../utils/formatters'

export type CurvaAbcChartItem = {
  nome: string
  faturamento: number
  acumuladoPct: number
  classe: 'A' | 'B' | 'C'
}

export function CurvaAbcChart({ data }: { data: CurvaAbcChartItem[] }) {
  /* Limita a 40 itens no gráfico para legibilidade */
  const visible = data.slice(0, 40)

  return (
    <div role="region" aria-label="Gráfico Curva ABC">
      <ChartShell height={380}>
        <ComposedChart data={visible} margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="nome"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={90}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
            }
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, name) => {
              const numeric = typeof value === 'number' ? value : 0
              if (name === 'Faturamento') return formatBRL(numeric)
              return `${numeric.toFixed(1)}%`
            }}
            labelStyle={{ fontWeight: 600 }}
          />
          <ReferenceLine yAxisId="right" y={80} stroke="#10B981" strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10, fill: '#10B981' }} />
          <ReferenceLine yAxisId="right" y={95} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: '95%', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
          <Bar
            yAxisId="left"
            dataKey="faturamento"
            name="Faturamento"
            radius={[3, 3, 0, 0]}
            fill="#3B82F6"
            fillOpacity={0.8}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="acumuladoPct"
            name="% Acumulado"
            stroke="#6366F1"
            strokeWidth={2.5}
            dot={false}
          />
        </ComposedChart>
      </ChartShell>
    </div>
  )
}
