# Load tests (k6)

Smoke + load + spike profiles para o backend IGA.

## Setup

Instalar k6:

```bash
# macOS
brew install k6

# Windows
choco install k6
# ou: winget install k6 --source winget

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Rodar

```bash
# Smoke (5 VU por 1 min) — usar contra dev/local sem medo
k6 run tests/load/baseline.js

# Load (50 VU por 2 min) — usar contra staging
STAGE=load BASE_URL=https://api-staging.igagestao.com.br k6 run tests/load/baseline.js

# Spike (200 VU por 30s) — testar capacidade de pico
STAGE=spike k6 run tests/load/baseline.js
```

## Targets esperados

- `http_req_failed`: < 1%
- `http_req_duration p(95)`: < 500ms
- `http_req_duration p(99)`: < 1500ms

## Producao

NAO rodar STAGE=load ou STAGE=spike contra producao sem aviso ao time SRE e
janela de manutencao acordada. Use sempre staging primeiro.

## Roadmap

- [ ] Adicionar autenticacao no script para testar endpoints autenticados
- [ ] Cenario authenticated: dashboard + datasource list
- [ ] CI: rodar smoke profile em PRs que tocam codigo do backend
