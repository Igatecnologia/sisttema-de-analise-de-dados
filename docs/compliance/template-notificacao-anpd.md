# Template de Notificação ANPD — Incidente de Segurança

> **Base legal**: LGPD Art. 48 — comunicação à ANPD em prazo razoável (precedente: **48 horas**)
> **Quando acionar**: vazamento, acesso indevido, perda de disponibilidade, ou qualquer incidente com PII
> **Responsável por acionar**: DPO (encarregado) com apoio do CTO

---

## 0. Fluxo resumido de resposta a incidente

```
T+0      → Detectado (alerta Sentry / cliente / pesquisa)
T+15min  → Classificar severidade (SEV-0..3) — ver tabela abaixo
T+30min  → Conter (revogar tokens, isolar máquina, bloquear IP)
T+2h     → Investigação inicial: o que vazou, quantos titulares, escopo
T+6h     → Decisão se notifica ANPD + titulares
T+24h    → Comunicação interna (CEO, jurídico, suporte)
T+48h    → **Notificação ANPD enviada** (este template)
T+72h    → Comunicação aos titulares afetados (Art. 48 §1º II)
T+7d     → Post-mortem público + ações corretivas em produção
T+30d    → Relatório de fechamento ANPD
```

---

## 1. Classificação de Severidade

| Sev | Critério | Notifica ANPD? | Notifica titular? |
|---|---|---|---|
| **SEV-0** | Vazamento massivo (>1k titulares) ou PII sensível (CPF, dado financeiro, saúde) | **SIM em 48h** | SIM em 72h |
| **SEV-1** | Vazamento limitado (<1k titulares) sem PII sensível, OU RCE/SSRF confirmado | **SIM em 48h** | SIM se risco real |
| **SEV-2** | Brecha contida (tentativa bloqueada), audit chain quebrada, dados de 1 tenant expostos a outro | Avaliar com jurídico | Caso a caso |
| **SEV-3** | Bug pontual sem vazamento, downtime < 1h, falha sem PII envolvida | NÃO | NÃO |

---

## 2. Modelo de notificação à ANPD

