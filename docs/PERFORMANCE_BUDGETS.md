# Performance Budgets

## Frontend bundle budgets

- Initial entry chunk (`index-*.js`): **max 400 KB** (raw file size in `dist/assets`)
- PDF export chunk (`vendor-pdf*.js`): **max 260 KB**

Validation command:

```bash
npm --prefix front-end-gest-o run build
npm --prefix front-end-gest-o run size:check
```

## Analyzer

Generate visual stats report:

```bash
npm --prefix front-end-gest-o run build:analyze
```

Output: `front-end-gest-o/dist/stats.html`

## Notes

- PDF and html2canvas-related code should stay lazily loaded.
- Budgets are enforced in CI through `size:check`.
