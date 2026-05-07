# Organizacao do Projeto

Este repositorio funciona como um workspace com dois apps e uma camada de orquestracao na raiz.

## Raiz

Arquivos da raiz pertencem ao ambiente completo, nao a um app isolado:

- `.github/workflows/ci.yml`: CI do workspace inteiro.
- `.dockerignore`: contexto Docker do workspace inteiro.
- `Dockerfile`: imagem multi-stage que builda backend e frontend para deploy tudo-em-um.
- `docker-compose.yml`: ambiente local completo com PostgreSQL, Redis, backend e frontend.
- `Makefile` e `package.json`: atalhos para comandos cross-project.
- `render.yaml`: deploy atual tudo-em-um.
- `PLANO-SAAS.md`: roadmap SaaS.
- `BRANCH_STRATEGY.md`: estrategia de branches.

## Backend

`back-end-gest-o/` contem somente codigo e configuracao especifica da API:

- `src/`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `.env.example`

## Frontend

`front-end-gest-o/` contem somente codigo e configuracao especifica da SPA:

- `src/`
- `public/`
- `tests/`
- `package.json`
- `vite.config.ts`
- `playwright.config.ts`
- `.env.example`

## Regra de organizacao

Se o arquivo coordena backend + frontend, fica na raiz. Se pertence a apenas um app, fica dentro da pasta desse app.
