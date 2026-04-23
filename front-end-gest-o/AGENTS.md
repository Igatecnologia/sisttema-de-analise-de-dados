# Guia do agente (frontend)

O mapa **completo** do monorepo (front + back, SGBR, problemas conhecidos, runbook) está na raiz do workspace:

**`../AGENTS.md`**

Use esse arquivo como referência principal para qualquer IA/agente trabalhando neste sistema.

---

## Específico do front-end

- **Stack:** React, Vite, TypeScript, Ant Design, React Router, TanStack Query, Axios.
- **Entrada:** `src/main.tsx`, rotas `src/routes/AppRouter.tsx`, layout `src/layouts/AppLayout.tsx`.
- **API:** serviços em `src/services/`; base URL em `src/api/apiEnv.ts` (`VITE_API_BASE_URL` sem `/api/v1` no final).

Para convenções de pastas e checklist de UI, veja a seção de estrutura em `../AGENTS.md`.
