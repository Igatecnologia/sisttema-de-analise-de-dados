# Contributing

## Commit padrão

Use Conventional Commits:

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `test: ...`
- `chore: ...`

## Fluxo recomendado

1. Rode checks locais antes de abrir PR.
2. Mantenha mudanças focadas por escopo.
3. Atualize docs quando alterar comportamento.

## Checks locais

### Frontend

- `npm run lint`
- `npx tsc --noEmit`
- `npm run test:unit`

### Backend

- `npm run lint`
- `npm run build`
- `npm run test`

## Hooks de git (opcional local)

Você pode configurar localmente:

- pre-commit com lint/format
- commit-msg com commitlint

Em ambientes sem setup de root package, execute os checks manualmente.

## Changelog

- Gere/atualize o changelog com `npm run changelog` na raiz.
- O formato segue Keep a Changelog + Conventional Commits.
