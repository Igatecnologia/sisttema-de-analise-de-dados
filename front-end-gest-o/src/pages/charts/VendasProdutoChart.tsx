import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartShell } from '../../components/ChartShell'

type ProdutoData = { produto: string; total: number }

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatAxisShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(Math.round(n))
}

export function VendasProdutoChart({ data }: { data: ProdutoData[] }) {
  if (!data.length) return null

  return (
    <div role="region" aria-label="Faturamento por produto">
      <ChartShell height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={formatAxisShort} />
          <YAxis type="category" dataKey="produto" width={90} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatBRL(Number(v))} />
          <Bar dataKey="total" name="Faturamento" fill="rgba(26, 122, 181, 0.75)" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ChartShell>
    </div>
  )
}
