# `.claude/` — Configuração Claude Code do IGA Gestão

Esta pasta é **versionada** (entra no git). Contém:

- `settings.json` — permissões e config compartilhada com o time
- `skills/` — skills locais ao projeto (carregam automaticamente quando relevante)
- `settings.local.json` — config pessoal (env vars, API keys) — **gitignored**

## Skills disponíveis

| Skill | Quando ativa |
|-------|-------------|
| `iga-multi-tenant` | RLS Postgres, segments, TenantContext, RBAC |
| `iga-connectors` | ERPs (SGBR/Bling/Tiny/Omie), proxy, datasources, field mappings |
| `iga-billing-stripe` | Checkout, webhook, portal, subscription gate, plan limits |
| `iga-deploy` | render.yaml, env vars de produção, runbooks, troubleshooting |
| `iga-copilot` | Orchestrator IA, 18 tools, Zod validation, plano migração Python |

Skills são carregadas via `description` matching pelo Claude. Não precisa importar manualmente.

## MCP Servers

`.mcp.json` na raiz do projeto define servidores MCP que viajam com o repo:

- **Context7** (`@upstash/context7-mcp`) — docs ao vivo de libs (React, Drizzle, AntD, TanStack Query, etc). Sem API key (free tier).

Para adicionar API key do Context7 e outros secrets, crie `.claude/settings.local.json`:

```json
{
  "env": {
    "CONTEXT7_API_KEY": "sua_key_aqui"
  }
}
```

> Esse arquivo é **gitignored**. Cada dev tem o seu.

## Como adicionar nova skill

```bash
mkdir -p .claude/skills/iga-NOVA-SKILL
cat > .claude/skills/iga-NOVA-SKILL/SKILL.md <<'EOF'
---
name: iga-nova-skill
description: Descrição do que ela cobre — Claude usa isso para decidir quando ativar. Use ao mexer em X, Y, Z.
---

# Conteúdo da skill em markdown
...
EOF
```

Depois commit e push — toda a equipe ganha.

## Referências

- [Skills docs](https://code.claude.com/docs/en/skills.md)
- [MCP Servers docs](https://code.claude.com/docs/en/mcp-servers.md)
- [Settings docs](https://code.claude.com/docs/en/settings.md)
- [Context7 GitHub](https://github.com/upstash/context7)
