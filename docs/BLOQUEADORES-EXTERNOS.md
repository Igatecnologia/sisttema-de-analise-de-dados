# Bloqueadores Externos — IGA Gestao SaaS

> Atualizado: 2026-05-09
> Status do codigo: 18 de 22 blocos do PLANO-SAAS com >=75% done. O que falta NAO e codigo.

Este documento lista o que ainda separa o sistema de **GA publico (Beta -> producao com clientes pagantes)**, e que **nao pode ser resolvido escrevendo codigo**. Sao acoes operacionais, legais, financeiras ou de hiring.

Use isto como checklist de bloqueadores externos quando:
- Definir budget de saida da Beta para GA
- Conversar com investidores/socios sobre o que falta
- Distribuir tarefas entre fundador, advogado, contador, vendedor

---

## 1. Compliance & Legal (SEC-4 — bloqueador GA pago)

| Item | Custo estimado | Prazo | Quem | Saida |
|------|---------------|-------|------|-------|
| **DPIA formal** (Data Protection Impact Assessment) | R$ 3-8k | 1-2 sem | Advogado especialista LGPD | Documento `docs/legal/DPIA.pdf` |
| **DPA template** (Data Processing Agreement) com clientes B2B | R$ 2-5k | 1 sem | Advogado | Template assinavel pelo cliente |
| **Termos de Uso + Politica de Privacidade revisados** | R$ 2-5k | 1 sem | Advogado | Versao 2.0 publicada com aceite versionado (ja temos infra) |
| **DPO designado** (Encarregado de Dados) | 0 ou retainer R$ 1-3k/mes | 1 sem | Advogado/funcionario interno | Nome + email publicado em /privacy |
| **Pentest externo** (OWASP Top 10 + multi-tenant isolation) | R$ 10-30k | 2-4 sem | Empresa especializada (Tempest, Hackmetrix, etc.) | Relatorio + plano de correcao |
| **CNPJ + contrato social** | R$ 0-2k | 1-2 sem | Contador | Documentos em ordem para Stripe live + emissao NFS-e |

**Total**: R$ 17-50k + 4-6 semanas. **Sem isso nao ha cliente pagante seguro.**

---

## 2. Infraestrutura paga (SEC-3 e OPS-2)

| Item | Custo mensal | Como ativar |
|------|-------------|-------------|
| **Cloudflare WAF Pro** | R$ 100-300/mes | Plano Pro/Business + criar rules |
| **DAST managed** (OWASP ZAP cloud, Detectify, etc.) | R$ 200-1500/mes | Contratar SaaS + apontar para staging |
| **Sentry produção** (alem do free tier 5k events/mes) | R$ 130-650/mes (Team/Business) | Upgrade plano + ajustar tracesSampleRate |
| **PostHog producao** (alem do free 1M events/mes) | R$ 0-450/mes | Upgrade quando ultrapassar |
| **Resend transactional email Pro** | R$ 100/mes | Contratar plano Pro (50k emails/mes) |
| **Render starter -> standard** (backend + DB) | R$ 100-500/mes | Upgrade quando hits free tier |
| **Vercel Pro** (alem do hobby) | R$ 100/mes (USD 20) | Upgrade quando ultrapassar |
| **Domain + SSL + DNS** | R$ 50-100/ano | Registro.br ou Cloudflare |

**Total**: R$ 800-3k/mes em infra ativa.

---

## 3. SSO Enterprise (SEC-2.7 — pos-PMF)

- **WorkOS** (recomendacao do plano): USD 50/conexao + setup ~ 2-3 dias de codigo
- **Auth0 Enterprise**: USD 130/mes minimo
- **Status**: NAO bloqueia Beta nem 1os pagantes. Bloqueia conta enterprise (>200 usuarios).

---

## 4. OPS-1 Time + Budget (operacional)

Itens que dependem de fundador, contador, RH, advogado:

- **Hiring**: contratar 1-2 devs full-time (CLT/PJ) ou freelancers reais
- **Runway**: 12-18 meses cobertos antes de buscar Series A (ou bootstrap)
- **ESOP**: programa de stock options para retencao
- **Estrutura juridica**: Holding + LTDA + acordo de socios (caso multi-fundadores)
- **Contabilidade**: contador para emissao de NFSe + folha de pagamento
- **Vendedor SDR/AE**: a partir do 5o pagante, ter alguem que prospecta

**Custo mensal**: R$ 30-80k/mes (depende de tamanho do time)

---

## 5. Itens de Marketing / Aquisicao (S9 e adjacentes)

NAO sao bloqueadores tecnicos, mas aceleram aquisicao:

- **Dominio proprio + SEO** (igagestao.com.br, etc.) — R$ 50-100/ano + 3-6 meses para indexar
- **Video demo profissional** (3-5 min) — R$ 2-10k via produtora
- **Conteudo de blog** (10-20 artigos seed) — R$ 2-8k via redator
- **Anuncios pagos** (Google Ads + LinkedIn) — R$ 5-30k/mes
- **Eventos do setor** (FIESP, Industria 4.0, etc.) — R$ 5-20k por evento

---

## 6. Resumo: Caminho para receita

### Caminho minimo para Beta Fechada FREE (~2h, R$ 0)
- Setar env vars no Render dashboard
- Criar webhook Stripe (test mode)
- Smoke test de 3 fluxos (cadastro, conector, dashboard)
- **Status**: pronto. Ver `DEPLOY-TODAY.md`

### Caminho para 1o pagante (~4 sem + R$ 17-50k)
1. Beta com 5-10 usuarios reais validando flows
2. Advogado: DPIA + DPA + Termos + DPO
3. Pentest externo
4. CNPJ + Stripe live KYC
5. Vender para 1 cliente em rede (Tiete Espumas, etc.)

### Caminho para GA publico (+~4 sem alem do minimo)
- CSP nonce dinamico (codigo, ~3 dias)
- OPS-3 a11y completo (codigo, ~1-2 sem)
- Cloudflare WAF Pro (config + R$ 100-300/mes)
- WCAG audit externo (R$ 5-15k)
- 30+ eventos PostHog + funnels (codigo, ja em ~26)
- Marketing: dominio + landing publica + 5-10 artigos SEO

---

## Observacoes

1. **Codigo nao bloqueia nada criticamente**. O sistema esta tecnicamente pronto para Beta fechada, com algumas melhorias incrementais possiveis (CSP nonce, k6, audit externo).
2. **Bloqueadores reais**: legal (DPIA/DPA/Termos), pentest, CNPJ e infra paga.
3. **Budget minimo viavel para entrar em GA com seguranca**: R$ 25-60k upfront + R$ 1-3k/mes de infra.
4. **Risco se ignorar bloqueadores legais**: multa LGPD ate 2% do faturamento (max R$ 50M por infraçao).
