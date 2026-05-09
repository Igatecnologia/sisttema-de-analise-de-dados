import {
  Alert,
  Alert as AntAlert,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Input,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Slider,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MetricCard } from '../components/MetricCard'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { queryKeys } from '../query/queryKeys'
import {
  getAlertasOperacionais,
  getCustoRealProdutos,
  getFichasTecnicas,
} from '../services/erpService'
import type { AlertaOperacional } from '../types/models'
import { getErrorMessage } from '../api/httpError'

/* ── Helpers ── */

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TIPO_LABELS: Record<string, string> = {
  margem_baixa: 'Margem Baixa',
  estoque_critico: 'Estoque Crítico',
  vazamento_lucro: 'Vazamento de Lucro',
  producao_atrasada: 'Produção Atrasada',
  inadimplencia: 'Inadimplência',
}

const TIPO_COLORS: Record<string, string> = {
  margem_baixa: 'red',
  estoque_critico: 'volcano',
  vazamento_lucro: 'orange',
  producao_atrasada: 'gold',
  inadimplencia: 'purple',
}

const SEVERIDADE_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 }
const SEVERIDADE_BADGE: Record<string, 'error' | 'warning' | 'processing'> = {
  alta: 'error',
  media: 'warning',
  baixa: 'processing',
}

/* ── Page ── */

