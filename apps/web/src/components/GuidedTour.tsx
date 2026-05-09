import { Button, Modal, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { markGuidedTourDone } from './guidedTourStorage'

export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const steps = useMemo(() => [
    {
      title: 'Dashboard',
      description: 'Acompanhe indicadores principais, alertas e atalhos para investigar dados.',
    },
    {
      title: 'Fontes de dados',
      description: 'Conecte ERP, BI ou APIs REST e valide campos antes de liberar dashboards.',
    },
    {
      title: 'Equipe',
      description: 'Convide usuarios e limite acessos por perfil e permissoes.',
    },
  ], [])
  const current = steps[step]

  function finish() {
    markGuidedTourDone()
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={finish}
      footer={null}
      title={`Tour guiado ${step + 1}/${steps.length}`}
      width={460}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ minHeight: 96 }}>
          <Typography.Title level={4}>{current.title}</Typography.Title>
          <Typography.Paragraph type="secondary">{current.description}</Typography.Paragraph>
        </div>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Button disabled={step === 0} onClick={() => setStep((value) => Math.max(value - 1, 0))}>Voltar</Button>
          {step === steps.length - 1 ? (
            <Button type="primary" onClick={finish}>Concluir</Button>
          ) : (
            <Button type="primary" onClick={() => setStep((value) => Math.min(value + 1, steps.length - 1))}>Proximo</Button>
          )}
        </Space>
      </Space>
    </Modal>
  )
}
