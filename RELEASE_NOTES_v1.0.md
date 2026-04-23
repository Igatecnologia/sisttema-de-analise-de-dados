# Release Notes v1.0

## Destaques

- Navegação por abas com persistência por tenant.
- Segurança reforçada com sessão por cookie HttpOnly, CSP e rate-limit.
- Persistência migrada para SQLite com migração automática de JSON.
- Sistema de alertas em tempo real via SSE com sino no header.
- Busca global por comando (`Ctrl/Cmd + K`) com resultados por categoria.
- Dashboard com widgets de KPI arrastáveis e layout persistido por usuário.
- Copiloto local gratuito com streaming e histórico por usuário.
- Exportações avançadas (PDF/CSV/Excel) com lazy loading.

## Backend

- Novas rotas: `search`, `copilot`, `alerts`, `scheduled-reports`, `user preferences`.
- Tabelas novas em SQLite: `sessions`, `alerts`, `copilot_messages`, `scheduled_reports`.
- Jobs: alertas periódicos e envio de relatórios por e-mail (SMTP).

## Frontend

- Motion/transições e microinterações.
- Command Palette (`cmdk`) e drawer de copiloto.
- Toaster unificado e atalhos globais.
- Persistência de preferências no backend.
