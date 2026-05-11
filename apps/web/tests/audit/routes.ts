/**
 * Inventario das rotas a auditar — manter em sync com:
 *   - apps/web/src/routes/AppRouter.tsx       (app principal)
 *   - apps/admin/app/**\/page.tsx              (super admin)
 *   - apps/landing/app/**\/page.tsx            (landing)
 *
 * `auth` indica se a rota requer sessao. Rotas com parametros dinamicos
 * (:token, :id) ou fluxos sensiveis (reset-password com token de email)
 * ficam fora porque exigem dados especificos.
 */

export type App = 'web' | 'admin' | 'landing'

export type AuditRoute = {
  app: App
  path: string
  label: string
  auth: 'none' | 'admin'
  /** Tolera erros conhecidos (ex: pagina com dependencia externa flaky). */
  expectErrors?: boolean
}

const WEB_BASE = 'http://localhost:5173'
const ADMIN_BASE = 'http://localhost:3003'
const LANDING_BASE = 'http://localhost:3002'

export const BASE_URLS: Record<App, string> = {
  web: WEB_BASE,
  admin: ADMIN_BASE,
  landing: LANDING_BASE,
}

export const AUDIT_ROUTES: AuditRoute[] = [
  // ── Landing ──────────────────────────────────────────────────────────────
  { app: 'landing', path: '/', label: 'Landing — Home', auth: 'none' },

  // ── Web (publicas) ───────────────────────────────────────────────────────
  { app: 'web', path: '/login', label: 'Login', auth: 'none' },
  { app: 'web', path: '/register', label: 'Cadastro', auth: 'none' },
  { app: 'web', path: '/forgot-password', label: 'Esqueci a senha', auth: 'none' },
  { app: 'web', path: '/legal/privacidade', label: 'Politica de privacidade', auth: 'none' },
  { app: 'web', path: '/legal/termos', label: 'Termos de uso', auth: 'none' },
  { app: 'web', path: '/legal/cookies', label: 'Politica de cookies', auth: 'none' },
  { app: 'web', path: '/legal/acessibilidade', label: 'Acessibilidade', auth: 'none' },
  { app: 'web', path: '/legal/sub-processors', label: 'Sub-processadores', auth: 'none' },

  // ── Web (autenticadas — admin) ───────────────────────────────────────────
  { app: 'web', path: '/gestao', label: 'Gestao executiva', auth: 'admin' },
  { app: 'web', path: '/dashboard', label: 'Dashboard', auth: 'admin' },
  { app: 'web', path: '/dashboard/analises', label: 'Dashboard — Analises', auth: 'admin' },
  { app: 'web', path: '/dashboard/dados', label: 'Dashboard — Dados', auth: 'admin' },
  { app: 'web', path: '/dashboard/vendas-analitico', label: 'Dashboard — Vendas analitico', auth: 'admin' },
  { app: 'web', path: '/operacional', label: 'Operacional', auth: 'admin' },
  { app: 'web', path: '/financeiro', label: 'Financeiro', auth: 'admin' },
  { app: 'web', path: '/relatorios', label: 'Relatorios', auth: 'admin' },
  { app: 'web', path: '/relatorios/agendados', label: 'Relatorios — Agendados', auth: 'admin' },
  { app: 'web', path: '/relatorios/galeria', label: 'Relatorios — Galeria', auth: 'admin' },
  { app: 'web', path: '/visoes-salvas', label: 'Visoes salvas', auth: 'admin' },
  { app: 'web', path: '/producao', label: 'Producao', auth: 'admin' },
  { app: 'web', path: '/ficha-tecnica', label: 'Ficha tecnica', auth: 'admin' },
  { app: 'web', path: '/clientes', label: 'Clientes', auth: 'admin' },
  { app: 'web', path: '/compras', label: 'Compras', auth: 'admin' },
  { app: 'web', path: '/estoque', label: 'Estoque', auth: 'admin' },
  { app: 'web', path: '/notas-fiscais', label: 'Notas fiscais', auth: 'admin' },
  { app: 'web', path: '/alertas', label: 'Alertas', auth: 'admin' },
  { app: 'web', path: '/notificacoes', label: 'Notificacoes', auth: 'admin' },
  { app: 'web', path: '/integracoes/saude', label: 'Saude das integracoes', auth: 'admin' },
  { app: 'web', path: '/fontes-de-dados', label: 'Fontes de dados', auth: 'admin' },
  { app: 'web', path: '/connectors', label: 'Connectors marketplace', auth: 'admin' },
  { app: 'web', path: '/webhooks', label: 'Webhooks', auth: 'admin' },
  { app: 'web', path: '/api-keys', label: 'API Keys', auth: 'admin' },
  { app: 'web', path: '/usuarios', label: 'Usuarios', auth: 'admin' },
  { app: 'web', path: '/configuracoes', label: 'Configuracoes', auth: 'admin' },
  { app: 'web', path: '/auditoria', label: 'Auditoria', auth: 'admin' },
  { app: 'web', path: '/billing', label: 'Billing', auth: 'admin' },
  { app: 'web', path: '/planos', label: 'Planos', auth: 'admin' },
  { app: 'web', path: '/planos/recomendar', label: 'Planos — Recomendar', auth: 'admin' },
  { app: 'web', path: '/admin/operacao', label: 'Admin — Operacao', auth: 'admin' },
  { app: 'web', path: '/super-admin', label: 'Super admin (atalho)', auth: 'admin' },
  { app: 'web', path: '/seguranca', label: 'Seguranca', auth: 'admin' },
  { app: 'web', path: '/seguranca/lgpd', label: 'Seguranca — LGPD', auth: 'admin' },
  { app: 'web', path: '/perfil', label: 'Perfil', auth: 'admin' },
  { app: 'web', path: '/orgs', label: 'Organizacoes', auth: 'admin' },
  { app: 'web', path: '/tokens', label: 'Design tokens', auth: 'admin' },
  { app: 'web', path: '/suporte', label: 'Suporte', auth: 'admin' },
  { app: 'web', path: '/suporte/fale-conosco', label: 'Suporte — Fale conosco', auth: 'admin' },
  { app: 'web', path: '/ajuda', label: 'Ajuda', auth: 'admin' },
  { app: 'web', path: '/novidades', label: 'Novidades', auth: 'admin' },
  { app: 'web', path: '/boas-vindas', label: 'Boas vindas', auth: 'admin' },
  { app: 'web', path: '/onboarding', label: 'Onboarding', auth: 'admin' },

  // ── Super Admin (porta 3003) ─────────────────────────────────────────────
  { app: 'admin', path: '/', label: 'SuperAdmin — Dashboard', auth: 'admin' },
  { app: 'admin', path: '/beta', label: 'SuperAdmin — Beta Fechada', auth: 'admin' },
  { app: 'admin', path: '/tenants', label: 'SuperAdmin — Tenants', auth: 'admin' },
  { app: 'admin', path: '/users', label: 'SuperAdmin — Usuarios', auth: 'admin' },
  { app: 'admin', path: '/subscriptions', label: 'SuperAdmin — Assinaturas', auth: 'admin' },
  { app: 'admin', path: '/ai-usage', label: 'SuperAdmin — IA Usage', auth: 'admin' },
  { app: 'admin', path: '/audit', label: 'SuperAdmin — Auditoria', auth: 'admin' },
  { app: 'admin', path: '/system', label: 'SuperAdmin — Saude do sistema', auth: 'admin' },
  { app: 'admin', path: '/connectors', label: 'SuperAdmin — Connectors', auth: 'admin' },
]
