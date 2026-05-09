# Security Policy — IGA Gestao

## Reportar vulnerabilidade

Por favor **NAO** abra issue publica para vulnerabilidades de seguranca.

Reporte para: **security@igagestao.com.br**

Inclua:
- Descricao da vulnerabilidade
- Passos para reproduzir
- Impacto potencial (vazamento de dados, RCE, escalation, etc.)
- Versao/branch afetada
- Sua sugestao de mitigacao (opcional)

Compromisso de resposta:
- **24h**: confirmacao de recebimento
- **7 dias**: triagem inicial + classificacao de severidade (SEV-0 a SEV-3)
- **30 dias**: correcao em producao para SEV-0/1, ou plano detalhado

## Versoes suportadas

Apenas `master` (producao atual) recebe patches de seguranca. Beta nao tem SLA de security.

## Disclosure responsavel

Pedimos 90 dias entre o reporte e disclosure publico — para dar tempo de:
1. Reproduzir + classificar
2. Corrigir + testar
3. Deploy em producao
4. Notificar clientes (LGPD Art. 48 quando aplicavel)

Hall of fame: pesquisadores que reportarem com responsabilidade serao
listados em `SECURITY-RESEARCHERS.md` (com permissao).

## Programa de bug bounty

Em planejamento (pos-GA). Inicialmente sem recompensa monetaria — apenas
reconhecimento publico no Hall of Fame.

## Controles ativos

Detalhes em `docs/compliance/DPIA.md`. Resumo:
- Auth: Argon2id + MFA TOTP + HIBP + lockout adaptativo + refresh rotation
- Multi-tenant: RLS Postgres FORCE com 5 cenarios automatizados em CI
- Crypto at-rest: AES-256-GCM (credenciais), JWT HS256 (sessao)
- CI: SAST (Semgrep), SCA (npm audit + Trivy), gitleaks, CodeQL, SBOM CycloneDX
- Headers: HSTS preload, CSP dinamico, COOP, Permissions-Policy
- Audit log: hash chain SHA-256 + REVOKE UPDATE/DELETE no Postgres

## PGP

Chave PGP para reports cifrados: ainda nao publicada. Use email TLS-only.