export function AlertasPage() {
  /* ── Filters ── */
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [tipoFilter, setTipoFilter] = useState<string>('all')
  const [severidadeFilter, setSeveridadeFilter] = useState<string>('all')
  const [lidoFilter, setLidoFilter] = useState<string>('all')

  /* ── Simulator state ── */
  const [selectedFichaId, setSelectedFichaId] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState<number>(10)
  const [precoOverride, setPrecoOverride] = useState<number | null>(null)

  /* ── Queries ── */
  const alertasQ = useQuery({
    queryKey: queryKeys.alertasOperacionais(),
    queryFn: getAlertasOperacionais,
  })
  const { data: alertas, isLoading: loadingAlertas } = alertasQ

  const fichasQ = useQuery({
    queryKey: queryKeys.fichasTecnicas(),
    queryFn: getFichasTecnicas,
  })
  const { data: fichas, isLoading: loadingFichas } = fichasQ

  const custosQ = useQuery({
    queryKey: queryKeys.custoRealProdutos(),
    queryFn: getCustoRealProdutos,
  })
  const { data: custos, isLoading: loadingCustos } = custosQ

  const hasAlertasError = alertasQ.isError
  const alertasError = alertasQ.error
  const hasSimuladorError = fichasQ.isError || custosQ.isError
  const simuladorError = fichasQ.error ?? custosQ.error

  const rows = useMemo(() => alertas ?? [], [alertas])
  const fichasList = fichas ?? []
  const custosList = custos ?? []

  /* ── Metrics ── */
  const totalAlertas = rows.length
  const altaSeveridade = rows.filter((r) => r.severidade === 'alta').length
  const naoLidos = rows.filter((r) => !r.lido).length
  const margemCritica = rows.filter((r) => r.tipo === 'margem_baixa').length

  /* ── Filtered + sorted rows ── */
  const filtered = useMemo(() => {
    let result = [...rows]

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        (r) =>
          r.titulo.toLowerCase().includes(q) ||
          r.descricao.toLowerCase().includes(q),
      )
    }
    if (tipoFilter !== 'all') result = result.filter((r) => r.tipo === tipoFilter)
    if (severidadeFilter !== 'all')
      result = result.filter((r) => r.severidade === severidadeFilter)
    if (lidoFilter !== 'all')
      result = result.filter((r) => (lidoFilter === 'true' ? r.lido : !r.lido))

    result.sort((a, b) => {
      const sev = SEVERIDADE_ORDER[a.severidade] - SEVERIDADE_ORDER[b.severidade]
      if (sev !== 0) return sev
      return b.data.localeCompare(a.data)
    })

    return result
  }, [rows, debouncedSearch, tipoFilter, severidadeFilter, lidoFilter])

  /* ── Table columns ── */
  const columns: ColumnsType<AlertaOperacional> = [
    {
      title: 'Severidade',
      dataIndex: 'severidade',
      key: 'severidade',
      width: 120,
      render: (sev: string) => (
        <Badge status={SEVERIDADE_BADGE[sev] ?? 'default'} text={sev.charAt(0).toUpperCase() + sev.slice(1)} />
      ),
    },
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      width: 120,
      sorter: (a, b) => a.data.localeCompare(b.data),
      render: (d: string) => {
        const [y, m, day] = d.split('-')
        return `${day}/${m}/${y}`
      },
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 160,
      render: (tipo: string) => (
        <Tag color={TIPO_COLORS[tipo] ?? 'default'}>{TIPO_LABELS[tipo] ?? tipo}</Tag>
      ),
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      key: 'titulo',
      render: (t: string) => <Typography.Text strong>{t}</Typography.Text>,
    },
    {
      title: 'Descrição',
      dataIndex: 'descricao',
      key: 'descricao',
      ellipsis: true,
    },
    {
      title: 'Ref.',
      dataIndex: 'referenciaId',
      key: 'referenciaId',
      width: 110,
      render: (id: string) => <Typography.Text code>{id}</Typography.Text>,
    },
    {
      title: 'Status',
      dataIndex: 'lido',
      key: 'lido',
      width: 90,
      render: (lido: boolean) =>
        lido ? <Tag color="green">Lido</Tag> : <Tag color="red">Novo</Tag>,
    },
  ]

  /* ── Simulator logic ── */
  const selectedFicha = fichasList.find((f) => f.id === selectedFichaId) ?? null
  const selectedCusto = custosList.find((c) => c.fichaTecnicaId === selectedFichaId) ?? null

  const precoBase = selectedFicha?.precoSugerido ?? 0
  const precoVenda = precoOverride ?? precoBase
  const sliderMin = Math.round(precoBase * 0.5 * 100) / 100
  const sliderMax = Math.round(precoBase * 1.5 * 100) / 100

  const receitaBruta = quantidade * precoVenda
  const custoTotal = selectedCusto ? quantidade * selectedCusto.custoRealTotal : 0
  const lucroEstimado = receitaBruta - custoTotal
  const margem = receitaBruta > 0 ? ((lucroEstimado / receitaBruta) * 100) : 0
  const volumeTotal = selectedFicha ? quantidade * selectedFicha.volumeM3 : 0

  const isLoading = loadingAlertas

  /* ── Render ── */
  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    )
  }

  if (hasAlertasError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Não foi possível carregar os alertas"
        description={getErrorMessage(alertasError, 'Tente novamente em instantes.')}
        action={
          <Button
            size="small"
            onClick={() => {
              void alertasQ.refetch()
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Section 1: Metric Cards ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Total Alertas" value={totalAlertas} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Alta Severidade" value={altaSeveridade} hero />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Não Lidos" value={naoLidos} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Margem Crítica" value={margemCritica} />
        </Col>
      </Row>

      {/* ── Section 2: Alerts Table ── */}
      <Card className="app-card" variant="borderless">
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          Alertas Operacionais
        </Typography.Title>

        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Buscar título ou descrição..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            value={tipoFilter}
            onChange={setTipoFilter}
            style={{ width: 200 }}
            options={[
              { value: 'all', label: 'Todos os tipos' },
              { value: 'margem_baixa', label: 'Margem Baixa' },
              { value: 'estoque_critico', label: 'Estoque Crítico' },
              { value: 'vazamento_lucro', label: 'Vazamento de Lucro' },
              { value: 'producao_atrasada', label: 'Produção Atrasada' },
              { value: 'inadimplencia', label: 'Inadimplência' },
            ]}
          />
          <Select
            value={severidadeFilter}
            onChange={setSeveridadeFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: 'Todas severidades' },
              { value: 'alta', label: 'Alta' },
              { value: 'media', label: 'Média' },
              { value: 'baixa', label: 'Baixa' },
            ]}
          />
          <Select
            value={lidoFilter}
            onChange={setLidoFilter}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: 'Todos status' },
              { value: 'false', label: 'Não lidos' },
              { value: 'true', label: 'Lidos' },
            ]}
          />
        </Space>

        <Table<AlertaOperacional>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} alertas` }}
          size="middle"
          scroll={{ x: 900 }}
        />
      </Card>

      {/* ── Section 3: Simulador de Lucro ── */}
      <Card className="app-card" variant="borderless">
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          Simulador: Se vender X &rarr; Lucro Y
        </Typography.Title>

        {hasSimuladorError ? (
          <Alert
            type="warning"
            showIcon
            message="Simulador temporariamente indisponível"
            description={getErrorMessage(simuladorError, 'Os alertas continuam disponíveis normalmente.')}
            action={
              <Button
                size="small"
                onClick={() => {
                  void fichasQ.refetch()
                  void custosQ.refetch()
                }}
              >
                Tentar novamente
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={8}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Produto
            </Typography.Text>
            <Select
              placeholder="Selecione um produto"
              value={selectedFichaId}
              onChange={(v) => {
                setSelectedFichaId(v)
                setPrecoOverride(null)
              }}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              loading={loadingFichas}
              disabled={hasSimuladorError || loadingFichas || loadingCustos}
              options={fichasList.map((f) => ({ value: f.id, label: f.produto }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Quantidade de peças
            </Typography.Text>
            <InputNumber
              min={1}
              max={1000}
              value={quantidade}
              onChange={(v) => setQuantidade(v ?? 10)}
              style={{ width: '100%' }}
              disabled={hasSimuladorError || loadingFichas || loadingCustos}
            />
          </Col>
        </Row>

        {selectedFicha && (
          <>
            <Divider />

            {!selectedCusto && (
              <AntAlert
                type="warning"
                showIcon
                message="Custo real não encontrado para este produto. Os cálculos de custo e lucro não estarão disponíveis."
                style={{ marginBottom: 16 }}
              />
            )}

            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Ajustar preço de venda: {formatBRL(precoVenda)}
            </Typography.Text>
            <Slider
              min={sliderMin}
              max={sliderMax}
              step={0.01}
              value={precoVenda}
              onChange={(v) => setPrecoOverride(v)}
              tooltip={{ formatter: (v) => (v != null ? formatBRL(v) : '') }}
              style={{ maxWidth: 500, marginBottom: 24 }}
            />

            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12} md={4}>
                <Statistic
                  title="Receita Bruta"
                  value={receitaBruta}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#1677ff' }}
                />
              </Col>
              {selectedCusto && (
                <Col xs={24} sm={12} md={4}>
                  <Statistic
                    title="Custo Total"
                    value={custoTotal}
                    precision={2}
                    prefix="R$"
                    valueStyle={{ color: '#666' }}
                  />
                </Col>
              )}
              {selectedCusto && (
                <Col xs={24} sm={12} md={4}>
                  <Statistic
                    title="Lucro Estimado"
                    value={lucroEstimado}
                    precision={2}
                    prefix="R$"
                    valueStyle={{ color: lucroEstimado >= 0 ? '#52c41a' : '#ff4d4f' }}
                  />
                </Col>
              )}
              {selectedCusto && (
                <Col xs={24} sm={12} md={4}>
                  <Statistic
                    title="Margem"
                    value={Number(margem.toFixed(1))}
                    precision={1}
                    suffix="%"
                    valueStyle={{ color: margem >= 0 ? '#52c41a' : '#ff4d4f' }}
                  />
                </Col>
              )}
              <Col xs={24} sm={12} md={4}>
                <Statistic
                  title="Volume Total"
                  value={Number(volumeTotal.toFixed(3))}
                  precision={3}
                  suffix="m³"
                />
              </Col>
            </Row>
          </>
        )}
      </Card>
    </div>
  )
}
