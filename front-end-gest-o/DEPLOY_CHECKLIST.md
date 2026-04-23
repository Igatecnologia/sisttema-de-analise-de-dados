# Deploy Checklist Automatizado

## Pré-deploy
- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run build`

## Qualidade E2E
- [ ] Instalar browsers: `npx playwright install chromium`
- [ ] `npm run test:e2e`
- [ ] Validar fluxo de login + navegação + RBAC + CRUD

## Segurança
- [ ] Confirmar CSP/headers em `vercel.json` e `netlify.toml`
- [ ] Confirmar ausência de segredos no build (`.env`, tokens, chaves)
- [ ] Revisar permissões de rotas e ações críticas (RBAC)

## Publicação
- [ ] Deploy em preview/staging
- [ ] Smoke test manual em staging
- [ ] Aprovação para produção
- [ ] Deploy produção

### GitHub Pages (só se estiver em uso)
- [ ] Tratar como **pré-visualização temporária** para cliente ver o front (não é produção oficial).
- [ ] Quando houver staging/produção definitivos (Vercel/Netlify), **desativar Pages** ou parar de usar o workflow, se acordado.

## Pós-deploy
- [ ] Verificar logs de erro iniciais
- [ ] Verificar monitoramento de latência das páginas críticas
- [ ] Confirmar funcionamento de exports e relatórios
