# Instalador Windows (.exe) — IGA Gestão

Gera um instalador `IgaGestao-Setup-1.0.0.exe` que:

- Instala em `C:\Program Files\IgaGestao\`
- Coloca dados em `C:\ProgramData\IgaGestao\data\` (preservados na desinstalação)
- Cria atalhos no **Menu Iniciar** e (opcional) área de trabalho
- Registra serviço Windows `IgaGestao` (opcional, inicia no boot)
- Verifica Node.js 20+ antes de instalar

## Pré-requisitos na máquina de build

1. **Inno Setup 6** — https://jrsoftware.org/isdl.php
   Após instalar, verifique que `iscc.exe` está no `PATH`:
   ```bat
   iscc /?
   ```
2. **NSSM (64-bit)** — https://nssm.cc/download
   Baixe o zip, extraia `win64/nssm.exe` e coloque em:
   ```
   installer/nssm/nssm.exe
   ```
3. **Build de distribuição** já gerado:
   ```bat
   cd ..
   build-windows.bat
   ```
   Isso cria `dist-windows/` que o instalador empacota.

## Construir o instalador

Na pasta `installer/`:

```bat
iscc installer.iss
```

Ou use o atalho na raiz:

```bat
cd ..
build-installer.bat
```

O `.exe` é gerado em `installer/output/IgaGestao-Setup-1.0.0.exe`.

## O que o instalador faz

1. **Pré-check**: verifica se `node.exe` existe no registro do Windows (HKLM Node.js). Se não, oferece abrir a página de download e cancela.
2. **Copia arquivos**:
   - Backend + frontend → `C:\Program Files\IgaGestao\`
   - NSSM → `C:\Program Files\IgaGestao\tools\nssm.exe`
   - Dados iniciais (users.json, datasources.json) → `C:\ProgramData\IgaGestao\data\` (só se ainda não existirem)
3. **Atalhos**: Menu Iniciar sempre; área de trabalho e serviço são opcionais nos checkboxes.
4. **Serviço Windows** (se marcado):
   - `nssm install IgaGestao <node.exe> dist\server.js`
   - Working dir: `C:\Program Files\IgaGestao\back-end-gest-o`
   - Env: `NODE_ENV=production` e `IGA_DATA_DIR=C:\ProgramData\IgaGestao\data`
   - Logs: `C:\ProgramData\IgaGestao\logs\out.log` e `err.log`
   - Start: automático no boot
5. **Pós-instalação**: abre `http://localhost:3001` no navegador.

## Desinstalar

Pelo Painel de Controle → Programas e Recursos → "IGA Gestão" → Desinstalar.

- Para o serviço antes de remover (`nssm stop` + `nssm remove`).
- Pergunta se quer **preservar os dados** em `C:\ProgramData\IgaGestao\` (escolha Não para reinstalação futura).

## Atualizar para nova versão

1. Incremente `MyAppVersion` em `installer.iss`.
2. Gere nova build: `build-windows.bat` + `build-installer.bat`.
3. Rode o novo `.exe` na máquina destino — Inno Setup detecta versão anterior via `AppId` e sobrescreve binários preservando `ProgramData`.

## Troubleshooting

| Sintoma | Solução |
|---|---|
| `iscc não é reconhecido` | Instalar Inno Setup 6 e garantir que a pasta dele esteja no PATH. |
| `Cannot find nssm.exe` ao compilar | Baixar NSSM e colocar em `installer/nssm/nssm.exe`. |
| Serviço não inicia após install | Checar logs em `C:\ProgramData\IgaGestao\logs\err.log` e se Node.js ≥20 está no PATH do sistema. |
| Porta 3001 ocupada | Editar `C:\Program Files\IgaGestao\back-end-gest-o\.env`, mudar `PORT=`, reiniciar serviço. |

## Assinatura digital (opcional)

Para assinar o `.exe` (evita alerta "desconhecido" do SmartScreen):

```bat
signtool sign /t http://timestamp.digicert.com /fd sha256 /a output\IgaGestao-Setup-1.0.0.exe
```

Requer certificado de code signing (EV recomendado).
