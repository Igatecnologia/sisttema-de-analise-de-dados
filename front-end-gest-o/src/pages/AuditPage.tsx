import { RangePickerBR } from '../components/DatePickerPtBR'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'

import { MetricCard } from '../components/MetricCard'
import { VirtualTable, type VirtualColumn } from '../components/VirtualTable'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/permissions'
import { listAuditLogs, type AuditAction, type AuditLog } from '../services/auditService'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../query/queryKeys'
import { hasAnySources } from '../services/dataSourceService'
import { DevErrorDetail } from '../components/DevErrorDetail'
import { getErrorMessage } from '../api/httpError'
import { pctDelta, shiftRange } from '../utils/dateRange'

function actionTag(action: AuditAction) {
  const color =
    action === 'login' || action === 'logout'
      ? 'blue'
      : action.includes('delete')
        ? 'red'
        : action.includes('export')
          ? 'purple'
          : action.includes('pii')
            ? 'gold'
          : 'green'
  return <Tag color={color}>{action}</Tag>
}

function maskText(text?: string) {
  if (!text) return '-'
  const at = text.indexOf('@')
  if (at > 1) {
    return `${text.slice(0, 2)}***${text.slice(at)}`
  }
  if (text.length <= 3) return '***'
  return `${text.slice(0, 2)}***`
}

