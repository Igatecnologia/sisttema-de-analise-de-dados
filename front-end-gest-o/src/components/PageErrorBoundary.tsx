import { Button, Result, Typography } from 'antd'
import React from 'react'
import { captureError } from '../monitoring/errorTracker'

type Props = {
  children: React.ReactNode
}

type State = {
  hasError: boolean
  errorId: string | null
  errorMessage: string | null
}

function generateErrorId(): string {
  return `PG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

/**
 * Error boundary de página: captura erros em uma página sem derrubar o app inteiro.
 * O usuário pode voltar à home ou recarregar a página.
 */
export class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, errorId: null, errorMessage: null }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorId: generateErrorId(),
      errorMessage: error?.message ?? String(error),
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureError(error, {
      component: 'PageErrorBoundary',
      extra: {
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
      },
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, errorId: null, errorMessage: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{ padding: 32, display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <Result
          status="warning"
          title="Esta página encontrou um problema"
          subTitle="O restante do sistema continua funcionando."
          extra={
            <>
              <Button type="primary" onClick={this.handleReset}>
                Tentar novamente
              </Button>
              <Button onClick={() => (window.location.href = '/')} style={{ marginLeft: 8 }}>
                Voltar ao início
              </Button>
              {this.state.errorId && (
                <Typography.Text
                  type="secondary"
                  style={{ display: 'block', marginTop: 12, fontSize: 12 }}
                  copyable
                >
                  Ref: {this.state.errorId}
                </Typography.Text>
              )}
            </>
          }
        />
      </div>
    )
  }
}
