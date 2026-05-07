# IGA Gestao — Plano da Landing Page

## Objetivo

Criar uma landing page de alta conversao que:
1. Explica o produto em 10 segundos
2. Gera leads qualificados (formulario de interesse)
3. Converte visitantes em trials de 14 dias
4. Posiciona o IGA como alternativa moderna a planilhas e ERPs pesados

---

## Publico-Alvo

| Persona | Cargo | Dor | O que busca |
|---|---|---|---|
| **Gestor Industrial** | Diretor / Gerente de Producao | Nao tem visao em tempo real da producao | Dashboard simples que mostre tudo |
| **Dono de Fabrica** | CEO / Socio | Paga ERP caro e usa 10% das funcoes | Solucao acessivel que conecte ao ERP atual |
| **Controller Financeiro** | CFO / Financeiro | Concilia dados em planilhas manualmente | Financeiro automatizado com dados do ERP |
| **TI da Industria** | Analista / Coordenador TI | Integracao entre sistemas e dificil | API generica que conecte qualquer ERP |

---

## Estrutura da Pagina

### Secao 1 — Hero (acima da dobra)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Titulo:                                            │
│  "Sua industria. Seus dados.                        │
│   Uma visao completa."                              │
│                                                     │
│  Subtitulo:                                         │
│  Conecte seu ERP e tenha dashboard de gestao,       │
│  producao, estoque, financeiro e IA — em minutos.   │
│                                                     │
│  [Testar gratis 14 dias]  [Ver demo]                │
│                                                     │
│  Screenshot do dashboard (dark mode, premium)       │
│  com dados reais (mockados para o print)            │
│                                                     │
│  "Sem cartao de credito. Cancele quando quiser."    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Decisoes de design**:
- Fundo escuro (dark mode) — transmite modernidade e seriedade
- Screenshot real do sistema (nao mockup generico)
- CTA primario verde (contraste com fundo escuro)
- CTA secundario ghost button (ver demo = video)

---

### Secao 2 — Problema / Solucao (logo abaixo da dobra)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  "Voce ja tem um ERP. O problema e usar os dados."  │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ ❌ Planilhas  │  │ ❌ ERP pesado│  │ ✅ IGA       │ │
│  │ Dados manuais│  │ Caro e lento│  │ Conecta ao  │ │
│  │ Desatualizado│  │ Usa 10%     │  │ ERP que voce│ │
│  │ Sem dashboard│  │ Sem BI real │  │ ja tem      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Secao 3 — Funcionalidades (cards com icone + print)

```
6 cards em grid 3x2:

1. Dashboard Executivo
   "Faturamento, margem, clientes — tudo em uma tela."
   [Print do DashboardPage]

2. Producao em Tempo Real
   "O que foi produzido, consumo de blocos, por periodo."
   [Print do ProducaoPage]

3. Estoque Inteligente
   "Materia-prima, produto final — status critico em destaque."
   [Print do EstoquePage]

4. Financeiro Completo
   "Contas a pagar, superavit/deficit, notas fiscais."
   [Print do FinancePage]

5. Compras e Fornecedores
   "Historico de compras, ticket medio, top fornecedores."
   [Print do ComprasPage]

6. IA Copilot
   "Pergunte qualquer coisa. O copiloto busca os dados pra voce."
   [Print do CopilotDrawer]
```

**Cada card**: icone + titulo + 1 frase + print da tela real + link "Saiba mais"

---

