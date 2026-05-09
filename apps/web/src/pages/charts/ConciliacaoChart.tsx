import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts'
import { ChartShell } from '../../components/ChartShell'

type Props = {
  conciliados: number
  pendentes: number
  divergentes: number
}

const COLORS = ['#1A7AB5', '#E8930C', '#D94A38']

export function ConciliacaoChart({ conciliados, pendentes, divergentes }: Props) {
  const data = [
    { name: 'Conciliado', value: conciliados },
    { name: 'Pendente', value: pendentes },
    { name: 'Divergente', value: divergentes },
  ].filter((d) => d.value > 0)

  if (!data.length) return null

  return (
    <div role="region" aria-label="Gráfico de conciliação">
      <ChartShell height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ChartShell>
    </div>
  )
}
