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
  errorStack: string | null
}

function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, errorId: null, errorMessage: null, errorStack: null }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorId: generateErrorId(),
      errorMessage: error?.message ?? String(error),
      errorStack: error?.stack ?? null,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] erro capturado:', error)
    console.error('[AppErrorBoundary] componentStack:', errorInfo.componentStack)
    captureError(error, {
      component: 'AppErrorBoundary',
      extra: {
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
      },
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 16,
        }}
      >
        <Result
          status="500"
          title="Algo deu errado"
          subTitle={this.state.errorMessage ?? 'Tente recarregar a página.'}
          extra={
            <>
              <Button type="primary" onClick={() => window.location.reload()}>
                Recarregar
              </Button>
              {this.state.errorId ? (
                <Typography.Text
                  type="secondary"
                  style={{ display: 'block', marginTop: 12, fontSize: 12 }}
                  copyable
                >
                  Código do erro: {this.state.errorId}
                </Typography.Text>
              ) : null}
              {this.state.errorStack ? (
                <details style={{ marginTop: 16, textAlign: 'left', maxWidth: 720 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: '#888' }}>
                    Detalhes técnicos (clique para expandir)
                  </summary>
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#fafafa',
                      border: '1px solid #eee',
                      borderRadius: 4,
                      fontSize: 11,
                      maxHeight: 300,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {this.state.errorStack}
                  </pre>
                </details>
              ) : null}
            </>
          }
        />
      </div>
    )
  }
}
