import { Router, json } from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logWarn } from '../services/structuredLog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Endpoints publicos de seguranca (RFC 9116 + best practices).
 * Sem auth.
 */
export const securityRouter = Router()

/**
 * SEC-3.3 — CSP violation reporting endpoint.
 * Browsers POSTam relatorios em formato `application/csp-report` ou `application/reports+json`.
 * Rate limit em memoria: max 10 reports/segundo/IP — evita inundacao por extensao maliciosa.
 */
const cspReportCounters = new Map<string, { count: number; windowStart: number }>()
const CSP_REPORT_WINDOW_MS = 1000
const CSP_REPORT_MAX_PER_WINDOW = 10

securityRouter.post(
  '/api/v1/security/csp-report',
  json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '32kb' }),
  (req, res) => {
    const ip = (req.ip ?? req.socket?.remoteAddress ?? 'unknown').toString()
    const now = Date.now()
    const counter = cspReportCounters.get(ip)
    if (!counter || now - counter.windowStart > CSP_REPORT_WINDOW_MS) {
      cspReportCounters.set(ip, { count: 1, windowStart: now })
    } else if (counter.count >= CSP_REPORT_MAX_PER_WINDOW) {
      return res.status(429).end()
    } else {
      counter.count += 1
    }
    /** Body pode ser { 'csp-report': {...} } ou um array (Reporting API). */
    const body = req.body as unknown
    logWarn('csp.violation', { ip, body })
    res.status(204).end()
  },
)

/**
 * GET /security/sbom.json — SBOM publico em formato CycloneDX (SEC-3.2).
 * Permite auditorias de cliente Enterprise verificarem dependencias declaradas.
 *
 * Geracao no build (CI ou local):
 *   npx --yes @cyclonedx/cyclonedx-npm --output-format JSON --output-file dist/sbom.json
 *
 * Override via env SBOM_PATH (caminho absoluto). Sem o arquivo, retorna 404 com
 * instrucoes — nao expoe dados sensiveis.
 */
function resolveSbomPath(): string {
  if (process.env.SBOM_PATH?.trim()) return process.env.SBOM_PATH.trim()
  /** dist/ ao buildar; fallback para raiz do package em dev. */
  const distPath = join(__dirname, '..', 'sbom.json')
  if (existsSync(distPath)) return distPath
  return join(__dirname, '..', '..', 'sbom.json')
}

securityRouter.get('/security/sbom.json', (_req, res) => {
  const sbomPath = resolveSbomPath()
  if (!existsSync(sbomPath)) {
    return res.status(404).json({
      message: 'SBOM nao gerado nesta build',
      hint: 'Gere com: npx --yes @cyclonedx/cyclonedx-npm --output-format JSON --output-file dist/sbom.json',
    })
  }
  try {
    const content = readFileSync(sbomPath, 'utf8')
    res.setHeader('Content-Type', 'application/vnd.cyclonedx+json')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(content)
  } catch (err) {
    logWarn('sbom.read_failed', { error: (err as Error).message })
    res.status(500).json({ message: 'Falha ao ler SBOM' })
  }
})

/** GET /.well-known/security.txt — RFC 9116. */
securityRouter.get('/.well-known/security.txt', (_req, res) => {
  const contact = process.env.SECURITY_CONTACT_EMAIL?.trim() ?? 'security@igagestao.com.br'
  const baseUrl = (process.env.PUBLIC_BASE_URL?.trim() ?? 'https://igagestao.com.br').replace(/\/$/, '')
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  const body = [
    `Contact: mailto:${contact}`,
    `Expires: ${expires}`,
    `Preferred-Languages: pt, en`,
    `Canonical: ${baseUrl}/.well-known/security.txt`,
    `Policy: ${baseUrl}/security/policy`,
    '',
  ].join('\n')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.send(body)
})

