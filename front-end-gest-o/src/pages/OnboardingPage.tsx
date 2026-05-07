import { App, Button, Card, Form, Input, Select, Steps, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveOnboarding, startOnboardingImport } from '../services/onboardingService'

type OnboardingFormValues = {
  segmento?: string
  meta?: string
  origem?: string
  endpoint?: string
  emails?: string
}

function parseTeamEmails(value?: string): string[] {
  return (value ?? '')
    .split(/\r?\n|,/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { message } = App.useApp()

  async function onFinish(values: OnboardingFormValues) {
    if (step < 2) {
      setStep(step + 1)
      return
    }

    setSubmitting(true)
    try {
      await saveOnboarding({
        companyProfile: {
          segmento: values.segmento ?? '',
          meta: values.meta ?? '',
        },
        dataSetup: {
          origem: values.origem ?? '',
          endpoint: values.endpoint ?? '',
        },
        teamInvites: parseTeamEmails(values.emails),
      })
      await startOnboardingImport()
      navigate('/importando-dados')
    } catch {
      message.error('Nao foi possivel salvar o onboarding.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Card className="app-card" style={{ width: 'min(760px, 94vw)' }}>
        <Steps current={step} items={[{ title: 'Empresa' }, { title: 'Dados' }, { title: 'Equipe' }]} />
        <Typography.Title level={2} style={{ marginTop: 24 }}>Onboarding</Typography.Title>
        <Form<OnboardingFormValues> layout="vertical" onFinish={onFinish}>
          {step === 0 ? (
            <>
              <Form.Item name="segmento" label="Segmento" rules={[{ required: true }]}>
                <Select options={[{ value: 'industria', label: 'Industria' }, { value: 'varejo', label: 'Varejo' }, { value: 'servicos', label: 'Servicos' }]} />
              </Form.Item>
              <Form.Item name="meta" label="Principal meta">
                <Input maxLength={160} />
              </Form.Item>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <Form.Item name="origem" label="Origem dos dados" rules={[{ required: true }]}>
                <Select options={[{ value: 'sgbr', label: 'SGBR BI' }, { value: 'api', label: 'API REST' }, { value: 'demo', label: 'Dados demo' }]} />
              </Form.Item>
              <Form.Item name="endpoint" label="Endpoint inicial">
                <Input maxLength={300} />
              </Form.Item>
            </>
          ) : null}
          {step === 2 ? (
            <Form.Item name="emails" label="Emails da equipe">
              <Input.TextArea rows={4} placeholder="um email por linha" />
            </Form.Item>
          ) : null}
          <Button type="primary" htmlType="submit" loading={submitting}>{step < 2 ? 'Continuar' : 'Importar dados'}</Button>
        </Form>
      </Card>
    </div>
  )
}
