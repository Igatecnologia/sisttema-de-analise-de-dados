'use client'

import { InputNumber, Modal, Space, Typography, message } from 'antd'
import { useState } from 'react'
import dayjs from 'dayjs'
import { api, ApiError, type Tenant } from '@/lib/api'

type Props = {
  tenant: Tenant | null
  onClose: () => void
  onSaved: () => void
}

export function ExtendTrialModal({ tenant, onClose, onSaved }: Props) {
  const [days, setDays] = useState(14)
  const [submitting, setSubmitting] = useState(false)

  async function handleOk() {
    if (!tenant) return
    setSubmitting(true)
    try {
      await api.post(`/v1/super-admin/tenants/${tenant.id}/extend-trial`, { days })
      message.success(`Trial estendido em ${days} dias`)
      onSaved()
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao estender trial'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={!!tenant}
      title="Estender trial"
      okText="Estender"
      cancelText="Cancelar"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={handleOk}
    >
      {tenant ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text>
            Tenant: <Typography.Text strong>{tenant.name}</Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary">
            Trial atual: {tenant.trialEndsAt ? dayjs(tenant.trialEndsAt).format('DD/MM/YYYY') : '—'}
          </Typography.Text>
          <InputNumber
            min={1}
            max={365}
            value={days}
            onChange={(v) => setDays(Number(v) || 1)}
            addonAfter="dias"
            style={{ width: 200 }}
          />
        </Space>
      ) : null}
    </Modal>
  )
}
