# Onboarding cliente Beta — script da reunião de 30 min

> Para fazer com cada cliente Beta, **um por um**, na primeira reunião após o aceite.
> Tempo total: 30 minutos. Não estoure 45.

---

## Antes da reunião (você prepara — 10 min)

### No `/super-admin`

- [ ] Crie o tenant com `slug` curto e fácil (ex: `acmetextil`)
- [ ] Crie o usuário admin do cliente com `email` profissional dele
- [ ] Senha temporária forte (≥14 chars), envie por canal seguro (WhatsApp, **não** email)
- [ ] `mustChangePassword = true` para forçar troca no primeiro login
- [ ] Setar `trial_ends_at = '2099-12-31'` ou manter `BILLING_GATE_DISABLED=1`
- [ ] Verificar que `enabled_modules` tem o que ele vai usar

### Documentação que você precisa do cliente

- [ ] URL do ERP dele (ex: `https://api.bling.com.br`)
- [ ] Credenciais — usuário/senha ou token Bearer
- [ ] Qual área é prioritária: vendas, produção, financeiro ou estoque?

### No seu lado

- [ ] Link do Meet/Zoom criado
- [ ] Tela do `/super-admin` aberta (para impersonar se travar)
- [ ] Logs Sentry aberto em outra aba
- [ ] CONTINUE.md aberto pra consultar comandos rápidos

---

## Pauta da reunião (30 min)

### 0–3 min: Quebra-gelo + objetivo claro
> "Hoje a gente conecta no [ERP] e você sai com sistema funcionando.
> Se algo travar, eu impersono e arrumo na hora. Não é Beta da gente
> depender de TI cliente — Beta é a gente fazer pra você."

### 3–8 min: Cliente loga e troca senha
- [ ] Cliente abre `app.igagestao.com.br/registrar` (ou `/login` se já criou no super-admin)
- [ ] Cliente cola email + senha temporária
- [ ] Modal de troca de senha aparece — cliente define nova senha forte
- [ ] Modal de Termos do Beta aparece — cliente lê e aceita
- [ ] Cliente vê tela `/gestao` (placeholder até configurar datasource)

### 8–18 min: Conectar ERP — o momento crítico
- [ ] Vá em **Fontes de Dados** → **Adicionar fonte**
- [ ] Selecione connector correto (SGBR / Custom REST / etc)
- [ ] Cole URL e credenciais
- [ ] Click "Testar conexão" — esperar 200 OK na tela
- [ ] Se falhar:
  - Pergunte qual erro aparece (status code + mensagem)
  - Se for 401: credenciais erradas — confira com cliente
  - Se for timeout: ERP cliente está lento ou off
  - Se for 500: capture log no Sentry, fala que vai investigar e parte pra próximo passo
- [ ] Se ok: cliente vê primeira tela com dados reais. **Esse é o momento que vende o produto. Pause e celebre.**

### 18–24 min: Tour rápido das funcionalidades
- [ ] Mostrar dashboard com KPIs reais (faturamento, margem)
- [ ] Mostrar 1 outro módulo conforme prioridade dele (financeiro, produção, estoque)
- [ ] Abrir Copilot — fazer 1 pergunta real ("qual o cliente que mais cresceu?")
- [ ] Mostrar configurações do tenant (perfil, branding, equipe)

### 24–28 min: Convite de equipe
- [ ] Em `/usuarios`, clica "Novo usuário"
- [ ] Cliente coloca email do colega + role (manager ou viewer)
- [ ] Sistema envia email de convite automático
- [ ] Cliente confirma que recebeu (mostre Resend logs se ele duvidar)

### 28–30 min: Fechamento
- [ ] Pergunta crítica: **"Qual seria o próximo passo natural pra você usar isso amanhã de manhã?"**
- [ ] Anota a resposta. Se for algo que ainda não funciona, marca como prioridade.
- [ ] Confirma WhatsApp de suporte
- [ ] Combina próxima conversa (D+7)

---

## Comandos rápidos durante a reunião

### Impersonar cliente (se ele travar)
```
1. /super-admin → /tenants → encontra o tenant
2. Click "Impersonar"
3. Banner vermelho aparece — você está logado como ele
4. Faz a ação que ele não conseguiu
5. Click "Sair da impersonação" no banner
```

### Ver erro do cliente em tempo real
```
sentry.io → projeto iga-backend → filter por tenant_id ou user_id
```

### Reset de senha (se ele esquecer)
```
1. /super-admin → /tenants/[slug]/users
2. Click no user → Reset password
3. Sistema envia email automático com link
```

### Reativar conta suspensa (caso contrário aconteça por engano)
```
node -e "const Database=require('better-sqlite3'); const db=new Database('./data/iga.db'); \
  db.prepare(\"UPDATE tenants SET status='active' WHERE slug='ACMETEXTIL'\").run();"
```

---

## Sinais de alerta durante a reunião

| Sinal | Diagnóstico | Ação |
|---|---|---|
| Cliente fica calado durante onboarding | Está perdido ou desconfortável | Pergunte: "Tá fazendo sentido até aqui?" |
| Cliente faz 5+ perguntas técnicas | TI dele vai ser bloqueio | Convida o TI dele pra próxima reunião |
| ERP travou ao testar conexão | Problema no lado dele ou bug nosso | Não force — agenda continuação amanhã |
| Cliente reclama da UI | Pode ser bug ou só estilo | Anota; se 2+ reclamarem, é bug real |
| Cliente quer mudar senha do ERP "por segurança" | Boa prática! | Encoraja, espera, retesta |

---

## Após a reunião (você anota — 5 min)

- [ ] Tenant ativo? `/super-admin` confirma `status: active` + `connector_id` correto
- [ ] Cliente conseguiu ver dashboard com dados reais? Sim/Não
- [ ] Convidou pelo menos 1 colega? Sim/Não
- [ ] Próximo passo combinado? Anotar
- [ ] Algum bug detectado? Issue criada
- [ ] Sentir do cliente: animado / neutro / preocupado? Anotar

Esses dados viram a régua do seu Beta.
