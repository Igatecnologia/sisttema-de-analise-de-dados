# IGA Gestão Desktop

App desktop Windows que empacota o frontend (React + Vite) e o backend (Node + Express) em uma única janela Electron. Roda em `http://127.0.0.1:<porta>` isolado por usuário (`%APPDATA%\IGA Gestao Desktop\`).

---

## Fluxo de release

Toda vez que houver mudança no frontend **ou** no backend, regere o build desktop.

```powershell
cd "C:\Users\mayke\Desktop\desenvolvimento iga\sistema de gestão\desktop-app"
npm run build:installer
```

Isso produz:

- `desktop-app\release\IGA Gestao-win32-x64\` — pasta executável
- `desktop-app\release\IGA-Gestao-Desktop-Setup.exe` — instalador assinado (se `SignTool` estiver configurado)

O script `build-windows.bat` (chamado pelo `prepare:assets`):

1. Gera o build de frontend (`npm run build` no Vite).
2. Gera o build de backend (`tsc`).
3. Roda `npm prune --omit=dev` no backend antes de copiar `node_modules` — reduz o instalador em ~60%.
4. Sobrescreve `data/users.json` e `data/datasources.json` com `[]` — cliente sempre recebe base limpa.
5. **NÃO copia `.env`** — toda a config de runtime é injetada pelo `main.mjs`.
6. Restaura `devDependencies` no final para não travar o dev local.

---

## Primeiro boot no cliente

1. Usuário executa o `IGA-Gestao-Desktop-Setup.exe`.
2. O app abre e, como `users.json` está vazio, o backend cria um admin com **senha aleatória**.
3. A senha é impressa:
   - No console do Electron (visível só se `IGA_DEVTOOLS=1`).
   - Em `%APPDATA%\IGA Gestao Desktop\data\FIRST_LOGIN.txt` (leitura recomendada).
4. Usuário faz login com as credenciais do arquivo.
5. O frontend detecta `mustChangePassword: true` e abre o modal de troca de senha obrigatória — sem opção de pular.
6. Após trocar, o usuário pode apagar `FIRST_LOGIN.txt`.

Recomendar ao cliente:

> "Abra o arquivo `%APPDATA%\IGA Gestao Desktop\data\FIRST_LOGIN.txt`, use as credenciais para entrar, troque a senha e apague o arquivo."

---

## Variáveis de ambiente opcionais

Definidas no sistema do cliente (Painel de Controle → Variáveis de Ambiente):

| Variável | Efeito |
|---|---|
| `ADMIN_DEFAULT_EMAIL` | E-mail do admin criado no 1º boot. Padrão: `admin@iga.com` |
| `ADMIN_DEFAULT_PASSWORD` | Usa esta senha em vez da aleatória (mínimo 8 chars). Útil em deploy automatizado. |
| `IGA_UPDATE_FEED_URL` | URL de um JSON `{version,url,notes}` — ativa checagem de atualização no startup. |
| `IGA_DEVTOOLS` | `1` para habilitar DevTools (Ctrl+Shift+I) no app de produção. |
| `LOG_JSON_REQUESTS` | `1` para logar cada request como JSON (sem body). |

---

## Robustez em produção

Implementado em `main.mjs`:

- **Single-instance lock** — 2 cliques no ícone focam a janela aberta em vez de subir outro backend.
- **Port fallback** — tenta `3001..3010`; se todas ocupadas, erro claro ao usuário.
- **Logs em arquivo** — `%APPDATA%\IGA Gestao Desktop\logs\iga-YYYY-MM-DD.log` (stdout/stderr do backend + eventos do Electron). Usuário pode abrir direto pelo botão "Abrir pasta de logs" no dialog de erro fatal.
- **Health check estrito** — só aceita HTTP 200 do backend; status 503/500 é tratado como falha.
- **Sem DevTools em produção** — a menos que `IGA_DEVTOOLS=1`.
- **Uncaught exception capture** — qualquer throw não tratado é persistido em log.

---

## Auto-update (opcional)

`updater.mjs` implementa uma verificação leve:

1. Defina `IGA_UPDATE_FEED_URL=https://seu-servidor/iga-latest.json` no cliente.
2. O JSON deve ter o formato:
   ```json
   { "version": "1.1.0", "url": "https://seu-servidor/IGA-Gestao-Desktop-Setup.exe", "notes": "..." }
   ```
3. Se a versão instalada for menor, aparece diálogo sugerindo download. Atualização ainda é **manual** (abre o link no navegador). Para full auto-update com delta binário, migrar para `electron-updater` + release server (GitHub Releases ou CDN próprio).

---

## Distribuição sem certificado

O instalador é entregue **não-assinado**. Isso é perfeitamente funcional, mas o Windows exibe um aviso na primeira execução. Envie o **guia do cliente** (`INSTALL_CLIENTE.md`) junto com o `.exe` para reduzir atrito.

### O que o cliente vai ver (e como passar)

1. Ao executar `IGA-Gestao-Desktop-Setup.exe`, aparece:
   > **Windows protegeu seu PC**
   > O Microsoft Defender SmartScreen impediu a inicialização…
2. Cliente clica em **"Mais informações"**.
3. Aparece um botão novo: **"Executar assim mesmo"** → instala normalmente.

### Caso antivírus bloqueie

Alguns AVs (Avast, AVG, Kaspersky) podem quarantenar o `.exe` por reputação baixa. Instruções ao cliente:

1. Abrir o antivírus → Quarentena.
2. Restaurar `IGA-Gestao-Desktop-Setup.exe` e adicionar à lista de exceções.
3. Executar novamente.

Se precisar eliminar de vez esse atrito, contratar certificado de code signing (Sectigo, DigiCert, etc.). Sem isso, cada versão começa "com reputação zero" no SmartScreen — funcional, só com 2 cliques a mais no primeiro download.

---

## Desinstalação

- O instalador pergunta ao desinstalar: **"Remover também os dados do usuário?"** (default Não).
- Se o cliente responder Não, `%APPDATA%\IGA Gestao Desktop\` fica intacto — reinstalação preserva usuários e fontes.

---

## Troubleshooting

| Sintoma | Onde olhar |
|---|---|
| App abre e fecha | `%APPDATA%\IGA Gestao Desktop\logs\iga-*.log` |
| "Nenhuma porta livre" | Reboot ou fechar outros Electron apps; checar portas 3001-3010 |
| Login diz "usuário ou senha incorretos" | Ler `FIRST_LOGIN.txt` — senha inicial é gerada automaticamente |
| Dashboard vazio | Menu **Fontes de dados** → **⋯ → Aplicar sugestões automáticas** em cada fonte |
| SmartScreen bloqueia | Assinar o `.exe` (ver seção acima) ou cliente clica "Mais informações → Executar assim mesmo" |