### Secao 4 — Como Funciona (3 passos)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1. Conecte         2. Configure        3. Use      │
│  ┌──────────┐      ┌──────────┐       ┌──────────┐ │
│  │  🔌 API   │      │  ⚙️ Setup │       │  📊 BI    │ │
│  │ Informe a │      │ Escolha  │       │ Dashboards│ │
│  │ URL e as  │      │ quais    │       │ prontos   │ │
│  │ credenciais│     │ modulos  │       │ em tempo  │ │
│  │ do seu ERP│      │ usar     │       │ real      │ │
│  └──────────┘      └──────────┘       └──────────┘ │
│                                                     │
│  "Tempo medio de setup: 10 minutos."                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Secao 5 — Integracoes Suportadas

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  "Conecte ao ERP que voce ja usa"                   │
│                                                     │
│  [Logo SGBR BI]  [Logo Bling]  [Logo Tiny]          │
│  [Logo Omie]     [Logo Sankhya] [+ Qualquer API]    │
│                                                     │
│  "Nao encontrou o seu? Fale conosco — integramos    │
│   qualquer API REST em ate 48h."                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Secao 6 — Segmentos Atendidos

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  "Qualquer industria. Qualquer tamanho."            │
│                                                     │
│  🏭 Espumas e       🧴 Produtos de    🔩 Metalurgia │
│     Colchoes           Limpeza                      │
│                                                     │
│  🍞 Alimentos       👕 Textil         📦 Logistica  │
│                                                     │
│  "O IGA se adapta ao seu segmento com              │
│   conectores especificos."                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Secao 7 — Pricing (alinhado com PLANO-SAAS.md v3)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  "Planos que cabem na sua operacao"                             │
│                                                                 │
│        ┌─────────────────────┐                                  │
│        │ Mensal  [●] Anual   │  ← Toggle pill animado           │
│        │         20% OFF     │     badge de desconto             │
│        └─────────────────────┘                                  │
│                                                                 │
│  ┌────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Free   │  │ Starter  │  │  ★ POPULAR   │  │  Enterprise  │  │
│  │        │  │          │  │    Pro       │  │              │  │
│  │ R$ 0   │  │ R$ 197   │  │  R$ 497      │  │  R$ 997      │  │
│  │        │  │ /mes     │  │  /mes        │  │  /mes        │  │
│  │        │  │ R$ 157   │  │  R$ 397      │  │  R$ 797      │  │
│  │        │  │ /mes anu.│  │  /mes anual  │  │  /mes anual  │  │
│  │        │  │          │  │              │  │              │  │
│  │ 1 user │  │ 3 users  │  │ 10 users     │  │ Ilimitado    │  │
│  │ 1 fonte│  │ 2 fontes │  │ 5 fontes     │  │ Ilimitado    │  │
│  │ Dashb. │  │ + Estoque│  │ Todos modulos│  │ Todos + API  │  │
│  │ Vendas │  │ + Compras│  │ Copilot (20) │  │ Copilot Prem.│  │
│  │        │  │ Email    │  │ Email + Chat │  │ Dedicado+SLA │  │
│  │ Docs   │  │          │  │              │  │ 99.5% SLA    │  │
│  │        │  │          │  │              │  │              │  │
│  │[Gratis]│  │ [Testar] │  │ [Testar]     │  │ [Falar]      │  │
│  └────────┘  └──────────┘  └──────────────┘  └──────────────┘  │
│                                                                 │
│  "Trial de 14 dias do plano Pro. Sem cartao.                    │
│   Ao expirar, vira Free."                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design do toggle**:
- Pill com slide animation (spring, 200ms)
- Badge "20% OFF" com pulse animation 1x ao aparecer
- Precos animam ao trocar (countUp, 400ms, easeOut)
- Cards hover: translateY(-4px) + shadow expand

---

### Secao 8 — Depoimentos / Social Proof

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  "O que nossos clientes dizem"                      │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ "Antes eu gastava 2h por dia compilando      │   │
│  │  planilhas. Agora abro o IGA e esta tudo la."│   │
│  │  — Joao, Gerente Industrial                  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ "A IA do copiloto me surpreendeu. Perguntei  │   │
│  │  o faturamento de marco e ele respondeu na   │   │
│  │  hora com os dados reais."                   │   │
│  │  — Maria, Diretora Financeira                │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  Logos de empresas clientes (quando tiver)           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Nota**: Ate ter depoimentos reais (meta: coletar na Beta Fechada, semanas 8-12), usar **metricas de produto** em vez de metricas de um unico cliente:
- "Setup em 10 minutos" — tempo medio de onboarding
- "9 modulos integrados" — dashboard, producao, estoque, financeiro, vendas, compras, NFs, relatorios, copilot
- "Conecta a qualquer API REST" — generico, nao depende de volume
- "Criptografia nivel bancario (AES-256)" — inspira confianca
- "100% na nuvem, sem instalacao" — diferenciador vs desktop

