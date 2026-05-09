import {
  AlertOutlined,
  AppstoreOutlined,
  CloudOutlined,
  CloudServerOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  DotChartOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  InboxOutlined,
  PhoneOutlined,
  ProfileOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import { Alert, Card, Col, Row, Space, Typography } from 'antd'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { useAuth } from '../auth/AuthContext'
import type { AuthSession } from '../auth/authStorage'
import type { Permission } from '../auth/permissions'
import { hasPermission } from '../auth/permissions'
import { hasAnySources } from '../services/dataSourceService'

type HubItem = {
  /** Se definido, exige permissão. Se omitido, visível a qualquer usuário autenticado. */
  permission?: Permission
  title: string
  description: string
  path: string
  icon: ReactNode
}

function hubItemVisible(session: AuthSession | null, it: HubItem): boolean {
  if (!session) return false
  if (it.permission && !hasPermission(session, it.permission)) return false
  return true
}

const HUB_SECTIONS: { label: string; items: HubItem[] }[] = [
  {
    label: 'Indicadores e vendas',
    items: [
      {
        permission: 'dashboard:view',
        title: 'Visão geral',
        description: 'KPIs, tendência de faturamento e resumo do período em um só lugar.',
        path: '/dashboard',
        icon: <DashboardOutlined style={{ fontSize: 22 }} />,
      },
      {
        permission: 'dashboard:view',
        title: 'Análises BI',
        description: 'Curvas, composição de receita e leituras analíticas para decisão.',
        path: '/dashboard/analises',
        icon: <DotChartOutlined style={{ fontSize: 22 }} />,
      },
      {
        permission: 'dashboard:view',
        title: 'Vendas analítico',
        description: 'Pedidos, clientes, produtos e margem — visão detalhada por linha.',
        path: '/dashboard/vendas-analitico',
        icon: <ShoppingCartOutlined style={{ fontSize: 22 }} />,
      },
    ],
  },
  {
    label: 'Financeiro e relatórios',
    items: [
      {
        permission: 'reports:view',
        title: 'Financeiro',
        description: 'Fluxo, contas e indicadores financeiros consolidados.',
        path: '/financeiro',
        icon: <DollarOutlined style={{ fontSize: 22 }} />,
      },
      {
        permission: 'reports:view',
        title: 'Relatórios',
        description: 'Exportação CSV/PDF e cortes executivos sobre vendas e custos.',
        path: '/relatorios',
        icon: <FileTextOutlined style={{ fontSize: 22 }} />,
      },
    ],
  },
  {
    label: 'Operação',
    items: [
      {
        permission: 'alertas:view',
        title: 'Alertas',
        description: 'Exceções, gargalos e o que precisa de ação imediata.',
        path: '/alertas',
        icon: <AlertOutlined style={{ fontSize: 22 }} />,
      },
      {
        permission: 'estoque:view',
        title: 'Estoque',
        description: 'Posição atual e movimentações de materiais e produtos.',
        path: '/estoque',
        icon: <InboxOutlined style={{ fontSize: 22 }} />,
      },
    ],
  },
  {
    label: 'ERP / Produção',
    items: [
      {
        permission: 'producao:view',
        title: 'Produção',
        description: 'Ordens, lotes, rendimento e acompanhamento da linha fabril.',
        path: '/producao',
        icon: <ExperimentOutlined style={{ fontSize: 22 }} />,
      },
      {
        permission: 'fichatecnica:view',
        title: 'Ficha técnica',
        description: 'Especificações, composição e custos de referência por produto.',
        path: '/ficha-tecnica',
        icon: <ProfileOutlined style={{ fontSize: 22 }} />,
      },
      {
        permission: 'comercial:view',
        title: 'Comercial',
        description: 'Pedidos, faturamento e ciclo comercial com clientes.',
        path: '/comercial',
        icon: <AppstoreOutlined style={{ fontSize: 22 }} />,
      },
    ],
  },
  {
    label: 'Suporte',
    items: [
      {
        title: 'Fale conosco',
        description: 'WhatsApp da equipe técnica — dúvidas, incidentes e acompanhamento.',
        path: '/suporte/fale-conosco',
        icon: <PhoneOutlined style={{ fontSize: 22, color: '#25D366' }} />,
      },
      {
        permission: 'support:view',
        title: 'Área técnica',
        description: 'Integrações e diagnóstico do ambiente (permissão de suporte).',
        path: '/suporte',
        icon: <CloudOutlined style={{ fontSize: 22 }} />,
      },
      {
        permission: 'datasources:view',
        title: 'Fontes de dados',
        description: 'Conexões SGBR/ERP e credenciais de API.',
        path: '/fontes-de-dados',
        icon: <CustomerServiceOutlined style={{ fontSize: 22 }} />,
      },
      {
        permission: 'operations:view',
        title: 'Operação',
        description: 'Status do backend, proxy e cache — uso exclusivo da equipe de suporte.',
        path: '/admin/operacao',
        icon: <CloudServerOutlined style={{ fontSize: 22 }} />,
      },
    ],
  },
]

export function GestaoExecutivaPage() {
  const { session } = useAuth()
  const configured = hasAnySources()

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Visão do gestor"
        subtitle="Ponto de partida do painel: indicadores, operação, financeiro e suporte. O que você vê depende do seu perfil e permissões."
      />

      {!configured && (
        <Alert
          type="warning"
          showIcon
          message="Fonte de dados ainda não configurada"
          description={
            hasPermission(session, 'datasources:view') ? (
              <>
                Cadastre a conexão em <Link to="/fontes-de-dados">Fontes de dados</Link> ou pela{' '}
                <Link to="/suporte">Área técnica</Link>. Sem isso, gráficos e totais podem ficar
                vazios.
              </>
            ) : hasPermission(session, 'support:view') ? (
              <>
                Peça a quem tenha acesso a <strong>Fontes de dados</strong> para cadastrar a conexão,
                ou use a <Link to="/suporte">Área técnica</Link>. Sem isso, gráficos e totais podem
                ficar vazios.
              </>
            ) : (
              <>
                Peça ao administrador para configurar a conexão ou{' '}
                <Link to="/suporte/fale-conosco">fale com o suporte</Link>. Sem isso, gráficos e totais
                podem ficar vazios.
              </>
            )
          }
        />
      )}

      {HUB_SECTIONS.map((section) => {
        const visible = section.items.filter((it) => hubItemVisible(session, it))
        if (!visible.length) return null
        return (
          <div key={section.label}>
            <Typography.Title level={5} style={{ marginBottom: 12 }}>
              {section.label}
            </Typography.Title>
            <Row gutter={[12, 12]}>
              {visible.map((it) => (
                <Col xs={24} sm={12} lg={8} key={it.path + it.title}>
                  <Link to={it.path} className="gestao-hub-card-link">
                    <Card className="app-card gestao-hub-card" hoverable variant="borderless">
                      <Space align="start" size={12}>
                        <span className="gestao-hub-card__icon" aria-hidden>
                          {it.icon}
                        </span>
                        <div>
                          <Typography.Text strong>{it.title}</Typography.Text>
                          <div>
                            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                              {it.description}
                            </Typography.Text>
                          </div>
                        </div>
                      </Space>
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
          </div>
        )
      })}
    </Space>
  )
}
