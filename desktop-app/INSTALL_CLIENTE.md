# Guia de instalação — IGA Gestão Desktop

Olá! Este guia mostra como instalar o **IGA Gestão** no seu computador Windows. Leva cerca de 2 minutos.

---

## 1. Baixe o instalador

Você recebeu o arquivo **`IGA-Gestao-Desktop-Setup.exe`** por e-mail, pendrive ou link. Salve-o na pasta **Downloads**.

---

## 2. Execute o instalador

Dê **duplo clique** em `IGA-Gestao-Desktop-Setup.exe`.

### ⚠ Se aparecer "Windows protegeu seu PC"

O Windows não reconhece o aplicativo ainda — isso é normal em apps novos. Siga estes passos:

1. Clique em **"Mais informações"** (logo abaixo da mensagem).
2. Aparece um botão novo: **"Executar assim mesmo"**.
3. Clique nele — a instalação continua normalmente.

![smartscreen](https://via.placeholder.com/600x300?text=Mais+informações+→+Executar+assim+mesmo)

### ⚠ Se o app fizer "bip" e não abrir nada

Algumas máquinas com Smart App Control (Windows 11) ou política corporativa bloqueiam silenciosamente. Solução em 1 comando:

1. Abra **PowerShell** (botão direito no menu Iniciar → Windows PowerShell).
2. Cole e Enter:

```powershell
Unblock-File -Path "$env:USERPROFILE\Downloads\IGA-Gestao-Desktop-Setup.exe"
```

3. Execute o instalador novamente.

Esse comando remove a "marca de origem da internet" (MOTW) que dispara várias defesas do Windows. É inofensivo — só desbloqueia o arquivo que você baixou.

### ⚠ Se o antivírus bloquear

Alguns antivírus (Avast, AVG, Kaspersky, McAfee) podem mover o instalador para quarentena.

1. Abra o antivírus → **Quarentena** (ou "Histórico de ameaças").
2. Selecione `IGA-Gestao-Desktop-Setup.exe`.
3. Clique em **Restaurar** e confirme **"Adicionar à lista de permitidos"**.
4. Execute novamente o instalador.

---

## 3. Siga o assistente

- Aceite os termos padrão.
- A pasta sugerida é `%LOCALAPPDATA%\Programs\IGA Gestao Desktop` (instalação **por usuário, sem precisar de senha de admin**).
- Marque **"Criar atalho na área de trabalho"** se quiser.
- Clique em **Instalar**.

> Não vai aparecer prompt "Deseja permitir alterações" do Windows — o app não precisa de privilégio administrativo.

Ao fim, marque **"Executar IGA Gestao agora"** e clique **Concluir**.

---

## 4. Primeiro login

Na **primeira vez** que o app abre, ele cria uma conta de administrador com senha aleatória.

**Localize a senha:**

1. Abra a pasta: `C:\Users\<SEU_USUARIO>\AppData\Roaming\IGA Gestao Desktop\data\`
   - Atalho: cole no Explorer → `%APPDATA%\IGA Gestao Desktop\data\`
2. Abra o arquivo **`FIRST_LOGIN.txt`** (com Bloco de Notas).
3. Copie o **e-mail** e a **senha** mostrados.

No app, digite essas credenciais e clique em **Entrar**.

---

## 5. Troque a senha (obrigatório)

Imediatamente após o login, o app abre uma janela **"Troca de senha obrigatória"**. Você não consegue usar o sistema até trocar.

- Digite a **senha atual** (a do arquivo).
- Escolha uma **nova senha** — mínimo 10 caracteres, com letras e números.
- Confirme.

Depois de confirmar, **apague o arquivo `FIRST_LOGIN.txt`** — a senha antiga não serve mais.

---

## 6. Configure suas fontes de dados

No menu lateral, clique em **Fontes de dados**. Adicione suas conexões (SGBR BI, API própria, etc.) usando **+ Nova conexão**.

Após testar, clique em **⋯ → "Aplicar sugestões automáticas"** em cada fonte para preencher mapeamentos automaticamente.

---

## Pronto!

Seu IGA Gestão está no ar. A cada nova versão, você receberá um novo `.exe` de atualização — ele preserva seus dados (contas, fontes, configurações).

---

## Suporte

| Problema | Solução |
|---|---|
| Esqueci a senha | Pode precisar reset pelo suporte — ligue/envie e-mail |
| App não abre | Abra a pasta `%APPDATA%\IGA Gestao Desktop\logs\` e envie o último arquivo `iga-*.log` ao suporte |
| Tela em branco | Feche tudo e reabra. Se persistir, reinicie o computador |
| Porta em uso | Feche outros aplicativos que rodam em segundo plano (Slack, etc.) e reabra |

Suporte técnico: **[insira seu canal aqui — WhatsApp, e-mail, telefone]**