**Evitar**: metricas de volume de um unico cliente (515 fichas, 707 itens) — nao impressionam para SaaS

---

### Secao 9 — FAQ

```
Perguntas frequentes (accordion):

Q: Preciso trocar meu ERP?
A: Nao. O IGA conecta ao ERP que voce ja usa via API.
   Voce nao precisa mudar nada no seu sistema atual.

Q: Meus dados ficam seguros?
A: Sim. Usamos criptografia AES-256, HTTPS obrigatorio,
   backups diarios e conformidade LGPD.

Q: Quanto tempo leva para configurar?
A: Em media 10 minutos. Voce so precisa da URL e
   credenciais do seu ERP.

Q: Posso cancelar a qualquer momento?
A: Sim. Sem multa, sem fidelidade. Seus dados sao
   exportados antes do cancelamento.

Q: Funciona no celular?
A: O sistema e responsivo e funciona no navegador
   do celular. App nativo em breve.

Q: E se meu ERP nao estiver na lista?
A: Integramos qualquer API REST. Fale conosco e
   configuramos em ate 48h.
```

---

### Secao 10 — CTA Final

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  "Pronto para ter visao completa da sua industria?" │
│                                                     │
│  [Comecar trial gratis]                             │
│                                                     │
│  ou                                                 │
│                                                     │
│  [Agendar demonstracao]  [Falar no WhatsApp]        │
│                                                     │
│  suporte@igagestao.com.br                           │
│  (11) 99999-9999                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Footer

```
Logo IGA | Termos de Uso | Privacidade | Status | Blog

Redes sociais: LinkedIn | Instagram

"IGA Automacao & Tecnologia — CNPJ XX.XXX.XXX/0001-XX"
"Sao Paulo, SP — Brasil"
```

---

## Stack Tecnica da Landing Page

| Item | Tecnologia | Motivo |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR para SEO, fast loading |
| Hosting | Vercel | Deploy automatico, CDN global, gratis para inicio |
| Estilo | Tailwind CSS | Rapido de implementar, responsivo |
| Animacoes | Framer Motion | Scroll reveal, parallax sutil |
| Analytics | Google Analytics 4 + Hotjar | Trafego + mapas de calor |
| Formulario | React Hook Form + Resend | Lead capture + email transacional |
| CMS (blog) | MDX ou Notion API | Artigos SEO sem backend |
| Imagens | Next/Image + WebP | Otimizadas automaticamente |
| Fontes | Sora + Inter | Mesmas do produto (consistencia de marca) |

---

## SEO — Palavras-Chave Alvo

### Primarias (volume alto, concorrencia media)
- "sistema de gestao industrial"
- "dashboard de producao"
- "ERP para industria"
- "BI industrial"
- "controle de producao online"

### Secundarias (long tail, baixa concorrencia)
- "conectar ERP a dashboard"
- "sistema de gestao para fabrica de espuma"
- "alternativa a planilha de producao"
- "dashboard de estoque industrial"
- "copiloto IA para gestao"
- "integrar SGBR BI"

### Paginas de SEO (blog/artigos)
1. "Como ter visao em tempo real da sua producao industrial"
2. "5 sinais de que sua fabrica precisa de um BI"
3. "ERP vs BI: qual a diferenca e por que voce precisa dos dois"
4. "Como reduzir desperdicio com dashboard de consumo de materia-prima"
5. "O que e um copiloto IA e como ele ajuda gestores industriais"

---

## Metricas da Landing Page

| Metrica | Meta Mes 1 | Meta Mes 3 | Meta Mes 6 |
|---|---|---|---|
| Visitantes unicos | 500 | 2.000 | 5.000 |
| Taxa de conversao (lead) | 3% | 5% | 7% |
| Leads capturados | 15 | 100 | 350 |
| Trials iniciados | 5 | 30 | 100 |
| Conversao trial->pago | 20% | 25% | 30% |
| CAC (custo por aquisicao) | — | R$ 200 | R$ 150 |

