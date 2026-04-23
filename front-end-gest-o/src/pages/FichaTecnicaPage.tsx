import { WarningOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { getErrorMessage } from '../api/httpError'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MetricCard } from '../components/MetricCard'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { queryKeys } from '../query/queryKeys'
import { getFichasTecnicas } from '../services/erpService'
import type { FichaTecnica } from '../types/models'

/* ── Helpers ── */

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dimensoesValidas(r: FichaTecnica) {
  return r.alturaM > 0 && r.larguraM > 0 && r.comprimentoM > 0
}

/* ── Page ── */

export function FichaTecnicaPage() {
  /* filters */
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [tipoFilter, setTipoFilter] = useState<string>('all')
  const [densidadeFilter, setDensidadeFilter] = useState<string>('all')
  const [ativoFilter, setAtivoFilter] = useState<string>('all')

  /* drawer */
  const [drawerRow, setDrawerRow] = useState<FichaTecnica | null>(null)

  /* query */
  const fichasQ = useQuery({
    queryKey: queryKeys.fichasTecnicas(),
    queryFn: getFichasTecnicas,
  })
  const { data, isLoading, isError, error, refetch } = fichasQ

  const rows = useMemo(() => data ?? [], [data])

  /* unique densidades for filter */
  const densidadeOptions = useMemo(
    () => [...new Set(rows.map((r) => r.densidade))].sort(),
    [rows],
  )

  /* filtered rows */
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return rows.filter((r) => {
      if (q && !r.produto.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q))
        return false
      if (tipoFilter !== 'all' && r.tipo !== tipoFilter) return false
      if (densidadeFilter !== 'all' && r.densidade !== densidadeFilter) return false
      if (ativoFilter !== 'all') {
        const wantAtivo = ativoFilter === 'true'
        if (r.ativo !== wantAtivo) return false
      }
      return true
    })
  }, [rows, debouncedSearch, tipoFilter, densidadeFilter, ativoFilter])

  /* metrics */
  const metrics = useMemo(() => {
    const ativos = filtered.filter((r) => r.ativo).length
    const count = filtered.length || 1
    const custoMedio = filtered.reduce((s, r) => s + r.custoEstimado, 0) / count
    const margemMedia = filtered.reduce((s, r) => s + r.margemAlvoPct, 0) / count
    const volumeMedio = filtered.reduce((s, r) => s + r.volumeM3, 0) / count
    return { ativos, custoMedio, margemMedia, volumeMedio }
  }, [filtered])

  /* columns */
  const columns: ColumnsType<FichaTecnica> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
    },
    {
      title: 'Produto',
      dataIndex: 'produto',
      key: 'produto',
      ellipsis: true,
      render: (v: string, r) => (
        <Space>
          <Typography.Text strong>{v}</Typography.Text>
          {!dimensoesValidas(r) && (
            <Tooltip title="Dimensões inválidas (valores <= 0)">
              <Tag color="red" icon={<WarningOutlined />}>
                Dimensões inválidas
              </Tag>
            </Tooltip>
          )}
          {r.volumeM3 <= 0 && (
            <Tooltip title="Volume inválido (<= 0)">
              <Tag color="orange" icon={<WarningOutlined />}>
                Volume inválido
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 110,
      render: (v: string) => (
        <Tag color={v === 'Espuma' ? 'blue' : 'orange'}>{v}</Tag>
      ),
    },
    {
      title: 'Densidade',
      dataIndex: 'densidade',
      key: 'densidade',
      width: 100,
    },
    {
      title: 'Dimensões',
      key: 'dimensoes',
      width: 180,
      render: (_, r) =>
        `${r.alturaM.toFixed(2)}×${r.larguraM.toFixed(2)}×${r.comprimentoM.toFixed(2)} m`,
    },
    {
      title: 'Volume m³',
      dataIndex: 'volumeM3',
      key: 'volumeM3',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.volumeM3 - b.volumeM3,
      render: (v: number) => v.toFixed(4),
    },
    {
      title: 'Peso Est.',
      dataIndex: 'pesoEstimadoKg',
      key: 'pesoEstimadoKg',
      width: 100,
      align: 'right',
      render: (v: number) => `${v.toFixed(2)} kg`,
    },
    {
      title: 'Consumo MP',
      dataIndex: 'consumoMateriaPrimaKg',
      key: 'consumoMateriaPrimaKg',
      width: 110,
      align: 'right',
      render: (v: number) => `${v.toFixed(2)} kg`,
    },
    {
      title: 'Custo Estimado',
      dataIndex: 'custoEstimado',
      key: 'custoEstimado',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.custoEstimado - b.custoEstimado,
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Custo/m³',
      dataIndex: 'custoPorM3',
      key: 'custoPorM3',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.custoPorM3 - b.custoPorM3,
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Preço Sugerido',
      dataIndex: 'precoSugerido',
      key: 'precoSugerido',
      width: 130,
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Margem Alvo',
      dataIndex: 'margemAlvoPct',
      key: 'margemAlvoPct',
      width: 110,
      align: 'right',
      render: (v: number) => {
        const color = v < 30 ? 'red' : v < 40 ? 'orange' : 'green'
        return <Tag color={color}>{v.toFixed(1)}%</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'ativo',
      key: 'ativo',
      width: 90,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Ativo' : 'Inativo'}</Tag>
      ),
    },
  ]

  /* loading */
  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    )
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Não foi possível carregar as fichas técnicas"
        description={getErrorMessage(error, 'Tente novamente em instantes.')}
        action={<Button size="small" onClick={() => void refetch()}>Tentar novamente</Button>}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Filtros ── */}
      <Card className="app-card" variant="borderless">
        <Space wrap size="middle">
          <Input.Search
            placeholder="Buscar produto ou ID..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            value={tipoFilter}
            onChange={setTipoFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: 'Todos os tipos' },
              { value: 'Espuma', label: 'Espuma' },
              { value: 'Aglomerado', label: 'Aglomerado' },
            ]}
          />
          <Select
            value={densidadeFilter}
            onChange={setDensidadeFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: 'Todas densidades' },
              ...densidadeOptions.map((d) => ({ value: d, label: d })),
            ]}
          />
          <Select
            value={ativoFilter}
            onChange={setAtivoFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'true', label: 'Ativos' },
              { value: 'false', label: 'Inativos' },
            ]}
          />
        </Space>
      </Card>

      {/* ── Métricas ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Produtos Ativos" value={metrics.ativos} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Custo Médio" value={formatBRL(metrics.custoMedio)} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Margem Média" value={`${metrics.margemMedia.toFixed(1)}%`} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Volume Médio" value={`${metrics.volumeMedio.toFixed(4)} m³`} />
        </Col>
      </Row>

      {/* ── Tabela ── */}
      <Card className="app-card" variant="borderless">
        {filtered.length === 0 ? (
          <Empty description="Nenhuma ficha técnica encontrada para os filtros aplicados" />
        ) : (
          <Table<FichaTecnica>
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            size="small"
            scroll={{ x: 1600 }}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} fichas` }}
            onRow={(record) => ({
              onClick: () => setDrawerRow(record),
              style: { cursor: 'pointer' },
            })}
          />
        )}
      </Card>

      {/* ── Drawer de detalhes ── */}
      <Drawer
        title={drawerRow ? `${drawerRow.id} — ${drawerRow.produto}` : 'Detalhes'}
        open={!!drawerRow}
        onClose={() => setDrawerRow(null)}
        width={620}
      >
        {drawerRow && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Identificação */}
            <Descriptions
              title="Identificação"
              bordered
              column={2}
              size="small"
            >
              <Descriptions.Item label="ID">{drawerRow.id}</Descriptions.Item>
              <Descriptions.Item label="Produto">{drawerRow.produto}</Descriptions.Item>
              <Descriptions.Item label="Tipo">
                <Tag color={drawerRow.tipo === 'Espuma' ? 'blue' : 'orange'}>
                  {drawerRow.tipo}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Densidade">{drawerRow.densidade}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={drawerRow.ativo ? 'green' : 'default'}>
                  {drawerRow.ativo ? 'Ativo' : 'Inativo'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {/* Dimensões */}
            <Descriptions
              title="Dimensões e Volume"
              bordered
              column={2}
              size="small"
            >
              <Descriptions.Item label="Altura">{drawerRow.alturaM.toFixed(2)} m</Descriptions.Item>
              <Descriptions.Item label="Largura">{drawerRow.larguraM.toFixed(2)} m</Descriptions.Item>
              <Descriptions.Item label="Comprimento">{drawerRow.comprimentoM.toFixed(2)} m</Descriptions.Item>
              <Descriptions.Item label="Volume">{drawerRow.volumeM3.toFixed(4)} m³</Descriptions.Item>
              <Descriptions.Item label="Fórmula" span={2}>
                <Typography.Text code>
                  {drawerRow.alturaM.toFixed(2)} × {drawerRow.larguraM.toFixed(2)} ×{' '}
                  {drawerRow.comprimentoM.toFixed(2)} = {drawerRow.volumeM3.toFixed(4)} m³
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Peso Estimado">{drawerRow.pesoEstimadoKg.toFixed(2)} kg</Descriptions.Item>
              <Descriptions.Item label="Consumo MP">{drawerRow.consumoMateriaPrimaKg.toFixed(2)} kg</Descriptions.Item>
              {!dimensoesValidas(drawerRow) && (
                <Descriptions.Item label="Alerta" span={2}>
                  <Tag color="red" icon={<WarningOutlined />}>
                    Dimensões inválidas — existem valores menores ou iguais a zero
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Custos */}
            <Descriptions
              title="Custos"
              bordered
              column={2}
              size="small"
            >
              <Descriptions.Item label="Matéria-Prima">{formatBRL(drawerRow.custoMateriaPrima)}</Descriptions.Item>
              <Descriptions.Item label="Conversão">{formatBRL(drawerRow.custoConversao)}</Descriptions.Item>
              <Descriptions.Item label="Custo Total">{formatBRL(drawerRow.custoEstimado)}</Descriptions.Item>
              <Descriptions.Item label="Custo/m³">{formatBRL(drawerRow.custoPorM3)}</Descriptions.Item>
            </Descriptions>

            {/* Preço e Margem */}
            <Descriptions
              title="Preço e Margem"
              bordered
              column={2}
              size="small"
            >
              <Descriptions.Item label="Preço Sugerido">{formatBRL(drawerRow.precoSugerido)}</Descriptions.Item>
              <Descriptions.Item label="Margem Alvo">
                <Tag
                  color={
                    drawerRow.margemAlvoPct < 30
                      ? 'red'
                      : drawerRow.margemAlvoPct < 40
                        ? 'orange'
                        : 'green'
                  }
                >
                  {drawerRow.margemAlvoPct.toFixed(1)}%
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Lucro Estimado" span={2}>
                {formatBRL(drawerRow.precoSugerido - drawerRow.custoEstimado)}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Drawer>
    </div>
  )
}
