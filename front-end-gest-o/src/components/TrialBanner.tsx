import { Alert, Button, Space } from 'antd'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getBillingStatus, type BillingStatus } from '../services/billingService'

/**
 * Banner discreto no topo do app quando trial esta acabando ou status problematico.
 * Esconde quando o tenant esta em `active` ou `trialing` com mais de 5 dias restantes.
 */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso) - Date.now()
  if (!Number.isFinite(ms)) return null
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

export function TrialBanner() {
  const [status, setStatus] = useState<BillingStatus | null>(null)

  useEffect(() => {
    getBillingStatus().then(setStatus).catch(() => undefined)
    /** Revalida a cada 15min — banner deve cair sozinho apos upgrade. */
    const id = setInterval(() => {
      getBillingStatus().then(setStatus).catch(() => undefined)
    }, 15 * 60_000)
    return () => clearInterval(id)
  }, [])

  if (!status) return null

  if (status.status === 'grace') {
    return (
      <Alert
        type="warning"
        showIcon
        banner
        message={
          <Space>
            <span>Pagamento falhou — voce esta em periodo de carencia. Atualize o cartao para nao perder acesso.</span>
            <Link to="/billing"><Button size="small">Atualizar pagamento</Button></Link>
          </Space>
        }
      />
    )
  }

  if (!status.access.allowed) {
    return (
      <Alert
        type="error"
        showIcon
        banner
        message={
          <Space>
            <span>{status.access.reason === 'trial_expired' ? 'Trial expirado.' : 'Assinatura inativa.'} Acesso somente leitura ate ativar plano.</span>
            <Link to="/planos"><Button size="small" type="primary">Ver planos</Button></Link>
          </Space>
        }
      />
    )
  }

  if (status.status === 'trialing' || status.plan === 'trial') {
    const days = daysUntil(status.trialEndsAt)
    if (days != null && days <= 5) {
      return (
        <Alert
          type={days <= 2 ? 'warning' : 'info'}
          showIcon
          banner
          message={
            <Space>
              <span>Seu trial expira em <strong>{days} {days === 1 ? 'dia' : 'dias'}</strong>.</span>
              <Link to="/planos"><Button size="small" type="primary">Assinar agora</Button></Link>
            </Space>
          }
        />
      )
    }
  }

  return null
}