---

## Cronograma de Implementacao

> **Alinhamento com PLANO-SAAS.md v3**: A landing page e a Sprint 9, que roda em **paralelo** com qualquer sprint. Deve estar online ate a **Beta Fechada (semana 8-12)** para captar leads. O CTA "Testar gratis" so funciona apos Sprint 4 (auth + registro) estar pronta.

| Etapa | Duracao | Entrega |
|---|---|---|
| Design (wireframe + visual) | 3 dias | Figma ou direto no codigo |
| Desenvolvimento | 5 dias | Next.js + Tailwind + Framer Motion |
| Conteudo (textos + prints) | 2 dias | Copy final + screenshots do sistema |
| Video demo | 2 dias | Roteiro + gravacao + edicao (ver secao Video Demo) |
| SEO + Analytics | 1 dia | GA4 + meta tags + sitemap |
| Dominio + Deploy | 1 dia | igagestao.com.br no Vercel |
| **Total** | **~2 semanas** | Landing page online |

### Fases da landing alinhadas ao SaaS

| Fase SaaS | Estado da landing | CTA principal |
|---|---|---|
| Alpha (sem. 1-8) | Em desenvolvimento | — |
| Beta Fechada (sem. 8-12) | **Online** com formulario de interesse | "Solicitar acesso" (waitlist) |
| Beta Aberta (sem. 12-15) | Atualizada com link de registro | "Testar gratis 14 dias" (registro direto) |
| GA (sem. 15+) | Completa com depoimentos reais + video | "Comecar agora" |

---

## Wireframe Visual (Mobile First)

### Mobile (375px)
```
[Logo IGA]
[Hamburger menu]

Sua industria.
Seus dados.
Uma visao completa.

[Testar gratis 14 dias]

[Screenshot do app]

---

O problema
[3 cards empilhados]

---

Funcionalidades
[6 cards empilhados, 1 por vez]

---

Como funciona
1 → 2 → 3
[Vertical]

---

Planos
[Cards empilhados com swipe]

---

FAQ
[Accordion]

---

[CTA grande]
[WhatsApp flutuante]
```

### Desktop (1440px)
```
[Navbar fixa: Logo | Features | Pricing | FAQ | [Testar gratis]]

[Hero full-width com screenshot flutuante]

[3 colunas: Problema vs Solucao]

[Grid 3x2: Features com prints]

[3 passos horizontais]

[3 colunas: Pricing]

[Carousel: Depoimentos]

[Accordion: FAQ]

[CTA full-width]

[Footer 4 colunas]
```

---

## Paleta de Cores da Landing Page

| Uso | Cor | Hex |
|---|---|---|
| Background principal | Dark navy | #080d12 |
| Surface/cards | Dark blue-grey | #111920 |
| Texto principal | Light grey | #e8eef4 |
| Texto secundario | Muted blue | #8a9bb0 |
| CTA primario | Emerald green | #10B981 |
| CTA hover | Lighter green | #34D399 |
| Accent/destaque | Brand blue | #1a7ab5 |
| Accent secundario | Orange | #e8930c |
| Pricing popular badge | Gold | #F59E0B |

**Motivo**: mesma paleta do sistema (dark mode) para consistencia de marca.
Visitante ve a landing page → ve o sistema → mesma identidade visual.

---

## Secao adicional — Seguranca e Confianca

> Inserir entre Secao 6 (Segmentos) e Secao 7 (Pricing)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  "Seus dados protegidos. Sempre."                   │
│                                                     │
│  🔒 Criptografia      📋 LGPD         ☁️ Backup     │
│     AES-256-GCM          Compliance      Diario     │
│                                                     │
│  🛡️ HTTPS             👥 RBAC          📊 Audit     │
│     Obrigatorio          Permissoes      Trail      │
│                                                     │
│  "Dados hospedados no Brasil.                       │
│   Conformidade total com a LGPD."                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

---

## Open Graph / Social Preview

Quando alguem compartilhar no LinkedIn, WhatsApp ou Twitter:

