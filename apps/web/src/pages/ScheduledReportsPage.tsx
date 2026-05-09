import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { Calendar, FileSpreadsheet, FileText, Mail, Plus, Trash2 } from 'lucide-react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import {
  buildCronExpr,
  createScheduledReport,
  deleteScheduledReport,
  describeCron,
  listScheduledReports,
  type ScheduledReport,
} from '../services/scheduledReportsService'

const REPORT_TYPES = [
  { value: 'vendas-mensal', label: 'Vendas — resumo mensal' },
  { value: 'financeiro-completo', label: 'Financeiro — completo' },
  { value: 'estoque-snapshot', label: 'Estoque — snapshot atual' },
  { value: 'compras-mensal', label: 'Compras — resumo mensal' },
  { value: 'producao-diaria', label: 'Produção — diário' },
  { value: 'auditoria-completa', label: 'Auditoria — log completo' },
]

const WEEKDAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

type FormValues = {
  name: string
  reportType: string
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  weekday: number
  dayOfMonth: number
  recipients: string
  format: 'pdf' | 'excel'
  active: boolean
}

export function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<FormValues>()
  const frequency = Form.useWatch('frequency', form)

  async function load() {
    setLoading(true)
    try {
      const list = await listScheduledReports()
      setReports(list)
    } catch {
      message.error('Falha ao carregar relatórios agendados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    form.resetFields()
    form.setFieldsValue({
      frequency: 'weekly',
      hour: 8,
      minute: 0,
      weekday: 1,
      dayOfMonth: 1,
      format: 'pdf',
      active: true,
    })
    setModalOpen(true)
  }

  async function save() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const recipients = values.recipients
        .split(/[,;\s\n]+/)
        .map((e) => e.trim())
        .filter(Boolean)
      if (recipients.length === 0) {
        message.error('Adicione ao menos um destinatário')
        return
      }
      const cronExpr = buildCronExpr({
        frequency: values.frequency,
        hour: values.hour,
        minute: values.minute,
        weekday: values.weekday,
        dayOfMonth: values.dayOfMonth,
      })
      await createScheduledReport({
        name: values.name.trim(),
        reportType: values.reportType,
        frequency: values.frequency,
        cronExpr,
        recipients,
        format: values.format,
        active: values.active,
      })
      message.success('Relatório agendado criado')
      setModalOpen(false)
      void load()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const e = err as { response?: { data?: { message?: string } } }
      message.error(e.response?.data?.message ?? 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      await deleteScheduledReport(id)
      message.success('Removido')
      void load()
    } catch {
      message.error('Falha ao remover')
    }
  }

  const columns = useMemo<ColumnsType<ScheduledReport>>(
    () => [
      {
        title: 'Nome',
        dataIndex: 'name',
        key: 'name',
        render: (v: string, r) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{v}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {REPORT_TYPES.find((t) => t.value === r.reportType)?.label ?? r.reportType}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Quando',
        dataIndex: 'cronExpr',
        key: 'cron',
        render: (v: string) => <Typography.Text style={{ fontSize: 13 }}>{describeCron(v)}</Typography.Text>,
      },
      {
        title: 'Formato',
        dataIndex: 'format',
        key: 'format',
        width: 110,
        render: (v: string) => (
          <Tag icon={v === 'pdf' ? <FileText size={11} /> : <FileSpreadsheet size={11} />} color={v === 'pdf' ? 'red' : 'green'}>
            {v.toUpperCase()}
          </Tag>
        ),
      },
      {
        title: 'Destinatários',
        dataIndex: 'recipients',
        key: 'recipients',
        render: (v: string[]) => (
          <Space size={4} wrap>
            {v.slice(0, 2).map((email) => (
              <Tag key={email} icon={<Mail size={11} />}>
                {email}
              </Tag>
            ))}
            {v.length > 2 ? <Tag>+{v.length - 2}</Tag> : null}
          </Space>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'active',
        key: 'active',
        width: 110,
        render: (active: boolean) => (
          <Badge status={active ? 'success' : 'default'} text={active ? 'Ativo' : 'Pausado'} />
        ),
      },
      {
        title: 'Último envio',
        dataIndex: 'lastSentAt',
        key: 'lastSentAt',
        width: 150,
        render: (v: string | null) =>
          v ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {new Date(v).toLocaleString('pt-BR')}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Nunca
            </Typography.Text>
          ),
      },
      {
        title: '',
        key: 'actions',
        width: 60,
        render: (_, record) => (
          <Popconfirm title="Remover este agendamento?" okType="danger" onConfirm={() => remove(record.id)}>
            <Button type="text" size="small" icon={<Trash2 size={14} />} danger />
          </Popconfirm>
        ),
      },
    ],
    [],
  )

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard
        title="Relatórios agendados"
        subtitle="Receba relatórios por email automaticamente, no horário que escolher."
        icon={<Calendar size={22} />}
        breadcrumbs={[
          { label: 'Início', to: '/gestao' },
          { label: 'Financeiro' },
          { label: 'Relatórios' },
          { label: 'Agendados' },
        ]}
        extra={
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Novo agendamento
          </Button>
        }
      />

      <Alert
        type="info"
        showIcon
        icon={<Calendar size={16} />}
        message="Os relatórios são enviados pelo servidor automaticamente nos horários configurados. Verifique sua caixa de entrada e a pasta de spam."
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ScheduledReport>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={reports}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Nenhum agendamento ainda"
                style={{ padding: 24 }}
              >
                <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
                  Criar primeiro agendamento
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title="Novo relatório agendado"
        okText="Criar"
        cancelText="Cancelar"
        onCancel={() => setModalOpen(false)}
        onOk={save}
        confirmLoading={saving}
        width={680}
      >
        <Form<FormValues> form={form} layout="vertical">
          <Form.Item label="Nome" name="name" rules={[{ required: true, message: 'Informe um nome.' }]}>
            <Input placeholder="Ex: Vendas semanal — segunda 8h" />
          </Form.Item>
          <Form.Item label="Tipo de relatório" name="reportType" rules={[{ required: true }]}>
            <Select options={REPORT_TYPES} placeholder="Selecione o conteúdo" />
          </Form.Item>

          <Form.Item label="Frequência" name="frequency" rules={[{ required: true }]}>
            <Segmented
              block
              options={[
                { value: 'daily', label: 'Diário' },
                { value: 'weekly', label: 'Semanal' },
                { value: 'monthly', label: 'Mensal' },
              ]}
            />
          </Form.Item>

          <Row gutter={12}>
            {frequency === 'weekly' ? (
              <Col span={8}>
                <Form.Item label="Dia da semana" name="weekday" rules={[{ required: true }]}>
                  <Select options={WEEKDAYS} />
                </Form.Item>
              </Col>
            ) : null}
            {frequency === 'monthly' ? (
              <Col span={8}>
                <Form.Item label="Dia do mês" name="dayOfMonth" rules={[{ required: true, type: 'number', min: 1, max: 28 }]}>
                  <InputNumber min={1} max={28} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            ) : null}
            <Col span={frequency === 'daily' ? 12 : 8}>
              <Form.Item label="Hora" name="hour" rules={[{ required: true, type: 'number', min: 0, max: 23 }]}>
                <InputNumber min={0} max={23} style={{ width: '100%' }} addonAfter="h" />
              </Form.Item>
            </Col>
            <Col span={frequency === 'daily' ? 12 : 8}>
              <Form.Item label="Minuto" name="minute" rules={[{ required: true, type: 'number', min: 0, max: 59 }]}>
                <InputNumber min={0} max={59} style={{ width: '100%' }} addonAfter="min" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Destinatários"
            name="recipients"
            rules={[{ required: true, message: 'Informe ao menos um email.' }]}
            extra="Separe múltiplos emails por vírgula, ponto-e-vírgula ou nova linha."
          >
            <Input.TextArea
              rows={3}
              placeholder="financeiro@empresa.com, diretor@empresa.com"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Row gutter={12} align="middle">
            <Col span={12}>
              <Form.Item label="Formato" name="format" rules={[{ required: true }]}>
                <Segmented
                  block
                  options={[
                    { value: 'pdf', label: 'PDF' },
                    { value: 'excel', label: 'Excel' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ativo" name="active" valuePropName="checked">
                <Switch checkedChildren="Sim" unCheckedChildren="Pausado" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default ScheduledReportsPage
