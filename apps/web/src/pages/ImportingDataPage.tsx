import { App, Card, Progress, Result } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOnboardingImportStatus } from '../services/onboardingService'

export function ImportingDataPage() {
  const { notification } = App.useApp()
  const [progress, setProgress] = useState(12)
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('running')

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const response = await getOnboardingImportStatus()
        if (cancelled) return
        const onboarding = response.onboarding
        if (!onboarding) return
        setProgress(Math.max(0, Math.min(onboarding.importProgress, 100)))
        setStatus(onboarding.importStatus)
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }

    void poll()
    const id = window.setInterval(() => void poll(), 1200)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (progress < 100 || status !== 'completed') return
    notification.success({ message: 'Importacao concluida', description: 'Os dashboards ja podem ser abertos.' })
  }, [notification, progress, status])

  const done = progress >= 100 && status === 'completed'
  const failed = status === 'failed'

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Card className="app-card" style={{ width: 'min(620px, 94vw)' }}>
        <Result
          status={done ? 'success' : failed ? 'error' : 'info'}
          title={done ? 'Dados prontos' : failed ? 'Falha na importacao' : 'Importando dados'}
          subTitle={done ? 'Primeiro processamento concluido.' : failed ? 'Tente iniciar o onboarding novamente.' : 'A sincronizacao segue em background.'}
          extra={done ? <Link to="/gestao">Abrir dashboard</Link> : <Progress percent={progress} status={failed ? 'exception' : 'active'} />}
        />
      </Card>
    </div>
  )
}
