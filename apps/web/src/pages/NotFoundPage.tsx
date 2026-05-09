import { Button, Card, Result } from 'antd'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <Card>
      <Result
        status="404"
        title="Página não encontrada"
        subTitle="O endereço acessado não existe ou foi movido."
        extra={
          <Button type="primary">
            <Link to="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        }
      />
    </Card>
  )
}

