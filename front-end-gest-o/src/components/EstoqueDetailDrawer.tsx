import type { JSX } from 'react'
import { Descriptions, Drawer, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'

type DetalhesRow = Record<string, unknown>

function val(row: DetalhesRow | undefined, key: string): unknown {
  if (!row) return undefined
  return row[key]
}

function txt(row: DetalhesRow | undefined, key: string, fallback = '—'): string {
  const v = val(row, key)
  if (v == null) return fallback
  const s = String(v).trim()
  return s || fallback
}

function num(row: DetalhesRow | undefined, key: string): number | null {
  const v = val(row, key)
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtBRL(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(row: DetalhesRow | undefined, key: string): string {
  const v = val(row, key)
  if (!v || typeof v !== 'string') return '—'
  const d = dayjs(v)
  return d.isValid() ? d.format('DD/MM/YYYY') : '—'
}

function statusTag(qtde: number | null): JSX.Element {
  if (qtde == null) return <Tag>—</Tag>
  if (qtde < 0) return <Tag color="red">Negativo ({fmtNum(qtde, 0)})</Tag>
  if (qtde === 0) return <Tag color="orange">Zerado</Tag>
  return <Tag color="green">{fmtNum(qtde, 2)}</Tag>
}

export function EstoqueDetailDrawer({
  open,
  onClose,
  title,
  detalhes,
}: {
  open: boolean
  onClose: () => void
  title: string
  detalhes: DetalhesRow | undefined
}) {
  const d = detalhes

  return (
    <Drawer
      title={title}
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      {d ? (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {/* Produto */}
          <div>
            <Typography.Title level={5} style={{ margin: '0 0 8px' }}>Produto</Typography.Title>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Código">{txt(d, 'controle')}</Descriptions.Item>
              <Descriptions.Item label="Nome">{txt(d, 'produto')}</Descriptions.Item>
              <Descriptions.Item label="Grupo">{txt(d, 'grupo')}</Descriptions.Item>
              <Descriptions.Item label="Subgrupo">{txt(d, 'subgrupo')}</Descriptions.Item>
              <Descriptions.Item label="Unidade">{txt(d, 'unidade')}</Descriptions.Item>
              <Descriptions.Item label="NCM">{txt(d, 'ncm')}</Descriptions.Item>
              <Descriptions.Item label="Ativo">{txt(d, 'ativo')}</Descriptions.Item>
              {val(d, 'obs') ? <Descriptions.Item label="Obs">{txt(d, 'obs')}</Descriptions.Item> : null}
            </Descriptions>
          </div>

          {/* Estoque */}
          <div>
            <Typography.Title level={5} style={{ margin: '0 0 8px' }}>Estoque</Typography.Title>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Quantidade">{statusTag(num(d, 'qtde'))}</Descriptions.Item>
              <Descriptions.Item label="Qtde Real">{statusTag(num(d, 'qtdereal'))}</Descriptions.Item>
              <Descriptions.Item label="Qtde Mínima">{fmtNum(num(d, 'qtdeminima'))}</Descriptions.Item>
              <Descriptions.Item label="Qtde Máxima">{fmtNum(num(d, 'qtdemaxima'))}</Descriptions.Item>
              <Descriptions.Item label="Em Produção">{fmtNum(num(d, 'qtdeemproducao'))}</Descriptions.Item>
              <Descriptions.Item label="Em Produção (MP)">{fmtNum(num(d, 'qtdeemproducaomp'))}</Descriptions.Item>
              <Descriptions.Item label="Pedido Venda">{fmtNum(num(d, 'qtdepedidovenda'))}</Descriptions.Item>
              <Descriptions.Item label="Pedido Compra">{fmtNum(num(d, 'qtdepedidocompra'))}</Descriptions.Item>
              <Descriptions.Item label="Reservada">{fmtNum(num(d, 'qtdereservada'))}</Descriptions.Item>
            </Descriptions>
          </div>

          {/* Custos e Preços */}
          <div>
            <Typography.Title level={5} style={{ margin: '0 0 8px' }}>Custos e Preços</Typography.Title>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Preço Custo">{fmtBRL(num(d, 'precocusto'))}</Descriptions.Item>
              <Descriptions.Item label="Preço Venda">{fmtBRL(num(d, 'precovenda'))}</Descriptions.Item>
              <Descriptions.Item label="Custo Última Compra">{fmtBRL(num(d, 'custoultimacompra'))}</Descriptions.Item>
              <Descriptions.Item label="Custo Médio">{fmtBRL(num(d, 'customedio'))}</Descriptions.Item>
              <Descriptions.Item label="% Lucro">{num(d, 'perclucro') != null ? fmtNum(num(d, 'perclucro'), 2) + '%' : '—'}</Descriptions.Item>
              <Descriptions.Item label="% Imposto Médio">{num(d, 'percimpostomedio') != null ? fmtNum(num(d, 'percimpostomedio'), 2) + '%' : '—'}</Descriptions.Item>
            </Descriptions>
          </div>

          {/* Movimentação */}
          <div>
            <Typography.Title level={5} style={{ margin: '0 0 8px' }}>Movimentação</Typography.Title>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Total Comprado">{fmtNum(num(d, 'qtdetotalcomprada'))}</Descriptions.Item>
              <Descriptions.Item label="Total Vendido">{fmtNum(num(d, 'qtdetotalvendida'))}</Descriptions.Item>
              <Descriptions.Item label="Última Compra">{fmtDate(d, 'dataultimacompra')}</Descriptions.Item>
              <Descriptions.Item label="Última Venda">{fmtDate(d, 'dataultimavenda')}</Descriptions.Item>
              <Descriptions.Item label="Cadastro">{fmtDate(d, 'datahoracadastro')}</Descriptions.Item>
              <Descriptions.Item label="Última Contagem">{fmtDate(d, 'dataultimacontagem')}</Descriptions.Item>
            </Descriptions>
          </div>

          {/* Fornecedor */}
          {val(d, 'fornecedor') || val(d, 'codfornecedor') ? (
            <div>
              <Typography.Title level={5} style={{ margin: '0 0 8px' }}>Fornecedor</Typography.Title>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Nome">{txt(d, 'fornecedor')}</Descriptions.Item>
                <Descriptions.Item label="Código">{txt(d, 'codfornecedor')}</Descriptions.Item>
              </Descriptions>
            </div>
          ) : null}
        </Space>
      ) : null}
    </Drawer>
  )
}
