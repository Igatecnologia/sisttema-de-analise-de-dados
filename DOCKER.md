# Docker local

O stack local roda tudo no Docker:

- `postgres` em `localhost:5432`
- `redis` em `localhost:6379`
- `backend` em `http://localhost:3000`
- `frontend` em `http://localhost:5173`
- `worker` para jobs em background
- `migrate` aplica as migrations PostgreSQL antes do backend iniciar

## Subir o sistema

```powershell
npm run dev:build
```

Depois acesse:

```text
http://localhost:5173
```

## Comandos úteis

```powershell
npm run dev
npm run logs
npm run dev:down
```

## Banco de dados

O compose usa PostgreSQL por padrão no backend e no worker:

```text
IGA_STORAGE_DRIVER=postgres
DATABASE_URL=postgresql://iga:iga_dev_password@postgres:5432/iga_gestao
REDIS_URL=redis://redis:6379
```

As migrations rodam automaticamente no serviço `migrate` antes de `backend` e `worker`.

Para aplicar migrations manualmente:

```powershell
docker compose run --rm migrate
```

## Saúde

```powershell
docker compose ps
```

Endpoints:

```text
http://localhost:3000/health/live
http://localhost:3000/health/ready
```