```html
<meta property="og:title" content="IGA Gestao — Dashboard industrial com IA" />
<meta property="og:description" content="Conecte seu ERP e tenha visao completa da producao, estoque, financeiro e vendas. Trial gratis de 14 dias." />
<meta property="og:image" content="https://igagestao.com.br/og-image.png" />
<meta property="og:url" content="https://igagestao.com.br" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```

**og-image.png**: screenshot do dashboard dark mode com dados, 1200x630px.

---

## Performance Budget

| Metrica | Alvo | Ferramenta |
|---|---|---|
| Lighthouse Performance | 95+ | Chrome DevTools |
| Lighthouse Accessibility | 100 | Chrome DevTools |
| Lighthouse SEO | 100 | Chrome DevTools |
| LCP (Largest Contentful Paint) | < 2.0s | Web Vitals |
| INP (Interaction to Next Paint) | < 200ms | Web Vitals |
| CLS (Cumulative Layout Shift) | < 0.1 | Web Vitals |
| Total page weight | < 500KB (sem imagens) | Bundlephobia |
| Time to Interactive | < 3s | Lighthouse |

---

## Estrategia de Conversao

### Elementos de conversao
- [ ] **Exit intent popup** — "Antes de sair: veja o sistema funcionando em 2 minutos" [Video] — **CUIDADO**: pode ser percebido como agressivo para produto premium. Implementar como A/B test antes de manter permanente. Desabilitar em mobile (nao funciona bem).
- [ ] **Scroll CTA flutuante** — botao "Testar gratis" fixo no mobile apos scroll da hero
- [ ] **WhatsApp flutuante** — botao verde no canto inferior direito (sempre visivel)
- [ ] **Retargeting pixel** — Meta Pixel + Google Ads tag para remarketing
- [ ] **UTM tracking** — todos os links com utm_source, utm_medium, utm_campaign
- [ ] **Lead scoring** — segmento + tamanho empresa + cargo = prioridade de contato
- [ ] **Formulario progressivo** — primeiro pede so email, depois nome/empresa no onboarding

### A/B Tests planejados
- Titulo hero: "Sua industria. Seus dados." vs "Pare de usar planilhas."
- CTA: "Testar gratis 14 dias" vs "Comecar agora" vs "Ver como funciona"
- Pricing: mostrar Free tier vs esconder Free tier
- Social proof: depoimentos vs metricas numéricas

---

## Acessibilidade (WCAG 2.1 AA)

- [ ] Contraste minimo 4.5:1 em todo texto (validar com WebAIM)
- [ ] Alt text em todas as imagens e screenshots
- [ ] Navegacao completa por teclado (Tab + Enter)
- [ ] Skip to content link
- [ ] Aria labels em botoes de icone
- [ ] Focus visible em todos os elementos interativos
- [ ] Teste com screen reader (NVDA ou VoiceOver)
- [ ] prefers-reduced-motion respeitado em animacoes

---

## Landing Pages por Segmento (pos-lancamento)

**IMPORTANTE**: So criar landing por segmento quando existir **connector funcionando + dados demo** para aquele segmento. Caso contrario, a pagina promete algo que nao entrega.

| URL | Segmento | Copy especifica | Pre-requisito |
|---|---|---|---|
| `/espumas` | Espumas e Colchoes | "Controle blocos, densidade, consumo M3" | Connector SGBR (ja pronto) |
| `/limpeza` | Produtos de Limpeza | "Estoque de insumos, lotes, validade" | Connector generico + dados demo |
| `/metalurgia` | Metalurgia | "Rastreabilidade de lotes, qualidade" | Feature F6 (rastreabilidade) |
| `/alimentos` | Alimentos | "HACCP compliance, rastreabilidade, validade" | Feature F6 + connector especifico |
| `/textil` | Textil | "Ordens de producao, grade de tamanhos" | Connector especifico |

**Ordem de criacao recomendada**:
1. `/espumas` — imediato (connector SGBR pronto)
2. Landing generica — para todos os outros segmentos (funciona com connector generico/CSV)
3. Demais — conforme connectors e features forem implementados

