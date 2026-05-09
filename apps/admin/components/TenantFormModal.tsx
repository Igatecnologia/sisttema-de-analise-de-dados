'use client'

import { Alert, Col, DatePicker, Divider, Form, Input, Modal, Row, Select, Spin, Tag, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Building2, CheckCircle2, MapPin, Search, Sparkles, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError, ALL_MODULES, type Tenant, type TenantInput } from '@/lib/api'
import {
  CnpjNetworkError,
  CnpjNotFoundError,
  formatCnpj,
  isValidCnpj,
  lookupCnpj,
  sanitizeCnpj,
  slugify,
  type CnpjData,
} from '@/lib/cnpjLookup'

type FormValues = {
  cnpj?: string
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
  contactEmail?: string
  contactPhone?: string
  betaNotes?: string
}

type Props = {
  open: boolean
  tenant: Tenant | null
  onClose: () => void
  onSaved: () => void
}

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; data: CnpjData }
  | { status: 'not-found' }
  | { status: 'invalid' }
  | { status: 'error'; message: string }

export function TenantFormModal({ open, tenant, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>()
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setLookup({ status: 'idle' })
    if (tenant) {
      form.setFieldsValue({
        cnpj: tenant.cnpj ? formatCnpj(tenant.cnpj) : '',
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
        contactEmail: tenant.contactEmail ?? '',
        contactPhone: tenant.contactPhone ?? '',
        betaNotes: tenant.betaNotes ?? '',
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

  function handleCnpjChange(raw: string) {
    const masked = formatCnpj(raw)
    form.setFieldValue('cnpj', masked)
    const digits = sanitizeCnpj(raw)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (digits.length === 0) {
      setLookup({ status: 'idle' })
      return
    }
    if (digits.length < 14) {
      setLookup({ status: 'idle' })
      return
    }
    if (!isValidCnpj(digits)) {
      setLookup({ status: 'invalid' })
      return
    }

    setLookup({ status: 'loading' })
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await lookupCnpj(digits)
        setLookup({ status: 'found', data })
        // Auto-preenche se campos vazios — nao sobrescreve o que o admin ja digitou.
        const currentName = form.getFieldValue('name')
        const currentSlug = form.getFieldValue('slug')
        const currentEmail = form.getFieldValue('contactEmail')
        const currentPhone = form.getFieldValue('contactPhone')
        if (!currentName) {
          form.setFieldValue('name', data.nomeFantasia ?? data.razaoSocial)
        }
        if (!currentSlug && !tenant) {
          form.setFieldValue('slug', slugify(data.nomeFantasia ?? data.razaoSocial))
        }
        if (!currentEmail && data.email) {
          form.setFieldValue('contactEmail', data.email)
        }
        if (!currentPhone && data.telefone) {
          form.setFieldValue('contactPhone', data.telefone)
        }
      } catch (err) {
        if (err instanceof CnpjNotFoundError) setLookup({ status: 'not-found' })
        else if (err instanceof CnpjNetworkError) setLookup({ status: 'error', message: err.message })
        else setLookup({ status: 'error', message: (err as Error).message })
      }
    }, 400)
  }

  async function handleOk() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const cnpjDigits = values.cnpj ? sanitizeCnpj(values.cnpj) : ''
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
      payload.cnpj = cnpjDigits.length === 14 ? cnpjDigits : null
      payload.contactEmail = values.contactEmail?.trim() || null
      payload.contactPhone = values.contactPhone?.trim() || null
      payload.betaNotes = values.betaNotes?.trim() || null

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
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-strong, var(--accent)))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Building2 size={17} strokeWidth={2.2} />
          </span>
          <span>{tenant ? `Editar — ${tenant.name}` : 'Novo cliente Beta'}</span>
        </div>
      }
      width={780}
      okText={tenant ? 'Salvar' : 'Criar cliente'}
      cancelText="Cancelar"
      confirmLoading={saving}
      onCancel={onClose}
      onOk={handleOk}
      destroyOnClose
    >
      <Form<FormValues> form={form} layout="vertical">
        {/* Seção 1 — CNPJ lookup */}
        <Divider titlePlacement="start" plain style={{ margin: '8px 0 16px', fontSize: 12, opacity: 0.7 }}>
          DADOS DA EMPRESA
        </Divider>

        <Row gutter={16}>
          <Col span={10}>
            <Form.Item
              label={
                <span>
                  CNPJ <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>auto-completa</Tag>
                </span>
              }
              name="cnpj"
              extra="Cole/digite o CNPJ — buscamos a Razão Social na BrasilAPI."
            >
              <Input
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
                onChange={(e) => handleCnpjChange(e.target.value)}
                suffix={
                  lookup.status === 'loading' ? (
                    <Spin size="small" />
                  ) : lookup.status === 'found' ? (
                    <CheckCircle2 size={16} color="var(--success, #10b981)" />
                  ) : lookup.status === 'not-found' || lookup.status === 'invalid' || lookup.status === 'error' ? (
                    <XCircle size={16} color="var(--danger, #ef4444)" />
                  ) : (
                    <Search size={14} style={{ opacity: 0.4 }} />
                  )
                }
              />
            </Form.Item>
          </Col>
          <Col span={14}>
            <Form.Item label="Nome (fantasia ou razão social)" name="name" rules={[{ required: true, message: 'Nome obrigatório' }]}>
              <Input placeholder="Acme Indústria" />
            </Form.Item>
          </Col>
        </Row>

        {lookup.status === 'found' && (
          <Alert
            type="success"
            showIcon
            icon={<Sparkles size={16} />}
            style={{ marginTop: -8, marginBottom: 16 }}
            message={
              <div style={{ fontSize: 13 }}>
                <strong>{lookup.data.razaoSocial}</strong>
                {lookup.data.cnaePrincipal && <span style={{ opacity: 0.75 }}> · {lookup.data.cnaePrincipal}</span>}
              </div>
            }
            description={
              <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 4 }}>
                {lookup.data.municipio && lookup.data.uf && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} /> {lookup.data.municipio}/{lookup.data.uf}
                  </span>
                )}
                {lookup.data.situacao && (
                  <Tag color={lookup.data.situacao.toUpperCase() === 'ATIVA' ? 'green' : 'orange'} style={{ marginRight: 0 }}>
                    {lookup.data.situacao}
                  </Tag>
                )}
                {lookup.data.porte && <Tag style={{ marginRight: 0 }}>{lookup.data.porte}</Tag>}
              </div>
            }
          />
        )}
        {lookup.status === 'invalid' && (
          <Alert type="error" showIcon style={{ marginTop: -8, marginBottom: 16 }} message="CNPJ inválido — verifique os dígitos." />
        )}
        {lookup.status === 'not-found' && (
          <Alert type="warning" showIcon style={{ marginTop: -8, marginBottom: 16 }} message="CNPJ não encontrado na Receita." description="Você ainda pode criar o tenant — o CNPJ ficará apenas registrado." />
        )}
        {lookup.status === 'error' && (
          <Alert type="error" showIcon style={{ marginTop: -8, marginBottom: 16 }} message="Falha ao consultar CNPJ" description={lookup.message} />
        )}

        <Row gutter={16}>
          <Col span={10}>
            <Form.Item label="Slug" name="slug" rules={[{ required: !tenant, message: 'Slug obrigatório' }]} extra={tenant ? 'Imutável após criação' : 'Domínio: <slug>.iga.app'}>
              <Input disabled={!!tenant} placeholder="acme-industria" />
            </Form.Item>
          </Col>
          <Col span={14}>
            <Form.Item label="Subtítulo" name="subtitle">
              <Input placeholder="Gestao e Analise de Dados" />
            </Form.Item>
          </Col>
        </Row>

        {/* Seção 2 — Contato beta */}
        <Divider titlePlacement="start" plain style={{ margin: '16px 0', fontSize: 12, opacity: 0.7 }}>
          CONTATO (BETA)
        </Divider>

        <Row gutter={16}>
          <Col span={14}>
            <Form.Item label="Email do contato" name="contactEmail" rules={[{ type: 'email', message: 'Email inválido' }]}>
              <Input placeholder="contato@empresa.com" />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item label="Telefone" name="contactPhone">
              <Input placeholder="(11) 99999-9999" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Notas internas (Beta)" name="betaNotes" extra="Visível apenas no super-admin. Use para registrar contexto do convite, follow-up, etc.">
          <Input.TextArea rows={2} placeholder="Indicado por João, primeiro contato em 2026-04-12..." maxLength={2000} showCount />
        </Form.Item>

        {/* Seção 3 — Plano e operação */}
        <Divider titlePlacement="start" plain style={{ margin: '16px 0', fontSize: 12, opacity: 0.7 }}>
          PLANO E OPERAÇÃO
        </Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Plano" name="plan" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'trial', label: 'Trial (Beta)' },
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
          <Input placeholder="sgbr-espuma | iga-custom-api | bling | tiny | omie" />
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
