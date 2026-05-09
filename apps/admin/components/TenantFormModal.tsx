'use client'

import { Col, DatePicker, Form, Input, Modal, Row, Select, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect } from 'react'
import { api, ApiError, ALL_MODULES, type Tenant, type TenantInput } from '@/lib/api'

type FormValues = {
  slug?: string
  name: string
  subtitle?: string
  plan: 'trial' | 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'inactive'
  connectorId?: string
  trialEndsAt?: Dayjs | null
  enabledModules?: string[]
  logoUrl?: string
  primaryColor?: string
}

type Props = {
  open: boolean
  tenant: Tenant | null
  onClose: () => void
  onSaved: () => void
}

export function TenantFormModal({ open, tenant, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>()

  useEffect(() => {
    if (!open) return
    if (tenant) {
      form.setFieldsValue({
        slug: tenant.slug,
        name: tenant.name,
        subtitle: tenant.subtitle,
        plan: tenant.plan,
        status: tenant.status === 'inactive' ? 'inactive' : 'active',
        connectorId: tenant.connectorId,
        trialEndsAt: tenant.trialEndsAt ? dayjs(tenant.trialEndsAt) : null,
        enabledModules: tenant.enabledModules,
        logoUrl: tenant.logoUrl ?? '',
        primaryColor: tenant.primaryColor ?? '',
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        plan: 'trial',
        status: 'active',
        connectorId: 'sgbr-espuma',
        subtitle: 'Gestao e Analise de Dados',
        enabledModules: ['dashboard', 'financeiro', 'relatorios', 'usuarios', 'auditoria', 'datasources', 'operations'],
        trialEndsAt: dayjs().add(14, 'day'),
      })
    }
  }, [open, tenant, form])

  async function handleOk() {
    try {
      const values = await form.validateFields()
      const payload: Partial<TenantInput> & { name: string; plan: TenantInput['plan']; status: TenantInput['status'] } = {
        name: values.name.trim(),
        plan: values.plan,
        status: values.status,
      }
      if (!tenant && values.slug) payload.slug = values.slug.trim()
      if (values.subtitle !== undefined) payload.subtitle = values.subtitle?.trim() || 'Gestao e Analise de Dados'
      if (values.connectorId !== undefined) payload.connectorId = values.connectorId?.trim() || 'sgbr-espuma'
      payload.logoUrl = values.logoUrl?.trim() ? values.logoUrl.trim() : null
      payload.primaryColor = values.primaryColor?.trim() ? values.primaryColor.trim() : null
      payload.trialEndsAt = values.trialEndsAt ? values.trialEndsAt.toISOString() : null
      if (values.enabledModules) payload.enabledModules = values.enabledModules

      if (tenant) {
        await api.put(`/v1/super-admin/tenants/${tenant.id}`, payload)
        message.success('Tenant atualizado')
      } else {
        await api.post('/v1/super-admin/tenants', payload)
        message.success('Tenant criado')
      }
      onSaved()
      onClose()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const msg = err instanceof ApiError ? err.message : 'Falha ao salvar'
      message.error(msg)
    }
  }

  return (
    <Modal
      open={open}
      title={tenant ? `Editar tenant — ${tenant.name}` : 'Novo tenant'}
      width={720}
      okText={tenant ? 'Salvar' : 'Criar'}
      cancelText="Cancelar"
      onCancel={onClose}
      onOk={handleOk}
      destroyOnClose
    >
      <Form<FormValues> form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Slug" name="slug" rules={[{ required: !tenant, message: 'Informe o slug.' }]}>
              <Input disabled={!!tenant} placeholder="acme-industria" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
              <Input placeholder="Acme Indústria" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Subtítulo" name="subtitle">
          <Input placeholder="Gestao e Analise de Dados" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Plano" name="plan" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'trial', label: 'Trial' },
                  { value: 'starter', label: 'Starter' },
                  { value: 'pro', label: 'Pro' },
                  { value: 'enterprise', label: 'Enterprise' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Status" name="status" rules={[{ required: true }]}>
              <Select options={[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Inativo' }]} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Trial até" name="trialEndsAt">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Connector" name="connectorId">
          <Input placeholder="sgbr-espuma" />
        </Form.Item>

        <Form.Item label="Módulos habilitados" name="enabledModules">
          <Select mode="multiple" options={ALL_MODULES.map((m) => ({ value: m, label: m }))} />
        </Form.Item>

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item label="Logo URL" name="logoUrl">
              <Input placeholder="https://..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Cor primária" name="primaryColor">
              <Input placeholder="#1677ff" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