> Enviar via Peticionamento Eletrônico no [gov.br/anpd](https://www.gov.br/anpd/pt-br) com cópia para `lgpd@igagestao.com.br` (DPO interno).
> Anexar: timeline detalhada, lista (anonimizada) de titulares afetados, evidências (logs sanitizados), plano de ação.

```
ASSUNTO: Comunicação de Incidente de Segurança — LGPD Art. 48
         IGA Gestão — [Tipo do incidente] — [Data: YYYY-MM-DD]

À Autoridade Nacional de Proteção de Dados (ANPD),

I. IDENTIFICAÇÃO DO CONTROLADOR

Razão Social:    [PREENCHER — razão social do CNPJ titular]
CNPJ:            [PREENCHER]
Endereço:        [PREENCHER]
Encarregado (DPO): [Nome do DPO]
Email DPO:        lgpd@igagestao.com.br
Telefone:        [PREENCHER]

II. DESCRIÇÃO DO INCIDENTE

Data/hora da detecção:   [YYYY-MM-DD HH:MM TZ]
Data/hora da ocorrência: [YYYY-MM-DD HH:MM TZ] (se diferente)
Severidade interna:      [SEV-0 / SEV-1 / SEV-2]
Natureza do incidente:   [vazamento / acesso indevido / perda / alteração indevida]

Resumo (até 500 palavras):
[Descreva o que aconteceu sem jargão técnico. Foco em FATOS, não suposições.
Ex: "Em [data], identificamos via monitoramento Sentry que um endpoint
público da API expunha indevidamente dados de N titulares de M tenants
durante um intervalo de aproximadamente X minutos. A causa raiz foi
[bug/configuração/etc.] e o vetor foi [como exploraram ou como descobrimos]."]

III. DADOS PESSOAIS ENVOLVIDOS

Categorias de dados afetados:  [ ] Nome  [ ] Email  [ ] CPF  [ ] CNPJ
                               [ ] Telefone  [ ] Endereço  [ ] Senha (hash)
                               [ ] Dados financeiros  [ ] Outros: ___

Dados sensíveis envolvidos (Art. 5 II)?  [ ] Sim  [ ] Não
   Se sim, quais: [origem racial/étnica, religião, opinião política, saúde, etc.]

Número estimado de titulares: [N pessoas]
Número exato de titulares:    [N pessoas] (se já apurado)
Tenants afetados:             [N empresas]

IV. CAUSA RAIZ (root cause)

Vetor técnico:    [ex: misconfigured RLS policy / vulnerabilidade dependência
                  / credencial vazada / falha de validação de input]

Mitigação imediata aplicada em [HH:MM]:
[ex: "Endpoint removido da rota pública. Sessões revogadas. Tokens em
rotação. Patch deployado em produção (commit SHA)."]

V. POTENCIAL DE DANO AOS TITULARES

Risco identificado (Art. 49 §1º LGPD):
[ ] Alto    — dados sensíveis OU possibilidade de fraude financeira
[ ] Médio   — dados de contato OU informações comerciais sigilosas
[ ] Baixo   — apenas metadados públicos ou anonimizados
[ ] Nenhum  — dados não foram efetivamente acessados (incidente contido)

Justificativa:
[Explique por que escolheu essa classificação. Considere se dados estavam
hash/criptografados, se houve download real ou só exposição, se atacante
conhecido tem capacidade técnica de explorar, etc.]

VI. MEDIDAS ADOTADAS E A ADOTAR

A) Medidas técnicas já implementadas (até T+48h):
   - [data] Mitigação X aplicada (commit/ticket)
   - [data] Revogação de tokens/sessões impactadas
   - [data] Patch em produção (commit SHA)
   - [data] Monitoramento adicional ativado (alerta Y)

B) Medidas técnicas planejadas (próximos 30 dias):
   - Auditoria de segurança externa
   - Implementação de [controle X]
   - Treinamento da equipe sobre [tema]

C) Medidas administrativas:
   - Comunicação interna a equipes de desenvolvimento e suporte
   - Revisão de processos de [code review / change management / etc.]
   - Atualização de runbooks de incident response

VII. COMUNICAÇÃO AOS TITULARES (Art. 48 §1º II)

Comunicação realizada/planejada para [YYYY-MM-DD]:
[ ] Email direto a cada titular afetado
[ ] Notificação in-app no próximo login
[ ] Página pública em /security-incidents/<id>
[ ] Comunicado em redes sociais (se SEV-0)

Conteúdo da comunicação:
[Texto plain, objetivo, sem jargão técnico, em PT-BR. Inclui:
 - O que aconteceu
 - Quais seus dados foram afetados
 - O que estamos fazendo
 - O que você pode fazer (trocar senha, ativar MFA, monitorar conta bancária)
 - Como nos contatar (lgpd@igagestao.com.br + telefone)]

VIII. EVIDÊNCIAS ANEXADAS

[ ] Timeline detalhada com timestamps (UTC)
[ ] Logs sanitizados (PII mascarada)
[ ] Screenshots de monitoramento (Sentry, Supabase, Fly)
[ ] Lista de titulares afetados (anonimizada com hash SHA-256 do email)
[ ] Commits/PRs com correções aplicadas
[ ] Post-mortem (se já concluído)

IX. CONTATO PARA ESCLARECIMENTOS

DPO (Encarregado de Dados):
   Nome:     [PREENCHER]
   Email:    lgpd@igagestao.com.br
   Telefone: [PREENCHER]

Disponibilidade para reuniões: dias úteis 09h-18h (horário de Brasília)

---

Atenciosamente,

[Nome DPO]
Encarregado de Dados Pessoais (DPO)
IGA Gestão

Data: [DD/MM/YYYY]
```

---

## 3. Comunicação ao titular (template email)

Enviar em **PT-BR claro**, com até 200 palavras na primeira tela. Sem jargão.

```
Assunto: [Importante] Atualização sobre seus dados na IGA Gestão

Olá [Nome],

Em [data], identificamos um incidente que pode ter afetado alguns dos
seus dados na IGA Gestão. Queremos contar tudo de forma transparente:

**O que aconteceu**
[1-2 frases]. Detectamos em [HH:MM]. Contemos em [HH:MM mesmo dia].

**Quais dados podem ter sido expostos**
- [Lista clara: nome, email, telefone, etc.]
- [O que NÃO foi afetado: senha, dados financeiros, etc.]

**O que já fizemos**
- Corrigimos a falha imediatamente (mesmo dia)
- Revogamos todas as sessões ativas e exigimos novo login
- [Outras ações concretas]

**O que recomendamos pra você**
- Troque sua senha em [link]
- Ative autenticação em 2 fatores em [link]
- Fique atento a emails suspeitos nos próximos dias

**Estamos à disposição**
Email: lgpd@igagestao.com.br
Telefone: [...]

Pedimos desculpas pelo incômodo e agradecemos a confiança.

Equipe IGA Gestão
```

---

## 4. Checklist do DPO durante o incidente

- [ ] Confirmar severidade (SEV-0..3) com CTO em T+15min
- [ ] Acionar canal de incidente (#incident-XXXX no Slack)
- [ ] Designar Incident Commander (responsável único pela resposta)
- [ ] Documentar timeline em tempo real (Notion/Linear)
- [ ] Sanitizar logs antes de compartilhar com terceiros (mascarar PII)
- [ ] Comunicar suporte ao cliente com FAQ pronto
- [ ] Notificar ANPD em ≤ 48h (este template)
- [ ] Notificar titulares em ≤ 72h
- [ ] Solicitar parecer jurídico (especialista em LGPD)
- [ ] Publicar post-mortem público em 7 dias (com transparência sobre causa)
- [ ] Implementar ação corretiva em produção em ≤ 30 dias
- [ ] Enviar relatório de fechamento à ANPD em ≤ 30 dias

---

## 5. Contatos críticos

| Função | Nome | Contato | SLA |
|---|---|---|---|
| DPO (Encarregado) | [PREENCHER] | lgpd@igagestao.com.br | 24/7 em SEV-0/1 |
| CTO | [PREENCHER] | [email] | T+30min em SEV-0 |
| CEO | [PREENCHER] | [email] | T+2h em SEV-0 |
| Jurídico externo (LGPD) | [PREENCHER escritório] | [email] | T+6h |
| Comunicação / PR | [PREENCHER] | [email] | T+12h em SEV-0 |

---

## 6. Referências

- [LGPD — Lei 13.709/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD — Peticionamento Eletrônico](https://www.gov.br/anpd/pt-br/canais_atendimento/atendimento-eletronico)
- [Guia ANPD — Comunicação de Incidente](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-de-comunicacao-de-incidente-de-seguranca-com-dados-pessoais.pdf)
- [DPIA.md](./DPIA.md) — análise de impacto interna
- [RoPA.md](./RoPA.md) — registro de atividades de tratamento
- [Runbook técnico de incident response](../runbooks/incident-response.md) — *a criar*

---

## Versão deste documento

| Versão | Data | Mudanças | Autor |
|---|---|---|---|
| 1.0 | 2026-05-12 | Versão inicial (P0-03 do audit) | Claude (P0-03) |
