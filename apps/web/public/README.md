# Static assets

## PWA icons

O `manifest.webmanifest` aponta apenas para `favicon.svg` (suportado por
PWA modernos, scaled automaticamente). Funciona em Chrome/Edge/Safari iOS 16+.

### Gerar PNGs reais (recomendado pra produção)

Quando quiser ícones bitmap de melhor qualidade pra app stores e Android antigo:

```bash
npx pwa-asset-generator ./favicon.svg ./apps/web/public \
  --background "#0d0d0d" --padding "10%" \
  --type png --opaque false \
  --favicon false --manifest ./apps/web/public/manifest.webmanifest
```

Vai gerar `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, etc.,
e atualizar o `manifest.webmanifest` com refs corretas.

### apple-touch-icon

Tem fallback no `index.html` (`<link rel="apple-touch-icon" href="/apple-touch-icon.png">`).
Se o arquivo não existir, iOS pega o `favicon.svg`. Pra app store/PWA premium,
gere um 180×180 PNG via comando acima.
