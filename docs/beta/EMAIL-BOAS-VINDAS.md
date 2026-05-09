# Email de boas-vindas — após aceite Beta

> Enviado **logo após** o cliente confirmar interesse, **antes** da reunião de onboarding.

**Assunto:** Bem-vindo ao Beta IGA — próximos passos pra [NOME DA EMPRESA]

```
[NOME], que bom que topou.

Você é cliente Beta nº [N] de 5. A partir de agora:

→ HOJE
   1. Anote o link de cadastro: https://app.igagestao.com.br/registrar
      Tenant slug: [empresa-slug]   Senha temporária: [SENHA]
   2. Faça login e confirme seu email
   3. Aceite os Termos do Beta (modal aparece no primeiro login)

→ AMANHÃ — agendei 30 min com você [DIA, HORA]
   - Conectamos no [ERP DELES] juntos
   - Você sai com sistema funcionando
   - Link Meet/Zoom: [LINK]

→ ESTA SEMANA
   - Convide até 9 colegas (Pro Beta limit) em /usuarios
   - Use o sistema normalmente — me avisa qualquer estranheza

→ DAQUI 7 DIAS
   - Te mando 3 perguntas curtas pra coletar feedback
   - Se algo travou, a gente conversa antes

CANAIS DE SUPORTE
   · WhatsApp direto: [SEU NÚMERO] — horário comercial, resposta em até 2h
   · Email não-urgente: suporte@igagestao.com.br
   · Bug crítico: WhatsApp + email "URGENTE" no assunto

LEMBRETES IMPORTANTES
   · É Beta. Pode ter bug. Me conta antes de bater cabeça.
   · Os dados são seus. Você pode exportar tudo a qualquer momento (/lgpd/export).
   · Sem cobrança durante o Beta. Sem cartão pedido.

Bora começar.

[SEU NOME]
WhatsApp: [NÚMERO]
```

---

## Variáveis a substituir antes de enviar

- `[NOME]` — primeiro nome do contato
- `[NOME DA EMPRESA]` — razão social ou marca
- `[N]` — número sequencial Beta (1 a 5)
- `[empresa-slug]` — slug do tenant criado em `/super-admin`
- `[SENHA]` — senha forte ≥ 14 chars; ele troca no primeiro login (já forçado)
- `[ERP DELES]` — SGBR / Bling / Tiny / Omie / Custom
- `[DIA, HORA]` — horário da reunião de onboarding
- `[LINK]` — link Google Meet ou Zoom
- `[SEU NÚMERO]` — seu WhatsApp pessoal/comercial
