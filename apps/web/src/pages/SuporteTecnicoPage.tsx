import { CloudServerOutlined, DatabaseOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Row, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/permissions'
import { PageHeaderCard } from '../components/PageHeaderCard'

/**
 * Área técnica: atalhos conforme permissões (support / datasources / operations).
 * Contato em `/suporte/fale-conosco` (todos os usuários).
 */
export function SuporteTecnicoPage() {
  const { session } = useAuth()
  const canDatasources = hasPermission(session, 'datasources:view')
  const canOperations = hasPermission(session, 'operations:view')

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Suporte técnico — área restrita"
        subtitle="Integrações e diagnóstico conforme as permissões do seu usuário. O contato com o suporte está em Fale conosco."
      />

      <Alert
        type="info"
        showIcon
        message="Permissões granulares"
        description="Fontes de dados e o painel Operação são liberados apenas para quem tiver as permissões correspondentes em Funcionários. Demais dúvidas: Fale conosco (WhatsApp)."
      />

      {(canDatasources || canOperations) && (
        <Row gutter={[16, 16]}>
          {canDatasources && (
            <Col xs={24} md={canOperations ? 12 : 24}>
              <Card
                hoverable
                className="app-card"
                title={
                  <Space>
                    <DatabaseOutlined />
                    Fontes de dados
                  </Space>
                }
              >
                <Typography.Paragraph type="secondary">
                  Cadastro e teste de conexões SGBR/ERP, credenciais de API e diagnóstico de campos.
                </Typography.Paragraph>
                <Link to="/fontes-de-dados">
                  <Button type="primary" block>
                    Abrir fontes de dados
                  </Button>
                </Link>
              </Card>
            </Col>
          )}
          {canOperations && (
            <Col xs={24} md={canDatasources ? 12 : 24}>
              <Card
                hoverable
                className="app-card"
                title={
                  <Space>
                    <CloudServerOutlined />
                    Operação
                  </Space>
                }
              >
                <Typography.Paragraph type="secondary">
                  Saúde do proxy, cache de tokens e status operacional do backend (exclusivo suporte).
                </Typography.Paragraph>
                <Link to="/admin/operacao">
                  <Button type="primary" block>
                    Abrir operação
                  </Button>
                </Link>
              </Card>
            </Col>
          )}
        </Row>
      )}

      {!canDatasources && !canOperations && (
        <Typography.Paragraph type="secondary">
          Você tem acesso à área técnica, mas sem permissão para Fontes de dados ou Operação. Peça ao
          administrador ou use o canal abaixo.
        </Typography.Paragraph>
      )}

      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        <Link to="/suporte/fale-conosco">Ir para Fale conosco (WhatsApp)</Link>
      </Typography.Paragraph>
    </Space>
  )
}
