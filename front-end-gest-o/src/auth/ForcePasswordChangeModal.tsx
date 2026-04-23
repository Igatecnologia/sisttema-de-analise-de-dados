import { useState } from 'react'
import { Alert, App, Button, Form, Input, Modal, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { http } from '../services/http'
import { useAuth } from './AuthContext'

/**
 * Modal não-dispensável mostrado quando `session.user.mustChangePassword === true`.
 * Bloqueia o app até o usuário definir uma nova senha. Rotas permanecem
 * renderizadas atrás, mas o modal impede interação.
 */
export function ForcePasswordChangeModal() {
  const { session, updateSession, signOut } = useAuth()
  const { notification } = App.useApp()
  const [form] = Form.useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>()
  const [submitting, setSubmitting] = useState(false)

  const open = Boolean(session?.user.mustChangePassword)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (values.newPassword !== values.confirmPassword) {
        form.setFields([{ name: 'confirmPassword', errors: ['As senhas não conferem'] }])
        return
      }
      setSubmitting(true)
      await http.post('/api/v1/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      updateSession((prev) => ({
        ...prev,
        user: { ...prev.user, mustChangePassword: false },
      }))
      notification.success({
        message: 'Senha atualizada',
        description: 'Sua senha foi trocada com sucesso. Você já pode usar o sistema.',
      })
      form.resetFields()
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      notification.error({
        message: 'Não foi possível trocar a senha',
        description: msg ?? (err instanceof Error ? err.message : 'Erro desconhecido'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <span>
          <LockOutlined style={{ marginRight: 8 }} />
          Troca de senha obrigatória
        </span>
      }
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button type="text" danger onClick={() => signOut()} disabled={submitting}>
            Sair
          </Button>
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            Confirmar nova senha
          </Button>
        </div>
      }
    >
      <Alert
        type="warning"
        showIcon
        message="Você precisa definir uma nova senha antes de continuar"
        description="A senha atual foi gerada automaticamente ou resetada por um administrador. Escolha uma senha pessoal e forte."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="currentPassword"
          label="Senha atual"
          rules={[{ required: true, message: 'Informe a senha atual' }]}
        >
          <Input.Password autoFocus autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="Nova senha"
          tooltip="Mínimo 10 caracteres, com letras e números."
          rules={[
            { required: true, message: 'Informe a nova senha' },
            { min: 10, message: 'Mínimo 10 caracteres' },
            {
              pattern: /[A-Za-z]/,
              message: 'Inclua ao menos uma letra',
            },
            {
              pattern: /\d/,
              message: 'Inclua ao menos um número',
            },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Confirmar nova senha"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Confirme a nova senha' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                return Promise.reject(new Error('As senhas não conferem'))
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Dica: use uma combinação de letras, números e símbolos que você lembre com facilidade.
        </Typography.Text>
      </Form>
    </Modal>
  )
}
