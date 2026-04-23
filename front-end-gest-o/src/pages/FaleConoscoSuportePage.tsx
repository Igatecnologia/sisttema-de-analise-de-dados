import { Space } from 'antd'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { SupportWhatsAppSection } from '../components/SupportWhatsAppSection'

/** Contato com suporte — disponível a todos os usuários autenticados (sem acesso a fontes/ops). */
export function FaleConoscoSuportePage() {
  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Suporte técnico"
        subtitle="Fale conosco: canal oficial com a equipe de suporte via WhatsApp."
      />
      <SupportWhatsAppSection />
    </Space>
  )
}
