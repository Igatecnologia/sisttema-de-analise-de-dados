import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartShell } from '../../components/ChartShell'
import type { FinanceOverview } from '../../types/models'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function FinanceFlowChart({ data }: { data: FinanceOverview['monthlyFlow'] }) {
  return (
    <div role="region" aria-label="Fluxo financeiro mensal">
      <ChartShell height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(v) => formatBRL(Number(v))} />
          <Legend />
          <Bar dataKey="receita" name="Receita" fill="rgba(82,196,26,0.75)" />
          <Bar dataKey="custos" name="Custos" fill="rgba(255,77,79,0.75)" />
          <Bar dataKey="lucro" name="Lucro" fill="rgba(22,119,255,0.75)" />
        </BarChart>
      </ChartShell>
    </div>
  )
}