function downloadCsv(rows: AuditLog[]) {
  const header = ['id', 'at', 'actor', 'action', 'target']
  const escape = (v: string) => `"${v.replaceAll('"', '""')}"`
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        escape(r.id),
        escape(r.at),
        escape(r.actor),
        escape(r.action),
        escape(r.target ?? ''),
      ].join(','),
    ),
  ].join('\n')

  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `auditoria_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function AuditPage() {
  const { notification } = App.useApp()
  const { session } = useAuth()
  const canExport = hasPermission(session, 'audit:export')
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const action = (searchParams.get('a') ?? 'all') as AuditAction | 'all'
  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') ?? ''

  const auditQuery = useQuery({
    queryKey: queryKeys.audit({ q, action }),
    queryFn: () => listAuditLogs({ q, action }),
  })

  const columns: VirtualColumn<AuditLog>[] = useMemo(
    () => [
      {
        key: 'id',
        title: 'ID',
        width: 120,
        render: (r) => r.id,
      },
      {
        key: 'actor',
        title: 'Ator',
        render: (r) => (r.piiMasked ? maskText(r.actor) : r.actor),
      },
      { key: 'action', title: 'Ação', width: 160, render: (r) => actionTag(r.action) },
      {
        key: 'target',
        title: 'Alvo',
        render: (r) => (r.piiMasked ? maskText(r.target) : (r.target ?? '-')),
      },
      {
        key: 'diff',
        title: 'Diff (de/para)',
        width: 220,
        render: (r) => {
          if (!r.diff) return '-'
          return `${JSON.stringify(r.diff.before)} → ${JSON.stringify(r.diff.after)}`
        },
      },
      {
        key: 'at',
        title: 'Data',
        width: 170,
        render: (r) => dayjs(r.at).format('DD/MM/YYYY HH:mm'),
      },
    ],
    [],
  )

  useEffect(() => {
    if (auditQuery.isError) {
      notification.error({
        title: 'Auditoria',
        description: getErrorMessage(auditQuery.error, 'Falha ao carregar logs.'),
      })
    }
  }, [auditQuery.isError, auditQuery.error, notification])

  const data = (auditQuery.data ?? []).filter((row) => {
    const matchDate =
      (!start || dayjs(row.at).isSame(start, 'day') || dayjs(row.at).isAfter(start, 'day')) &&
      (!end || dayjs(row.at).isSame(end, 'day') || dayjs(row.at).isBefore(end, 'day'))
    return matchDate
  })
  const canRevealPII = session?.user?.role === 'admin'
  const auditSummary = useMemo(() => {
    const total = data.length
    const pii = data.filter((x) => x.action === 'pii.reveal').length
    const critical = data.filter((x) => x.action.includes('delete') || x.action.includes('export')).length
    const withDiff = data.filter((x) => !!x.diff).length
    return { total, pii, critical, withDiff }
  }, [data])
  const previousAuditSummary = useMemo(() => {
    const shifted = shiftRange(start, end)
    if (!shifted) return null
    const prev = (auditQuery.data ?? []).filter((row) => {
      const d = dayjs(row.at)
      return (
        d.isSame(shifted.prevStart, 'day') ||
        d.isSame(shifted.prevEnd, 'day') ||
        (d.isAfter(shifted.prevStart, 'day') && d.isBefore(shifted.prevEnd, 'day'))
      )
    })
    return {
      total: prev.length,
      pii: prev.filter((x) => x.action === 'pii.reveal').length,
      critical: prev.filter((x) => x.action.includes('delete') || x.action.includes('export'))
        .length,
      withDiff: prev.filter((x) => !!x.diff).length,
    }
  }, [auditQuery.data, end, start])

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Auditoria"
        subtitle={
          hasAnySources()
            ? 'Logs de auditoria não estão disponíveis na API SGBR integrada. Ative um serviço de log ou outra API.'
            : 'Logs de ações do sistema com filtros na URL e export CSV.'
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => auditQuery.refetch()}>
              Atualizar
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={!canExport || !data.length}
              onClick={() => downloadCsv(data)}
            >
              Exportar CSV
            </Button>
          </Space>
        }
      />

      {hasAnySources() ? (
        <Alert
          type="info"
          showIcon
          title="Auditoria não fornecida pela API SGBR"
          description="Nenhum dado será listado até existir endpoint compatível em VITE_API_BASE_URL."
        />
      ) : null}

      <Card className="app-card no-hover" variant="borderless" title="Filtros">
        <div className="filter-bar">
          <div className="filter-item">
            <span>Busca</span>
            <Input.Search
              allowClear
              placeholder="ID, ator ou alvo"
              value={q}
              onChange={(e) => {
                const next = e.target.value
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  if (next) p.set('q', next)
                  else p.delete('q')
                  return p
                })
              }}
            />
          </div>
          <div className="filter-item">
            <span>Ação</span>
            <Select
              style={{ width: 220 }}
              value={action}
              onChange={(next) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  if (next === 'all') p.delete('a')
                  else p.set('a', next)
                  return p
                })
              }}
              options={[
                { value: 'all', label: 'Todas as ações' },
                { value: 'login', label: 'Login' },
                { value: 'logout', label: 'Logout' },
                { value: 'users.create', label: 'Criar usuário' },
                { value: 'users.update', label: 'Editar usuário' },
                { value: 'users.delete', label: 'Excluir usuário' },
                { value: 'reports.export', label: 'Exportar relatório' },
                { value: 'pii.reveal', label: 'Dados sensíveis' },
              ]}
            />
          </div>
          <div className="filter-item">
            <span>Período</span>
            <RangePickerBR
              format="DD/MM/YYYY"
              placeholder={['Data inicial', 'Data final']}
              onChange={(vals) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  const [from, to] = vals ?? []
                  if (from) p.set('start', from.format('YYYY-MM-DD'))
                  else p.delete('start')
                  if (to) p.set('end', to.format('YYYY-MM-DD'))
                  else p.delete('end')
                  return p
                })
              }}
            />
          </div>
        </div>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Eventos no período"
            value={auditSummary.total}
            previousValue={previousAuditSummary?.total}
            deltaPct={
              previousAuditSummary
                ? pctDelta(auditSummary.total, previousAuditSummary.total)
                : undefined
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Ações críticas"
            value={auditSummary.critical}
            previousValue={previousAuditSummary?.critical}
            deltaPct={
              previousAuditSummary
                ? pctDelta(auditSummary.critical, previousAuditSummary.critical)
                : undefined
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Revelação de PII"
            value={auditSummary.pii}
            previousValue={previousAuditSummary?.pii}
            deltaPct={
              previousAuditSummary ? pctDelta(auditSummary.pii, previousAuditSummary.pii) : undefined
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Registros com diff"
            value={auditSummary.withDiff}
            previousValue={previousAuditSummary?.withDiff}
            deltaPct={
              previousAuditSummary
                ? pctDelta(auditSummary.withDiff, previousAuditSummary.withDiff)
                : undefined
            }
          />
        </Col>
      </Row>

      {(auditQuery.isLoading || auditQuery.isFetching) && (
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      )}

      {auditQuery.isError && (
        <Card extra={<Button onClick={() => auditQuery.refetch()}>Tentar novamente</Button>}>
          <Alert
            type="error"
            showIcon
            title="Não foi possível carregar"
            description={
              <>
                {getErrorMessage(auditQuery.error, 'Falha ao carregar logs.')}
                <DevErrorDetail error={auditQuery.error} />
              </>
            }
          />
        </Card>
      )}

      {!auditQuery.isLoading && !data.length && (
        <Card>
          <div style={{ padding: 32 }}>
            <Empty
              description="Sem logs para exibir."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        </Card>
      )}

      {!!data.length && (
        <Card className="app-card quantum-table" variant="borderless" title="Logs">
          <Space orientation="vertical" size={8} style={{ marginBottom: 12, width: '100%' }}>
            <Typography.Text type="secondary">
              LGPD ativo: campos sensíveis ficam mascarados e o acesso é registrado.
            </Typography.Text>
            {data.some((x) => x.piiMasked) && (
              <Button
                disabled={!canRevealPII}
                onClick={() => {
                  notification.info({
                    title: 'Acesso sensível registrado',
                    description:
                      'Visualização de PII marcada no log para fins de compliance (simulado).',
                  })
                }}
              >
                Registrar visualização de PII
              </Button>
            )}
          </Space>
          <VirtualTable rows={data} rowKey={(r) => r.id} columns={columns} height={520} />
        </Card>
      )}
    </Space>
  )
}