/** GET /security/policy — politica de divulgacao responsavel. */
securityRouter.get('/security/policy', (_req, res) => {
  const contact = process.env.SECURITY_CONTACT_EMAIL?.trim() ?? 'security@igagestao.com.br'
  const body = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Politica de Divulgacao Responsavel — IGA Gestao</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; color: #172033; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; margin-top: 32px; }
    code { background: #f5f7fa; padding: 2px 6px; border-radius: 4px; }
    a { color: #1677ff; }
  </style>
</head>
<body>
  <h1>Politica de Divulgacao Responsavel</h1>
  <p>Agradecemos pesquisadores que reportam vulnerabilidades de forma responsavel.</p>
  <h2>Escopo (in scope)</h2>
  <ul>
    <li>app.igagestao.com.br e qualquer <code>{slug}.igagestao.com.br</code></li>
    <li>API REST (<code>/api/v1/*</code>)</li>
    <li>Sub-dominios oficiais listados em status page</li>
  </ul>
  <h2>Fora de escopo</h2>
  <ul>
    <li>Marketing/blog/landing</li>
    <li>Ataques de engenharia social contra funcionarios</li>
    <li>DDoS volumetrico ou flooding</li>
    <li>Vulnerabilidades em dependencias terceiras (reportar diretamente ao mantenedor)</li>
  </ul>
  <h2>Safe harbor</h2>
  <p>Nao processaremos legalmente quem reportar de boa-fe seguindo esta politica. Pedimos:</p>
  <ul>
    <li>Nao acessar dados de outros usuarios alem do minimo necessario para demonstrar a falha</li>
    <li>Nao destruir dados; nao impactar disponibilidade</li>
    <li>Reportar antes de qualquer divulgacao publica (90 dias de embargo padrao)</li>
  </ul>
  <h2>SLA de resposta</h2>
  <ul>
    <li>Triagem inicial: 24h uteis</li>
    <li>Feedback substantivo: 7 dias uteis</li>
    <li>Correcao: depende da severidade (criticos &lt;= 7d; altos &lt;= 30d)</li>
  </ul>
  <h2>Contato</h2>
  <p>Email: <a href="mailto:${contact}">${contact}</a></p>
  <p>Para criptografar, use a chave PGP publicada em <code>/.well-known/pgp-key.txt</code> (em breve).</p>
  <hr>
  <p><a href="/.well-known/security.txt">security.txt</a></p>
</body>
</html>`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(body)
})

/** GET /security — pagina publica com info de seguranca. */
securityRouter.get('/security', (_req, res) => {
  const contact = process.env.SECURITY_CONTACT_EMAIL?.trim() ?? 'security@igagestao.com.br'
  const body = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Seguranca — IGA Gestao</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; color: #172033; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; margin-top: 32px; }
    .feature { background: #f5f7fa; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>Seguranca</h1>
  <p>Esta pagina lista os controles de seguranca implementados na plataforma IGA Gestao.</p>

  <h2>Autenticacao e identidade</h2>
  <div class="feature">Senhas com argon2id (OWASP recommended). MFA/TOTP opcional. HIBP check em senhas novas. Account lockout adaptativo. Refresh token com reuse detection. Login alerts por email.</div>

  <h2>Isolamento multi-tenant</h2>
  <div class="feature">PostgreSQL Row Level Security (RLS) com FORCE em todas as tabelas multi-tenant. Politicas verificadas com testes automatizados (cross-tenant SELECT/UPDATE/DELETE).</div>

  <h2>Integridade do log</h2>
  <div class="feature">Audit log com hash chain SHA-256 (prev_hash + row_hash). UPDATE/DELETE revogados pelo Postgres. Endpoint <code>/audit/verify</code> recalcula a cadeia.</div>

  <h2>SSRF e proxy seguro</h2>
  <div class="feature">Bloqueio de redes privadas (RFC1918, loopback, link-local), metadata cloud, schemes nao-http(s). Validacao em runtime antes de cada fetch externo.</div>

  <h2>Privacidade (LGPD)</h2>
  <div class="feature">Direitos do titular (acesso, portabilidade, anonimizacao, exclusao) implementados em <code>/api/v1/lgpd/*</code>. PII redaction automatica em logs.</div>

  <h2>Reportar uma vulnerabilidade</h2>
  <p>Email: <a href="mailto:${contact}">${contact}</a></p>
  <p>Politica completa: <a href="/security/policy">/security/policy</a></p>
  <p>Arquivo padrao: <a href="/.well-known/security.txt">/.well-known/security.txt</a></p>
</body>
</html>`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(body)
})
