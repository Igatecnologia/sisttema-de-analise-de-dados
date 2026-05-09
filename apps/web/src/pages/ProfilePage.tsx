import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  App,
} from 'antd'
import { SaveOutlined, UserOutlined } from '@ant-design/icons'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { UserCircle } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

type ProfileForm = {
  name: string
  email: string
  role: string
  locale: string
  density: string
  homePath: string
}

const activeSessions = [
  { id: 'web-current', device: 'Chrome no Windows', location: 'Sessao atual', lastSeen: 'Agora', status: 'Ativa' },
  { id: 'mobile', device: 'Safari iOS', location: 'Sao Paulo, BR', lastSeen: 'Ha 2 horas', status: 'Reconhecida' },
]

export function ProfilePage() {
  const { notification } = App.useApp()
  const { session, updateSession } = useAuth()
  const [form] = Form.useForm<ProfileForm>()
  const user = session?.user

  function handleSave(values: ProfileForm) {
    if (!session) return
    updateSession((prev) => ({
      ...prev,
      user: {
        ...prev.user,
        name: values.name.trim(),
      },
    }))
    notification.success({ message: 'Perfil atualizado' })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Meu perfil"
        subtitle="Dados pessoais, sessões ativas e preferências da experiência."
        icon={<UserCircle size={22} />}
        breadcrumbs={[{ label: 'Início', to: '/gestao' }, { label: 'Conta' }, { label: 'Meu perfil' }]}
        extra={<Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>Salvar</Button>}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="app-card" variant="borderless">
            <Space direction="vertical" size={16} align="center" style={{ width: '100%' }}>
              <Avatar size={96} icon={<UserOutlined />} style={{ background: '#1A7AB5' }}>
                {user?.name?.slice(0, 1).toUpperCase()}
              </Avatar>
              <div style={{ textAlign: 'center' }}>
                <Typography.Title level={4} style={{ marginBottom: 0 }}>{user?.name ?? 'Usuario'}</Typography.Title>
                <Typography.Text type="secondary">{user?.email}</Typography.Text>
              </div>
              <Space wrap>
                <Tag color="blue">{user?.role ?? 'viewer'}</Tag>
                <Tag color="green">Online</Tag>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="app-card" variant="borderless" title="Informacoes pessoais">
            <Form<ProfileForm>
              form={form}
              layout="vertical"
              initialValues={{
                name: user?.name ?? '',
                email: user?.email ?? '',
                role: user?.role ?? 'viewer',
                locale: 'pt-BR',
                density: 'comfortable',
                homePath: '/gestao',
              }}
              onFinish={handleSave}
            >
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="name" label="Nome" rules={[{ required: true, message: 'Informe seu nome.' }]}>
                    <Input maxLength={120} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="email" label="E-mail">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="role" label="Perfil">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="locale" label="Idioma">
                    <Select options={[{ value: 'pt-BR', label: 'Portugues (Brasil)' }]} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="density" label="Densidade">
                    <Select
                      options={[
                        { value: 'comfortable', label: 'Confortavel' },
                        { value: 'compact', label: 'Compacta' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="app-card" variant="borderless" title="Sessoes ativas">
            <Table
              rowKey="id"
              size="middle"
              pagination={false}
              dataSource={activeSessions}
              columns={[
                { title: 'Dispositivo', dataIndex: 'device' },
                { title: 'Local', dataIndex: 'location' },
                { title: 'Ultima atividade', dataIndex: 'lastSeen' },
                { title: 'Status', dataIndex: 'status', render: (value) => <Tag color="green">{value}</Tag> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="app-card" variant="borderless" title="Preferencias">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Typography.Text>Receber alertas por e-mail</Typography.Text>
                <Switch defaultChecked />
              </Space>
              <Divider style={{ margin: 0 }} />
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Typography.Text>Abrir busca com atalho global</Typography.Text>
                <Switch defaultChecked />
              </Space>
              <Divider style={{ margin: 0 }} />
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Typography.Text>Mostrar tour em novidades grandes</Typography.Text>
                <Switch defaultChecked />
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
