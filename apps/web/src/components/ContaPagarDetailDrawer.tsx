import {
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  TagsOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Col, Drawer, Row, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { formatBRL } from '../utils/formatters'
import type { ContaPagar } from '../types/models'

type StatusStyle = {
  color: 'success' | 'processing' | 'error'
  accent: string
  icon: React.ReactNode
  hint: string
}

function statusStyle(status: ContaPagar['status'], diasAtraso: number, diasParaVencer: number): StatusStyle {
  if (status === 'Pago') {
    return { color: 'success', accent: '#10B981', icon: <CheckCircleOutlined />, hint: 'Título quitado' }
  }
  if (status === 'Vencido') {
    return {
      color: 'error',
      accent: '#F43F5E',
      icon: <WarningOutlined />,
      hint: `Vencido há ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'}`,
    }
  }
  return {
    color: 'processing',
    accent: '#3B82F6',
    icon: <ClockCircleOutlined />,
    hint:
      diasParaVencer <= 0
        ? 'Vence hoje'
        : `Vence em ${diasParaVencer} ${diasParaVencer === 1 ? 'dia' : 'dias'}`,
  }
}

const categoriaAccent: Record<ContaPagar['categoria'], string> = {
  'Matéria Prima': '#8B5CF6',
  Energia: '#F59E0B',
  Folha: '#06B6D4',
  Impostos: '#EF4444',
  Frete: '#10B981',
  Outros: '#64748B',
}

function InfoBlock({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | React.ReactNode
  sub?: string
  accent?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          flexShrink: 0,
          background: accent ? `${accent}14` : 'var(--qc-canvas)',
          display: 'grid',
          placeItems: 'center',
          color: accent ?? 'var(--qc-text-muted)',
          fontSize: 16,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <Typography.Text type="secondary" className="typ-label" style={{ display: 'block' }}>
          {label}
        </Typography.Text>
        <div className="typ-value-lg" style={{ marginTop: 1 }}>
          {value}
        </div>
        {sub && (
          <Typography.Text type="secondary" className="typ-meta">
            {sub}
          </Typography.Text>
        )}
      </div>
    </div>
  )
}

type Props = {
  open: boolean
  conta: ContaPagar | null
  onClose: () => void
}

export function ContaPagarDetailDrawer({ open, conta, onClose }: Props) {
  if (!conta) return null

  const hoje = dayjs().startOf('day')
  const venc = dayjs(conta.dataVencimento).startOf('day')
  const emi = dayjs(conta.dataEmissao).startOf('day')
  const pag = conta.dataPagamento ? dayjs(conta.dataPagamento).startOf('day') : null

  /** Dias de atraso (positivo = já atrasou; para pagos, mede quanto foi pago depois do vencimento). */
  const diasAtraso = pag
    ? Math.max(0, pag.diff(venc, 'day'))
    : Math.max(0, hoje.diff(venc, 'day'))
  const diasParaVencer = venc.diff(hoje, 'day')

  const style = statusStyle(conta.status, diasAtraso, diasParaVencer)
  const catAccent = categoriaAccent[conta.categoria] ?? '#64748B'

  const pagamentoSub = pag
    ? diasAtraso > 0
      ? `Pago com ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} de atraso`
      : 'Pago em dia'
    : conta.status === 'Vencido'
      ? `Atrasado há ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'}`
      : 'Ainda não pago'

  return (
    <Drawer
      title={null}
      placement="right"
      width={520}
      onClose={onClose}
      open={open}
      destroyOnClose
      styles={{ body: { padding: '0 24px 24px' } }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: '20px 0 16px',
          borderBottom: '1px solid var(--qc-border)',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Conta a pagar · #{conta.id}
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: '4px 0 0', lineHeight: 1.2 }}>
              {conta.fornecedor || 'Sem fornecedor'}
            </Typography.Title>
            {conta.descricao && (
              <Typography.Paragraph type="secondary" style={{ margin: '6px 0 0', fontSize: 12 }} ellipsis={{ rows: 2 }}>
                {conta.descricao}
              </Typography.Paragraph>
            )}
          </div>
          <Tag
            color={style.color}
            icon={style.icon}
            style={{ flexShrink: 0, fontSize: 12, padding: '3px 10px' }}
          >
            {conta.status}
          </Tag>
        </div>
      </div>

      {/* ── Hero valor ── */}
      <div
        style={{
          padding: '18px 20px',
          borderRadius: 14,
          marginBottom: 20,
          background: `linear-gradient(135deg, ${style.accent}1A 0%, ${style.accent}08 100%)`,
          border: `1px solid ${style.accent}33`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              Valor do título
            </Typography.Text>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1.1,
                fontVariantNumeric: 'tabular-nums',
                color: style.accent,
                marginTop: 4,
              }}
            >
              {formatBRL(conta.valor)}
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              {style.hint}
            </Typography.Text>
          </div>
          <div
            aria-hidden
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: `${style.accent}22`,
              color: style.accent,
              fontSize: 26,
              flexShrink: 0,
            }}
          >
            {style.icon}
          </div>
        </div>
      </div>

      {/* ── KPIs datas ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <InfoBlock
            icon={<CalendarOutlined />}
            label="Vencimento"
            value={venc.format('DD/MM/YYYY')}
            sub={
              conta.status === 'Pago'
                ? `Emitido em ${emi.format('DD/MM/YYYY')}`
                : diasParaVencer > 0
                  ? `em ${diasParaVencer} ${diasParaVencer === 1 ? 'dia' : 'dias'}`
                  : diasParaVencer === 0
                    ? 'hoje'
                    : `${Math.abs(diasParaVencer)} ${Math.abs(diasParaVencer) === 1 ? 'dia' : 'dias'} em atraso`
            }
            accent={style.accent}
          />
        </Col>
        <Col span={12}>
          <InfoBlock
            icon={pag ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
            label="Pagamento"
            value={pag ? pag.format('DD/MM/YYYY') : '—'}
            sub={pagamentoSub}
            accent={pag ? '#10B981' : diasAtraso > 0 ? '#F43F5E' : 'var(--qc-text-muted)'}
          />
        </Col>
        <Col span={12}>
          <InfoBlock
            icon={<TagsOutlined />}
            label="Categoria"
            value={
              <Tag color={undefined} style={{ margin: 0, background: `${catAccent}1A`, border: `1px solid ${catAccent}44`, color: catAccent, fontWeight: 600 }}>
                {conta.categoria}
              </Tag>
            }
            sub="Classificação contábil"
            accent={catAccent}
          />
        </Col>
        <Col span={12}>
          <InfoBlock
            icon={<FileTextOutlined />}
            label="Emissão"
            value={emi.format('DD/MM/YYYY')}
            sub={`${Math.max(0, venc.diff(emi, 'day'))} dias até o vencimento original`}
            accent="#8B5CF6"
          />
        </Col>
      </Row>

      {/* ── Bloco fornecedor ── */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 10,
          marginBottom: 20,
          background: 'var(--qc-canvas)',
          border: '1px solid var(--qc-border)',
        }}
      >
        <InfoBlock
          icon={<BankOutlined />}
          label="Fornecedor"
          value={conta.fornecedor || '—'}
          sub={`Categoria: ${conta.categoria} · Título #${conta.id}`}
          accent="#06B6D4"
        />
      </div>

      {/* ── Resumo financeiro / linha do tempo ── */}
      <Typography.Text strong className="typ-section">
        <DollarOutlined style={{ marginRight: 4 }} /> Resumo financeiro
      </Typography.Text>
      <div style={{ padding: '0 4px', marginTop: 8 }}>
        {(
          [
            { label: 'Valor do título', value: formatBRL(conta.valor) },
            { label: 'Data de emissão', value: emi.format('DD/MM/YYYY') },
            { label: 'Data de vencimento', value: venc.format('DD/MM/YYYY') },
            {
              label: 'Data de pagamento',
              value: pag ? pag.format('DD/MM/YYYY') : 'Em aberto',
              color: pag ? '#10B981' : 'var(--qc-text-muted)',
            },
            {
              label: 'Dias em atraso',
              value: diasAtraso > 0 ? `${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'}` : '—',
              color: diasAtraso > 0 ? '#F43F5E' : undefined,
            },
          ] as Array<{ label: string; value: string; color?: string }>
        ).map((r) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid var(--qc-border)',
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {r.label}
            </Typography.Text>
            <Typography.Text
              strong
              style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: r.color }}
            >
              {r.value}
            </Typography.Text>
          </div>
        ))}
      </div>
    </Drawer>
  )
}
