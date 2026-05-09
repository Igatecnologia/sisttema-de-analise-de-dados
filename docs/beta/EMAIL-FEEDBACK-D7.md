# Email de feedback — D+7 do Beta

> Enviado **7 dias após o primeiro login** do cliente Beta.

**Assunto:** [NOME], 3 perguntas rápidas sobre o IGA (5 min)

```
Oi [NOME],

Faz uma semana desde que você entrou no Beta. Antes de qualquer outra
coisa: obrigado por topar.

Preciso de 5 minutos do seu tempo pra 3 perguntas. Pode responder neste
email mesmo, ou no WhatsApp. Sua resposta vai mudar diretamente o
roadmap dos próximos 30 dias.

1. O que VOCÊ usou nesta semana?
   (Não me diga "tudo". Quais 1-2 telas você abriu mais de uma vez?)

2. O que SEU TIME usou?
   (Quem mais entrou? Eles abriram o sistema sozinhos ou você teve que
   chamar? O que eles olharam?)

3. Qual decisão você tomou esta semana com base no que viu no IGA?
   (Pode ser pequena: "vi que cliente X caiu, liguei". Se a resposta
   for "nenhuma" — vale ouro também, é o que mais preciso saber.)

BÔNUS — se sobrar 30 segundos:

  · O que ainda NÃO funcionou como você esperava?
  · Que pergunta você fez ao Copilot que ele NÃO conseguiu responder?

Promessa: te respondo em até 24h com o que vamos fazer com cada
feedback. Se algo precisa de ajuste urgente, fix vai pra próxima sexta.

Valeu por estar aqui.

[SEU NOME]
WhatsApp: [NÚMERO]
```

---

## Como interpretar as respostas

| Resposta | O que significa | Ação |
|---|---|---|
| "Usei muito o Dashboard" | Encontrou valor primário | Pergunte: "qual KPI te chamou mais atenção?" |
| "Não usei muito" | Onboarding falhou ou ele sumiu | Liga em 24h, descobre se é bug ou falta de tempo |
| "Time não entrou" | Convite não foi feito ou a curva é alta | Ajude ele a convidar manualmente |
| "Tomei decisão X com base em Y" | **Money quote** — peça permissão pra usar como case |
| "Copilot errou Z" | Bug ou alucinação real | Investigar nos logs Sentry |
| "Faltou módulo X" | Roadmap signal | Anotar; se 3+ pedem, prioriza |

## Métricas a calcular após coletar dos 5

- **Activation rate**: quantos chegaram a ver dashboard com dados reais? (alvo: 5/5)
- **Weekly active**: quantos abriram nos últimos 7 dias? (alvo: ≥3/5)
- **Decision count**: quantos tomaram decisão concreta? (qualidade do produto, alvo ≥2/5)
- **Champion candidates**: quem deu resposta entusiasmada? (potencial case e referral)

## Checklist após o D+7

- [ ] Coletou resposta dos 5
- [ ] Mandou follow-up para os que não responderam (D+9)
- [ ] Compilou top 3 dores recorrentes
- [ ] Compilou top 3 features mais usadas
- [ ] Decidiu o que entra na próxima sprint baseado no feedback
- [ ] Comunicou de volta aos clientes Beta o que mudou ("vocês pediram X, fizemos")
