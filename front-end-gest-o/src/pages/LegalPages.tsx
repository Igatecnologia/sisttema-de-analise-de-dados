import { Card, Table, Tag, Typography } from 'antd'
import { PageHeaderCard } from '../components/PageHeaderCard'

const today = new Date().toISOString().slice(0, 10)

export function PrivacyPolicyPage() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard title="Politica de privacidade" subtitle={`Ultima atualizacao: ${today}`} />
      <Card>
        <Typography>
          <Typography.Title level={4}>1. Quais dados coletamos</Typography.Title>
          <Typography.Paragraph>
            Coletamos: nome, email, IP, hash de user-agent, dados de uso (paginas visitadas, tempo de sessao) e dados que voce cadastra ativamente (datasources, configuracoes de empresa). Senhas sao armazenadas apenas como hash argon2id — nunca em texto.
          </Typography.Paragraph>
          <Typography.Title level={4}>2. Bases legais</Typography.Title>
          <Typography.Paragraph>
            Execucao de contrato (LGPD Art. 7 V) para fornecer o servico contratado; legitimo interesse (Art. 7 IX) para deteccao de fraude e seguranca; consentimento (Art. 7 I) para comunicacoes de marketing.
          </Typography.Paragraph>
          <Typography.Title level={4}>3. Compartilhamento (sub-processadores)</Typography.Title>
          <Typography.Paragraph>
            Compartilhamos dados estritamente operacionais com: Stripe (pagamentos, EUA), Cloudflare (CDN/WAF, EUA), Resend (emails, EUA), Groq (Copilot IA, EUA), Render/Vercel (hosting). DPAs assinados.
          </Typography.Paragraph>
          <Typography.Title level={4}>4. Seus direitos (LGPD Art. 18)</Typography.Title>
          <Typography.Paragraph>
            Acesso, correcao, anonimizacao, exclusao e portabilidade — todos disponiveis em /seguranca/lgpd. SLA de resposta: 15 dias uteis.
          </Typography.Paragraph>
          <Typography.Title level={4}>5. Retencao</Typography.Title>
          <Typography.Paragraph>
            Dados ativos: enquanto a conta existir. Apos exclusao: 7 dias soft + 30 dias backup. Dados financeiros: 5 anos por obrigacao legal (Art. 7 §1 LGPD).
          </Typography.Paragraph>
          <Typography.Title level={4}>6. DPO</Typography.Title>
          <Typography.Paragraph>
            <strong>Email:</strong> lgpd@igagestao.com.br
          </Typography.Paragraph>
        </Typography>
      </Card>
    </div>
  )
}

export function TermsOfServicePage() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard title="Termos de uso" subtitle={`Ultima atualizacao: ${today}`} />
      <Card>
        <Typography>
          <Typography.Title level={4}>1. Objeto</Typography.Title>
          <Typography.Paragraph>
            IGA Gestao eh um SaaS de business intelligence industrial. Voce contrata um plano (Free, Pro ou Enterprise) e recebe acesso aos modulos correspondentes.
          </Typography.Paragraph>
          <Typography.Title level={4}>2. SLA</Typography.Title>
          <Typography.Paragraph>
            Pro: 99% uptime mensal. Enterprise: 99.5% + suporte 4h. Free: best-effort. SLA NAO se aplica a indisponibilidade do ERP do cliente.
          </Typography.Paragraph>
          <Typography.Title level={4}>3. Limitacao de responsabilidade</Typography.Title>
          <Typography.Paragraph>
            Nossa responsabilidade total fica limitada ao equivalente a 12 meses de mensalidade do plano contratado. Nao respondemos por: lucros cessantes, perda de dados causada pelo cliente, ou indisponibilidade do ERP de terceiro.
          </Typography.Paragraph>
          <Typography.Title level={4}>4. Encerramento</Typography.Title>
          <Typography.Paragraph>
            Voce pode cancelar a qualquer momento via /billing. Podemos suspender contas que violem estes termos (uso fraudulento, scraping, abuso de API) com aviso de 7 dias.
          </Typography.Paragraph>
          <Typography.Title level={4}>5. Foro</Typography.Title>
          <Typography.Paragraph>
            Foro de Sao Paulo, SP, Brasil.
          </Typography.Paragraph>
        </Typography>
      </Card>
    </div>
  )
}

type SubProcessor = {
  vendor: string
  purpose: string
  dataProcessed: string
  region: string
  dpa: 'signed' | 'pending' | 'na'
}