Cada pagina:
- Mesmo layout da landing principal
- Hero com screenshot do sistema configurado para aquele segmento
- Depoimento de cliente do segmento (coletar na Beta)
- FAQ especifico
- SEO keywords do segmento

---

## Social Proof — O que mostrar em cada fase

### Fase 1: Pre-lancamento (sem clientes SaaS)

Usar **metricas de produto**, nao de volume de dados de um unico cliente:

| Metrica | Como mostrar | Por que funciona |
|---|---|---|
| Modulos | "9 modulos integrados" | Mostra completude do produto |
| Setup | "Setup em 10 minutos" | Remove objecao de complexidade |
| Seguranca | "Criptografia AES-256 + LGPD" | Inspira confianca |
| Integracao | "Conecta a qualquer API REST" | Mostra flexibilidade |
| IA | "Copilot IA integrado" | Diferenciador |
| Disponibilidade | "100% na nuvem, sem instalacao" | Diferenciador vs desktop |

### Fase 2: Beta Fechada (5-10 clientes)

Coletar depoimentos reais dos clientes beta. Script de coleta:
1. Apos 30 dias de uso, enviar email pedindo feedback (3 perguntas)
2. Pedir permissao para usar nome + cargo + empresa
3. Priorizar depoimentos que mencionam **tempo economizado** ou **decisoes melhores**

### Fase 3: GA (50+ clientes)

- Counter animado: "X empresas confiam no IGA"
- Logos de clientes (com permissao)
- Case studies: 1-2 paginas detalhadas com metricas de impacto

---

## Video Demo — Roteiro

**Duracao**: 2 minutos | **Formato**: screencast com voiceover | **Ferramenta**: Loom ou OBS

```
0:00-0:10  Hook: "Voce tem um ERP. Mas sabe o que seus dados dizem?"
0:10-0:25  Problema: mostrar planilha confusa → transicao para dashboard IGA
0:25-0:50  Dashboard: navegar pelas metricas, mostrar dark mode premium
0:50-1:10  Modulos: click rapido em Producao, Estoque, Financeiro (3 seg cada)
1:10-1:30  Copilot: digitar pergunta natural, IA responde com dados reais
1:30-1:45  Setup: mostrar tela de onboarding, "10 minutos e esta pronto"
1:45-2:00  CTA: "Teste gratis 14 dias. Sem cartao. igagestao.com.br"
```

**Dicas**:
- Gravar com dados mockados realistas (nao dados vazios)
- Dark mode para transmitir modernidade
- Musica de fundo: instrumental suave, sem voz (evitar distraction)
- Thumbnail: screenshot do dashboard com play button overlay

---

## Checklist de Lancamento da Landing Page

### Pre-lancamento
- [ ] Dominio `igagestao.com.br` registrado
- [ ] Hosting configurado (Vercel)
- [ ] SSL ativo (A+ no SSL Labs)
- [ ] Google Search Console verificado
- [ ] Sitemap.xml gerado e submetido
- [ ] robots.txt configurado
- [ ] favicon + apple-touch-icon
- [ ] Open Graph image (1200x630)

### Conteudo
- [ ] Textos revisados por nativo (sem erros de portugues)
- [ ] Screenshots atualizados do sistema v1.2.0
- [ ] Video demo gravado e hospedado (YouTube ou Vimeo)
- [ ] FAQ com 6+ perguntas
- [ ] Termos de uso e privacidade linkados

### Tecnico
- [ ] Lighthouse 95+ Performance
- [ ] Lighthouse 100 Accessibility
- [ ] Lighthouse 100 SEO
- [ ] Responsivo testado: iPhone SE, iPhone 14, iPad, Desktop
- [ ] Dark mode only (consistencia com produto)
- [ ] Analytics (GA4 + Hotjar) configurados
- [ ] Formulario de lead testado end-to-end
- [ ] WhatsApp button com link correto
- [ ] Retargeting pixels instalados

### Marketing
- [ ] 3 artigos SEO publicados no blog
- [ ] Post de lancamento no LinkedIn
- [ ] Google Meu Negocio configurado (se aplicavel)
- [ ] Email de lancamento para lista de contatos
