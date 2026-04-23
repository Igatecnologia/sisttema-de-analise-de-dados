# Segurança do frontend

## Cookies HttpOnly e tokens (plano)

**Estado atual:** o token e a sessão ficam em `localStorage` (`src/auth/authStorage.ts`). Qualquer XSS no mesmo origin pode ler esses dados.

**Objetivo:** quando a API suportar, preferir autenticação baseada em **cookies `HttpOnly` + `Secure` + `SameSite`** (e, se aplicável, refresh com rotação), com o frontend a usar `credentials: 'include'` nas chamadas e **sem** guardar o JWT em JS.

**Passos típicos (com backend):**

1. Login passa a devolver `Set-Cookie` em vez de (ou além de) JSON com token.
2. CORS: `Access-Control-Allow-Credentials: true` e origem explícita (não `*`).
3. Axios/fetch: `withCredentials: true` só para o domínio da API.
4. Remover persistência do token em `localStorage` e ajustar `createAuthorizedAxios` / interceptors.
5. Rever logout no servidor (invalidar cookie/sessão).

Até lá, reduzir superfície XSS (CSP, sem `dangerouslySetInnerHTML`, dependências atualizadas) é a principal compensação no frontend.

## CSP e XSS

**Headers:** `vercel.json` e `netlify.toml` definem CSP e headers irmãos (`X-Frame-Options`, `Referrer-Policy`, etc.). `style-src` inclui `'unsafe-inline'` por compatibilidade com Ant Design — endurecer exigiria hashes ou refatoração de estilos.

**Checklist de revisão:**

- Não introduzir HTML cru de utilizador sem sanitização (DOMPurify ou equivalente).
- Evitar `eval`, `new Function`, `innerHTML` com dados não confiáveis.
- Revisar integrações de terceiros (scripts, iframes) antes de alargar `script-src` / `frame-src`.
- Opcional: restringir `connect-src` a hosts concretos da API em produção (hoje permite `https:` em geral por flexibilidade do SGBR).

## Exportação de Excel

- **Estado atual:** exportação `.xlsx` no frontend usa `exceljs` (sem advisories ativos no `npm audit` atual).
- **Contexto de risco:** continuamos a gerar ficheiros localmente no browser; não existe parser de Excel enviado por utilizador neste fluxo.
- **Ação contínua:** manter `npm audit` no CI e monitorizar advisories de dependências de exportação.

## Redirecionamento pós-login

O destino após login é validado com `sanitizeAppRedirectPath` (`src/utils/sanitizeAppRedirectPath.ts`) para permitir apenas caminhos internos da SPA e evitar redirecionamentos abertos.

## Build de produção vs mocks

- **`.env.production`** (no repositório) força `VITE_USE_MOCKS=false`, para o `vite build` não herdar MSW do `.env` local.
- **`vite build`** ainda **falha** se, após o merge de envs, `VITE_USE_MOCKS=true` ou `VITE_AUTH_BACKEND=mock` (ver `vite.config.ts`) — por exemplo CI que exporta essas variáveis ou `VITE_AUTH_BACKEND=mock` apenas no `.env` (use `.env.local` para flags só de desenvolvimento).
- **E2E:** usar `npm run build:e2e`, que aplica `--mode e2e` e o ficheiro **`.env.e2e`** (MSW + mock auth explícitos).
- Em CI de deploy “real”, fixar `VITE_USE_MOCKS=false` no workflow (ex.: GitHub Pages) como camada extra.