const SUB_PROCESSORS: SubProcessor[] = [
  {
    vendor: 'Stripe',
    purpose: 'Processamento de pagamentos (checkout, faturas, portal de billing)',
    dataProcessed: 'Nome, email, dados de cartao (tokenizados pela Stripe), historico de assinatura',
    region: 'Estados Unidos / Irlanda (EU)',
    dpa: 'pending',
  },
  {
    vendor: 'Cloudflare',
    purpose: 'CDN, WAF, mitigacao DDoS, DNS',
    dataProcessed: 'IP, headers HTTP, logs de requisicao (24h)',
    region: 'Global (anycast)',
    dpa: 'pending',
  },
  {
    vendor: 'Resend',
    purpose: 'Envio de emails transacionais (verificacao, convite, alertas)',
    dataProcessed: 'Email do destinatario, conteudo da mensagem, status de entrega',
    region: 'Estados Unidos',
    dpa: 'pending',
  },
  {
    vendor: 'Groq',
    purpose: 'Inferencia LLM para o Copilot IA',
    dataProcessed: 'Prompt do usuario (pode conter PII se digitada), resposta do modelo',
    region: 'Estados Unidos',
    dpa: 'pending',
  },
  {
    vendor: 'Render',
    purpose: 'Hospedagem da aplicacao (compute, Postgres gerenciado, Redis)',
    dataProcessed: 'Todos os dados da aplicacao em repouso',
    region: 'Estados Unidos (Oregon)',
    dpa: 'pending',
  },
  {
    vendor: 'Sentry',
    purpose: 'Error tracking e performance monitoring',
    dataProcessed: 'Stack traces, breadcrumbs (com PII redactada via beforeSend)',
    region: 'Estados Unidos / UE',
    dpa: 'pending',
  },
]

export function SubProcessorsPage() {
  const dpaTag = (status: SubProcessor['dpa']) => {
    if (status === 'signed') return <Tag color="green">DPA assinado</Tag>
    if (status === 'pending') return <Tag color="gold">DPA pendente</Tag>
    return <Tag>NAO se aplica</Tag>
  }
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard
        title="Sub-processadores"
        subtitle={`Ultima atualizacao: ${today}`}
      />
      <Card>
        <Typography.Paragraph>
          Esta pagina lista todos os sub-processadores que tratam dados pessoais em nome da
          IGA Gestao, conforme exigido pela LGPD (Art. 39) e GDPR (Art. 28). Notificaremos
          alteracoes nesta lista com 30 dias de antecedencia via email aos administradores
          de cada tenant.
        </Typography.Paragraph>
        <Table<SubProcessor>
          dataSource={SUB_PROCESSORS}
          rowKey="vendor"
          pagination={false}
          columns={[
            { title: 'Provedor', dataIndex: 'vendor', width: 140 },
            { title: 'Finalidade', dataIndex: 'purpose' },
            { title: 'Dados tratados', dataIndex: 'dataProcessed' },
            { title: 'Regiao', dataIndex: 'region', width: 180 },
            {
              title: 'DPA',
              dataIndex: 'dpa',
              width: 140,
              render: (value: SubProcessor['dpa']) => dpaTag(value),
            },
          ]}
        />
        <Typography.Paragraph style={{ marginTop: 16 }}>
          Para questoes sobre sub-processadores ou para solicitar copia de DPAs assinados,
          contate <strong>lgpd@igagestao.com.br</strong>.
        </Typography.Paragraph>
      </Card>
    </div>
  )
}

export function CookiesPolicyPage() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard title="Politica de cookies" subtitle={`Ultima atualizacao: ${today}`} />
      <Card>
        <Typography>
          <Typography.Title level={4}>Cookies essenciais (sempre ativos)</Typography.Title>
          <ul>
            <li><strong>iga_session</strong> (HttpOnly, Secure, SameSite=Strict) — autenticacao. Duracao: 8h. Obrigatorio para login.</li>
            <li><strong>XSRF-TOKEN</strong> — protecao CSRF. Duracao: sessao.</li>
          </ul>
          <Typography.Title level={4}>Cookies opcionais (consentidos)</Typography.Title>
          <ul>
            <li><strong>Analytics</strong> (Google Analytics 4 — opt-in) — metricas anonimas de uso.</li>
            <li><strong>Marketing</strong> (Hotjar — opt-in) — gravacoes de sessao agregadas para UX.</li>
          </ul>
          <Typography.Paragraph>
            Voce pode revogar consentimento a qualquer momento limpando os cookies do navegador ou clicando em &quot;Personalizar cookies&quot; no rodape (em breve).
          </Typography.Paragraph>
        </Typography>
      </Card>
    </div>
  )
}
