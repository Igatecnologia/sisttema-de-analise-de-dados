# Contributing — IGA Gestao

Obrigado pelo interesse em contribuir. Este guia mantem qualidade do codigo
e velocidade de entrega.

## Setup local

1. **Pre-requisitos**: Node 22+ (`.nvmrc`), Docker, Python 3.12+ (uv) — apenas se for tocar `services/ai/`.
2. Clone e instale:
   ```bash
   git clone https://github.com/Igatecnologia/iga-gestao.git
   cd iga-gestao
   npm install                  # instala todos workspaces via turborepo
   ```
3. Suba o stack:
   ```bash
   npm run dev                  # docker compose (sem iga-ai)
   npm run dev:ai               # com iga-ai
   ```

## Branch workflow

- `master` (default): producao. Protegido — apenas via PR.
- `develop`: integracao de features (opcional para fluxos curtos).
- `feature/*`: trabalho incremental. Branchs curtas (< 5 dias).
- `fix/*`: correcoes pontuais.
- `hotfix/*`: producao urgente.

## Commits

Seguimos **Conventional Commits**:

```
feat(api): add billing portal endpoint
fix(web): corrigir loop infinito no dashboard
chore(deps): bump axios 1.6 -> 1.7
docs: update README quickstart
test: cobrir cenarios de RLS no Postgres
refactor(ai): extrair tool registry
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

## Pull Requests

1. Use o template (`.github/PULL_REQUEST_TEMPLATE.md`) — ele aparece automaticamente.
2. CI precisa estar **verde** antes de merge.
3. Review obrigatoria: ao menos 1 aprovacao.
4. Squash merge na master (preserva historia limpa).

## Padrao de codigo

### TypeScript (services/api, apps/*)
- ESLint flat config + `tsc --strict`
- Sem `any` — use `unknown` + narrowing
- Async/await, never `.then()`
- Zod para validacao de input externo
- React 19: deixar React Compiler otimizar (sem `useMemo/useCallback` manuais)

### Python (services/ai)
- ruff (lint + format)
- mypy --strict
- pytest async com `pytest-asyncio`
- Pydantic v2 para todos os modelos

### Geral
- Naming pt-BR para domain entities (Tenant, Fontes), en-US para tecnico (Provider, Service)
- Comentarios apenas para "porque" — nao "o que"
- Sem TODOs sem owner+data

## Testes

Codigo novo precisa de teste:
- **Backend**: vitest unit + RLS scenarios em `services/api/src/db/postgresRls.test.ts`
- **Frontend**: vitest + Testing Library, e2e Playwright para fluxos criticos
- **AI service**: pytest unit + eval suite (`services/ai/iga_ai/eval/cases.yaml`)

Rodar:
```bash
npm run test                    # todos workspaces (turbo)
npm run test:e2e                # Playwright
cd services/ai && uv run pytest # Python
```

## Seguranca

- **Nunca** commitar `.env` ou credenciais reais.
- Rotacionar secrets se vazaram (ver `INCIDENT-RESPONSE` na DPIA).
- SAST + SCA + secret scan rodam em CI (`.github/workflows/security.yml`).
- Reportar vulnerabilidade: security@igagestao.com.br (nao abra issue publica).

## Performance

- SLOs em `docs/PERFORMANCE-BUDGET.md` (caso retorne) — ou veja CLAUDE.md "SLOs principais".
- Bundle size: `npm run size:check` em `apps/web`.
- Load test: `npm run test:load` (k6).

## Duvidas

- Tecnicas: abra issue ou Slack #iga-eng.
- Produto: Notion + reuniao semanal.
