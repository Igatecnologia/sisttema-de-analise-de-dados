import {
  CalendarOutlined,
  DollarOutlined,
  DownOutlined,
  InboxOutlined,
  PercentageOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Col, Drawer, Row, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import type { VendaAnaliticaRow } from '../api/schemas'
import { formatBRL } from '../utils/formatters'
import { lineReceitaRow } from '../utils/vendasAnaliticoAggregates'

function statusLabel(code: string): { text: string; color: 'success' | 'warning' | 'error' | 'default' } {
  const c = code.trim().toUpperCase()
  if (c === 'F' || c === 'FE' || c === 'PG') return { text: 'Faturado', color: 'success' }
  if (c === 'C' || c === 'X' || c === 'CAN') return { text: 'Cancelado', color: 'error' }
  if (c === 'P' || c === 'A' || c === 'AB') return { text: 'Pendente', color: 'warning' }
  return { text: code, color: 'default' }
}

function InfoBlock({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | React.ReactNode; sub?: string; accent?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: accent ? `${accent}14` : 'var(--qc-canvas)',
        display: 'grid', placeItems: 'center',
        color: accent ?? 'var(--qc-text-muted)', fontSize: 16,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <Typography.Text type="secondary" className="typ-label" style={{ display: 'block' }}>
          {label}
        </Typography.Text>
        <div className="typ-value-lg" style={{ marginTop: 1 }}>
          {value}
        </div>
        {sub && <Typography.Text type="secondary" className="typ-meta">{sub}</Typography.Text>}
      </div>
    </div>
  )
}

type PedidoAgrupado = {
  key: string
  cliente: string
  codcliente: string | number
  cepcliente: string
  vendedor: string
  data: string
  datafec: string
  status: string
  itens: VendaAnaliticaRow[]
  totalPedido: number
  totalCusto: number
  totalQtd: number
  undPrincipal: string
  margem: number
  qtdProdutos: number
}

type Props = {
  open: boolean
  pedido: PedidoAgrupado | null
  onClose: () => void
}

export function VendaAnaliticoDetailDrawer({ open, pedido, onClose }: Props) {
  const [showAll, setShowAll] = useState(false)

  if (!pedido) return null

  const status = statusLabel(pedido.status)
  const lucro = pedido.totalPedido - pedido.totalCusto

  // Agrupar linhas do mesmo produto (codprod + valorunit)
  const produtosAgrupados = (() => {
    const map = new Map<string, { item: VendaAnaliticaRow; qtdTotal: number; totalLinha: number; custoTotal: number; linhas: number }>()
    for (const item of pedido.itens) {
      const key = `${item.codprod}|${item.valorunit}|${item.precocustoitem}`
      const cur = map.get(key)
      if (cur) {
        cur.qtdTotal += item.qtdevendida
        cur.totalLinha += lineReceitaRow(item)
        cur.custoTotal += item.precocustoitem * item.qtdevendida
        cur.linhas++
      } else {
        map.set(key, {
          item,
          qtdTotal: item.qtdevendida,
          totalLinha: lineReceitaRow(item),
          custoTotal: item.precocustoitem * item.qtdevendida,
          linhas: 1,
        })
      }
    }
    return [...map.values()].sort((a, b) => b.totalLinha - a.totalLinha)
  })()

  const MAX_VISIBLE = 10
  const visibleProdutos = showAll ? produtosAgrupados : produtosAgrupados.slice(0, MAX_VISIBLE)
  const hasMore = produtosAgrupados.length > MAX_VISIBLE && !showAll

  return (
    <Drawer
      title={null}
      placement="right"
      width={560}
      onClose={onClose}
      open={open}
      destroyOnClose
      afterOpenChange={(v) => { if (!v) setShowAll(false) }}
      styles={{ body: { padding: '0 24px 24px' } }}
    >
      {/* ── Header do pedido ── */}
      <div style={{ padding: '20px 0 16px', borderBottom: '1px solid var(--qc-border)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Venda · {pedido.qtdProdutos} {pedido.qtdProdutos === 1 ? 'produto' : 'produtos'}
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: '4px 0 0', lineHeight: 1.2 }}>
              {pedido.cliente || 'Sem cliente'}
            </Typography.Title>
          </div>
          <Tag color={status.color} style={{ flexShrink: 0, fontSize: 12, padding: '2px 10px' }}>
            {status.text}
          </Tag>
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(pedido.data).format('DD/MM/YYYY [às] HH:mm')}
          </Typography.Text>
          {pedido.datafec && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Fechamento: {dayjs(pedido.datafec).format('DD/MM/YYYY')}
            </Typography.Text>
          )}
        </div>
      </div>

      {/* ── KPIs do pedido ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <InfoBlock
            icon={<DollarOutlined />}
            label="Total da venda"
            value={formatBRL(pedido.totalPedido)}
            sub={`${pedido.totalQtd.toLocaleString('pt-BR')} unidades`}
            accent="#10B981"
          />
        </Col>
        <Col span={12}>
          <InfoBlock
            icon={<PercentageOutlined />}
            label="Margem bruta"
            value={
              <span style={{ color: pedido.margem >= 30 ? '#10B981' : pedido.margem >= 15 ? '#F59E0B' : '#F43F5E' }}>
                {pedido.margem.toFixed(1)}%
              </span>
            }
            sub={`Lucro: ${formatBRL(lucro)}`}
            accent={pedido.margem >= 30 ? '#10B981' : pedido.margem >= 15 ? '#F59E0B' : '#F43F5E'}
          />
        </Col>
      </Row>

      {/* ── Cliente ── */}
      <div style={{
        padding: '14px 16px', borderRadius: 10, marginBottom: 20,
        background: 'var(--qc-canvas)', border: '1px solid var(--qc-border)',
      }}>
        <InfoBlock
          icon={<UserOutlined />}
          label="Cliente"
          value={pedido.cliente || '—'}
          sub={`Código: ${pedido.codcliente}${pedido.cepcliente ? ` · CEP: ${pedido.cepcliente}` : ''}${pedido.vendedor ? ` · Vendedor: ${pedido.vendedor}` : ''}`}
          accent="#8B5CF6"
        />
      </div>

      {/* ── Lista de produtos ── */}
      <Typography.Text strong className="typ-section">
        <InboxOutlined style={{ marginRight: 4 }} />
        {produtosAgrupados.length === pedido.qtdProdutos
          ? `Produtos (${produtosAgrupados.length})`
          : `Produtos (${produtosAgrupados.length} únicos · ${pedido.qtdProdutos} linhas)`}
      </Typography.Text>
      <div style={{
        borderRadius: 10, overflow: 'hidden', marginBottom: 20,
        border: '1px solid var(--qc-border)',
      }}>
        {visibleProdutos.map((p, i) => {
          const itemLucro = p.totalLinha - p.custoTotal
          const itemMargem = p.totalLinha > 0 ? (itemLucro / p.totalLinha) * 100 : 0
          return (
            <div key={`${p.item.codprod}-${i}`} style={{
              padding: '14px 16px',
              borderBottom: i < visibleProdutos.length - 1 ? '1px solid var(--qc-border)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'var(--qc-primary-light)',
                  color: 'var(--qc-primary)',
                  display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                  marginTop: 1,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                    {p.item.decprod}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    Cód: {p.item.codprod}
                    {p.linhas > 1 && <> · {p.linhas} linhas agrupadas</>}
                  </Typography.Text>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography.Text strong style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                    {formatBRL(p.totalLinha)}
                  </Typography.Text>
                </div>
              </div>

              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 36,
                fontSize: 12, color: 'var(--qc-text-muted)',
              }}>
                <span>{p.qtdTotal.toLocaleString('pt-BR')} {p.item.und} × {formatBRL(p.item.valorunit)}</span>
                {p.item.qtdeconvertidavd > 0 && p.item.qtdeconvertidavd !== p.qtdTotal && (
                  <>
                    <span>·</span>
                    <span>Convertido: {p.item.qtdeconvertidavd.toLocaleString('pt-BR')} {p.item.und}</span>
                  </>
                )}
                <span>·</span>
                <span>Custo: {formatBRL(p.item.precocustoitem)}/un</span>
                <span>·</span>
                <span>Lucro: <span style={{ color: itemLucro >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600 }}>{formatBRL(itemLucro)}</span></span>
                <Tag color={itemMargem >= 30 ? 'green' : itemMargem >= 15 ? 'gold' : 'red'} style={{ margin: 0, fontSize: 10 }}>
                  {itemMargem.toFixed(1)}%
                </Tag>
              </div>
            </div>
          )
        })}

        {/* Ver mais */}
        {hasMore && (
          <div style={{ padding: '8px 16px', textAlign: 'center', borderTop: '1px solid var(--qc-border)' }}>
            <Button type="link" size="small" icon={<DownOutlined />} onClick={() => setShowAll(true)}>
              Ver mais {produtosAgrupados.length - MAX_VISIBLE} produtos
            </Button>
          </div>
        )}

        {/* Totalizador */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', background: 'var(--qc-canvas)',
          borderTop: '2px solid var(--qc-border)',
        }}>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>Total</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              {produtosAgrupados.length} {produtosAgrupados.length === 1 ? 'produto' : 'produtos'} · {pedido.totalQtd.toLocaleString('pt-BR')} un
            </Typography.Text>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(pedido.totalPedido)}
            </Typography.Text>
            <Tag color={pedido.margem >= 30 ? 'green' : pedido.margem >= 15 ? 'gold' : 'red'} style={{ margin: 0, fontSize: 11 }}>
              {pedido.margem.toFixed(1)}%
            </Tag>
          </div>
        </div>
      </div>

      {/* ── Resumo financeiro ── */}
      <Typography.Text strong className="typ-section">
        <DollarOutlined style={{ marginRight: 4 }} /> Resumo financeiro
      </Typography.Text>
      <div style={{ padding: '0 4px' }}>
        {[
          { label: 'Faturamento', value: formatBRL(pedido.totalPedido) },
          { label: 'Custo total', value: formatBRL(pedido.totalCusto) },
          { label: 'Lucro bruto', value: formatBRL(lucro), color: lucro >= 0 ? '#10B981' : '#F43F5E' },
          { label: 'Margem', value: `${pedido.margem.toFixed(1)}%`, tag: true },
        ].map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--qc-border)' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.label}</Typography.Text>
            {r.tag ? (
              <Tag color={pedido.margem >= 30 ? 'green' : pedido.margem >= 15 ? 'gold' : 'red'} style={{ margin: 0 }}>
                {r.value}
              </Tag>
            ) : (
              <Typography.Text strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: r.color }}>
                {r.value}
              </Typography.Text>
            )}
          </div>
        ))}
      </div>
    </Drawer>
  )
}
